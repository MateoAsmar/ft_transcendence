import { insecureCredentials, loadProto } from './grpcHelpers';
import { promisify } from 'util';

const proto = loadProto('matchmaking.proto') as any;
const host = process.env.MATCHMAKING_GRPC_TARGET || 'matchmaking-service:50055';

const client = new proto.transcendence.matchmaking.MatchmakingService(host, insecureCredentials) as any;

export const matchmakingClient = {
  queueForMatch: promisify(client.QueueForMatch.bind(client)),
  cancelQueue: promisify(client.CancelQueue.bind(client)),
};

