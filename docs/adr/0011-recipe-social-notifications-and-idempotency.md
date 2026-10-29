# 0011: Recipe Social Notifications, Idempotency, and Lifecycle Cleanup

We decided to wire recipe engagement actions (likes, comments, replies) directly to `NotificationEmit`, enforce atomic idempotent operations for likes/unlikes, prune unread notifications on unliking and entity deletion, and scope reply notifications exclusively to the parent comment author.

## Context

1. **Disconnected Social Feedback Loop**: While `NotificationEmit` supported recipe and comment notification formatting, `RecipeService` was never wired to dispatch them. Liking recipes or posting comments/replies occurred silently, breaking user engagement.
2. **Notification Fatigue vs. Thread Relevance**: When discussions occur on recipes, notifying the recipe author on every single nested reply creates excessive spam. The direct author of the parent comment is the intended recipient of the reply.
3. **Ghost Notifications & Orphaned Records**: Because `Notification.target_id` is a polymorphic integer in PostgreSQL (it references recipes, comments, or users without a database foreign key), PostgreSQL cannot `ON DELETE CASCADE` notifications when a recipe or comment is deleted or when a like is removed. Leaving unread alerts when a user unlikes or deletes their comment creates confusing phantom notifications.
4. **Concurrency Race Conditions**: Concurrent like requests (e.g., rapid double-clicking or mobile network retries) using a non-atomic read-then-write pattern caused Prisma `P2002` (unique constraint violation) and `P2025` (record not found on delete), returning unhandled `500 Internal Server Error` responses.

## Decision

1. **Direct Service Dispatch**:
   - Inject `NotificationEmit` directly into `RecipeService`.
   - Dispatch notifications synchronously after persistent database mutations.
2. **Notification Targeting Rules**:
   - **Recipe Like**: Notify the recipe author (`subject: recipe`, `action: like`, `target_id: recipeId`).
   - **Top-Level Comment**: Notify the recipe author (`subject: recipe`, `action: comment`, `target_id: recipeId`).
   - **Comment Reply**: Notify strictly the parent comment author (`subject: comment`, `action: comment`, `target_id: parentCommentId`). Do not notify the recipe author unless they are the parent comment author.
   - **Self-Action Suppression**: Never generate notifications if the actor is also the recipient (`actor_id === user_id`).
3. **Idempotent Like & Unlike Handling**:
   - Use atomic `prisma.like.create` catching Prisma `P2002` (idempotent no-op). Only dispatch notifications if the like record was newly created.
   - On unlike, delete the like record catching Prisma `P2025` (idempotent no-op).
4. **Lifecycle Notification Cleanup**:
   - **Unlike Cleanup**: When unliking, delete any unread notification (`is_read: false`) from the actor for that recipe like. Leave read notifications (`is_read: true`) intact as historical records.
   - **Entity Deletion Cleanup**:
     - When deactivating a comment (`deleteComment`), delete any unread notifications where `subject = comment` and `target_id = commentId`.
     - When deleting a recipe (`deleteRecipe`), delete all notifications where `subject = recipe` and `target_id = recipeId`.

## Consequences

- Restores real-time and persistent social feedback loops across recipe likes, comments, and replies.
- Eliminates 500 crashes and UI error banners during rapid double-tapping on like buttons.
- Prevents notification fatigue by keeping reply notifications scoped to conversation participants.
- Prevents phantom unread notifications and dead navigation links in user inboxes.
