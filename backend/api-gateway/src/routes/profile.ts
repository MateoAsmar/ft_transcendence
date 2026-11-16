import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { profileClient } from '../clients/profileClient';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import { pipeline } from 'stream/promises';
import { getDatabase } from '../lib';

const buildContext = (request: FastifyRequest) => ({
  context: {
    user_id: request.userContext!.userId,
    username: request.userContext!.username,
  },
});

const formatProfile = (profile: any) => ({
  id: profile.id,
  displayname: profile.display_name,
  display_name: profile.display_name, // For backward compatibility
  email: profile.email,
  picture: profile.avatar_url,
  avatar_url: profile.avatar_url, // For backward compatibility
  createdAt: profile.created_at,
  username: profile.username,
  auth_provider: profile.auth_provider,
  oauth_avatar_url: profile.oauth_avatar_url,
  twofa_enabled: profile.twofa_enabled,
});

export default async function profileRoutes(app: FastifyInstance) {
  const db = getDatabase();
  const uploadsRoot = process.env.UPLOADS_DIR || '/uploads';
  const uploadDir = path.join(uploadsRoot, 'avatars');
  const allowedMime = new Set([
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/gif',
    'image/webp',
  ]);
  app.addHook('preHandler', app.verifyUser);

  app.get('/api/profile/me', async (request, reply) => {
    const response = await profileClient.getProfile(buildContext(request));
    reply.send(formatProfile(response.profile));
  });

  app.get('/api/profile/:username', async (request, reply) => {
    const params = request.params as { username: string };
    const username = params.username;

    // Get user ID from username
    const user = db.prepare('SELECT id FROM users WHERE username = ?').get(username) as { id: number } | undefined;

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    const response = await profileClient.getProfile({
      context: {
        user_id: user.id,
        username: username,
      },
    });
    reply.send(formatProfile(response.profile));
  });

  app.get('/api/profile/:username/stats', async (request, reply) => {
    const params = request.params as { username: string };
    const username = params.username;

    // Get user ID from username
    const user = db.prepare('SELECT id FROM users WHERE username = ?').get(username) as { id: number } | undefined;

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    const response = await profileClient.getStats({
      context: {
        user_id: user.id,
        username: username,
      },
    });
    reply.send(response);
  });

  app.get('/api/profile/:username/history', async (request, reply) => {
    const params = request.params as { username: string };
    const username = params.username;
    const query = request.query as { page?: string; limit?: string };
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '10', 10);

    // Get user ID from username
    const user = db.prepare('SELECT id FROM users WHERE username = ?').get(username) as { id: number } | undefined;

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    const response = await profileClient.getHistory({
      context: {
        user_id: user.id,
        username: username,
      },
      page,
      limit,
    });
    reply.send(response);
  });

  app.put('/api/profile/me', async (request, reply) => {
    const body = request.body as { username?: string; display_name?: string };
    const response = await profileClient.updateProfile({
      ...buildContext(request),
      username: body?.username,
      display_name: body?.display_name,
    });
    reply.send({ message: response.message ?? 'Profile updated', success: response.success });
  });

  app.get('/api/profile/history', async (request, reply) => {
    const query = request.query as { page?: string; limit?: string };
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '10', 10);

    const response = await profileClient.getHistory({
      ...buildContext(request),
      page,
      limit,
    });

    console.log('📊 API Gateway received from backend:', JSON.stringify(response, null, 2));

    reply.send(response);
  });

  app.get('/api/profile/stats', async (request, reply) => {
    const response = await profileClient.getStats(buildContext(request));
    reply.send(response);
  });

  app.post('/api/profile/avatar', async (request, reply) => {
    const body = request.body as { avatar_url?: string };
    const response = await profileClient.updateAvatar({
      ...buildContext(request),
      avatar_url: body?.avatar_url,
    });
    reply.send({ message: response.message ?? 'Avatar updated', success: response.success });
  });

  app.post('/api/profile/upload-avatar', async (request, reply) => {
    const user = request.userContext!;

    if (!existsSync(uploadDir)) {
      mkdirSync(uploadDir, { recursive: true });
    }

    const file = await request.file();
    if (!file) {
      return reply.status(400).send({ error: 'No file uploaded' });
    }

    if (!allowedMime.has(file.mimetype)) {
      file.file.resume();
      return reply.status(415).send({ error: 'Unsupported file type' });
    }

    if ((file as any).truncated) {
      file.file.resume();
      return reply.status(413).send({ error: 'File too large' });
    }

    const ext = resolveExtension(file.filename, file.mimetype);
    const filename = `${user.userId}-${Date.now()}-${randomBytes(6).toString('hex')}${ext}`;
    const diskPath = path.join(uploadDir, filename);

    try {
      await pipeline(file.file, createWriteStream(diskPath));
    } catch (error) {
      app.log.error({ err: error }, 'Failed to write uploaded avatar');
      return reply.status(400).send({ error: 'Failed to process upload. Please try again.' });
    }

    const avatarUrl = `/uploads/avatars/${filename}`;
    const update = await profileClient.updateAvatar({
      ...buildContext(request),
      avatar_url: avatarUrl,
    });

    if (!update.success) {
      return reply.status(400).send({ error: update.message ?? 'Failed to update avatar' });
    }

    reply.send({ success: true, avatar_url: avatarUrl });
  });

  app.delete('/api/profile/avatar', async (request, reply) => {
    const response = await profileClient.updateAvatar({
      ...buildContext(request),
      avatar_url: '',
    });

    if (!response.success) {
      return reply.status(400).send({ error: response.message ?? 'Failed to reset avatar' });
    }

    reply.send({ success: true, message: 'Avatar reset successfully' });
  });

  // Simple 2FA toggle endpoint
  app.put('/api/profile/2fa-preference', async (request, reply) => {
    const user = request.userContext!;
    const { twofa_enabled } = (request.body as { twofa_enabled?: boolean }) ?? {};

    if (typeof twofa_enabled !== 'boolean') {
      return reply.status(400).send({ error: 'twofa_enabled must be a boolean' });
    }

    db.prepare('UPDATE users SET twofa_enabled = ? WHERE id = ?')
      .run(twofa_enabled ? 1 : 0, user.userId);

    reply.send({
      success: true,
      twofa_enabled,
    });
  });

  app.post('/api/profile/2fa/setup', async (request, reply) => {
    const user = request.userContext!;
    const secret = speakeasy.generateSecret({
      name: `Transcendence (${user.username})`,
    });

    await db
      .prepare('UPDATE users SET twofa_secret = ?, twofa_enabled = 0 WHERE id = ?')
      .run(secret.base32, user.userId);

    const qrCode = await QRCode.toDataURL(secret.otpauth_url || '');

    reply.send({
      secret: secret.base32,
      qrCode,
      manualEntry: secret.base32,
    });
  });

  app.post('/api/profile/2fa/enable', async (request, reply) => {
    const user = request.userContext!;
    const { token } = (request.body as { token?: string }) ?? {};

    if (!token) {
      return reply.status(400).send({ error: 'Token is required' });
    }

    const record = db
      .prepare('SELECT twofa_secret FROM users WHERE id = ?')
      .get(user.userId) as { twofa_secret?: string } | undefined;

    if (!record?.twofa_secret) {
      return reply
        .status(400)
        .send({ error: '2FA setup not initiated. Please setup 2FA first.' });
    }

    const verified = speakeasy.totp.verify({
      secret: record.twofa_secret,
      encoding: 'base32',
      token,
      window: 2,
    });

    if (!verified) {
      return reply.status(400).send({ error: 'Invalid token. Please try again.' });
    }

    db.prepare('UPDATE users SET twofa_enabled = 1 WHERE id = ?').run(user.userId);

    reply.send({
      message: '2FA enabled successfully',
      twofa_enabled: true,
    });
  });

  app.post('/api/profile/2fa/disable', async (request, reply) => {
    const user = request.userContext!;
    const { token } = (request.body as { token?: string }) ?? {};

    if (!token) {
      return reply.status(400).send({ error: 'Token is required to disable 2FA' });
    }

    const record = db
      .prepare('SELECT twofa_secret, twofa_enabled FROM users WHERE id = ?')
      .get(user.userId) as { twofa_secret?: string; twofa_enabled?: number } | undefined;

    if (!record) {
      return reply.status(404).send({ error: 'User not found' });
    }

    if (!record.twofa_enabled) {
      return reply.status(400).send({ error: '2FA is not enabled' });
    }

    const verified = speakeasy.totp.verify({
      secret: record.twofa_secret!,
      encoding: 'base32',
      token,
      window: 2,
    });

    if (!verified) {
      return reply.status(400).send({ error: 'Invalid token. Cannot disable 2FA.' });
    }

    db.prepare('UPDATE users SET twofa_enabled = 0, twofa_secret = NULL WHERE id = ?')
      .run(user.userId);

    reply.send({
      message: '2FA disabled successfully',
      twofa_enabled: false,
    });
  });

  app.delete('/api/profile/delete-account', async (request, reply) => {
    const response = await profileClient.deleteAccount(buildContext(request));
    reply.send({ message: response.message, success: response.success });
  });

  app.post('/api/profile/anonymize', async (request, reply) => {
    const response = await profileClient.anonymizeAccount(buildContext(request));
    reply.send({ message: response.message, success: response.success });
  });

  app.get('/api/profile/export-data', async (request, reply) => {
    const response = await profileClient.exportUserData(buildContext(request));
    const data = JSON.parse(response.data_json);
    reply
      .header('Content-Type', 'application/json')
      .header('Content-Disposition', 'attachment; filename="my-data.json"')
      .send(data);
  });
}

const resolveExtension = (originalName: string | undefined, mime: string) => {
  const ext = originalName ? path.extname(originalName) : '';
  if (ext) {
    return ext;
  }

  switch (mime) {
    case 'image/png':
      return '.png';
    case 'image/jpeg':
    case 'image/jpg':
      return '.jpg';
    case 'image/gif':
      return '.gif';
    case 'image/webp':
      return '.webp';
    default:
      return '';
  }
};
