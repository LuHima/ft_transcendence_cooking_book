-- CreateEnum
CREATE TYPE "RecipeDifficulty" AS ENUM ('easy', 'medium', 'hard');

-- DropForeignKey
ALTER TABLE "shopping_lists" DROP CONSTRAINT "shopping_lists_user_id_fkey";

-- DropForeignKey
ALTER TABLE "shopping_lists" DROP CONSTRAINT "shopping_lists_meal_plan_id_fkey";

-- DropForeignKey
ALTER TABLE "shopping_list_items" DROP CONSTRAINT "shopping_list_items_shopping_list_id_fkey";

-- DropForeignKey
ALTER TABLE "shopping_list_items" DROP CONSTRAINT "shopping_list_items_ingredient_id_fkey";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "address" VARCHAR(255),
ADD COLUMN     "birth_date" DATE,
ADD COLUMN     "city" VARCHAR(100),
ADD COLUMN     "first_name" VARCHAR(100),
ADD COLUMN     "last_name" VARCHAR(100),
ADD COLUMN     "phone" VARCHAR(30),
ADD COLUMN     "postal_code" VARCHAR(10);

-- AlterTable
ALTER TABLE "recipes" ADD COLUMN     "difficulty" "RecipeDifficulty" NOT NULL DEFAULT 'easy';

-- DropTable
DROP TABLE "shopping_lists";

-- DropTable
DROP TABLE "shopping_list_items";
