export const Topics = {
  ProfileEvents: 'profile.events',
  FriendEvents: 'friends.events',
} as const;

export type TopicName = (typeof Topics)[keyof typeof Topics];
