export const faceEnrollmentAttemptLimit = 10;
export const faceEnrollmentWindowMs = 10 * 60 * 1000;

function windowStart(now: Date) {
  return new Date(now.getTime() - faceEnrollmentWindowMs);
}

export async function getFaceEnrollmentLimit(adminId: number, funcionarioId: number, now = new Date()) {
  const { prisma } = await import("@/lib/prisma");
  const oldest = await prisma.faceEnrollmentAttempt.findFirst({
    where: { adminId, funcionarioId, resultado: "verification_failure", criadoEm: { gte: windowStart(now) } },
    orderBy: { criadoEm: "asc" },
    select: { criadoEm: true },
  });
  if (!oldest) return null;
  const count = await prisma.faceEnrollmentAttempt.count({
    where: { adminId, funcionarioId, resultado: "verification_failure", criadoEm: { gte: windowStart(now) } },
  });
  if (count < faceEnrollmentAttemptLimit) return null;
  return Math.max(1, Math.ceil((oldest.criadoEm.getTime() + faceEnrollmentWindowMs - now.getTime()) / 1000));
}

export async function recordFaceEnrollmentFailure(adminId: number, funcionarioId: number, now = new Date()) {
  const { prisma } = await import("@/lib/prisma");
  await prisma.faceEnrollmentAttempt.create({ data: { adminId, funcionarioId, resultado: "verification_failure", criadoEm: now } });
  const retryAfterSeconds = await getFaceEnrollmentLimit(adminId, funcionarioId, now) ?? Math.ceil(faceEnrollmentWindowMs / 1000);
  const count = await prisma.faceEnrollmentAttempt.count({
    where: { adminId, funcionarioId, resultado: "verification_failure", criadoEm: { gte: windowStart(now) } },
  });
  return { count, retryAfterSeconds };
}

export async function clearFaceEnrollmentFailures(adminId: number, funcionarioId: number) {
  const { prisma } = await import("@/lib/prisma");
  await prisma.faceEnrollmentAttempt.deleteMany({ where: { adminId, funcionarioId, resultado: "verification_failure" } });
}
