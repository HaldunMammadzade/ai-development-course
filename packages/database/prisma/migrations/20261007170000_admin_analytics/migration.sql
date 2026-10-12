CREATE TYPE "account_role" AS ENUM ('user', 'admin');

ALTER TABLE "users" ADD COLUMN "role" "account_role" NOT NULL DEFAULT 'user';

CREATE INDEX "users_created_at_idx" ON "users"("created_at");
CREATE INDEX "users_email_verified_at_idx" ON "users"("email_verified_at");
CREATE INDEX "lesson_progress_lesson_id_status_idx" ON "lesson_progress"("lesson_id", "status");
CREATE INDEX "lesson_progress_started_at_idx" ON "lesson_progress"("started_at");
CREATE INDEX "exercise_attempts_created_at_idx" ON "exercise_attempts"("created_at");
CREATE INDEX "exercise_attempts_user_id_passed_idx" ON "exercise_attempts"("user_id", "passed");
CREATE INDEX "ai_usage_task_type_created_at_idx" ON "ai_usage"("task_type", "created_at");
CREATE INDEX "transcription_usage_created_at_idx" ON "transcription_usage"("created_at");
CREATE INDEX "transcription_usage_status_idx" ON "transcription_usage"("status");
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");
CREATE INDEX "payment_events_status_received_at_idx" ON "payment_events"("status", "received_at");
CREATE INDEX "operational_jobs_status_updated_at_idx" ON "operational_jobs"("status", "updated_at");
CREATE INDEX "daily_activity_activity_date_idx" ON "daily_activity"("activity_date");

CREATE TABLE "admin_audit_log" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "admin_user_id" UUID NOT NULL,
  "action" TEXT NOT NULL,
  "target_type" TEXT,
  "target_id" TEXT,
  "correlation_id" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_audit_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "admin_audit_log_admin_user_id_created_at_idx" ON "admin_audit_log"("admin_user_id", "created_at");
CREATE INDEX "admin_audit_log_created_at_idx" ON "admin_audit_log"("created_at");

ALTER TABLE "admin_audit_log" ADD CONSTRAINT "admin_audit_log_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
