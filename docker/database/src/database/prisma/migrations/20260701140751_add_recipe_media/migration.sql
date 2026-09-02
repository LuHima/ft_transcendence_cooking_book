-- DropTable: shopping list feature removed
DROP TABLE "shopping_list_items";
DROP TABLE "shopping_lists";

-- CreateEnum
CREATE TYPE "RecipeDifficulty" AS ENUM ('easy', 'medium', 'hard');

-- AlterTable: recipes
ALTER TABLE "recipes" ADD COLUMN "difficulty" "RecipeDifficulty" NOT NULL DEFAULT 'easy';

-- AlterTable: users (anagrafica estesa)
ALTER TABLE "users" ADD COLUMN "first_name" VARCHAR(100);
ALTER TABLE "users" ADD COLUMN "last_name" VARCHAR(100);
ALTER TABLE "users" ADD COLUMN "birth_date" DATE;
ALTER TABLE "users" ADD COLUMN "phone" VARCHAR(30);
ALTER TABLE "users" ADD COLUMN "address" VARCHAR(255);
ALTER TABLE "users" ADD COLUMN "city" VARCHAR(100);
ALTER TABLE "users" ADD COLUMN "postal_code" VARCHAR(10);