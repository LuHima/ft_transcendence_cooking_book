# 0015: Friendship Lifecycle, Rejection Cooldown, and Notification Pruning

We decided to record a persistent `rejected` status on friend request decline with an enforced 30-day anti-harassment cooldown, make friend request creation idempotent against unique constraint collisions, and prune actionable/stale notifications on request acceptance, cross-request auto-acceptance, and unfriending.

## Context

1. **Re-request Spamming After Rejection**: Previously, `rejectFriendRequest` performed an immediate hard delete of the pending `Friendship` row (per initial ADR 0009 specification). Because no rejection history was retained in the database, a rejected user could immediately re-send another friend request, enabling persistent harassment and alert spam.
2. **Inbox Notification Stagnation on Acceptance**: When User B accepted User A's friend request, the system emitted a `friend_accept` notification to User A, but never resolved or removed the original incoming `friend_request` notification in User B's inbox. This left misleading unread counters and obsolete action items.
3. **Cross-Request Auto-Accept Leaks**: When User A sent a request to User B while User B already had a pending request to User A, the system auto-resolved the friendship into `accepted`. However, User A's inbox still held the unread `friend_request` alert from User B.
4. **Concurrency Race Conditions on "Add Friend"**: If a user rapidly tapped "Add Friend" or if mobile network retries sent parallel requests, the non-atomic check-then-create sequence resulted in Prisma `P2002` unique constraint violations (`500 Internal Server Error`).
5. **Orphaned Social Alerts on Unfriend**: When an established friendship was removed (`removeFriend`), unread historical friend alerts lingered in user inboxes.

## Decision

1. **Rejection State & 30-Day Anti-Harassment Cooldown**:
   - In `rejectFriendRequest`, update the friendship row to `status: 'rejected'` with `updated_at: new Date()`, instead of deleting it.
   - In `sendFriendRequest`:
     - If an existing row has `requester_id === requesterId, addressee_id === recipientId, status === 'rejected'`:
       - If `Date.now() - updated_at.getTime() < 30 * 24 * 60 * 60 * 1000` (within 30 days): throw `ConflictException('Friend request cannot be sent to this user')`.
       - If elapsed time is `>= 30 days`: update the existing row to `status: 'pending'` and emit `friend_request` notification.
     - If an existing row has `requester_id === recipientId, addressee_id === requesterId, status === 'rejected'` (the rejecter now initiates a request):
       - Allow the request; update the row to `requester_id: requesterId, addressee_id: recipientId, status: 'pending'` and emit notification.
   - For public profile and search display, `status: 'rejected'` maps to `friendship_status: 'none'`.
2. **Idempotent Parallel Request Handling**:
   - In `sendFriendRequest`, catch Prisma `P2002` (unique constraint on `[requester_id, addressee_id]`) and return `{ message: 'Friend request sent', status: 'pending' }` without throwing 500 errors.
3. **Actionable Notification Cleanup on Acceptance**:
   - In `acceptFriendRequest`, permanently delete the incoming `friend_request` notification from the accepter's inbox (`prisma.notification.deleteMany({ where: { user_id: userId, actor_id: requesterId, action: 'friend_request' } })`).
   - In cross-request auto-accept (`sendFriendRequest`), delete the pending `friend_request` notification in the caller's inbox (`user_id: requesterId, actor_id: recipientId, action: 'friend_request'`), in addition to notifying the counterparty.
4. **Notification Pruning on Unfriend (`removeFriend`)**:
   - When deleting an accepted friendship, delete any unread `friend_request` or `friend_accept` notifications between the two users (`is_read: false`).

## Consequences

- Completely prevents repeated friend request spamming after rejection while allowing a reasonable 30-day cooldown recovery.
- Keeps notification centers actionable and free of ghost alerts for already-established friendships.
- Provides resilient double-click idempotency without 500 crashes.
- Amends ADR 0009 regarding hard-deletion of rejected requests.
