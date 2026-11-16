import type { FastifyInstance, FastifyRequest } from 'fastify';
import { friendsClient } from '../clients/friendsClient';

const ctx = (request: FastifyRequest) => ({
  context: {
    user_id: request.userContext!.userId,
    username: request.userContext!.username,
  },
});

export default async function friendsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.verifyUser);
  app.get('/api/friends/list', async (request, reply) => {
    const response = await friendsClient.listFriends(ctx(request));
    reply.send(response);
  });

  app.get('/api/friends/online', async (request, reply) => {
    const response = await friendsClient.listOnlineFriends(ctx(request));
    reply.send(response);
  });

  app.get('/api/friends/requests/received', async (request, reply) => {
    const response = await friendsClient.getReceivedRequests(ctx(request));
    reply.send(response);
  });

  app.get('/api/friends/requests/sent', async (request, reply) => {
    const response = await friendsClient.getSentRequests(ctx(request));
    reply.send(response);
  });

  app.post('/api/friends/request', async (request, reply) => {
    const body = request.body as { username?: string };
    const response = await friendsClient.sendFriendRequest({
      ...ctx(request),
      username: body?.username,
    });
    reply.send(response);
  });

  app.post('/api/friends/request/:id/accept', async (request, reply) => {
    const params = request.params as { id: string };
    const response = await friendsClient.acceptFriendRequest({
      ...ctx(request),
      request_id: Number(params.id),
    });
    reply.send(response);
  });

  app.post('/api/friends/request/:id/reject', async (request, reply) => {
    const params = request.params as { id: string };
    const response = await friendsClient.rejectFriendRequest({
      ...ctx(request),
      request_id: Number(params.id),
    });
    reply.send(response);
  });

  app.delete('/api/friends/:username', async (request, reply) => {
    const params = request.params as { username: string };
    const response = await friendsClient.removeFriend({
      ...ctx(request),
      username: params.username,
    });
    reply.send(response);
  });

  app.get('/api/friends/search', async (request, reply) => {
    const query = (request.query as { query?: string }).query;
    const response = await friendsClient.searchUsers({
      ...ctx(request),
      query,
    });
    reply.send(response);
  });

  app.get('/api/friends/invitations', async (request, reply) => {
    const response = await friendsClient.listInvitations(ctx(request));
    reply.send(response);
  });

  app.post('/api/friends/invite', async (request, reply) => {
    const body = request.body as { friend_id?: number; room_code?: string };
    const response = await friendsClient.sendGameInvitation({
      ...ctx(request),
      friend_id: body?.friend_id,
      room_code: body?.room_code,
    });
    reply.send(response);
  });

  app.post('/api/friends/invitation/:id/accept', async (request, reply) => {
    const params = request.params as { id: string };
    const response = await friendsClient.acceptGameInvitation({
      ...ctx(request),
      invitation_id: Number(params.id),
    });
    reply.send(response);
  });

  app.post('/api/friends/invitation/:id/reject', async (request, reply) => {
    const params = request.params as { id: string };
    const response = await friendsClient.rejectGameInvitation({
      ...ctx(request),
      invitation_id: Number(params.id),
    });
    reply.send(response);
  });
}

