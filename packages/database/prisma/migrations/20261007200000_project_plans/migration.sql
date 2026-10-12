CREATE TABLE "project_plans" (
    "user_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "body" VARCHAR(2000) NOT NULL,
    "review" JSONB,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "project_plans_pkey" PRIMARY KEY ("user_id","project_id")
);

ALTER TABLE "project_plans" ADD CONSTRAINT "project_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_plans" ADD CONSTRAINT "project_plans_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
