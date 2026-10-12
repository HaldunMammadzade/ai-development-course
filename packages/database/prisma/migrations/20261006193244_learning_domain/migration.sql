/*
  Warnings:

  - You are about to drop the `quotas` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "locale" AS ENUM ('az-AZ', 'en', 'tr', 'ru');

-- CreateEnum
CREATE TYPE "explanation_style" AS ENUM ('clear', 'step_by_step', 'example_first', 'analogy', 'concise');

-- CreateEnum
CREATE TYPE "challenge_level" AS ENUM ('adaptive', 'gentle', 'standard', 'demanding');

-- CreateEnum
CREATE TYPE "path_track" AS ENUM ('frontend', 'backend', 'fullstack', 'skill');

-- CreateEnum
CREATE TYPE "publish_status" AS ENUM ('draft', 'published');

-- CreateEnum
CREATE TYPE "block_type" AS ENUM ('reading', 'check_question', 'recap');

-- CreateEnum
CREATE TYPE "concept_role" AS ENUM ('primary', 'supporting');

-- CreateEnum
CREATE TYPE "difficulty" AS ENUM ('beginner', 'easy', 'intermediate', 'advanced', 'expert');

-- CreateEnum
CREATE TYPE "enrollment_status" AS ENUM ('active', 'paused', 'completed');

-- CreateEnum
CREATE TYPE "progress_status" AS ENUM ('not_started', 'in_progress', 'completed');

-- CreateEnum
CREATE TYPE "teaching_mode" AS ENUM ('explain', 'socratic', 'practice', 'debug', 'challenge', 'interview', 'project', 'revision');

-- CreateEnum
CREATE TYPE "teaching_state" AS ENUM ('created', 'prior_check', 'objective', 'explain', 'comprehension_check', 'adapt', 'exercise', 'evaluate', 'hint', 'raise_difficulty', 'summarize', 'homework', 'completed', 'abandoned');

-- CreateEnum
CREATE TYPE "message_role" AS ENUM ('student', 'teacher', 'system');

-- CreateEnum
CREATE TYPE "event_source" AS ENUM ('lesson_check', 'exercise', 'quiz', 'code_review', 'interview', 'homework');

-- CreateEnum
CREATE TYPE "memory_category" AS ENUM ('learning', 'skill', 'mistake', 'project', 'interview', 'preference');

-- CreateEnum
CREATE TYPE "misconception_status" AS ENUM ('active', 'resolved');

-- CreateEnum
CREATE TYPE "homework_status" AS ENUM ('assigned', 'done', 'skipped');

-- CreateEnum
CREATE TYPE "plan_code" AS ENUM ('free', 'starter', 'pro', 'premium');

-- DropForeignKey
ALTER TABLE "quotas" DROP CONSTRAINT "quotas_user_id_fkey";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "locale" "locale" NOT NULL DEFAULT 'az-AZ',
ADD COLUMN     "name" VARCHAR(80),
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'UTC';

-- DropTable
DROP TABLE "quotas";

-- CreateTable
CREATE TABLE "student_preferences" (
    "user_id" UUID NOT NULL,
    "explanation_style" "explanation_style" NOT NULL DEFAULT 'clear',
    "challenge_level" "challenge_level" NOT NULL DEFAULT 'adaptive',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "student_preferences_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "learning_paths" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "track" "path_track" NOT NULL,
    "status" "publish_status" NOT NULL,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "learning_paths_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "path_id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lessons" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "module_id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "estimated_minutes" INTEGER NOT NULL,
    "status" "publish_status" NOT NULL,

    CONSTRAINT "lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_blocks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lesson_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "type" "block_type" NOT NULL,
    "body" JSONB NOT NULL,

    CONSTRAINT "lesson_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concepts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "summary" TEXT NOT NULL,

    CONSTRAINT "concepts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concept_prerequisites" (
    "concept_id" UUID NOT NULL,
    "prerequisite_id" UUID NOT NULL,

    CONSTRAINT "concept_prerequisites_pkey" PRIMARY KEY ("concept_id","prerequisite_id")
);

-- CreateTable
CREATE TABLE "lesson_concepts" (
    "lesson_id" UUID NOT NULL,
    "concept_id" UUID NOT NULL,
    "role" "concept_role" NOT NULL,

    CONSTRAINT "lesson_concepts_pkey" PRIMARY KEY ("lesson_id","concept_id")
);

-- CreateTable
CREATE TABLE "enrollments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "path_id" UUID NOT NULL,
    "status" "enrollment_status" NOT NULL DEFAULT 'active',
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ,

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_progress" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "status" "progress_status" NOT NULL DEFAULT 'not_started',
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "time_spent_seconds" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "lesson_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "concept_id" UUID NOT NULL,
    "source" "event_source" NOT NULL,
    "source_id" UUID,
    "evidence" SMALLINT NOT NULL,
    "weight" DECIMAL(4,2) NOT NULL DEFAULT 1,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_mastery" (
    "user_id" UUID NOT NULL,
    "concept_id" UUID NOT NULL,
    "score" SMALLINT NOT NULL,
    "evidence_count" INTEGER NOT NULL,
    "last_evidence_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "skill_mastery_pkey" PRIMARY KEY ("user_id","concept_id")
);

-- CreateTable
CREATE TABLE "misconceptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "concept_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "description" VARCHAR(280) NOT NULL,
    "status" "misconception_status" NOT NULL DEFAULT 'active',
    "occurrence_count" INTEGER NOT NULL DEFAULT 1,
    "last_seen_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "misconceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_activity" (
    "user_id" UUID NOT NULL,
    "activity_date" DATE NOT NULL,
    "teacher_turns" INTEGER NOT NULL DEFAULT 0,
    "lessons_completed" INTEGER NOT NULL DEFAULT 0,
    "minutes" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "daily_activity_pkey" PRIMARY KEY ("user_id","activity_date")
);

-- CreateTable
CREATE TABLE "teaching_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "mode" "teaching_mode" NOT NULL,
    "state" "teaching_state" NOT NULL,
    "turn_count" INTEGER NOT NULL DEFAULT 0,
    "summary" TEXT,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_activity_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ,

    CONSTRAINT "teaching_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teaching_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" UUID NOT NULL,
    "client_turn_id" TEXT,
    "role" "message_role" NOT NULL,
    "speech" TEXT NOT NULL,
    "payload" JSONB,
    "model" TEXT,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teaching_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "homework_assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "prompt" TEXT NOT NULL,
    "status" "homework_status" NOT NULL DEFAULT 'assigned',
    "due_at" TIMESTAMPTZ NOT NULL,
    "completed_at" TIMESTAMPTZ,

    CONSTRAINT "homework_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memory_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "category" "memory_category" NOT NULL,
    "concept_id" UUID,
    "content" VARCHAR(280) NOT NULL,
    "importance" SMALLINT NOT NULL,
    "session_id" UUID,
    "expires_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "explanation_cache" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "concept_id" UUID NOT NULL,
    "locale" "locale" NOT NULL,
    "difficulty" "difficulty" NOT NULL,
    "style" "explanation_style" NOT NULL,
    "speech" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "explanation_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "code" "plan_code" NOT NULL,
    "name" TEXT NOT NULL,
    "monthly_price_minor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'AZN',
    "daily_teacher_turns" INTEGER NOT NULL,
    "monthly_teacher_turns" INTEGER NOT NULL,
    "daily_strong_calls" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "user_plans" (
    "user_id" UUID NOT NULL,
    "plan_code" "plan_code" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "period_start" TIMESTAMPTZ NOT NULL,
    "period_end" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "user_plans_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "ai_usage" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "task_type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "cost_micros" BIGINT NOT NULL,
    "cached" BOOLEAN NOT NULL DEFAULT false,
    "latency_ms" INTEGER NOT NULL,
    "correlation_id" TEXT NOT NULL,
    "session_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "learning_paths_slug_key" ON "learning_paths"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "learning_paths_position_key" ON "learning_paths"("position");

-- CreateIndex
CREATE UNIQUE INDEX "modules_path_id_slug_key" ON "modules"("path_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "modules_path_id_position_key" ON "modules"("path_id", "position");

-- CreateIndex
CREATE INDEX "lessons_status_idx" ON "lessons"("status");

-- CreateIndex
CREATE UNIQUE INDEX "lessons_module_id_slug_key" ON "lessons"("module_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "lessons_module_id_position_key" ON "lessons"("module_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_blocks_lesson_id_position_key" ON "lesson_blocks"("lesson_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "concepts_slug_key" ON "concepts"("slug");

-- CreateIndex
CREATE INDEX "concepts_domain_idx" ON "concepts"("domain");

-- CreateIndex
CREATE INDEX "concept_prerequisites_prerequisite_id_idx" ON "concept_prerequisites"("prerequisite_id");

-- CreateIndex
CREATE INDEX "enrollments_user_id_status_idx" ON "enrollments"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_user_id_path_id_key" ON "enrollments"("user_id", "path_id");

-- CreateIndex
CREATE INDEX "lesson_progress_user_id_idx" ON "lesson_progress"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_progress_user_id_lesson_id_key" ON "lesson_progress"("user_id", "lesson_id");

-- CreateIndex
CREATE INDEX "learning_events_user_id_concept_id_created_at_idx" ON "learning_events"("user_id", "concept_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "skill_mastery_user_id_score_idx" ON "skill_mastery"("user_id", "score");

-- CreateIndex
CREATE INDEX "misconceptions_user_id_status_idx" ON "misconceptions"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "misconceptions_user_id_concept_id_code_key" ON "misconceptions"("user_id", "concept_id", "code");

-- CreateIndex
CREATE INDEX "teaching_sessions_user_id_started_at_idx" ON "teaching_sessions"("user_id", "started_at" DESC);

-- CreateIndex
CREATE INDEX "teaching_messages_session_id_created_at_idx" ON "teaching_messages"("session_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "teaching_messages_session_id_client_turn_id_key" ON "teaching_messages"("session_id", "client_turn_id");

-- CreateIndex
CREATE INDEX "homework_assignments_user_id_status_due_at_idx" ON "homework_assignments"("user_id", "status", "due_at");

-- CreateIndex
CREATE INDEX "memory_items_user_id_category_created_at_idx" ON "memory_items"("user_id", "category", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "explanation_cache_concept_id_locale_difficulty_style_key" ON "explanation_cache"("concept_id", "locale", "difficulty", "style");

-- CreateIndex
CREATE INDEX "user_plans_plan_code_idx" ON "user_plans"("plan_code");

-- CreateIndex
CREATE INDEX "ai_usage_user_id_created_at_idx" ON "ai_usage"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "ai_usage_created_at_idx" ON "ai_usage"("created_at");

-- AddForeignKey
ALTER TABLE "student_preferences" ADD CONSTRAINT "student_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modules" ADD CONSTRAINT "modules_path_id_fkey" FOREIGN KEY ("path_id") REFERENCES "learning_paths"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_blocks" ADD CONSTRAINT "lesson_blocks_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concept_prerequisites" ADD CONSTRAINT "concept_prerequisites_concept_id_fkey" FOREIGN KEY ("concept_id") REFERENCES "concepts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concept_prerequisites" ADD CONSTRAINT "concept_prerequisites_prerequisite_id_fkey" FOREIGN KEY ("prerequisite_id") REFERENCES "concepts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_concepts" ADD CONSTRAINT "lesson_concepts_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_concepts" ADD CONSTRAINT "lesson_concepts_concept_id_fkey" FOREIGN KEY ("concept_id") REFERENCES "concepts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_path_id_fkey" FOREIGN KEY ("path_id") REFERENCES "learning_paths"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_events" ADD CONSTRAINT "learning_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_events" ADD CONSTRAINT "learning_events_concept_id_fkey" FOREIGN KEY ("concept_id") REFERENCES "concepts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_mastery" ADD CONSTRAINT "skill_mastery_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_mastery" ADD CONSTRAINT "skill_mastery_concept_id_fkey" FOREIGN KEY ("concept_id") REFERENCES "concepts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "misconceptions" ADD CONSTRAINT "misconceptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "misconceptions" ADD CONSTRAINT "misconceptions_concept_id_fkey" FOREIGN KEY ("concept_id") REFERENCES "concepts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_activity" ADD CONSTRAINT "daily_activity_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teaching_sessions" ADD CONSTRAINT "teaching_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teaching_sessions" ADD CONSTRAINT "teaching_sessions_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teaching_messages" ADD CONSTRAINT "teaching_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "teaching_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homework_assignments" ADD CONSTRAINT "homework_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homework_assignments" ADD CONSTRAINT "homework_assignments_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "teaching_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homework_assignments" ADD CONSTRAINT "homework_assignments_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_items" ADD CONSTRAINT "memory_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_items" ADD CONSTRAINT "memory_items_concept_id_fkey" FOREIGN KEY ("concept_id") REFERENCES "concepts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_items" ADD CONSTRAINT "memory_items_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "teaching_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "explanation_cache" ADD CONSTRAINT "explanation_cache_concept_id_fkey" FOREIGN KEY ("concept_id") REFERENCES "concepts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_plans" ADD CONSTRAINT "user_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_plans" ADD CONSTRAINT "user_plans_plan_code_fkey" FOREIGN KEY ("plan_code") REFERENCES "plans"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- One open teaching session per user per lesson.
CREATE UNIQUE INDEX "teaching_sessions_one_open_per_lesson"
ON "teaching_sessions" ("user_id", "lesson_id")
WHERE "ended_at" IS NULL;

-- Phase 1 allows one active enrollment per user. Non-active rows can coexist.
CREATE UNIQUE INDEX "enrollments_one_active_per_user"
ON "enrollments" ("user_id")
WHERE "status" = 'active';

ALTER TABLE "learning_events"
ADD CONSTRAINT "learning_events_evidence_range" CHECK ("evidence" >= 0 AND "evidence" <= 100);

ALTER TABLE "skill_mastery"
ADD CONSTRAINT "skill_mastery_score_range" CHECK ("score" >= 0 AND "score" <= 100);

ALTER TABLE "concept_prerequisites"
ADD CONSTRAINT "concept_prerequisites_no_self" CHECK ("concept_id" <> "prerequisite_id");

ALTER TABLE "memory_items"
ADD CONSTRAINT "memory_items_importance_range" CHECK ("importance" >= 1 AND "importance" <= 3);

