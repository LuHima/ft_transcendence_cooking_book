-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "OwnerType" AS ENUM ('user', 'platform');

-- CreateEnum
CREATE TYPE "MealType" AS ENUM ('breakfast', 'lunch', 'dinner', 'snack');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('image', 'video');

-- CreateEnum
CREATE TYPE "RecipeDifficulty" AS ENUM ('easy', 'medium', 'hard');

-- CreateEnum
CREATE TYPE "TranslationStatus" AS ENUM ('completed', 'failed');

-- CreateEnum
CREATE TYPE "TranslationSource" AS ENUM ('author_original', 'machine', 'manual');

-- CreateEnum
CREATE TYPE "Course" AS ENUM ('appetizer', 'first_course', 'main_course', 'dessert', 'side_dish', 'drink', 'snack');

-- CreateEnum
CREATE TYPE "UnitOfMeasure" AS ENUM ('g', 'kg', 'ml', 'cl', 'l', 'oz', 'lb', 'fl_oz', 'cup', 'tbsp', 'tsp', 'piece', 'pinch');

-- CreateEnum
CREATE TYPE "IngredientCategory" AS ENUM ('produce', 'dairy_eggs', 'meat_poultry', 'seafood', 'bakery_grains', 'pantry_spices', 'legumes_nuts', 'beverages_liquids', 'other');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'moderator', 'user');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'disabled', 'banned');

-- CreateEnum
CREATE TYPE "RecipePrivacy" AS ENUM ('public', 'friends_only', 'private');

-- CreateEnum
CREATE TYPE "ProfilePrivacy" AS ENUM ('public', 'friends_only', 'private');

-- CreateEnum
CREATE TYPE "NotificationSubject" AS ENUM ('recipe', 'comment', 'user');

-- CreateEnum
CREATE TYPE "NotificationAction" AS ENUM ('like', 'comment', 'friend_request', 'friend_accept', 'post', 'delete', 'update', 'warn');

-- CreateEnum
CREATE TYPE "FriendshipStatus" AS ENUM ('pending', 'accepted', 'rejected', 'none');

-- CreateEnum
CREATE TYPE "ReportSubject" AS ENUM ('recipe', 'comment', 'user');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('spam_scam', 'harassment_bullying', 'hate_speech', 'sexual_content', 'violence_threats', 'copyright_infringement', 'impersonation_misinformation', 'other');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('pending', 'dismissed', 'action_taken');

-- CreateEnum
CREATE TYPE "ReportAction" AS ENUM ('delete_content', 'ban', 'warn', 'dismiss');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "id_google" TEXT,
    "username" VARCHAR(30) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255),
    "avatar_url" VARCHAR(255),
    "bio" VARCHAR(500),
    "first_name" VARCHAR(100),
    "last_name" VARCHAR(100),
    "birth_date" DATE,
    "phone" VARCHAR(30),
    "address" VARCHAR(255),
    "city" VARCHAR(100),
    "postal_code" VARCHAR(10),
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "profile_privacy" "ProfilePrivacy" NOT NULL DEFAULT 'public',
    "banned_until" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "role" "Role" NOT NULL DEFAULT 'user',
    "two_factor" VARCHAR(255),
    "is_two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipes" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "owner_type" "OwnerType" NOT NULL DEFAULT 'user',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "suspended_by_ban" BOOLEAN NOT NULL DEFAULT false,
    "privacy" "RecipePrivacy" NOT NULL DEFAULT 'public',
    "course" "Course" NOT NULL DEFAULT 'main_course',
    "difficulty" "RecipeDifficulty" NOT NULL DEFAULT 'easy',
    "prep_time" INTEGER NOT NULL DEFAULT 0,
    "cook_time" INTEGER NOT NULL DEFAULT 0,
    "total_time" INTEGER NOT NULL DEFAULT 0,
    "servings" INTEGER NOT NULL DEFAULT 1,
    "source_lang" VARCHAR(5) NOT NULL DEFAULT 'en',
    "translation_status" "TranslationStatus" NOT NULL DEFAULT 'completed',
    "cover_image_url" VARCHAR(500),
    "video_url" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_translations" (
    "recipe_id" INTEGER NOT NULL,
    "locale" VARCHAR(5) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "preservation" TEXT,
    "tips" TEXT,
    "translation_source" "TranslationSource" NOT NULL DEFAULT 'machine',

    CONSTRAINT "recipe_translations_pkey" PRIMARY KEY ("recipe_id","locale")
);

-- CreateTable
CREATE TABLE "recipe_steps" (
    "id" SERIAL NOT NULL,
    "recipe_id" INTEGER NOT NULL,
    "step_number" INTEGER NOT NULL,
    "duration" INTEGER,
    "image_url" VARCHAR(500),

    CONSTRAINT "recipe_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_step_translations" (
    "step_id" INTEGER NOT NULL,
    "locale" VARCHAR(5) NOT NULL,
    "title" VARCHAR(255),
    "description" TEXT NOT NULL,

    CONSTRAINT "recipe_step_translations_pkey" PRIMARY KEY ("step_id","locale")
);

-- CreateTable
CREATE TABLE "recipe_tags" (
    "recipe_id" INTEGER NOT NULL,
    "tag_id" INTEGER NOT NULL,

    CONSTRAINT "recipe_tags_pkey" PRIMARY KEY ("recipe_id","tag_id")
);

-- CreateTable
CREATE TABLE "ingredients" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "category" "IngredientCategory" NOT NULL,

    CONSTRAINT "ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredient_translations" (
    "ingredient_id" INTEGER NOT NULL,
    "locale" VARCHAR(5) NOT NULL,
    "name" VARCHAR(100) NOT NULL,

    CONSTRAINT "ingredient_translations_pkey" PRIMARY KEY ("ingredient_id","locale")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(50) NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tag_translations" (
    "tag_id" INTEGER NOT NULL,
    "locale" VARCHAR(5) NOT NULL,
    "name" VARCHAR(100) NOT NULL,

    CONSTRAINT "tag_translations_pkey" PRIMARY KEY ("tag_id","locale")
);

-- CreateTable
CREATE TABLE "recipe_ingredients" (
    "recipe_id" INTEGER NOT NULL,
    "ingredient_id" INTEGER NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unit" "UnitOfMeasure" NOT NULL,
    "notes" JSONB,

    CONSTRAINT "recipe_ingredients_pkey" PRIMARY KEY ("recipe_id","ingredient_id")
);

-- CreateTable
CREATE TABLE "friendships" (
    "id" SERIAL NOT NULL,
    "requester_id" INTEGER NOT NULL,
    "addressee_id" INTEGER NOT NULL,
    "status" "FriendshipStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "friendships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" SERIAL NOT NULL,
    "recipe_id" INTEGER NOT NULL,
    "user_id" INTEGER,
    "parent_id" INTEGER,
    "content" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_edited" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "likes" (
    "user_id" INTEGER NOT NULL,
    "recipe_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "likes_pkey" PRIMARY KEY ("user_id","recipe_id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "actor_id" INTEGER NOT NULL,
    "subject" "NotificationSubject" NOT NULL,
    "action" "NotificationAction" NOT NULL,
    "target_id" INTEGER,
    "details" VARCHAR(1000),
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_media" (
    "id" SERIAL NOT NULL,
    "recipe_id" INTEGER NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "media_type" "MediaType" NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipe_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jwt_sessions" (
    "id_session" SERIAL NOT NULL,
    "id_user" INTEGER NOT NULL,
    "hashed_jwt_token" VARCHAR(255) NOT NULL,
    "expire_time_jwt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jwt_sessions_pkey" PRIMARY KEY ("id_session")
);

-- CreateTable
CREATE TABLE "user_blocks" (
    "id" SERIAL NOT NULL,
    "blocker_id" INTEGER NOT NULL,
    "blocked_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" SERIAL NOT NULL,
    "reporter_id" INTEGER NOT NULL,
    "subject" "ReportSubject" NOT NULL,
    "target_id" INTEGER NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "description" VARCHAR(1000),
    "status" "ReportStatus" NOT NULL DEFAULT 'pending',
    "actions" "ReportAction"[] DEFAULT ARRAY[]::"ReportAction"[],
    "resolution_reason" "ReportReason",
    "resolution_description" VARCHAR(1000),
    "resolution_notes" VARCHAR(1000),
    "resolved_by_id" INTEGER,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ban_history" (
    "id" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "banned_by_id" INTEGER,
    "report_id" INTEGER,
    "action" "ReportAction" NOT NULL DEFAULT 'ban',
    "reason" "ReportReason" NOT NULL,
    "description" VARCHAR(1000),
    "internal_notes" VARCHAR(1000),
    "duration_days" INTEGER,
    "is_permanent" BOOLEAN NOT NULL DEFAULT false,
    "banned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "unbanned_at" TIMESTAMP(3),
    "unbanned_by_id" INTEGER,
    "unban_reason" VARCHAR(1000),

    CONSTRAINT "ban_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_id_google_key" ON "users"("id_google");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_status_deleted_at_created_at_idx" ON "users"("status", "deleted_at", "created_at");

-- CreateIndex
CREATE INDEX "recipes_privacy_is_active_idx" ON "recipes"("privacy", "is_active");

-- CreateIndex
CREATE INDEX "recipes_is_active_privacy_created_at_idx" ON "recipes"("is_active", "privacy", "created_at" DESC);

-- CreateIndex
CREATE INDEX "recipes_user_id_is_active_privacy_created_at_idx" ON "recipes"("user_id", "is_active", "privacy", "created_at" DESC);

-- CreateIndex
CREATE INDEX "recipe_translations_locale_title_idx" ON "recipe_translations"("locale", "title");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_steps_recipe_id_step_number_key" ON "recipe_steps"("recipe_id", "step_number");

-- CreateIndex
CREATE INDEX "recipe_tags_tag_id_idx" ON "recipe_tags"("tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "ingredients_slug_key" ON "ingredients"("slug");

-- CreateIndex
CREATE INDEX "ingredients_category_idx" ON "ingredients"("category");

-- CreateIndex
CREATE INDEX "ingredient_translations_locale_name_idx" ON "ingredient_translations"("locale", "name");

-- CreateIndex
CREATE UNIQUE INDEX "tags_slug_key" ON "tags"("slug");

-- CreateIndex
CREATE INDEX "tag_translations_locale_name_idx" ON "tag_translations"("locale", "name");

-- CreateIndex
CREATE INDEX "recipe_ingredients_ingredient_id_idx" ON "recipe_ingredients"("ingredient_id");

-- CreateIndex
CREATE INDEX "friendships_addressee_id_status_idx" ON "friendships"("addressee_id", "status");

-- CreateIndex
CREATE INDEX "friendships_requester_id_status_idx" ON "friendships"("requester_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "friendships_requester_id_addressee_id_key" ON "friendships"("requester_id", "addressee_id");

-- CreateIndex
CREATE INDEX "comments_recipe_id_is_active_idx" ON "comments"("recipe_id", "is_active");

-- CreateIndex
CREATE INDEX "comments_recipe_id_parent_id_created_at_idx" ON "comments"("recipe_id", "parent_id", "created_at");

-- CreateIndex
CREATE INDEX "comments_parent_id_created_at_idx" ON "comments"("parent_id", "created_at");

-- CreateIndex
CREATE INDEX "comments_user_id_is_active_idx" ON "comments"("user_id", "is_active");

-- CreateIndex
CREATE INDEX "comments_created_at_idx" ON "comments"("created_at");

-- CreateIndex
CREATE INDEX "likes_recipe_id_idx" ON "likes"("recipe_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_created_at_idx" ON "notifications"("user_id", "is_read", "created_at");

-- CreateIndex
CREATE INDEX "notifications_actor_id_idx" ON "notifications"("actor_id");

-- CreateIndex
CREATE INDEX "notifications_subject_target_id_idx" ON "notifications"("subject", "target_id");

-- CreateIndex
CREATE INDEX "recipe_media_recipe_id_order_idx" ON "recipe_media"("recipe_id", "order");

-- CreateIndex
CREATE INDEX "jwt_sessions_id_user_id_session_idx" ON "jwt_sessions"("id_user", "id_session");

-- CreateIndex
CREATE INDEX "jwt_sessions_expire_time_jwt_idx" ON "jwt_sessions"("expire_time_jwt");

-- CreateIndex
CREATE INDEX "user_blocks_blocked_id_idx" ON "user_blocks"("blocked_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_blocks_blocker_id_blocked_id_key" ON "user_blocks"("blocker_id", "blocked_id");

-- CreateIndex
CREATE INDEX "reports_status_created_at_idx" ON "reports"("status", "created_at");

-- CreateIndex
CREATE INDEX "reports_subject_target_id_idx" ON "reports"("subject", "target_id");

-- CreateIndex
CREATE INDEX "reports_subject_status_target_id_idx" ON "reports"("subject", "status", "target_id");

-- CreateIndex
CREATE INDEX "reports_resolved_by_id_idx" ON "reports"("resolved_by_id");

-- CreateIndex
CREATE INDEX "reports_reporter_id_subject_target_id_status_idx" ON "reports"("reporter_id", "subject", "target_id", "status");

-- CreateIndex
CREATE INDEX "ban_history_user_id_banned_at_idx" ON "ban_history"("user_id", "banned_at");

-- CreateIndex
CREATE INDEX "ban_history_banned_at_idx" ON "ban_history"("banned_at");

-- CreateIndex
CREATE INDEX "ban_history_banned_by_id_idx" ON "ban_history"("banned_by_id");

-- CreateIndex
CREATE INDEX "ban_history_unbanned_by_id_idx" ON "ban_history"("unbanned_by_id");

-- CreateIndex
CREATE INDEX "ban_history_report_id_idx" ON "ban_history"("report_id");

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_translations" ADD CONSTRAINT "recipe_translations_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_steps" ADD CONSTRAINT "recipe_steps_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_step_translations" ADD CONSTRAINT "recipe_step_translations_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "recipe_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_tags" ADD CONSTRAINT "recipe_tags_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_tags" ADD CONSTRAINT "recipe_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredient_translations" ADD CONSTRAINT "ingredient_translations_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tag_translations" ADD CONSTRAINT "tag_translations_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_addressee_id_fkey" FOREIGN KEY ("addressee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "likes" ADD CONSTRAINT "likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "likes" ADD CONSTRAINT "likes_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_media" ADD CONSTRAINT "recipe_media_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jwt_sessions" ADD CONSTRAINT "jwt_sessions_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocker_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocked_id_fkey" FOREIGN KEY ("blocked_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ban_history" ADD CONSTRAINT "ban_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ban_history" ADD CONSTRAINT "ban_history_banned_by_id_fkey" FOREIGN KEY ("banned_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ban_history" ADD CONSTRAINT "ban_history_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ban_history" ADD CONSTRAINT "ban_history_unbanned_by_id_fkey" FOREIGN KEY ("unbanned_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
