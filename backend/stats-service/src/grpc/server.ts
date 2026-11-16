import fs from 'fs';
import path from 'path';
import { loadPackageDefinition, Server, ServerCredentials } from '@grpc/grpc-js';
import { loadSync } from '@grpc/proto-loader';
import { getDatabase } from '../lib';

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

const PROTO_PATH = resolveProtoPath('stats.proto');

const packageDefinition = loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const protoDescriptor = loadPackageDefinition(packageDefinition) as any;
const statsPackage = protoDescriptor.transcendence.stats;

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

const handlers = {
  async GetDashboardDetailed(
    call: GrpcCall<{ context?: UserContext }>,
    callback: GrpcCallback<any>,
  ) {
    try {
      const context = ensureUserContext(call.request.context);
      const userId = context.user_id;

      const basicStats = db
        .prepare(
          `
            SELECT 
              COUNT(*) as total_games,
              SUM(CASE WHEN winner_id = ? THEN 1 ELSE 0 END) as wins,
              SUM(CASE WHEN winner_id IS NULL OR winner_id != ? THEN 1 ELSE 0 END) as losses
            FROM games 
            WHERE player1_id = ? OR player2_id = ?
          `,
        )
        .get(userId, userId, userId, userId) as any;

      const recentGames = db
        .prepare(
          `
            SELECT winner_id, player1_id, player2_id, created_at
            FROM games
            WHERE player1_id = ? OR player2_id = ?
            ORDER BY created_at DESC
            LIMIT 20
          `,
        )
        .all(userId, userId) as any[];

      let currentStreak = 0;
      for (const game of recentGames) {
        if (game.winner_id === userId) {
          currentStreak++;
        } else {
          break;
        }
      }

      const gamesToday = db
        .prepare(
          `
            SELECT COUNT(*) as count
            FROM games
            WHERE (player1_id = ? OR player2_id = ?)
              AND DATE(created_at) = DATE('now')
          `,
        )
        .get(userId, userId) as any;

      const weekGames = db
        .prepare(
          `
            SELECT COUNT(*) as count
            FROM games
            WHERE (player1_id = ? OR player2_id = ?)
              AND created_at >= datetime('now', '-7 days')
          `,
        )
        .get(userId, userId) as any;

      const scoreStats = db
        .prepare(
          `
            SELECT 
              AVG(CASE WHEN player1_id = ? THEN player1_score ELSE player2_score END) as avg_score,
              AVG(CASE WHEN player1_id = ? THEN player2_score ELSE player1_score END) as avg_score_against,
              MAX(CASE WHEN player1_id = ? THEN player1_score ELSE player2_score END) as best_player_score,
              MIN(CASE WHEN player1_id = ? THEN player2_score ELSE player1_score END) as best_opponent_score
            FROM games 
            WHERE player1_id = ? OR player2_id = ?
          `,
        )
        .get(userId, userId, userId, userId, userId, userId) as any;

      const aiGames = db
        .prepare(
          `
            SELECT COUNT(*) as ai_games, SUM(CASE WHEN winner_id = ? THEN 1 ELSE 0 END) as ai_wins
            FROM games 
            WHERE player1_id = ? AND player2_id IS NULL
          `,
        )
        .get(userId, userId) as any;

      const playerGames = db
        .prepare(
          `
            SELECT COUNT(*) as player_games, SUM(CASE WHEN winner_id = ? THEN 1 ELSE 0 END) as player_wins
            FROM games 
            WHERE (player1_id = ? OR player2_id = ?) AND player2_id IS NOT NULL
          `,
        )
        .get(userId, userId, userId) as any;

      const recentWinRate = recentGames
        .slice(0, 5)
        .reduce((acc, game) => (game.winner_id === userId ? acc + 1 : acc), 0) * 20;

      const winRateTrend: number[] = [];
      for (let i = 6; i >= 0; i--) {
        const dayGames = db
          .prepare(
            `
              SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN winner_id = ? THEN 1 ELSE 0 END) as wins
              FROM games 
              WHERE (player1_id = ? OR player2_id = ?) 
                AND DATE(created_at) = DATE('now', '-${i} days')
            `,
          )
          .get(userId, userId, userId) as any;
        const dayWinRate = dayGames.total > 0 ? Math.round((dayGames.wins / dayGames.total) * 100) : 0;
        winRateTrend.push(dayWinRate);
      }

      const achievements: string[] = [];
      if ((basicStats?.wins || 0) > 0) achievements.push('first_win');
      if ((basicStats?.total_games || 0) >= 100) achievements.push('century');
      if (currentStreak >= 5) achievements.push('hot_streak');

      const perfectGames = db
        .prepare(
          `
            SELECT COUNT(*) as count
            FROM games 
            WHERE winner_id = ? 
              AND ((player1_id = ? AND player1_score = 3 AND player2_score = 0) 
                OR (player2_id = ? AND player2_score = 3 AND player1_score = 0))
          `,
        )
        .get(userId, userId, userId) as any;
      if (perfectGames.count > 0) achievements.push('perfect_game');

      const bestScore =
        scoreStats.best_player_score && scoreStats.best_opponent_score !== undefined
          ? `${scoreStats.best_player_score}-${scoreStats.best_opponent_score}`
          : '0-0';

      callback(null, {
        success: true,
        wins: basicStats.wins || 0,
        losses: basicStats.losses || 0,
        total_games: basicStats.total_games || 0,
        current_streak: currentStreak,
        games_today: gamesToday.count || 0,
        games_week: weekGames.count || 0,
        avg_score: scoreStats.avg_score || 0,
        avg_score_against: scoreStats.avg_score_against || 0,
        best_score: bestScore,
        ai_wins: aiGames.ai_wins || 0,
        player_wins: playerGames.player_wins || 0,
        recent_win_rate: recentWinRate,
        win_rate_trend: winRateTrend,
        achievements,
      });
    } catch (error) {
      callback(error as Error);
    }
  },

  async GetDashboardSessions(
    call: GrpcCall<{ context?: UserContext }>,
    callback: GrpcCallback<any>,
  ) {
    try {
      const context = ensureUserContext(call.request.context);
      const userId = context.user_id;

      const sessions = db
        .prepare(
          `
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
                WHEN g.player2_id IS NULL THEN 'AI'
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
              CASE 
                WHEN g.player2_id IS NULL THEN 'AI'
                WHEN g.player1_id = ? THEN p2.username
                ELSE p1.username
              END as opponent_name,
              CASE
                WHEN g.player2_id IS NULL THEN 'ai'
                ELSE 'player'
              END as game_mode
            FROM games g
            LEFT JOIN users p1 ON g.player1_id = p1.id
            LEFT JOIN users p2 ON g.player2_id = p2.id
            WHERE g.player1_id = ? OR g.player2_id = ?
            ORDER BY g.created_at DESC
            LIMIT 50
          `,
        )
        .all(userId, userId, userId, userId, userId, userId) as any[];

      callback(null, {
        success: true,
        sessions,
      });
    } catch (error) {
      callback(error as Error);
    }
  },

  async GetLeaderboard(
    call: GrpcCall<{ context?: UserContext; period?: string }>,
    callback: GrpcCallback<any>,
  ) {
    try {
      const context = ensureUserContext(call.request.context);
      const period = call.request.period || 'all';

      let dateFilter = '';
      if (period === 'weekly') {
        dateFilter = "AND g.created_at >= datetime('now', '-7 days')";
      } else if (period === 'monthly') {
        dateFilter = "AND g.created_at >= datetime('now', '-30 days')";
      }

      const leaderboardQuery = `
        SELECT 
          u.id,
          u.username,
          u.display_name,
          u.avatar_url,
          u.oauth_avatar_url,
          COALESCE(stats.wins, 0) as wins,
          COALESCE(stats.losses, 0) as losses,
          COALESCE(stats.total_games, 0) as total_games,
          CASE 
            WHEN COALESCE(stats.total_games, 0) > 0 
            THEN ROUND(COALESCE(stats.wins, 0) * 100.0 / stats.total_games, 2)
            ELSE 0 
          END as win_rate
        FROM users u
        LEFT JOIN (
          SELECT 
            user_id,
            COUNT(*) as total_games,
            SUM(CASE WHEN is_winner = 1 THEN 1 ELSE 0 END) as wins,
            SUM(CASE WHEN is_winner = 0 THEN 1 ELSE 0 END) as losses
          FROM (
            SELECT 
              p1.id as user_id,
              g.id as game_id,
              CASE WHEN g.winner_id = p1.id THEN 1 ELSE 0 END as is_winner
            FROM users p1
            LEFT JOIN games g ON (g.player1_id = p1.id OR g.player2_id = p1.id)
            WHERE g.id IS NOT NULL ${dateFilter}
            
            UNION ALL
            
            SELECT 
              p1.id as user_id,
              m.id as game_id,
              CASE WHEN m.winner_id = p1.id THEN 1 ELSE 0 END as is_winner
            FROM users p1
            LEFT JOIN match_history m ON (m.player1_id = p1.id OR m.player2_id = p1.id)
            WHERE m.id IS NOT NULL ${dateFilter.replace(/g\./g, 'm.')}
          )
          GROUP BY user_id
        ) stats ON u.id = stats.user_id
        WHERE COALESCE(stats.total_games, 0) > 0
        ORDER BY win_rate DESC, wins DESC, total_games DESC
        LIMIT 50
      `;

      const leaderboard = db.prepare(leaderboardQuery).all();

      const userRankingQuery = `
        SELECT 
          rank_table.rank,
          rank_table.id,
          rank_table.username,
          rank_table.display_name,
          rank_table.wins,
          rank_table.losses,
          rank_table.total_games,
          rank_table.win_rate
        FROM (
          SELECT 
            u.id,
            u.username,
            u.display_name,
            COALESCE(stats.wins, 0) as wins,
            COALESCE(stats.losses, 0) as losses,
            COALESCE(stats.total_games, 0) as total_games,
            CASE 
              WHEN COALESCE(stats.total_games, 0) > 0 
              THEN ROUND(COALESCE(stats.wins, 0) * 100.0 / stats.total_games, 2)
              ELSE 0 
            END as win_rate,
            ROW_NUMBER() OVER (
              ORDER BY 
                CASE 
                  WHEN COALESCE(stats.total_games, 0) > 0 
                  THEN ROUND(COALESCE(stats.wins, 0) * 100.0 / stats.total_games, 2)
                  ELSE 0 
                END DESC,
                COALESCE(stats.wins, 0) DESC,
                COALESCE(stats.total_games, 0) DESC
            ) as rank
          FROM users u
          LEFT JOIN (
            SELECT 
              user_id,
              COUNT(*) as total_games,
              SUM(CASE WHEN is_winner = 1 THEN 1 ELSE 0 END) as wins,
              SUM(CASE WHEN is_winner = 0 THEN 1 ELSE 0 END) as losses
            FROM (
              SELECT 
                p1.id as user_id,
                g.id as game_id,
                CASE WHEN g.winner_id = p1.id THEN 1 ELSE 0 END as is_winner
              FROM users p1
              LEFT JOIN games g ON (g.player1_id = p1.id OR g.player2_id = p1.id)
              WHERE g.id IS NOT NULL ${dateFilter}
              
              UNION ALL
              
              SELECT 
                p1.id as user_id,
                m.id as game_id,
                CASE WHEN m.winner_id = p1.id THEN 1 ELSE 0 END as is_winner
              FROM users p1
              LEFT JOIN match_history m ON (m.player1_id = p1.id OR m.player2_id = p1.id)
              WHERE m.id IS NOT NULL ${dateFilter.replace(/g\./g, 'm.')}
            )
            GROUP BY user_id
          ) stats ON u.id = stats.user_id
          WHERE COALESCE(stats.total_games, 0) > 0
        ) rank_table
        WHERE rank_table.id = ?
      `;

      const userRanking = db.prepare(userRankingQuery).get(context.user_id) as any;

      let finalUserRanking = userRanking;
      if (!userRanking) {
        const userInfo = db
          .prepare('SELECT id, username, display_name FROM users WHERE id = ?')
          .get(context.user_id) as any;
        if (userInfo) {
          finalUserRanking = {
            rank: leaderboard.length + 1,
            id: userInfo.id,
            username: userInfo.username,
            display_name: userInfo.display_name,
            wins: 0,
            losses: 0,
            total_games: 0,
            win_rate: 0,
          };
        }
      }

      callback(null, {
        success: true,
        leaderboard,
        user_ranking: finalUserRanking,
        period,
      });
    } catch (error) {
      callback(error as Error);
    }
  },
};

export const startGrpcServer = async () => {
  const server = new Server();
  server.addService(statsPackage.StatsService.service, handlers);

  const host = process.env.STATS_GRPC_HOST || '0.0.0.0';
  const port = Number(process.env.STATS_GRPC_PORT || 50053);

  await new Promise<void>((resolve, reject) => {
    server.bindAsync(`${host}:${port}`, ServerCredentials.createInsecure(), (error) => {
      if (error) {
        reject(error);
        return;
      }
      server.start();
      console.log(`Stats gRPC server listening on ${host}:${port}`);
      resolve();
    });
  });

  return server;
};

