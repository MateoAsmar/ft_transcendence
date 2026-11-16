import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import crypto from 'crypto';
import { getDatabase } from '../lib';

const db = getDatabase();

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
  id_token: string;
}

interface GoogleUserInfo {
  id?: string;
  sub?: string;
  email: string;
  name: string;
  given_name?: string;
  family_name?: string;
  picture: string;
  verified_email?: boolean;
  email_verified?: boolean;
}

const stripTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const generateUniqueUsername = (displayName: string): string => {
  const base = displayName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'player';
  let username = base;
  let counter = 1;

  while (true) {
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (!existing) return username;
    username = `${base}${counter}`;
    counter++;
  }
};

const resolvePublicBackendUrl = (proto: string, host: string): string => {
  const override = process.env.PUBLIC_BACKEND_URL;
  if (override) {
    return stripTrailingSlash(override);
  }

  return `${proto}://${host}`;
};

const resolvePublicFrontendUrl = (backendUrl: string): string => {
  const override = process.env.PUBLIC_FRONTEND_URL || process.env.FRONTEND_URL;
  if (override) {
    return stripTrailingSlash(override);
  }
  return 'http://localhost:5173';
};

// Public URL resolution helpers allow overriding the host used for OAuth redirects.

export default async function oauthRoutes(app: FastifyInstance) {
  app.get('/oauth/google', async (request: FastifyRequest, reply: FastifyReply) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return reply.status(400).send({ error: 'Google OAuth login is not available' });
    }

    const state = crypto.randomBytes(32).toString('hex');
    const proto = (request.headers['x-forwarded-proto'] as string) || request.protocol;
    const host = (request.headers['x-forwarded-host'] as string) || (request.headers.host as string);
    const backendUrl = resolvePublicBackendUrl(proto, host);
    const referer = (request.headers.referer as string) || resolvePublicFrontendUrl(backendUrl);

    reply.setCookie('oauth_state', state, {
      httpOnly: true,
      secure: proto === 'https',
      sameSite: 'lax',
      maxAge: 600,
      path: '/'
    });

    // Store the original host to redirect back after OAuth
    reply.setCookie('oauth_ref', referer, {
      httpOnly: true,
      secure: proto === 'https',
      sameSite: 'lax',
      maxAge: 600,
      path: '/'
    });

    // Use the resolved backend URL (env override or request host)
    const redirectUri = `${backendUrl}/api/oauth/google/callback`;
    
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid profile email',
      state,
      access_type: 'offline',
      prompt: 'consent'
    });

    return reply.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  });

  app.get('/oauth/google/callback', async (request: FastifyRequest, reply: FastifyReply) => {
    const { code, state } = request.query as { code?: string; state?: string };
    const storedState = request.cookies.oauth_state;
    const referer = request.cookies.oauth_ref as string | undefined;
    const proto = (request.headers['x-forwarded-proto'] as string) || request.protocol;
    const host = (request.headers['x-forwarded-host'] as string) || (request.headers.host as string);
    const backendUrl = resolvePublicBackendUrl(proto, host);

    if (!code || !state || state !== storedState) {
      const fallback = referer || resolvePublicFrontendUrl(backendUrl);
      return reply.redirect(`${fallback}/login?error=oauth_failed`);
    }

    reply.clearCookie('oauth_state', { path: '/' });
    reply.clearCookie('oauth_ref', { path: '/' });

    try {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      
      // Use the resolved backend URL for the redirect URI (matches what we sent to Google)
      const redirectUri = `${backendUrl}/api/oauth/google/callback`;

      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId ?? '',
          client_secret: clientSecret ?? '',
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri
        })
      });

      const tokenData: GoogleTokenResponse = await tokenResponse.json();
      if (!tokenResponse.ok) {
        app.log.error({ tokenData }, 'Google token exchange failed');
        const fallback = referer || resolvePublicFrontendUrl(backendUrl);
        return reply.redirect(`${fallback}/login?error=oauth_failed`);
      }

      const userResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });

      const userData: GoogleUserInfo = await userResponse.json();
      const emailVerified = (userData.verified_email ?? userData.email_verified) === true;
      if (!userResponse.ok || !emailVerified) {
        app.log.error({ userData }, 'Google user info retrieval failed');
        const fallback = referer || resolvePublicFrontendUrl(backendUrl);
        return reply.redirect(`${fallback}/login?error=email_not_verified`);
      }

      const googleId = userData.id || userData.sub;
      let user = db.prepare('SELECT * FROM users WHERE email = ?').get(userData.email) as any;

      if (user) {
        if (!user.google_id) {
          db.prepare('UPDATE users SET google_id = ?, display_name = ? WHERE id = ?')
            .run(googleId, userData.name, user.id);
        }
      } else {
        const username = generateUniqueUsername(userData.name);
        const result = db.prepare(`
          INSERT INTO users (username, email, password_hash, google_id, display_name, avatar_url, auth_provider, oauth_avatar_url)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          username,
          userData.email,
          '',
          googleId,
          userData.name,
          userData.picture,
          'google',
          userData.picture
        );

        user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);

        db.prepare(`
          INSERT INTO user_stats (user_id, total_games, wins, losses)
          VALUES (?, 0, 0, 0)
        `).run(user.id);
      }

      const token = app.jwt.sign(
        {
          userId: user.id,
          username: user.username,
          email: user.email,
          displayName: user.display_name
        },
        { expiresIn: '24h' }
      );

      reply.setCookie('auth_token', token, {
        httpOnly: true,
        secure: proto === 'https',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24
      });

      // Redirect to the original frontend URL
      const targetFront = referer || resolvePublicFrontendUrl(backendUrl);
      return reply.redirect(`${targetFront}/dashboard`);
    } catch (error) {
      app.log.error({ err: error }, 'OAuth callback error');
      const fallback = referer || resolvePublicFrontendUrl(backendUrl);
      return reply.redirect(`${fallback}/login?error=oauth_failed`);
    }
  });
}
