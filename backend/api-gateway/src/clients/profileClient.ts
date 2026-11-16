import { insecureCredentials, loadProto } from './grpcHelpers';
import { promisify } from 'util';

const proto = loadProto('profile.proto') as any;

const host = process.env.PROFILE_GRPC_TARGET || 'profile-service:50051';

const client = new proto.transcendence.profile.ProfileService(host, insecureCredentials) as any;

export const profileClient = {
  getProfile: promisify(client.GetProfile.bind(client)),
  updateProfile: promisify(client.UpdateProfile.bind(client)),
  getHistory: promisify(client.GetHistory.bind(client)),
  getStats: promisify(client.GetStats.bind(client)),
  updateAvatar: promisify(client.UpdateAvatar.bind(client)),
  deleteAccount: promisify(client.DeleteAccount.bind(client)),
  anonymizeAccount: promisify(client.AnonymizeAccount.bind(client)),
  exportUserData: promisify(client.ExportUserData.bind(client)),
};

