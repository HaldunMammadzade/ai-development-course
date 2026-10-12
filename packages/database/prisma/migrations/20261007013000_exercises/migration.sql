-- CreateEnum
CREATE TYPE "exercise_type" AS ENUM ('multiple_choice', 'code_text');

-- CreateEnum
CREATE TYPE "exercise_language" AS ENUM ('html', 'css', 'javascript');

-- CreateEnum
CREATE TYPE "exercise_attempt_status" AS ENUM ('passed', 'failed');

-- CreateTable
CREATE TABLE "exercises" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lesson_id" UUID NOT NULL,
    "concept_id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "type" "exercise_type" NOT NULL,
    "language" "exercise_language",
    "difficulty" "difficulty" NOT NULL,
    "position" INTEGER NOT NULL,
    "starter_code" TEXT,
    "rules" JSONB NOT NULL,
    "options" JSONB NOT NULL DEFAULT '[]',
    "published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercise_attempts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "exercise_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "client_attempt_id" TEXT NOT NULL,
    "submission" TEXT NOT NULL,
    "status" "exercise_attempt_status" NOT NULL,
    "score" SMALLINT NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "feedback" TEXT NOT NULL,
    "passed_rules" JSONB NOT NULL,
    "failed_rules" JSONB NOT NULL,
    "attempt_number" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exercise_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "exercises_slug_key" ON "exercises"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "exercises_lesson_id_position_key" ON "exercises"("lesson_id", "position");

-- CreateIndex
CREATE INDEX "exercises_lesson_id_published_idx" ON "exercises"("lesson_id", "published");

-- CreateIndex
CREATE UNIQUE INDEX "exercise_attempts_user_id_exercise_id_client_attempt_id_key" ON "exercise_attempts"("user_id", "exercise_id", "client_attempt_id");

-- CreateIndex
CREATE INDEX "exercise_attempts_user_id_exercise_id_created_at_idx" ON "exercise_attempts"("user_id", "exercise_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_concept_id_fkey" FOREIGN KEY ("concept_id") REFERENCES "concepts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_attempts" ADD CONSTRAINT "exercise_attempts_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_attempts" ADD CONSTRAINT "exercise_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "exercise_attempts" ADD CONSTRAINT "exercise_attempts_score_check" CHECK ("score" >= 0 AND "score" <= 100);

ALTER TABLE "exercise_attempts" ADD CONSTRAINT "exercise_attempts_attempt_number_check" CHECK ("attempt_number" >= 1);
