import type { FastifyInstance, FastifyRequest } from 'fastify';
import { matchmakingClient } from '../clients/matchmakingClient';

const ctx = (request: FastifyRequest) => ({
  context: {
    user_id: request.userContext!.userId,
    username: request.userContext!.username,
  },
});

export default async function matchmakingRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.verifyUser);

  app.post('/api/matchmaking/queue', async (request, reply) => {
    const body = request.body as { mode?: string };
    const response = await matchmakingClient.queueForMatch({
      ...ctx(request),
      mode: body?.mode,
    });
    reply.send(response);
  });

  app.post('/api/matchmaking/cancel', async (request, reply) => {
    const response = await matchmakingClient.cancelQueue(ctx(request));
    reply.send(response);
  });
}

