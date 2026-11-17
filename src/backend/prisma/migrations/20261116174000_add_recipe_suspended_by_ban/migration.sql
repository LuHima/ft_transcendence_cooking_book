-- AlterTable
ALTER TABLE "recipes" ADD COLUMN "suspended_by_ban" BOOLEAN NOT NULL DEFAULT false;
