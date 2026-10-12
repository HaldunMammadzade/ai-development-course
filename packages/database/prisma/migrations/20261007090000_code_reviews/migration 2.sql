CREATE TYPE "code_review_mode" AS ENUM ('explain', 'hint', 'review');

CREATE TYPE "code_review_status" AS ENUM ('pending', 'completed');

CREATE TABLE "code_reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "exercise_id" UUID NOT NULL,
    "attempt_id" UUID NOT NULL,
    "client_review_id" UUID NOT NULL,
    "mode" "code_review_mode" NOT NULL,
    "status" "code_review_status" NOT NULL,
    "result" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ,

    CONSTRAINT "code_reviews_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "code_reviews_user_id_attempt_id_client_review_id_mode_key" ON "code_reviews"("user_id", "attempt_id", "client_review_id", "mode");

CREATE INDEX "code_reviews_attempt_id_mode_status_idx" ON "code_reviews"("attempt_id", "mode", "status");

ALTER TABLE "code_reviews" ADD CONSTRAINT "code_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "code_reviews" ADD CONSTRAINT "code_reviews_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "code_reviews" ADD CONSTRAINT "code_reviews_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "exercise_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
