import fs from 'fs';
import path from 'path';
import { loadPackageDefinition, Server, ServerCredentials } from '@grpc/grpc-js';
import { loadSync } from '@grpc/proto-loader';
import { getDatabase } from '../lib';
import { GameServer } from '../websocket/gameServer';

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

const PROTO_PATH = resolveProtoPath('game.proto');

const packageDefinition = loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const protoDescriptor = loadPackageDefinition(packageDefinition) as any;
const gamePackage = protoDescriptor.transcendence.game;

type GrpcCall<Request> = {
  request: Request;
};

type GrpcCallback<Response> = (error: Error | null, response?: Response) => void;

interface UserContext {
  user_id: number;
  username: string;
}

const db = getDatabase();

const ensureUserContext = (context: UserContext | undefined) => {
  if (!context || !context.user_id) {
    throw new Error('Missing user context');
  }
  return context;
};

export const createGameHandlers = (gameServer: GameServer) => ({
  async StartGame(call: GrpcCall<{ context?: UserContext }>, callback: GrpcCallback<any>) {
    try {
      ensureUserContext(call.request.context);
      callback(null, { status: 'ready', message: 'Game Started Successfully' });
    } catch (error) {
      callback(error as Error);
    }
  },

  async EndGame(
    call: GrpcCall<{ context?: UserContext; player1_score?: number; player2_score?: number; game_mode?: string }>,
    callback: GrpcCallback<any>,
  ) {
    try {
      const context = ensureUserContext(call.request.context);
      const player1Score = call.request.player1_score;
      const player2Score = call.request.player2_score;
      const gameMode = call.request.game_mode || 'local'; // default to local if not specified

      if (player1Score === undefined || player2Score === undefined) {
        callback(null, { message: 'Score is undefined' });
        return;
      }

      // AI games: player2_id = 0, Local games: player2_id = NULL
      const player2Id = gameMode === 'ai' ? 0 : null;
      const winnerId = player1Score > player2Score ? context.user_id : null;
      const result = db
        .prepare(
          `
            INSERT INTO games (player1_id, player2_id, player1_score, player2_score, winner_id)
            VALUES (?, ?, ?, ?, ?)
          `,
        )
        .run(context.user_id, player2Id, player1Score, player2Score, winnerId);

      const playerId = context.user_id;
      const win = player1Score > player2Score;
      const userStats = db.prepare('SELECT * FROM user_stats WHERE user_id = ?').get(playerId);

      if (userStats) {
        if (win) {
          db.prepare('UPDATE user_stats SET total_games = total_games + 1, wins = wins + 1 WHERE user_id = ?')
            .run(playerId);
        } else {
          db.prepare('UPDATE user_stats SET total_games = total_games + 1, losses = losses + 1 WHERE user_id = ?')
            .run(playerId);
        }
      } else {
        db.prepare('INSERT INTO user_stats (user_id, total_games, wins, losses) VALUES (?, 1, ?, ?)')
          .run(playerId, win ? 1 : 0, win ? 0 : 1);
      }

      await gameServer.emitGameResult({
        gameId: Number(result.lastInsertRowid),
        playerId,
        opponentId: null,
        playerScore: player1Score,
        opponentScore: player2Score,
        won: win,
      });

      callback(null, {
        message: win ? 'Congrats ! You won !' : 'Good Game ! Better Luck Next Time!',
        game_id: Number(result.lastInsertRowid),
        winner: win ? 'You' : 'Opponent',
      });
    } catch (error) {
      callback(error as Error);
    }
  },

  async GetStats(call: GrpcCall<{ context?: UserContext }>, callback: GrpcCallback<any>) {
    try {
      const context = ensureUserContext(call.request.context);
      const stats = db
        .prepare('SELECT * FROM user_stats WHERE user_id = ?')
        .get(context.user_id) as { total_games: number; wins: number; losses: number } | undefined;

      if (!stats) {
        callback(null, {
          username: context.username,
          total_games: 0,
          wins: 0,
          losses: 0,
          win_rate: '0%'
        });
        return;
      }

      const winRate = stats.total_games > 0 ? Math.round((stats.wins / stats.total_games) * 100) : 0;

      callback(null, {
        username: context.username,
        total_games: stats.total_games,
        wins: stats.wins,
        losses: stats.losses,
        win_rate: `${winRate}%`,
      });
    } catch (error) {
      callback(error as Error);
    }
  },

  async GetHistory(call: GrpcCall<{ context?: UserContext }>, callback: GrpcCallback<any>) {
    try {
      const context = ensureUserContext(call.request.context);
      const games = db
        .prepare(
          `
            SELECT id, player1_score, player2_score
            FROM games
            WHERE player1_id = ?
            ORDER BY id DESC
          `,
        )
        .all(context.user_id) as Array<{ id: number; player1_score: number; player2_score: number }>;

      if (!games || games.length === 0) {
        callback(null, {
          username: context.username,
          games: [],
          total_games: 0,
          message: 'No games played yet. Start your first game!'
        });
        return;
      }

      const formattedGames = games.map((game) => ({
        game_id: game.id,
        player1_score: game.player1_score,
        player2_score: game.player2_score,
        result: game.player1_score > game.player2_score ? 'won' : 'lost',
        opponent: 'AI',
      }));

      callback(null, {
        username: context.username,
        games: formattedGames,
        total_games: formattedGames.length,
      });
    } catch (error) {
      callback(error as Error);
    }
  },
});

export const startGrpcServer = async (gameServer: GameServer) => {
  const server = new Server();
  server.addService(gamePackage.GameSessionService.service, createGameHandlers(gameServer));

  const host = process.env.GAME_SESSION_GRPC_HOST || '0.0.0.0';
  const port = Number(process.env.GAME_SESSION_GRPC_PORT || 50054);

  await new Promise<void>((resolve, reject) => {
    server.bindAsync(`${host}:${port}`, ServerCredentials.createInsecure(), (error: Error | null) => {
      if (error) {
        reject(error);
        return;
      }
      server.start();
      console.log(`Game session gRPC server listening on ${host}:${port}`);
      resolve();
    });
  });

  return server;
};

