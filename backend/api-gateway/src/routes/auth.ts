import {
  FastifyInstance,
  FastifyReply,
  FastifyRequest
} from 'fastify';
import bcrypt from 'bcryptjs';
import validator from 'validator';
import speakeasy from 'speakeasy';
import {
  getKafkaProducer,
  getDatabase,
  Topics,
  type ProfileEvent
} from '../lib';
import { sendOTPEmail, generateOTP } from '../services/email';

interface RegisterBody {
  email: string;
  password: string;
  username: string;
  display_name?: string;
}

interface LoginBody {
  username: string;
  password: string;
}

interface VerifyBody {
  tempToken: string;
  code: string;
}

// In-memory OTP store: userId -> { otp, expiresAt }
const otpStore = new Map<number, { otp: string; expiresAt: number }>();

declare module 'fastify' {
  interface FastifyRequest {
    userContext?: {
      userId: number;
      username: string;
    };
  }
}

export default async function authRoutes(app: FastifyInstance) {
  const db = getDatabase();
  let kafkaProducer = await initKafkaProducer(app);

  app.addHook('onClose', async () => {
    if (kafkaProducer) {
      await kafkaProducer.disconnect();
      kafkaProducer = null;
    }
  });

  const emitProfileEvent = async (event: ProfileEvent) => {
    if (!kafkaProducer) {
      kafkaProducer = await initKafkaProducer(app);
    }

    if (!kafkaProducer) {
      app.log.warn('Kafka producer unavailable, skipping profile event');
      return;
    }

    await kafkaProducer.send({
      topic: Topics.ProfileEvents,
      messages: [{
        value: JSON.stringify(event)
      }]
    });
  };

  app.post<{ Body: RegisterBody }>('/register', async (req, reply) => {
    const { email, password, username, display_name } = req.body;

    if (!email) {
      return reply.status(400).send({ error: 'Enter an Email' });
    }

    if (!validator.isEmail(email)) {
      return reply.status(400).send({ error: 'Enter a Valid Email' });
    }

    const existingEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingEmail) {
      return reply.status(400).send({ error: 'Email Already Exists Find Another One :)' });
    }

    if (!password) {
      return reply.status(400).send({ error: 'Enter a Password' });
    }

    if (password.length < 6) {
      return reply.status(400).send({ error: 'Password Must Be 6 or More Characters' });
    }

    if (!username) {
      return reply.status(400).send({ error: 'Enter a Username' });
    }

    const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existingUser) {
      return reply.status(400).send({ error: 'User Already Exists Find Another One :)' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const defaultAvatar = '/uploads/default-avatar.jpg';
    const userDisplayName = display_name || username;

    const result = db.prepare(`
      INSERT INTO users (email, username, password_hash, display_name, avatar_url, auth_provider)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(email, username, hashedPassword, userDisplayName, defaultAvatar, 'manual');

    const userId = Number(result.lastInsertRowid);

    const token = app.jwt.sign({
      userId,
      username,
      email,
      displayName: userDisplayName
    }, { expiresIn: '24h' });

    setAuthCookie(req, reply, token);

    reply.send({
      message: 'Account Created Successfully',
      token,
      user: {
        id: userId,
        username,
        email,
        displayName: userDisplayName
      }
    });

    await emitProfileEvent({
      type: 'profileUpdated',
      userId,
      payload: { action: 'register' },
      emittedAt: new Date().toISOString()
    });
  });

  app.post<{ Body: LoginBody }>('/login', async (req, reply) => {
    const { username, password } = req.body;

    if (!username) {
      return reply.status(400).send({ error: 'Enter a Username' });
    }

    const user = db.prepare(`
      SELECT id, username, email, password_hash, display_name, twofa_enabled
      FROM users WHERE username = ?
    `).get(username) as any;

    if (!user) {
      return reply.status(400).send({ error: 'Username Not Found' });
    }

    if (!password) {
      return reply.status(400).send({ error: 'Password Not Found' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return reply.status(400).send({ error: 'Invalid Credentials' });
    }

    if (user.twofa_enabled) {
      // Generate 6-digit OTP
      const otp = generateOTP();
      const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

      // Console log for debugging
      console.log('='.repeat(60));
      console.log('🔐 2FA OTP Generated');
      console.log('='.repeat(60));
      console.log(`User: ${user.username} (${user.email})`);
      console.log(`OTP Code: ${otp}`);
      console.log(`Expires: ${new Date(expiresAt).toLocaleString()}`);
      console.log('='.repeat(60));

      // Store OTP
      otpStore.set(user.id, { otp, expiresAt });

      // Send OTP via email
      const emailSent = await sendOTPEmail({
        to: user.email,
        username: user.display_name || user.username,
        otp
      });

      if (!emailSent) {
        app.log.error(`Failed to send 2FA email to ${user.email}`);
        console.log(`⚠️  Email sending failed for ${user.email}`);
        // Continue anyway - OTP is stored, user can still verify if they get the email later
      } else {
        console.log(`✅ 2FA email sent successfully to ${user.email}`);
      }

      const tempToken = app.jwt.sign({
        userId: user.id,
        username: user.username,
        partial: true
      }, { expiresIn: '10m' });

      return reply.send({
        message: '2FA code sent to your email',
        tempToken,
        requires2FA: true
      });
    }

    const token = createSessionToken(app, user);
    setAuthCookie(req, reply, token);

    return reply.send({
      message: 'Login Successfully',
      token,
      requires2FA: false
    });
  });

  app.post<{ Body: VerifyBody }>('/verify-2fa', async (req, reply) => {
    const { tempToken, code } = req.body;

    if (!code) {
      return reply.status(400).send({ error: 'Verification code is required' });
    }

    let decoded: any;
    try {
      decoded = app.jwt.verify(tempToken);
    } catch {
      return reply.status(401).send({ error: 'Invalid or expired token' });
    }

    const userId = decoded.userId;
    const user = db.prepare(`
      SELECT id, username, email, display_name
      FROM users WHERE id = ?
    `).get(userId) as any;

    if (!user) {
      return reply.status(400).send({ error: 'User not found' });
    }

    // Check OTP from store
    const storedOTP = otpStore.get(userId);

    if (!storedOTP) {
      return reply.status(400).send({ error: 'No verification code found. Please login again.' });
    }

    // Check if OTP expired
    if (Date.now() > storedOTP.expiresAt) {
      otpStore.delete(userId);
      return reply.status(400).send({ error: 'Verification code expired. Please login again.' });
    }

    // Verify OTP
    if (storedOTP.otp !== code.trim()) {
      return reply.status(400).send({ error: 'Invalid verification code' });
    }

    // OTP is valid - remove it and create session
    otpStore.delete(userId);

    const token = createSessionToken(app, user);
    setAuthCookie(req, reply, token);

    return reply.send({
      message: 'Login Successfully',
      token
    });
  });

  app.post('/logout', async (_req, reply) => {
    reply.clearCookie('auth_token', { path: '/' });
    return reply.send({ message: 'Logged out' });
  });
}

const setAuthCookie = (req: FastifyRequest, reply: FastifyReply, token: string) => {
  const isSecure = (req.headers['x-forwarded-proto'] as string) === 'https';

  reply.setCookie('auth_token', token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24
  });
};

const createSessionToken = (app: FastifyInstance, user: any) => {
  return app.jwt.sign({
    userId: user.id,
    username: user.username,
    email: user.email,
    displayName: user.display_name
  }, { expiresIn: '24h' });
};

const initKafkaProducer = async (app: FastifyInstance) => {
  try {
    return await getKafkaProducer();
  } catch (error) {
    app.log.error({ err: error }, 'Failed to initialize Kafka producer for auth events');
    return null;
  }
};
