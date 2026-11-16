-- CreateIndex
CREATE INDEX IF NOT EXISTS "users_status_deleted_at_created_at_idx" ON "users"("status", "deleted_at", "created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "recipes_is_active_privacy_created_at_idx" ON "recipes"("is_active", "privacy", "created_at" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "recipes_user_id_is_active_privacy_created_at_idx" ON "recipes"("user_id", "is_active", "privacy", "created_at" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "recipe_tags_tag_id_idx" ON "recipe_tags"("tag_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "recipe_ingredients_ingredient_id_idx" ON "recipe_ingredients"("ingredient_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "comments_recipe_id_is_active_idx" ON "comments"("recipe_id", "is_active");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "comments_recipe_id_parent_id_created_at_idx" ON "comments"("recipe_id", "parent_id", "created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "comments_parent_id_created_at_idx" ON "comments"("parent_id", "created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "comments_user_id_is_active_idx" ON "comments"("user_id", "is_active");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "comments_created_at_idx" ON "comments"("created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "likes_recipe_id_idx" ON "likes"("recipe_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notifications_actor_id_idx" ON "notifications"("actor_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notifications_subject_target_id_idx" ON "notifications"("subject", "target_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "recipe_media_recipe_id_order_idx" ON "recipe_media"("recipe_id", "order");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "jwt_sessions_id_user_id_session_idx" ON "jwt_sessions"("id_user", "id_session");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "jwt_sessions_expire_time_jwt_idx" ON "jwt_sessions"("expire_time_jwt");

-- DropIndex
DROP INDEX IF EXISTS "user_blocks_blocker_id_idx";

-- CreateIndex
CREATE INDEX IF NOT EXISTS "reports_reporter_id_subject_target_id_status_idx" ON "reports"("reporter_id", "subject", "target_id", "status");

-- Enforce one active pending report per (reporter_id, subject, target_id) to prevent TOCTOU duplicates
CREATE UNIQUE INDEX IF NOT EXISTS "reports_pending_reporter_target_unique_idx"
ON "reports"("reporter_id", "subject", "target_id")
WHERE "status" = 'pending';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ban_history_report_id_idx" ON "ban_history"("report_id");
