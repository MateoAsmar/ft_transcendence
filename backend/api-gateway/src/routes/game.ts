import type { FastifyInstance, FastifyRequest } from 'fastify';
import { gameClient } from '../clients/gameClient';

const ctx = (request: FastifyRequest) => ({
  context: {
    user_id: request.userContext!.userId,
    username: request.userContext!.username,
  },
});

export default async function gameRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.verifyUser);

  app.post('/api/game/start', async (request, reply) => {
    const response = await gameClient.startGame(ctx(request));
    reply.send({ message: response.message, status: response.status });
  });

  app.post('/api/game/end', async (request, reply) => {
    const body = request.body as { player1_score?: number; player2_score?: number; game_mode?: string };
    const response = await gameClient.endGame({
      ...ctx(request),
      player1_score: body?.player1_score,
      player2_score: body?.player2_score,
      game_mode: body?.game_mode || 'local',
    });

    reply.send({
      message: response.message,
      gameId: response.game_id,
      result: {
        player1_score: body?.player1_score ?? 0,
        player2_score: body?.player2_score ?? 0,
        winner: response.winner,
      },
    });
  });

  app.get('/api/game/stats', async (request, reply) => {
    const response = await gameClient.getStats(ctx(request));
    reply.send({
      user: request.userContext!.username,
      stats: {
        total_games: response.total_games ?? 0,
        wins: response.wins ?? 0,
        losses: response.losses ?? 0,
        winRate: response.win_rate ?? '0%',
      },
    });
  });

  app.get('/api/game/history', async (request, reply) => {
    const response = await gameClient.getHistory(ctx(request));
    reply.send({
      user: response.username,
      games: response.games ?? [],
      total_games: response.total_games ?? (response.games ? response.games.length : 0),
      message: response.message,
    });
  });
}
