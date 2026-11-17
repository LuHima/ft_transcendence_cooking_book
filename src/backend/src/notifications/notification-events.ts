import type { EventEmitter2 } from '@nestjs/event-emitter';

export const USER_EVICT_EVENT = 'user.evict' as const;

export interface UserEvictEventPayload {
  userId: number;
}

export function emitUserEvict(
  eventEmitter: Pick<EventEmitter2, 'emit'> | undefined,
  userId: number | null | undefined,
): void {
  if (!userId || !eventEmitter) return;
  const payload: UserEvictEventPayload = { userId };
  eventEmitter.emit(USER_EVICT_EVENT, payload);
}
