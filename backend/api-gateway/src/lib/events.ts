export interface ProfileEvent {
  type: string;
  userId: number;
  payload: Record<string, unknown>;
  emittedAt: string;
}

