-- AlterTable
ALTER TABLE "exercises" ADD COLUMN "execution" JSONB;

-- CreateTable
CREATE TABLE "exercise_execution_claims" (
    "user_id" UUID NOT NULL,
    "exercise_id" UUID NOT NULL,
    "client_attempt_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exercise_execution_claims_pkey" PRIMARY KEY ("user_id","exercise_id","client_attempt_id")
);

-- CreateIndex
CREATE INDEX "exercise_execution_claims_created_at_idx" ON "exercise_execution_claims"("created_at");

-- AddForeignKey
ALTER TABLE "exercise_execution_claims" ADD CONSTRAINT "exercise_execution_claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_execution_claims" ADD CONSTRAINT "exercise_execution_claims_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;
