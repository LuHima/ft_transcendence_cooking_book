-- CreateEnum
CREATE TYPE "TranslationStatus" AS ENUM ('completed', 'failed');

-- AlterTable
ALTER TABLE "recipes" DROP COLUMN "description",
DROP COLUMN "instructions",
DROP COLUMN "title",
ADD COLUMN     "cook_time" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "course" "Course" NOT NULL DEFAULT 'main_course',
ADD COLUMN     "cover_image_url" VARCHAR(500),
ADD COLUMN     "servings" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "source_lang" VARCHAR(5) NOT NULL DEFAULT 'it',
ADD COLUMN     "total_time" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "translation_status" "TranslationStatus" NOT NULL DEFAULT 'completed',
ADD COLUMN     "updated_at" TIMESTAMP(3),
ADD COLUMN     "video_url" VARCHAR(500),
ALTER COLUMN "prep_time" SET NOT NULL,
ALTER COLUMN "prep_time" SET DEFAULT 0;

-- CreateTable
CREATE TABLE "recipe_translations" (
    "recipe_id" INTEGER NOT NULL,
    "locale" VARCHAR(5) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "preservation" TEXT,
    "tips" TEXT,

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

-- CreateIndex
CREATE INDEX "recipe_translations_locale_title_idx" ON "recipe_translations"("locale", "title");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_steps_recipe_id_step_number_key" ON "recipe_steps"("recipe_id", "step_number");

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
