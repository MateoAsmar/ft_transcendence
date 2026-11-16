import path from 'path';
import dotenv from 'dotenv';
import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import fastifyCookie from '@fastify/cookie';
import fastifyMultipart from '@fastify/multipart';
import authRoutes from './routes/auth';
import oauthRoutes from './routes/oauth';
import profileRoutes from './routes/profile';
import friendsRoutes from './routes/friends';
import statsRoutes from './routes/stats';
import gameRoutes from './routes/game';
import matchmakingRoutes from './routes/matchmaking';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

declare module 'fastify' {
  interface FastifyInstance {
    verifyUser: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    userContext?: {
      userId: number;
      username: string;
    };
  }
}

const buildServer = () => {
  const app = Fastify({
    logger: true,
  });

  registerPlugins(app);
  registerRoutes(app);

  return app;
};

const registerPlugins = (app: FastifyInstance) => {
  app.register(fastifyCors, {
    origin: true,
    credentials: true,
  });

  app.register(fastifyCookie);

  app.register(fastifyJwt, {
    secret: process.env.JWT_SECRET || 'kakra42',
  });

  app.register(fastifyMultipart, {
    attachFieldsToBody: false,
    limits: {
      fileSize: Number(process.env.UPLOAD_MAX_BYTES || 5 * 1024 * 1024),
      files: 1,
    },
  });

  app.decorate('verifyUser', async function verifyUser(request, reply) {
    const authHeader = request.headers.authorization;
    const cookieToken = (request.cookies as any)?.auth_token as string | undefined;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : cookieToken;

    if (!token) {
      return reply.status(401).send({ error: 'No token provided' });
    }

    try {
      const decoded = this.jwt.verify(token) as any;
      request.userContext = {
        userId: decoded.userId || decoded.user_id,
        username: decoded.username,
      };
    } catch {
      return reply.status(401).send({ error: 'Invalid or expired token' });
    }
  });

  const staticRoot = path.join(__dirname, '../public');
  app.register(fastifyStatic, {
    root: staticRoot,
    wildcard: false,
  });

  const uploadsPath = process.env.NODE_ENV === 'production'
    ? '/uploads'
    : path.join(__dirname, '../../../database/uploads');

  app.register(fastifyStatic, {
    root: uploadsPath,
    prefix: '/uploads/',
    decorateReply: false,
  });
};

const registerRoutes = (app: FastifyInstance) => {
  app.register(authRoutes, { prefix: '/api/auth' });
  app.register(oauthRoutes, { prefix: '/api' });

  app.addHook('preHandler', async (request, reply) => {
    const routeUrl = request.routeOptions?.url;
    if (!routeUrl) {
      return;
    }

    if (routeUrl.startsWith('/api/auth') || routeUrl.startsWith('/api/oauth')) {
      return;
    }
    await app.verifyUser(request, reply);
  });

  app.register(profileRoutes);
  app.register(friendsRoutes);
  app.register(statsRoutes);
  app.register(gameRoutes);
  app.register(matchmakingRoutes);

  app.get('/api/ping', async () => ({ pong: true }));

  app.setNotFoundHandler((_req, reply) => {
    reply.status(404).send({ error: 'Not Found' });
  });
};

const start = async () => {
  const app = buildServer();
  const port = Number(process.env.PORT || 8000);
  const host = process.env.HOST || '0.0.0.0';

  try {
    await app.listen({ port, host });
    app.log.info(`API Gateway listening on ${host}:${port}`);
  } catch (error) {
    app.log.error(error, 'Failed to start API Gateway');
    process.exit(1);
  }
};

start();
