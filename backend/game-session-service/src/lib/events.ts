export interface PresenceStatusEvent {
  userId: number;
  username: string;
  status: 'online' | 'offline';
  timestamp: string;
}

export interface GameResultEvent {
  gameId: number;
  playerId: number;
  opponentId: number | null;
  playerScore: number;
  opponentScore: number;
  won: boolean;
  recordedAt: string;
}

export interface ProfileEvent {
  type:
    | 'profileUpdated'
    | 'friendAdded'
    | 'friendRemoved'
    | 'friendRequest'
    | 'friendAccepted'
    | 'gameInvitation'
    | 'gameInvitationDeclined';
  userId: number;
  payload: Record<string, unknown>;
  emittedAt: string;
}
