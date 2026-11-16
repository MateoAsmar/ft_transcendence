import { insecureCredentials, loadProto } from './grpcHelpers';
import { promisify } from 'util';

const proto = loadProto('friends.proto') as any;
const host = process.env.FRIENDS_GRPC_TARGET || 'friends-service:50052';

const client = new proto.transcendence.friends.FriendsService(host, insecureCredentials) as any;

export const friendsClient = {
  listFriends: promisify(client.ListFriends.bind(client)),
  listOnlineFriends: promisify(client.ListOnlineFriends.bind(client)),
  getReceivedRequests: promisify(client.GetReceivedRequests.bind(client)),
  getSentRequests: promisify(client.GetSentRequests.bind(client)),
  sendFriendRequest: promisify(client.SendFriendRequest.bind(client)),
  acceptFriendRequest: promisify(client.AcceptFriendRequest.bind(client)),
  rejectFriendRequest: promisify(client.RejectFriendRequest.bind(client)),
  removeFriend: promisify(client.RemoveFriend.bind(client)),
  searchUsers: promisify(client.SearchUsers.bind(client)),
  listInvitations: promisify(client.ListInvitations.bind(client)),
  sendGameInvitation: promisify(client.SendGameInvitation.bind(client)),
  acceptGameInvitation: promisify(client.AcceptGameInvitation.bind(client)),
  rejectGameInvitation: promisify(client.RejectGameInvitation.bind(client)),
};

