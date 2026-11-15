-- CreateIndex
CREATE INDEX "reports_subject_status_target_id_idx" ON "reports"("subject", "status", "target_id");
