-- AlterTable
ALTER TABLE "users" DROP COLUMN "roles";
ALTER TABLE "users" ADD COLUMN "role" "Role" NOT NULL DEFAULT 'user';
