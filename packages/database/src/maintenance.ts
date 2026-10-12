import type { Prisma } from "./generated/prisma/client";
import type { PrismaClient } from "./platform-prisma";

type CleanupClient = PrismaClient | Prisma.TransactionClient;

const CLAIM_TTL_MS = 2 * 60 * 1000;
const TEACHING_CLAIM_TTL_MS = 60 * 1000;
const CHECKOUT_TTL_MS = 24 * 60 * 60 * 1000;
const RATE_WINDOW_MS = 8 * 24 * 60 * 60 * 1000;
const COMPLETED_JOB_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface CleanupCounts {
  sessions: number;
  verificationTokens: number;
  resetTokens: number;
  teachingClaims: number;
  exerciseClaims: number;
  projectClaims: number;
  interviewClaims: number;
  checkouts: number;
  rateBuckets: number;
  jobs: number;
}

export async function runOperationalCleanup(
  prisma: CleanupClient,
  now = new Date(),
): Promise<CleanupCounts> {
  const claimCutoff = new Date(now.getTime() - CLAIM_TTL_MS);
  const teachingCutoff = new Date(now.getTime() - TEACHING_CLAIM_TTL_MS);
  const checkoutCutoff = new Date(now.getTime() - CHECKOUT_TTL_MS);
  const rateCutoff = new Date(now.getTime() - RATE_WINDOW_MS);
  const jobCutoff = new Date(now.getTime() - COMPLETED_JOB_TTL_MS);

  const sessions = await prisma.session.deleteMany({
    where: { OR: [{ revokedAt: { not: null } }, { expiresAt: { lt: now } }] },
  });
  const verificationTokens = await prisma.emailVerificationToken.deleteMany({
    where: { OR: [{ consumedAt: { not: null } }, { expiresAt: { lt: now } }] },
  });
  const resetTokens = await prisma.passwordResetToken.deleteMany({
    where: { OR: [{ consumedAt: { not: null } }, { expiresAt: { lt: now } }] },
  });
  const teachingClaims = await prisma.$executeRaw`
    DELETE FROM teaching_messages
    WHERE role = 'student'
      AND created_at < ${teachingCutoff}
      AND payload->>'status' = 'pending'
  `;
  const exerciseClaims = await prisma.exerciseExecutionClaim.deleteMany({
    where: { createdAt: { lt: claimCutoff } },
  });
  const projectClaims = await prisma.projectExecutionClaim.deleteMany({
    where: { createdAt: { lt: claimCutoff } },
  });
  const interviewClaims = await prisma.interviewExecutionClaim.deleteMany({
    where: { createdAt: { lt: claimCutoff } },
  });
  const checkouts = await prisma.checkoutSession.deleteMany({
    where: { status: "pending", createdAt: { lt: checkoutCutoff } },
  });
  const rateBuckets = await prisma.authRateBucket.deleteMany({
    where: { windowStart: { lt: rateCutoff } },
  });
  const jobs = await prisma.operationalJob.deleteMany({
    where: {
      status: { in: ["completed", "dead"] },
      updatedAt: { lt: jobCutoff },
      payload: { equals: {} },
    },
  });

  return {
    sessions: sessions.count,
    verificationTokens: verificationTokens.count,
    resetTokens: resetTokens.count,
    teachingClaims: Number(teachingClaims),
    exerciseClaims: exerciseClaims.count,
    projectClaims: projectClaims.count,
    interviewClaims: interviewClaims.count,
    checkouts: checkouts.count,
    rateBuckets: rateBuckets.count,
    jobs: jobs.count,
  };
}
