import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import type { Producer } from 'kafkajs';
import {
  createProducer,
  createConsumer,
  Topics,
  type PresenceStatusEvent,
  type GameResultEvent,
} from './lib';
import { GameServer } from './websocket/gameServer';
import { startGrpcServer } from './grpc/server';

const setupGameServer = (app: ReturnType<typeof Fastify>) => {
  let kafkaProducer: Producer | null = null;

  const getProducer = async (): Promise<Producer | null> => {
    if (kafkaProducer) {
      return kafkaProducer;
    }

    try {
      kafkaProducer = await createProducer();
      return kafkaProducer;
    } catch (error) {
      app.log.error({ err: error }, 'Game session service failed to connect to Kafka');
      return null;
    }
  };

  const emitPresence = async (event: PresenceStatusEvent) => {
    const producer = await getProducer();
    if (!producer) return;

    await producer.send({
      topic: Topics.PresenceStatus,
      messages: [{ value: JSON.stringify(event) }],
    });
  };

  const emitGameResult = async (event: GameResultEvent) => {
    const producer = await getProducer();
    if (!producer) return;

    await producer.send({
      topic: Topics.GameResults,
      messages: [{ value: JSON.stringify(event) }],
    });
  };

  const readyPromise = new Promise<GameServer>((resolve) => {
    app.addHook('onReady', async () => {
      const gameServer = new GameServer(app.server, {
        onPresenceChange: emitPresence,
        onGameResult: emitGameResult,
      });
      app.log.info('Game server initialized');
      resolve(gameServer);
    });
  });

  app.addHook('onClose', async () => {
    if (kafkaProducer) {
      await kafkaProducer.disconnect();
      kafkaProducer = null;
    }
  });

  return readyPromise;
};

const setupFriendEventsConsumer = async (gameServer: GameServer, app: ReturnType<typeof Fastify>) => {
  try {
    app.log.info('🔔 Starting friend events consumer...');
    const consumer = await createConsumer('game-session-friend-events');
    app.log.info('🔔 Consumer created, subscribing to topic...');
    await consumer.subscribe({ topic: Topics.FriendEvents, fromBeginning: false });
    app.log.info('🔔 Subscribed to friends.events topic');

    // Import getDatabase here to access DB
    const { getDatabase } = await import('./lib');
    const db = getDatabase();

    await consumer.run({
      eachMessage: async ({ message }: any) => {
        try {
          const event = JSON.parse(message.value?.toString() || '{}');
          app.log.info({ event }, '🔔 Received friend event');

          switch (event.type) {
            case 'friendRequest':
              // Event structure: { type, senderId, receiverId, requestId }
              if (event.receiverId && event.senderId && event.requestId) {
                const sender = db.prepare('SELECT id, username, display_name FROM users WHERE id = ?').get(event.senderId) as any;
                if (sender) {
                  gameServer.emitToUser(event.receiverId, 'friendRequestReceived', {
                    request_id: event.requestId,
                    sender_id: sender.id,
                    sender_username: sender.username,
                    sender_display_name: sender.display_name,
                  });
                  app.log.info(`✅ Sent friendRequestReceived to user ${event.receiverId} (request: ${event.requestId})`);
                }
              }
              break;

            case 'friendAccepted':
              // Event structure: { type, userId (accepter), friendId (original requester), requestId }
              if (event.friendId && event.userId) {
                const accepter = db.prepare('SELECT id, username, display_name FROM users WHERE id = ?').get(event.userId) as any;
                if (accepter) {
                  gameServer.emitToUser(event.friendId, 'friendRequestAccepted', {
                    user_id: accepter.id,
                    username: accepter.username,
                    display_name: accepter.display_name,
                  });
                  app.log.info(`✅ Sent friendRequestAccepted to user ${event.friendId}`);
                }
              }
              break;

            case 'friendRemoved':
              // Event structure: { type, userId (remover), removedFriendId }
              if (event.removedFriendId && event.userId) {
                const remover = db.prepare('SELECT id, username, display_name FROM users WHERE id = ?').get(event.userId) as any;
                if (remover) {
                  gameServer.emitToUser(event.removedFriendId, 'friendRemoved', {
                    user_id: remover.id,
                    username: remover.username,
                    display_name: remover.display_name,
                  });
                  app.log.info(`✅ Sent friendRemoved to user ${event.removedFriendId}`);
                }
              }
              break;

            case 'gameInvitation':
              // Event structure: { type, userId (receiver), invitationId, roomCode }
              if (event.userId && event.invitationId && event.roomCode) {
                const invitation = db.prepare(`
                  SELECT gi.id, gi.sender_id, gi.receiver_id, gi.room_code,
                         u.username as sender_username, u.display_name as sender_display_name
                  FROM game_invitations gi
                  JOIN users u ON gi.sender_id = u.id
                  WHERE gi.id = ?
                `).get(event.invitationId) as any;

                if (invitation) {
                  gameServer.emitToUser(event.userId, 'gameInvitation', {
                    invitation_id: invitation.id,
                    sender_id: invitation.sender_id,
                    sender_username: invitation.sender_username,
                    sender_display_name: invitation.sender_display_name,
                    room_code: invitation.room_code,
                  });
                  app.log.info(`✅ Sent gameInvitation to user ${event.userId}`);
                }
              }
              break;

            default:
              app.log.warn({ type: event.type }, 'Unknown friend event type');
          }
        } catch (error) {
          app.log.error({ err: error }, 'Error processing friend event');
        }
      },
    });

    app.log.info('✅ Friend events consumer started');
  } catch (error) {
    app.log.error({ err: error }, 'Failed to start friend events consumer');
  }
};

const start = async () => {
  const app = Fastify({ logger: true });

  app.register(fastifyCors, {
    origin: true,
    credentials: true,
  });

  app.get('/health', async () => ({ status: 'ok' }));

  const gameServerPromise = setupGameServer(app);

  const port = Number(process.env.GAME_SESSION_HTTP_PORT || 4002);
  const host = process.env.HOST || '0.0.0.0';

  try {
    await app.listen({ port, host });
    app.log.info(`Game session HTTP server listening on ${host}:${port}`);

    const gameServer = await gameServerPromise;
    await startGrpcServer(gameServer);
    app.log.info('Game session gRPC server started');

    // Start friend events consumer
    await setupFriendEventsConsumer(gameServer, app);
  } catch (error) {
    app.log.error({ err: error }, 'Failed to start game session service');
    process.exit(1);
  }
};

start();
