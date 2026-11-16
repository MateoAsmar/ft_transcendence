import fs from 'fs';
import path from 'path';
import { loadPackageDefinition, Server, ServerCredentials } from '@grpc/grpc-js';
import { loadSync } from '@grpc/proto-loader';
import {
  createConsumer,
  createProducer,
  getDatabase,
  PresenceCache,
  Topics,
  type PresenceStatusEvent,
} from '../lib';

const resolveProtoPath = (fileName: string) => {
  const candidates = [
    process.env.PROTO_ROOT,
    path.resolve(__dirname, '../../protos'),
    path.resolve(__dirname, '../../../protos'),
    path.resolve(__dirname, '../../../../protos'),
    path.resolve(process.cwd(), 'protos'),
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const fullPath = path.join(candidate, fileName);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }

  throw new Error(`Unable to locate proto file "${fileName}". Set PROTO_ROOT or add a protos directory.`);
};

const PROTO_PATH = resolveProtoPath('friends.proto');

const packageDefinition = loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const protoDescriptor = loadPackageDefinition(packageDefinition) as any;
const friendsPackage = protoDescriptor.transcendence.friends;

type GrpcCall<Request> = {
  request: Request;
};

type GrpcCallback<Response> = (error: Error | null, response?: Response) => void;

interface UserContext {
  user_id: number;
  username: string;
}

const db = getDatabase();
const presenceCache = new PresenceCache();

const ensureUserContext = (context: UserContext | undefined) => {
  if (!context || !context.user_id) {
    throw new Error('Missing user context');
  }
  return context;
};

const mapFriendRecord = (row: any) => {
  const presence = presenceCache.get(row.id);
  return {
    id: row.id,
    username: row.username,
    display_name: row.display_name,
    avatar_url: row.avatar_url,
    oauth_avatar_url: row.oauth_avatar_url,
    friend_since: row.friend_since ?? null,
    is_online: presence?.status === 'online',
    presence_updated_at: presence?.timestamp ?? null,
  };
};

const emitFriendEvent = async (event: Record<string, unknown>) => {
  const producer = await createProducer();
  await producer.send({
    topic: Topics.FriendEvents,
    messages: [{ value: JSON.stringify(event) }],
  });
};

const handlers = {
  async ListFriends(call: GrpcCall<{ context?: UserContext }>, callback: GrpcCallback<any>) {
    try {
      const context = ensureUserContext(call.request.context);
      const rows = db
        .prepare(
          `
            SELECT
              u.id,
              u.username,
              u.display_name,
              COALESCE(u.oauth_avatar_url, u.avatar_url) as avatar_url,
              u.oauth_avatar_url,
              f.created_at as friend_since
            FROM friends f
            JOIN users u ON f.friend_id = u.id
            WHERE f.user_id = ?
            ORDER BY u.username ASC
          `,
        )
        .all(context.user_id) as any[];

      callback(null, { friends: rows.map(mapFriendRecord) });
    } catch (error) {
      callback(error as Error);
    }
  },

  async ListOnlineFriends(call: GrpcCall<{ context?: UserContext }>, callback: GrpcCallback<any>) {
    try {
      const context = ensureUserContext(call.request.context);
      const rows = db
        .prepare(
          `
            SELECT
              u.id,
              u.username,
              u.display_name,
              COALESCE(u.oauth_avatar_url, u.avatar_url) as avatar_url,
              u.oauth_avatar_url,
              f.created_at as friend_since
            FROM friends f
            JOIN users u ON f.friend_id = u.id
            WHERE f.user_id = ?
            ORDER BY u.username ASC
          `,
        )
        .all(context.user_id) as any[];

      callback(null, {
        friends: rows
          .map(mapFriendRecord)
          .filter((friend) => friend.is_online),
      });
    } catch (error) {
      callback(error as Error);
    }
  },

  async GetReceivedRequests(
    call: GrpcCall<{ context?: UserContext }>,
    callback: GrpcCallback<any>,
  ) {
    try {
      const context = ensureUserContext(call.request.context);
      const rows = db
        .prepare(
          `
            SELECT
              fr.id,
              fr.sender_id,
              fr.receiver_id,
              fr.status,
              fr.created_at,
              u.username,
              u.display_name,
              COALESCE(u.oauth_avatar_url, u.avatar_url) as avatar_url
            FROM friend_requests fr
            JOIN users u ON fr.sender_id = u.id
            WHERE fr.receiver_id = ? AND fr.status = 'pending'
            ORDER BY fr.created_at DESC
          `,
        )
        .all(context.user_id) as any[];

      callback(null, { requests: rows });
    } catch (error) {
      callback(error as Error);
    }
  },

  async GetSentRequests(call: GrpcCall<{ context?: UserContext }>, callback: GrpcCallback<any>) {
    try {
      const context = ensureUserContext(call.request.context);
      const rows = db
        .prepare(
          `
            SELECT
              fr.id,
              fr.sender_id,
              fr.receiver_id,
              fr.status,
              fr.created_at,
              u.username,
              u.display_name,
              COALESCE(u.oauth_avatar_url, u.avatar_url) as avatar_url
            FROM friend_requests fr
            JOIN users u ON fr.receiver_id = u.id
            WHERE fr.sender_id = ? AND fr.status = 'pending'
            ORDER BY fr.created_at DESC
          `,
        )
        .all(context.user_id) as any[];

      callback(null, { requests: rows });
    } catch (error) {
      callback(error as Error);
    }
  },

  async SendFriendRequest(
    call: GrpcCall<{ context?: UserContext; username?: string }>,
    callback: GrpcCallback<any>,
  ) {
    try {
      const context = ensureUserContext(call.request.context);
      const username = call.request.username?.trim();
      if (!username) {
        callback(null, { success: false, message: 'Username is required' });
        return;
      }

      const targetUser = db
        .prepare('SELECT id, username FROM users WHERE username = ?')
        .get(username) as { id: number; username: string } | undefined;
      if (!targetUser) {
        callback(null, { success: false, message: 'User not found' });
        return;
      }

      if (targetUser.id === context.user_id) {
        callback(null, { success: false, message: 'Cannot send request to yourself' });
        return;
      }

      const existingFriend = db
        .prepare('SELECT 1 FROM friends WHERE user_id = ? AND friend_id = ?')
        .get(context.user_id, targetUser.id);
      if (existingFriend) {
        callback(null, { success: false, message: 'Already friends' });
        return;
      }

      const existingRequest = db
        .prepare(
          `
            SELECT id, status, sender_id, receiver_id
            FROM friend_requests
            WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
            ORDER BY updated_at DESC
            LIMIT 1
          `,
        )
        .get(context.user_id, targetUser.id, targetUser.id, context.user_id) as
        | { id: number; status: string; sender_id: number; receiver_id: number }
        | undefined;

      let requestId: number;
      if (existingRequest) {
        db.prepare(
          `
            UPDATE friend_requests
            SET sender_id = ?, receiver_id = ?, status = 'pending',
                created_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `,
        ).run(context.user_id, targetUser.id, existingRequest.id);
        requestId = existingRequest.id;
      } else {
        const result = db
          .prepare(
            `
              INSERT INTO friend_requests (sender_id, receiver_id, status)
              VALUES (?, ?, 'pending')
            `,
          )
          .run(context.user_id, targetUser.id);
        requestId = Number(result.lastInsertRowid);
      }

      await emitFriendEvent({
        type: 'friendRequest',
        senderId: context.user_id,
        receiverId: targetUser.id,
        requestId,
      });

      callback(null, { success: true, message: 'Friend request sent', request_id: requestId });
    } catch (error) {
      callback(error as Error);
    }
  },

  async AcceptFriendRequest(
    call: GrpcCall<{ context?: UserContext; request_id?: number }>,
    callback: GrpcCallback<any>,
  ) {
    try {
      const context = ensureUserContext(call.request.context);
      const requestId = call.request.request_id;
      if (!requestId) {
        callback(null, { success: false, message: 'Request ID required' });
        return;
      }

      const request = db
        .prepare(
          `
            SELECT id, sender_id
            FROM friend_requests
            WHERE id = ? AND receiver_id = ? AND status = 'pending'
          `,
        )
        .get(requestId, context.user_id) as { id: number; sender_id: number } | undefined;

      if (!request) {
        callback(null, { success: false, message: 'Request not found' });
        return;
      }

      db.prepare('BEGIN').run();
      try {
        db.prepare(
          `
            UPDATE friend_requests
            SET status = 'accepted', updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `,
        ).run(requestId);

        db.prepare('INSERT INTO friends (user_id, friend_id) VALUES (?, ?)')
          .run(context.user_id, request.sender_id);
        db.prepare('INSERT INTO friends (user_id, friend_id) VALUES (?, ?)')
          .run(request.sender_id, context.user_id);

        db.prepare('COMMIT').run();
      } catch (error) {
        db.prepare('ROLLBACK').run();
        throw error;
      }

      await emitFriendEvent({
        type: 'friendAccepted',
        userId: context.user_id,
        friendId: request.sender_id,
        requestId,
      });

      callback(null, { success: true, message: 'Friend request accepted' });
    } catch (error) {
      callback(error as Error);
    }
  },

  async RejectFriendRequest(
    call: GrpcCall<{ context?: UserContext; request_id?: number }>,
    callback: GrpcCallback<any>,
  ) {
    try {
      const context = ensureUserContext(call.request.context);
      const requestId = call.request.request_id;
      if (!requestId) {
        callback(null, { success: false, message: 'Request ID required' });
        return;
      }

      const result = db
        .prepare(
          `
            UPDATE friend_requests
            SET status = 'rejected', updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND receiver_id = ? AND status = 'pending'
          `,
        )
        .run(requestId, context.user_id);

      if (result.changes === 0) {
        callback(null, { success: false, message: 'Request not found' });
        return;
      }

      callback(null, { success: true, message: 'Friend request rejected' });
    } catch (error) {
      callback(error as Error);
    }
  },

  async RemoveFriend(
    call: GrpcCall<{ context?: UserContext; username?: string }>,
    callback: GrpcCallback<any>,
  ) {
    try {
      const context = ensureUserContext(call.request.context);
      const username = call.request.username?.trim();
      if (!username) {
        callback(null, { success: false, message: 'Username required' });
        return;
      }

      const targetUser = db
        .prepare('SELECT id FROM users WHERE username = ?')
        .get(username) as { id: number } | undefined;

      if (!targetUser) {
        callback(null, { success: false, message: 'User not found' });
        return;
      }

      db.prepare('BEGIN').run();
      try {
        db.prepare('DELETE FROM friends WHERE user_id = ? AND friend_id = ?')
          .run(context.user_id, targetUser.id);
        db.prepare('DELETE FROM friends WHERE user_id = ? AND friend_id = ?')
          .run(targetUser.id, context.user_id);
        db.prepare(
          `
            DELETE FROM friend_requests
            WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
          `,
        ).run(context.user_id, targetUser.id, targetUser.id, context.user_id);
        db.prepare('COMMIT').run();
      } catch (error) {
        db.prepare('ROLLBACK').run();
        throw error;
      }

      await emitFriendEvent({
        type: 'friendRemoved',
        userId: context.user_id,
        removedFriendId: targetUser.id,
      });

      callback(null, { success: true, message: 'Friend removed' });
    } catch (error) {
      callback(error as Error);
    }
  },

  async SearchUsers(
    call: GrpcCall<{ context?: UserContext; query?: string }>,
    callback: GrpcCallback<any>,
  ) {
    try {
      const context = ensureUserContext(call.request.context);
      const query = call.request.query?.trim();
      if (!query || query.length < 2) {
        callback(null, { users: [] });
        return;
      }

      const searchPattern = `%${query}%`;
      const users = db
        .prepare(
          `
            SELECT DISTINCT
              u.id,
              u.username,
              u.display_name,
              COALESCE(u.oauth_avatar_url, u.avatar_url) as avatar_url,
              CASE WHEN f.friend_id IS NOT NULL THEN 1 ELSE 0 END as is_friend,
              CASE WHEN fr_sent.id IS NOT NULL THEN 1 ELSE 0 END as request_sent,
              CASE WHEN fr_received.id IS NOT NULL THEN 1 ELSE 0 END as request_received
            FROM users u
            LEFT JOIN friends f ON f.user_id = ? AND f.friend_id = u.id
            LEFT JOIN friend_requests fr_sent ON fr_sent.sender_id = ? AND fr_sent.receiver_id = u.id AND fr_sent.status = 'pending'
            LEFT JOIN friend_requests fr_received ON fr_received.sender_id = u.id AND fr_received.receiver_id = ? AND fr_received.status = 'pending'
            WHERE u.id != ? AND u.username LIKE ?
            ORDER BY u.username ASC
            LIMIT 20
          `,
        )
        .all(
          context.user_id,
          context.user_id,
          context.user_id,
          context.user_id,
          searchPattern,
        ) as any[];

      callback(null, { users });
    } catch (error) {
      callback(error as Error);
    }
  },

  async ListInvitations(call: GrpcCall<{ context?: UserContext }>, callback: GrpcCallback<any>) {
    try {
      const context = ensureUserContext(call.request.context);
      const rows = db
        .prepare(
          `
            SELECT
              gi.id,
              gi.sender_id,
              u.username as sender_username,
              u.display_name as sender_display_name,
              gi.room_code,
              gi.status,
              gi.created_at,
              gi.expires_at
            FROM game_invitations gi
            JOIN users u ON gi.sender_id = u.id
            WHERE gi.receiver_id = ? AND gi.status = 'pending' AND datetime(gi.expires_at) > datetime('now')
            ORDER BY gi.created_at DESC
          `,
        )
        .all(context.user_id) as any[];

      callback(null, { invitations: rows });
    } catch (error) {
      callback(error as Error);
    }
  },

  async SendGameInvitation(
    call: GrpcCall<{ context?: UserContext; friend_id?: number; room_code?: string }>,
    callback: GrpcCallback<any>,
  ) {
    try {
      const context = ensureUserContext(call.request.context);
      const friendId = call.request.friend_id;
      const roomCode = call.request.room_code?.trim();
      if (!friendId || !roomCode) {
        callback(null, { success: false, message: 'friend_id and room_code are required' });
        return;
      }

      const isFriend = db
        .prepare('SELECT 1 FROM friends WHERE user_id = ? AND friend_id = ?')
        .get(context.user_id, friendId);
      if (!isFriend) {
        callback(null, { success: false, message: 'Not friends' });
        return;
      }

      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      const result = db
        .prepare(
          `
            INSERT INTO game_invitations (sender_id, receiver_id, room_code, expires_at)
            VALUES (?, ?, ?, ?)
          `,
        )
        .run(context.user_id, friendId, roomCode, expiresAt);

      await emitFriendEvent({
        type: 'gameInvitation',
        userId: friendId,
        invitationId: Number(result.lastInsertRowid),
        roomCode,
      });

      callback(null, {
        success: true,
        message: 'Game invitation sent',
        request_id: Number(result.lastInsertRowid),
      });
    } catch (error) {
      callback(error as Error);
    }
  },

  async AcceptGameInvitation(
    call: GrpcCall<{ context?: UserContext; invitation_id?: number }>,
    callback: GrpcCallback<any>,
  ) {
    try {
      const context = ensureUserContext(call.request.context);
      const invitationId = call.request.invitation_id;
      if (!invitationId) {
        callback(null, { success: false, message: 'Invitation ID required' });
        return;
      }

      const invitation = db
        .prepare(
          `
            UPDATE game_invitations
            SET status = 'accepted'
            WHERE id = ? AND receiver_id = ? AND status = 'pending'
              AND datetime(expires_at) > datetime('now')
            RETURNING room_code
          `,
        )
        .get(invitationId, context.user_id) as { room_code: string } | undefined;

      if (!invitation) {
        callback(null, { success: false, message: 'Invitation not found or expired' });
        return;
      }

      callback(null, {
        success: true,
        message: 'Invitation accepted',
        request_id: invitationId,
      });
    } catch (error) {
      callback(error as Error);
    }
  },

  async RejectGameInvitation(
    call: GrpcCall<{ context?: UserContext; invitation_id?: number }>,
    callback: GrpcCallback<any>,
  ) {
    try {
      const context = ensureUserContext(call.request.context);
      const invitationId = call.request.invitation_id;
      if (!invitationId) {
        callback(null, { success: false, message: 'Invitation ID required' });
        return;
      }

      const invitation = db
        .prepare(
          `
            SELECT sender_id FROM game_invitations
            WHERE id = ? AND receiver_id = ? AND status = 'pending'
          `,
        )
        .get(invitationId, context.user_id) as { sender_id: number } | undefined;

      if (!invitation) {
        callback(null, { success: false, message: 'Invitation not found' });
        return;
      }

      db.prepare(
        `
          UPDATE game_invitations
          SET status = 'rejected'
          WHERE id = ?
        `,
      ).run(invitationId);

      await emitFriendEvent({
        type: 'gameInvitationDeclined',
        userId: invitation.sender_id,
        invitationId,
      });

      callback(null, { success: true, message: 'Invitation rejected' });
    } catch (error) {
      callback(error as Error);
    }
  },
};

export const startGrpcServer = async () => {
  const kafkaConsumer = await createConsumer('friends-service-presence');
  await kafkaConsumer.subscribe({ topic: Topics.PresenceStatus, fromBeginning: false });
  await kafkaConsumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      try {
        const event = JSON.parse(message.value.toString()) as PresenceStatusEvent;
        presenceCache.update(event);
      } catch (error) {
        console.error('Failed to parse presence event', error);
      }
    },
  });

  const server = new Server();
  server.addService(friendsPackage.FriendsService.service, handlers);

  const host = process.env.FRIENDS_GRPC_HOST || '0.0.0.0';
  const port = Number(process.env.FRIENDS_GRPC_PORT || 50052);

  await new Promise<void>((resolve, reject) => {
    server.bindAsync(`${host}:${port}`, ServerCredentials.createInsecure(), (error) => {
      if (error) {
        reject(error);
        return;
      }
      server.start();
      console.log(`Friends gRPC server listening on ${host}:${port}`);
      resolve();
    });
  });

  return { server, kafkaConsumer };
};
