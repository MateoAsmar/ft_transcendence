import { insecureCredentials, loadProto } from './grpcHelpers';
import { promisify } from 'util';

const proto = loadProto('game.proto') as any;
const host = process.env.GAME_SESSION_GRPC_TARGET || 'game-session-service:50054';

const client = new proto.transcendence.game.GameSessionService(host, insecureCredentials) as any;

export const gameClient = {
  startGame: promisify(client.StartGame.bind(client)),
  endGame: promisify(client.EndGame.bind(client)),
  getStats: promisify(client.GetStats.bind(client)),
  getHistory: promisify(client.GetHistory.bind(client)),
};

