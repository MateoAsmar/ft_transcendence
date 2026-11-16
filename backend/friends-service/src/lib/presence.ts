import { PresenceStatusEvent } from './events';

interface PresenceRecord {
  status: 'online' | 'offline';
  timestamp: string;
  username: string;
}

export class PresenceCache {
  private states = new Map<number, PresenceRecord>();

  update(event: PresenceStatusEvent) {
    this.states.set(event.userId, {
      status: event.status,
      timestamp: event.timestamp,
      username: event.username,
    });
  }

  get(userId: number) {
    return this.states.get(userId);
  }
}
