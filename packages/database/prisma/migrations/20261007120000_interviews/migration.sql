CREATE TYPE "interview_question_type" AS ENUM ('verbal', 'code');
CREATE TYPE "interview_session_status" AS ENUM ('active', 'completed', 'abandoned');
CREATE TYPE "interview_phase" AS ENUM ('question', 'follow_up');
CREATE TYPE "interview_understanding" AS ENUM ('unknown', 'incorrect', 'partial', 'correct');
CREATE TYPE "interview_answer_status" AS ENUM ('pending', 'completed');

CREATE TABLE "interviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "difficulty" "difficulty" NOT NULL,
    "estimated_minutes" INTEGER NOT NULL,
    "status" "publish_status" NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "interviews_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "interviews_slug_key" ON "interviews"("slug");

CREATE TABLE "interview_requirements" (
    "interview_id" UUID NOT NULL,
    "concept_id" UUID NOT NULL,

    CONSTRAINT "interview_requirements_pkey" PRIMARY KEY ("interview_id","concept_id")
);

CREATE INDEX "interview_requirements_concept_id_idx" ON "interview_requirements"("concept_id");

CREATE TABLE "interview_questions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "interview_id" UUID NOT NULL,
    "concept_id" UUID NOT NULL,
    "parent_id" UUID,
    "slug" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "type" "interview_question_type" NOT NULL,
    "difficulty" "difficulty" NOT NULL,
    "status" "publish_status" NOT NULL,
    "criteria" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "starter_code" TEXT,
    "execution" JSONB,

    CONSTRAINT "interview_questions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "interview_questions_interview_id_slug_key" ON "interview_questions"("interview_id", "slug");
CREATE UNIQUE INDEX "interview_questions_interview_id_position_key" ON "interview_questions"("interview_id", "position");
CREATE INDEX "interview_questions_interview_id_position_idx" ON "interview_questions"("interview_id", "position");

CREATE TABLE "interview_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "interview_id" UUID NOT NULL,
    "status" "interview_session_status" NOT NULL DEFAULT 'active',
    "phase" "interview_phase" NOT NULL DEFAULT 'question',
    "current_question_id" UUID,
    "follow_ups_used" INTEGER NOT NULL DEFAULT 0,
    "ai_calls" INTEGER NOT NULL DEFAULT 0,
    "final_score" SMALLINT,
    "band" VARCHAR(16),
    "report" JSONB,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ,

    CONSTRAINT "interview_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "interview_sessions_user_id_status_idx" ON "interview_sessions"("user_id", "status");
CREATE INDEX "interview_sessions_user_id_started_at_idx" ON "interview_sessions"("user_id", "started_at");

CREATE TABLE "interview_answers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "client_answer_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "code" TEXT,
    "status" "interview_answer_status" NOT NULL DEFAULT 'pending',
    "understanding" "interview_understanding",
    "reasoning" VARCHAR(16),
    "execution_score" SMALLINT,
    "evidence" SMALLINT NOT NULL DEFAULT 0,
    "speech" TEXT NOT NULL DEFAULT '',
    "feedback" TEXT NOT NULL DEFAULT '',
    "strengths" JSONB NOT NULL DEFAULT '[]',
    "issues" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evaluated_at" TIMESTAMPTZ,

    CONSTRAINT "interview_answers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "interview_answers_session_id_client_answer_id_key" ON "interview_answers"("session_id", "client_answer_id");
CREATE INDEX "interview_answers_session_id_status_idx" ON "interview_answers"("session_id", "status");

CREATE TABLE "interview_execution_claims" (
    "user_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "client_answer_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interview_execution_claims_pkey" PRIMARY KEY ("user_id","session_id","question_id","client_answer_id")
);

CREATE INDEX "interview_execution_claims_created_at_idx" ON "interview_execution_claims"("created_at");

ALTER TABLE "interview_requirements" ADD CONSTRAINT "interview_requirements_interview_id_fkey" FOREIGN KEY ("interview_id") REFERENCES "interviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "interview_requirements" ADD CONSTRAINT "interview_requirements_concept_id_fkey" FOREIGN KEY ("concept_id") REFERENCES "concepts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "interview_questions" ADD CONSTRAINT "interview_questions_interview_id_fkey" FOREIGN KEY ("interview_id") REFERENCES "interviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "interview_questions" ADD CONSTRAINT "interview_questions_concept_id_fkey" FOREIGN KEY ("concept_id") REFERENCES "concepts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "interview_questions" ADD CONSTRAINT "interview_questions_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "interview_questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_interview_id_fkey" FOREIGN KEY ("interview_id") REFERENCES "interviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_current_question_id_fkey" FOREIGN KEY ("current_question_id") REFERENCES "interview_questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "interview_answers" ADD CONSTRAINT "interview_answers_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "interview_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "interview_answers" ADD CONSTRAINT "interview_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "interview_questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "interview_answers" ADD CONSTRAINT "interview_answers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "interview_execution_claims" ADD CONSTRAINT "interview_execution_claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "interview_execution_claims" ADD CONSTRAINT "interview_execution_claims_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "interview_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "interview_execution_claims" ADD CONSTRAINT "interview_execution_claims_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "interview_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
