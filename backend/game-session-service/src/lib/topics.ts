export const Topics = {
  PresenceStatus: 'presence.status',
  GameResults: 'game.results',
  ProfileEvents: 'profile.events',
  FriendEvents: 'friends.events',
} as const;

export type TopicName = (typeof Topics)[keyof typeof Topics];
