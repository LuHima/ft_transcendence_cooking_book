-- Backfill ADR-0034 schema changes that were previously in schema.prisma without a migration:
-- 1. BanHistory.internal_notes column
-- 2. Nullable BanHistory.banned_by_id with ON DELETE SET NULL
-- 3. Report.resolved_by_id FK with ON DELETE SET NULL

ALTER TABLE "ban_history"
  ADD COLUMN IF NOT EXISTS "internal_notes" VARCHAR(1000),
  ALTER COLUMN "banned_by_id" DROP NOT NULL;

ALTER TABLE "ban_history" DROP CONSTRAINT IF EXISTS "ban_history_banned_by_id_fkey";
ALTER TABLE "ban_history"
  ADD CONSTRAINT "ban_history_banned_by_id_fkey"
  FOREIGN KEY ("banned_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "reports" DROP CONSTRAINT IF EXISTS "reports_resolved_by_id_fkey";
ALTER TABLE "reports"
  ADD CONSTRAINT "reports_resolved_by_id_fkey"
  FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "reports_resolved_by_id_idx" ON "reports"("resolved_by_id");
CREATE INDEX IF NOT EXISTS "ban_history_banned_by_id_idx" ON "ban_history"("banned_by_id");
CREATE INDEX IF NOT EXISTS "ban_history_unbanned_by_id_idx" ON "ban_history"("unbanned_by_id");
