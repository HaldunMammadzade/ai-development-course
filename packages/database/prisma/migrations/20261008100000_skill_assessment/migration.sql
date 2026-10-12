CREATE TYPE "skill_assessment_status" AS ENUM ('in_progress', 'completed', 'skipped');

CREATE TABLE "skill_assessments" (
    "user_id" UUID NOT NULL,
    "status" "skill_assessment_status" NOT NULL,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ,

    CONSTRAINT "skill_assessments_pkey" PRIMARY KEY ("user_id")
);

CREATE TABLE "skill_assessment_answers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "item_id" VARCHAR(80) NOT NULL,
    "client_attempt_id" UUID NOT NULL,
    "submission" VARCHAR(2000) NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skill_assessment_answers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "skill_assessment_answers_user_id_item_id_key" ON "skill_assessment_answers"("user_id", "item_id");

CREATE UNIQUE INDEX "skill_assessment_answers_user_id_client_attempt_id_key" ON "skill_assessment_answers"("user_id", "client_attempt_id");

CREATE INDEX "skill_assessment_answers_user_id_created_at_idx" ON "skill_assessment_answers"("user_id", "created_at");

ALTER TABLE "skill_assessments" ADD CONSTRAINT "skill_assessments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "skill_assessment_answers" ADD CONSTRAINT "skill_assessment_answers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "skill_assessments"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
