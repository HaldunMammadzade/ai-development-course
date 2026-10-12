-- AlterEnum
ALTER TYPE "event_source" ADD VALUE IF NOT EXISTS 'speaking';

-- CreateEnum
CREATE TYPE "speaking_mode" AS ENUM ('lesson', 'interview');

-- CreateEnum
CREATE TYPE "speaking_session_status" AS ENUM ('active', 'completed', 'abandoned');

-- CreateEnum
CREATE TYPE "speaking_attempt_status" AS ENUM ('pending', 'transcribed', 'completed', 'unclear');

-- CreateEnum
CREATE TYPE "speaking_understanding" AS ENUM ('unknown', 'incorrect', 'partial', 'correct');

-- CreateTable
CREATE TABLE "speaking_questions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" TEXT NOT NULL,
    "concept_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "speaking_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "speaking_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "mode" "speaking_mode" NOT NULL,
    "status" "speaking_session_status" NOT NULL DEFAULT 'active',
    "current_question_id" UUID,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ,
    "ai_calls" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "speaking_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "speaking_attempts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "client_attempt_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "status" "speaking_attempt_status" NOT NULL DEFAULT 'pending',
    "transcript" TEXT NOT NULL DEFAULT '',
    "understanding" "speaking_understanding",
    "speech" TEXT NOT NULL DEFAULT '',
    "feedback" TEXT NOT NULL DEFAULT '',
    "strengths" JSONB NOT NULL DEFAULT '[]',
    "issues" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "speaking_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transcription_usage" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "duration_ms" INTEGER,
    "status" TEXT NOT NULL,
    "latency_ms" INTEGER NOT NULL,
    "cost_micros" BIGINT NOT NULL DEFAULT 0,
    "correlation_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transcription_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "speaking_questions_slug_key" ON "speaking_questions"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "speaking_questions_position_key" ON "speaking_questions"("position");

-- CreateIndex
CREATE INDEX "speaking_sessions_user_id_status_idx" ON "speaking_sessions"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "speaking_attempts_session_id_client_attempt_id_key" ON "speaking_attempts"("session_id", "client_attempt_id");

-- CreateIndex
CREATE INDEX "speaking_attempts_user_id_created_at_idx" ON "speaking_attempts"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "speaking_attempts_session_id_status_idx" ON "speaking_attempts"("session_id", "status");

-- CreateIndex
CREATE INDEX "transcription_usage_user_id_created_at_idx" ON "transcription_usage"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "speaking_questions" ADD CONSTRAINT "speaking_questions_concept_id_fkey" FOREIGN KEY ("concept_id") REFERENCES "concepts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speaking_sessions" ADD CONSTRAINT "speaking_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speaking_sessions" ADD CONSTRAINT "speaking_sessions_current_question_id_fkey" FOREIGN KEY ("current_question_id") REFERENCES "speaking_questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speaking_attempts" ADD CONSTRAINT "speaking_attempts_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "speaking_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speaking_attempts" ADD CONSTRAINT "speaking_attempts_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "speaking_questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speaking_attempts" ADD CONSTRAINT "speaking_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcription_usage" ADD CONSTRAINT "transcription_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
