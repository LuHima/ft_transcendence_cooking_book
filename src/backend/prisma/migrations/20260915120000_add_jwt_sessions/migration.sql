-- AlterTable
ALTER TABLE "users" DROP COLUMN "hashed_refresh_token";

-- CreateTable
CREATE TABLE "jwt_sessions" (
    "id_session" SERIAL NOT NULL,
    "id_user" INTEGER NOT NULL,
    "hashed_jwt_token" VARCHAR(255) NOT NULL,
    "expire_time_jwt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jwt_sessions_pkey" PRIMARY KEY ("id_session")
);

-- CreateIndex
CREATE INDEX "jwt_sessions_id_user_idx" ON "jwt_sessions"("id_user");

-- AddForeignKey
ALTER TABLE "jwt_sessions" ADD CONSTRAINT "jwt_sessions_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;