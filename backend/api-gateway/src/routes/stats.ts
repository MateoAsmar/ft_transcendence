import type { FastifyInstance, FastifyRequest } from 'fastify';
import { statsClient } from '../clients/statsClient';

const ctx = (request: FastifyRequest) => ({
  context: {
    user_id: request.userContext!.userId,
    username: request.userContext!.username,
  },
});

export default async function statsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.verifyUser);
  app.get('/api/dashboard/detailed', async (request, reply) => {
    const response = await statsClient.getDashboardDetailed(ctx(request));
    reply.send(response);
  });

  app.get('/api/dashboard/sessions', async (request, reply) => {
    const response = await statsClient.getDashboardSessions(ctx(request));
    reply.send(response);
  });

  app.get('/api/leaderboard', async (request, reply) => {
    const period = (request.query as { period?: string })?.period || 'all';
    const response = await statsClient.getLeaderboard({
      ...ctx(request),
      period,
    });
    const { user_ranking, ...rest } = response as any;
    reply.send({
      ...rest,
      userRanking: user_ranking ?? null,
    });
  });
}

