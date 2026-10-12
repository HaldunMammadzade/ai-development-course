ALTER TYPE "event_source" ADD VALUE 'project';

CREATE TABLE "projects" (
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

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "projects_slug_key" ON "projects"("slug");

CREATE TABLE "project_requirements" (
    "project_id" UUID NOT NULL,
    "concept_id" UUID NOT NULL,

    CONSTRAINT "project_requirements_pkey" PRIMARY KEY ("project_id","concept_id")
);

CREATE INDEX "project_requirements_concept_id_idx" ON "project_requirements"("concept_id");

CREATE TABLE "project_milestones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "concept_id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "starter_files" JSONB NOT NULL,
    "checks" JSONB NOT NULL,

    CONSTRAINT "project_milestones_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "project_milestones_project_id_slug_key" ON "project_milestones"("project_id", "slug");

CREATE UNIQUE INDEX "project_milestones_project_id_position_key" ON "project_milestones"("project_id", "position");

CREATE INDEX "project_milestones_project_id_position_idx" ON "project_milestones"("project_id", "position");

CREATE TABLE "project_milestone_progress" (
    "user_id" UUID NOT NULL,
    "milestone_id" UUID NOT NULL,
    "score" SMALLINT NOT NULL,
    "passed_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "project_milestone_progress_pkey" PRIMARY KEY ("user_id","milestone_id")
);

CREATE INDEX "project_milestone_progress_user_id_idx" ON "project_milestone_progress"("user_id");

CREATE TABLE "project_attempts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "milestone_id" UUID NOT NULL,
    "client_attempt_id" UUID NOT NULL,
    "files" JSONB NOT NULL,
    "status" "exercise_attempt_status" NOT NULL,
    "score" SMALLINT NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "feedback" TEXT NOT NULL,
    "passed_checks" JSONB NOT NULL,
    "failed_checks" JSONB NOT NULL,
    "attempt_number" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_attempts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "project_attempts_user_id_milestone_id_client_attempt_id_key" ON "project_attempts"("user_id", "milestone_id", "client_attempt_id");

CREATE INDEX "project_attempts_user_id_milestone_id_created_at_idx" ON "project_attempts"("user_id", "milestone_id", "created_at" DESC);

CREATE TABLE "project_reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "milestone_id" UUID NOT NULL,
    "attempt_id" UUID NOT NULL,
    "client_review_id" UUID NOT NULL,
    "mode" "code_review_mode" NOT NULL,
    "status" "code_review_status" NOT NULL,
    "result" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ,

    CONSTRAINT "project_reviews_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "project_reviews_user_id_attempt_id_client_review_id_mode_key" ON "project_reviews"("user_id", "attempt_id", "client_review_id", "mode");

CREATE INDEX "project_reviews_attempt_id_mode_status_idx" ON "project_reviews"("attempt_id", "mode", "status");

CREATE TABLE "project_execution_claims" (
    "user_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "milestone_id" UUID NOT NULL,
    "client_attempt_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_execution_claims_pkey" PRIMARY KEY ("user_id","project_id","milestone_id","client_attempt_id")
);

CREATE INDEX "project_execution_claims_created_at_idx" ON "project_execution_claims"("created_at");

ALTER TABLE "project_requirements" ADD CONSTRAINT "project_requirements_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_requirements" ADD CONSTRAINT "project_requirements_concept_id_fkey" FOREIGN KEY ("concept_id") REFERENCES "concepts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "project_milestones" ADD CONSTRAINT "project_milestones_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_milestones" ADD CONSTRAINT "project_milestones_concept_id_fkey" FOREIGN KEY ("concept_id") REFERENCES "concepts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "project_milestone_progress" ADD CONSTRAINT "project_milestone_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_milestone_progress" ADD CONSTRAINT "project_milestone_progress_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "project_milestones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_attempts" ADD CONSTRAINT "project_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_attempts" ADD CONSTRAINT "project_attempts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_attempts" ADD CONSTRAINT "project_attempts_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "project_milestones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_reviews" ADD CONSTRAINT "project_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_reviews" ADD CONSTRAINT "project_reviews_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "project_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_reviews" ADD CONSTRAINT "project_reviews_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "project_milestones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_execution_claims" ADD CONSTRAINT "project_execution_claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_execution_claims" ADD CONSTRAINT "project_execution_claims_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_execution_claims" ADD CONSTRAINT "project_execution_claims_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "project_milestones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
