import fs from "fs";
import path from "path";
import crypto from "crypto";
import {
  loadPackageDefinition,
  Server,
  ServerCredentials,
} from "@grpc/grpc-js";
import { loadSync } from "@grpc/proto-loader";
import { getDatabase, createProducer, Topics, type ProfileEvent } from "../lib";

const resolveProtoPath = (fileName: string) => {
  const candidates = [
    process.env.PROTO_ROOT,
    path.resolve(__dirname, "../../protos"),
    path.resolve(__dirname, "../../../protos"),
    path.resolve(__dirname, "../../../../protos"),
    path.resolve(process.cwd(), "protos"),
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const fullPath = path.join(candidate, fileName);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }

  throw new Error(
    `Unable to locate proto file "${fileName}". Set PROTO_ROOT or add a protos directory.`
  );
};

const PROTO_PATH = resolveProtoPath("profile.proto");

const packageDefinition = loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const protoDescriptor = loadPackageDefinition(packageDefinition) as any;
const profilePackage = protoDescriptor.transcendence.profile;

type GrpcCall<Request> = {
  request: Request;
};

type GrpcCallback<Response> = (
  error: Error | null,
  response?: Response
) => void;

interface UserContext {
  user_id: number;
  username: string;
}

const db = getDatabase();

type ProfileRecord = {
  id: number;
  username: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  oauth_avatar_url: string | null;
  auth_provider: string;
  twofa_enabled: number | null;
  created_at: string;
};

const mapHistoryResult = (row: any) => ({
  id: row.id,
  opponent_username: row.opponent_name || "Player 2",
  player_score: row.my_score ?? 0,
  opponent_score: row.opponent_score ?? 0,
  result: row.result,
  played_at: row.created_at,
  mode: row.game_mode ?? "player",
});

const ensureUserContext = (context: UserContext | undefined) => {
  if (!context || !context.user_id) {
    throw new Error("Missing user context");
  }
  return context;
};

const emitProfileEvent = async (event: ProfileEvent) => {
  const producer = await createProducer();
  await producer.send({
    topic: Topics.ProfileEvents,
    messages: [{ value: JSON.stringify(event) }],
  });
};

const handlers = {
  async GetProfile(
    call: GrpcCall<{ context?: UserContext }>,
    callback: GrpcCallback<any>
  ) {
    try {
      const context = ensureUserContext(call.request.context);
      const profile = db
        .prepare(
          `
            SELECT id, username, display_name, email, avatar_url, oauth_avatar_url, auth_provider,
                   twofa_enabled, created_at
            FROM users
            WHERE id = ?
          `
        )
        .get(context.user_id) as ProfileRecord | undefined;

      if (!profile) {
        callback(new Error("Profile not found"));
        return;
      }

      callback(null, {
        profile: {
          id: profile.id,
          username: profile.username,
          display_name: profile.display_name,
          email: profile.email,
          avatar_url: profile.avatar_url,
          oauth_avatar_url: profile.oauth_avatar_url,
          auth_provider: profile.auth_provider,
          twofa_enabled: Boolean(profile.twofa_enabled),
          created_at: profile.created_at,
        },
      });
    } catch (error) {
      callback(error as Error);
    }
  },

  async UpdateProfile(
    call: GrpcCall<{
      context?: UserContext;
      username?: string;
      display_name?: string;
    }>,
    callback: GrpcCallback<any>
  ) {
    try {
      const context = ensureUserContext(call.request.context);
      const { username, display_name } = call.request;

      if (!username && !display_name) {
        callback(null, { success: false, message: "No fields to update" });
        return;
      }

      const currentUser = db
        .prepare("SELECT auth_provider FROM users WHERE id = ?")
        .get(context.user_id) as any;
      if (!currentUser) {
        callback(null, { success: false, message: "User not found" });
        return;
      }

      if (
        (username || display_name) &&
        currentUser.auth_provider !== "manual"
      ) {
        callback(null, {
          success: false,
          message: "Cannot change username or display name for OAuth accounts",
        });
        return;
      }

      if (username) {
        const existingUser = db
          .prepare("SELECT id FROM users WHERE username = ? AND id != ?")
          .get(username, context.user_id);
        if (existingUser) {
          callback(null, { success: false, message: "Username already taken" });
          return;
        }
      }

      const updateFields: string[] = [];
      const values: any[] = [];

      if (username) {
        updateFields.push("username = ?");
        values.push(username);
      }
      if (display_name) {
        updateFields.push("display_name = ?");
        values.push(display_name);
      }

      values.push(context.user_id);

      db.prepare(
        `UPDATE users SET ${updateFields.join(", ")} WHERE id = ?`
      ).run(...values);

      await emitProfileEvent({
        type: "profileUpdated",
        userId: context.user_id,
        payload: {
          username: username ?? null,
          display_name: display_name ?? null,
        },
        emittedAt: new Date().toISOString(),
      });

      callback(null, { success: true, message: "Profile updated" });
    } catch (error) {
      callback(error as Error);
    }
  },

  async GetHistory(
    call: GrpcCall<{ context?: UserContext; page?: number; limit?: number }>,
    callback: GrpcCallback<any>
  ) {
    try {
      const context = ensureUserContext(call.request.context);
      const page = call.request.page || 1;
      const limit = Math.min(call.request.limit || 10, 50); // Max 50 per page
      const offset = (page - 1) * limit;

      // Get total count from both 'games' table (AI/local games) and 'match_history' table (online multiplayer)
      const totalCount = db
        .prepare(
          `
          SELECT COUNT(*) as total FROM (
            SELECT id FROM games WHERE player1_id = ? OR player2_id = ?
            UNION ALL
            SELECT id FROM match_history WHERE player1_id = ? OR player2_id = ?
          )
        `
        )
        .get(
          context.user_id,
          context.user_id,
          context.user_id,
          context.user_id
        ) as any;

      // Query both tables and combine results
      const rows = db
        .prepare(
          `
            SELECT * FROM (
              SELECT
                g.id,
                g.player1_id,
                g.player2_id,
                g.player1_score,
                g.player2_score,
                g.winner_id,
                g.created_at,
                p1.username as player1_name,
                p2.username as player2_name,
                CASE
                  WHEN g.winner_id = ? THEN 'win'
                  WHEN g.winner_id IS NULL THEN 'draw'
                  ELSE 'loss'
                END as result,
                CASE
                  WHEN g.player1_id = ? THEN g.player1_score
                  ELSE g.player2_score
                END as my_score,
                CASE
                  WHEN g.player1_id = ? THEN g.player2_score
                  ELSE g.player1_score
                END as opponent_score,
                COALESCE(
                  CASE
                    WHEN g.player2_id = 0 THEN 'AI'
                    WHEN g.player2_id IS NULL THEN 'Player 2'
                    WHEN g.player1_id = ? THEN p2.username
                    ELSE p1.username
                  END,
                  'Player 2'
                ) as opponent_name,
                CASE
                  WHEN g.player2_id = 0 THEN 'ai'
                  WHEN g.player2_id IS NULL THEN 'local'
                  ELSE 'player'
                END as game_mode
              FROM games g
              LEFT JOIN users p1 ON g.player1_id = p1.id
              LEFT JOIN users p2 ON g.player2_id = p2.id
              WHERE g.player1_id = ? OR g.player2_id = ?
              
              UNION ALL
              
              SELECT
                m.id,
                m.player1_id,
                m.player2_id,
                m.player1_score,
                m.player2_score,
                m.winner_id,
                m.game_date as created_at,
                p1.username as player1_name,
                p2.username as player2_name,
                CASE
                  WHEN m.winner_id = ? THEN 'win'
                  WHEN m.winner_id IS NULL THEN 'draw'
                  ELSE 'loss'
                END as result,
                CASE
                  WHEN m.player1_id = ? THEN m.player1_score
                  ELSE m.player2_score
                END as my_score,
                CASE
                  WHEN m.player1_id = ? THEN m.player2_score
                  ELSE m.player1_score
                END as opponent_score,
                CASE
                  WHEN m.player1_id = ? THEN p2.username
                  ELSE p1.username
                END as opponent_name,
                'online' as game_mode
              FROM match_history m
              LEFT JOIN users p1 ON m.player1_id = p1.id
              LEFT JOIN users p2 ON m.player2_id = p2.id
              WHERE m.player1_id = ? OR m.player2_id = ?
            )
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
          `
        )
        .all(
          context.user_id,
          context.user_id,
          context.user_id,
          context.user_id,
          context.user_id,
          context.user_id,
          context.user_id,
          context.user_id,
          context.user_id,
          context.user_id,
          context.user_id,
          context.user_id,
          limit,
          offset
        ) as any[];

      const mappedHistory = rows.map(mapHistoryResult);
      const total = totalCount.total || 0;
      const totalPages = Math.ceil(total / limit);

      console.log("📊 GetHistory response:", {
        page,
        limit,
        total,
        totalPages,
        results: mappedHistory.length,
        gameModes: mappedHistory.map((h) => h.mode),
      });

      callback(null, {
        history: mappedHistory,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      });
    } catch (error) {
      callback(error as Error);
    }
  },

  async GetStats(
    call: GrpcCall<{ context?: UserContext }>,
    callback: GrpcCallback<any>
  ) {
    try {
      const context = ensureUserContext(call.request.context);

      // Count games from both 'games' table (AI games) and 'match_history' table (online multiplayer)
      const gamesPlayed = db
        .prepare(
          `
          SELECT COUNT(*) as total FROM (
            SELECT id FROM games WHERE player1_id = ? OR player2_id = ?
            UNION ALL
            SELECT id FROM match_history WHERE player1_id = ? OR player2_id = ?
          )
        `
        )
        .get(
          context.user_id,
          context.user_id,
          context.user_id,
          context.user_id
        ) as any;

      const gamesWon = db
        .prepare(
          `
          SELECT COUNT(*) as wins FROM (
            SELECT id FROM games 
            WHERE (player1_id = ? OR player2_id = ?) AND winner_id = ?
            UNION ALL
            SELECT id FROM match_history 
            WHERE (player1_id = ? OR player2_id = ?) AND winner_id = ?
          )
        `
        )
        .get(
          context.user_id,
          context.user_id,
          context.user_id,
          context.user_id,
          context.user_id,
          context.user_id
        ) as any;

      const totalGames = gamesPlayed?.total || 0;
      const wins = gamesWon?.wins || 0;
      const losses = totalGames - wins;

      callback(null, {
        total_games: totalGames,
        wins,
        losses,
      });
    } catch (error) {
      callback(error as Error);
    }
  },

  async UpdateAvatar(
    call: GrpcCall<{ context?: UserContext; avatar_url?: string }>,
    callback: GrpcCallback<any>
  ) {
    try {
      const context = ensureUserContext(call.request.context);
      const avatarUrl = call.request.avatar_url?.trim();

      // Allow empty string or null to reset to default avatar
      const finalAvatarUrl = avatarUrl || '/uploads/default-avatar.jpg';

      db.prepare("UPDATE users SET avatar_url = ? WHERE id = ?").run(
        finalAvatarUrl,
        context.user_id
      );

      await emitProfileEvent({
        type: "profileUpdated",
        userId: context.user_id,
        payload: { avatar_url: finalAvatarUrl },
        emittedAt: new Date().toISOString(),
      });

      callback(null, { success: true, message: "Avatar updated" });
    } catch (error) {
      callback(error as Error);
    }
  },

  async DeleteAccount(
    call: GrpcCall<{ context?: UserContext }>,
    callback: GrpcCallback<any>
  ) {
    try {
      const context = ensureUserContext(call.request.context);

      // Delete user avatar files
      const user = db
        .prepare("SELECT avatar_url FROM users WHERE id = ?")
        .get(context.user_id) as any;
      if (user?.avatar_url) {
        const uploadsRoot = process.env.UPLOADS_DIR || "/uploads";
        const avatarPath = path.join(
          uploadsRoot,
          user.avatar_url.replace("/uploads/", "")
        );
        if (fs.existsSync(avatarPath)) {
          fs.unlinkSync(avatarPath);
        }
      }

      // Delete from tables without CASCADE DELETE
      db.prepare(
        "DELETE FROM games WHERE player1_id = ? OR player2_id = ?"
      ).run(context.user_id, context.user_id);
      db.prepare("DELETE FROM user_stats WHERE user_id = ?").run(
        context.user_id
      );
      db.prepare(
        "DELETE FROM match_history WHERE player1_id = ? OR player2_id = ?"
      ).run(context.user_id, context.user_id);

      // Delete user (triggers CASCADE for friends, friend_requests, game_invitations)
      db.prepare("DELETE FROM users WHERE id = ?").run(context.user_id);

      await emitProfileEvent({
        type: "accountDeleted",
        userId: context.user_id,
        payload: {},
        emittedAt: new Date().toISOString(),
      });

      callback(null, {
        success: true,
        message: "Account deleted successfully",
      });
    } catch (error) {
      callback(error as Error);
    }
  },

  async AnonymizeAccount(
    call: GrpcCall<{ context?: UserContext }>,
    callback: GrpcCallback<any>
  ) {
    try {
      const context = ensureUserContext(call.request.context);

      // Delete user avatar files
      const user = db
        .prepare("SELECT avatar_url FROM users WHERE id = ?")
        .get(context.user_id) as any;
      if (user?.avatar_url) {
        const uploadsRoot = process.env.UPLOADS_DIR || "/uploads";
        const avatarPath = path.join(
          uploadsRoot,
          user.avatar_url.replace("/uploads/", "")
        );
        if (fs.existsSync(avatarPath)) {
          fs.unlinkSync(avatarPath);
        }
      }

      // Anonymize user data - remove PII but keep record for game history integrity
      // Generate a random unusable password hash to satisfy NOT NULL constraint
      const randomHash = crypto.randomBytes(32).toString("hex");

      db.prepare(
        `UPDATE users
         SET email = ?,
             username = ?,
             display_name = ?,
             avatar_url = NULL,
             oauth_avatar_url = NULL,
             google_id = NULL,
             ft_id = NULL,
             password_hash = ?,
             twofa_secret = NULL,
             twofa_enabled = 0
         WHERE id = ?`
      ).run(
        `deleted_${context.user_id}@anonymized.local`,
        `deleted_user_${context.user_id}`,
        "Deleted User",
        randomHash,
        context.user_id
      );

      await emitProfileEvent({
        type: "accountAnonymized",
        userId: context.user_id,
        payload: {},
        emittedAt: new Date().toISOString(),
      });

      callback(null, {
        success: true,
        message: "Account anonymized successfully",
      });
    } catch (error) {
      callback(error as Error);
    }
  },

  async ExportUserData(
    call: GrpcCall<{ context?: UserContext }>,
    callback: GrpcCallback<any>
  ) {
    try {
      const context = ensureUserContext(call.request.context);

      // Gather all user data from various tables
      const profile = db
        .prepare(
          `SELECT id, username, display_name, email, avatar_url, oauth_avatar_url,
                  auth_provider, twofa_enabled, created_at, updated_at
           FROM users WHERE id = ?`
        )
        .get(context.user_id);

      const games = db
        .prepare("SELECT * FROM games WHERE player1_id = ? OR player2_id = ?")
        .all(context.user_id, context.user_id);

      const matchHistory = db
        .prepare(
          "SELECT * FROM match_history WHERE player1_id = ? OR player2_id = ?"
        )
        .all(context.user_id, context.user_id);

      const stats = db
        .prepare("SELECT * FROM user_stats WHERE user_id = ?")
        .get(context.user_id);

      const friends = db
        .prepare("SELECT * FROM friends WHERE user_id = ? OR friend_id = ?")
        .all(context.user_id, context.user_id);

      const friendRequests = db
        .prepare(
          "SELECT * FROM friend_requests WHERE sender_id = ? OR receiver_id = ?"
        )
        .all(context.user_id, context.user_id);

      const gameInvitations = db
        .prepare(
          "SELECT * FROM game_invitations WHERE sender_id = ? OR receiver_id = ?"
        )
        .all(context.user_id, context.user_id);

      const userData = {
        profile,
        games,
        matchHistory,
        stats,
        friends,
        friendRequests,
        gameInvitations,
        exportedAt: new Date().toISOString(),
      };

      callback(null, { data_json: JSON.stringify(userData, null, 2) });
    } catch (error) {
      callback(error as Error);
    }
  },
};

export const startGrpcServer = async () => {
  const server = new Server();
  server.addService(profilePackage.ProfileService.service, handlers);

  const host = process.env.PROFILE_GRPC_HOST || "0.0.0.0";
  const port = Number(process.env.PROFILE_GRPC_PORT || 50051);

  await new Promise<void>((resolve, reject) => {
    server.bindAsync(
      `${host}:${port}`,
      ServerCredentials.createInsecure(),
      (error: Error | null) => {
        if (error) {
          reject(error);
          return;
        }
        server.start();
        console.log(`Profile gRPC server listening on ${host}:${port}`);
        resolve();
      }
    );
  });

  return server;
};
