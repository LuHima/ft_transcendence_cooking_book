# 0009: Bidirectional Friendships and Social Lifecycle

## Context

The platform initially inherited a monodirectional follower model (`follows` table, Instagram-style). A culinary social community requires reciprocal, consensual peer-to-peer relationships (Facebook-style) to foster collaboration, meal sharing, and direct real-time presence.

## Decision

1. **Schema & Model**: Decommission the `follows` table entirely in favor of a single `friendships` table (`requester_id`, `addressee_id`, `status: pending | accepted`).
2. **Atomic Lifecycle**:
   - Requests are created with `status: pending`.
   - Rejection and cancellation perform an immediate **hard delete** of the pending row, accompanied by cascading cleanup of orphaned `friend_request` notification rows in the recipient's inbox.
   - Unfriending performs a **silent hard delete** of the accepted row without notifying the counterparty.
   - **Cross-Request Auto-Accept**: If User A sends a request to User B while User B already has an active pending request to User A, the system immediately resolves the relationship into `accepted` and dispatches a `friend_accept` notification.
3. **API Ergonomics**: Target user IDs are used directly in mutation endpoints (`POST /friends/requests/:userId/accept`, `DELETE /friends/requests/:userId`) rather than internal database request IDs.
4. **Presence & Notifications**: Notification fan-outs and WebSocket presence (`userStatus`) query accepted bidirectional friendships instead of follows.
