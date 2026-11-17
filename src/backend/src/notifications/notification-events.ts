export const USER_EVICT_EVENT = 'user.evict' as const;

export interface UserEvictEventPayload {
  userId: number;
}
