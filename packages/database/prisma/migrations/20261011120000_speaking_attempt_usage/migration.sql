ALTER TABLE "ai_usage" ADD COLUMN "speaking_attempt_id" UUID;

ALTER TABLE "transcription_usage" ADD COLUMN "speaking_attempt_id" UUID;

CREATE INDEX "ai_usage_speaking_attempt_id_idx" ON "ai_usage"("speaking_attempt_id");

CREATE INDEX "transcription_usage_speaking_attempt_id_idx" ON "transcription_usage"("speaking_attempt_id");
