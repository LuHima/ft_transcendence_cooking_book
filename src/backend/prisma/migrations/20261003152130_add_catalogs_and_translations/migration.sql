/*
  Warnings:

  - You are about to drop the column `name` on the `ingredients` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[slug]` on the table `ingredients` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `category` to the `ingredients` table without a default value. This is not possible if the table is not empty.
  - Added the required column `slug` to the `ingredients` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `unit` on the `recipe_ingredients` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "Course" AS ENUM ('appetizer', 'first_course', 'main_course', 'dessert', 'side_dish', 'drink', 'snack');

-- CreateEnum
CREATE TYPE "UnitOfMeasure" AS ENUM ('g', 'kg', 'ml', 'cl', 'l', 'oz', 'lb', 'fl_oz', 'cup', 'tbsp', 'tsp', 'piece', 'pinch');

-- CreateEnum
CREATE TYPE "IngredientCategory" AS ENUM ('produce', 'dairy_eggs', 'meat_poultry', 'seafood', 'bakery_grains', 'pantry_spices', 'legumes_nuts', 'beverages_liquids', 'other');

-- DropIndex
DROP INDEX "ingredients_name_key";

-- AlterTable
ALTER TABLE "ingredients" DROP COLUMN "name",
ADD COLUMN     "category" "IngredientCategory" NOT NULL,
ADD COLUMN     "slug" VARCHAR(100) NOT NULL;

-- AlterTable
ALTER TABLE "recipe_ingredients" ADD COLUMN     "notes" JSONB,
DROP COLUMN "unit",
ADD COLUMN     "unit" "UnitOfMeasure" NOT NULL;

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

-- CreateIndex
CREATE INDEX "ingredient_translations_locale_name_idx" ON "ingredient_translations"("locale", "name");

-- CreateIndex
CREATE UNIQUE INDEX "tags_slug_key" ON "tags"("slug");

-- CreateIndex
CREATE INDEX "tag_translations_locale_name_idx" ON "tag_translations"("locale", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ingredients_slug_key" ON "ingredients"("slug");

-- AddForeignKey
ALTER TABLE "ingredient_translations" ADD CONSTRAINT "ingredient_translations_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tag_translations" ADD CONSTRAINT "tag_translations_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
