export const Topics = {
  MatchmakingRequests: 'matchmaking.requests',
  MatchmakingCancelled: 'matchmaking.cancelled',
} as const;

export type TopicName = (typeof Topics)[keyof typeof Topics];

