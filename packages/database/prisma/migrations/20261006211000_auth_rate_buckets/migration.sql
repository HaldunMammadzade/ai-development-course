-- CreateTable
CREATE TABLE "auth_rate_buckets" (
    "action" TEXT NOT NULL,
    "subject_hash" TEXT NOT NULL,
    "window_start" TIMESTAMPTZ NOT NULL,
    "hits" INTEGER NOT NULL,

    CONSTRAINT "auth_rate_buckets_pkey" PRIMARY KEY ("action", "subject_hash", "window_start")
);
