import { insecureCredentials, loadProto } from './grpcHelpers';
import { promisify } from 'util';

const proto = loadProto('stats.proto') as any;
const host = process.env.STATS_GRPC_TARGET || 'stats-service:50053';

const client = new proto.transcendence.stats.StatsService(host, insecureCredentials) as any;

export const statsClient = {
  getDashboardDetailed: promisify(client.GetDashboardDetailed.bind(client)),
  getDashboardSessions: promisify(client.GetDashboardSessions.bind(client)),
  getLeaderboard: promisify(client.GetLeaderboard.bind(client)),
};

