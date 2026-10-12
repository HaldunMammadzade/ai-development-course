CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");
CREATE INDEX "sessions_revoked_at_idx" ON "sessions"("revoked_at");
CREATE INDEX "email_verification_tokens_expires_at_idx" ON "email_verification_tokens"("expires_at");
CREATE INDEX "password_reset_tokens_expires_at_idx" ON "password_reset_tokens"("expires_at");
CREATE INDEX "checkout_sessions_status_created_at_idx" ON "checkout_sessions"("status", "created_at");
CREATE INDEX "auth_rate_buckets_window_start_idx" ON "auth_rate_buckets"("window_start");

CREATE TABLE "operational_jobs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "status" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "max_attempts" INTEGER NOT NULL DEFAULT 5,
  "run_after" TIMESTAMPTZ NOT NULL,
  "locked_at" TIMESTAMPTZ,
  "last_error" TEXT,
  "correlation_id" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "operational_jobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "operational_jobs_name_idempotency_key_key" ON "operational_jobs"("name", "idempotency_key");
CREATE INDEX "operational_jobs_status_run_after_idx" ON "operational_jobs"("status", "run_after");
