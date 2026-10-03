import { prisma } from "@/lib/prisma";
import { hashSecret } from "@/lib/webauthn";

export const loginAttemptLimit = 5;
export const loginAttemptWindowMs = 15 * 60 * 1000;
export const loginBlockDurationMs = 15 * 60 * 1000;

function bucketKey(scope: "badge" | "ip", value: string) {
  return hashSecret(`login:${scope}:${value}`);
}

export async function isLoginTemporarilyBlocked(badge: string, ipHash: string, now = new Date()) {
  const keys = [bucketKey("badge", badge), bucketKey("ip", ipHash)];
  const blocked = await prisma.loginAttemptBucket.findFirst({
    where: { keyHash: { in: keys }, blockedUntil: { gt: now } },
    select: { keyHash: true },
  });
  return Boolean(blocked);
}

export async function recordLoginFailure(badge: string, ipHash: string, now = new Date()) {
  const cutoff = new Date(now.getTime() - loginAttemptWindowMs);
  const keys = [bucketKey("badge", badge), bucketKey("ip", ipHash)];

  for (const keyHash of keys) {
    const reset = await prisma.loginAttemptBucket.updateMany({
      where: { keyHash, windowStartedAt: { lte: cutoff } },
      data: { failures: 1, windowStartedAt: now, blockedUntil: null },
    });
    if (reset.count === 0) {
      await prisma.loginAttemptBucket.upsert({
        where: { keyHash },
        create: { keyHash, failures: 1, windowStartedAt: now },
        update: { failures: { increment: 1 } },
      });
    }
    const bucket = await prisma.loginAttemptBucket.findUnique({
      where: { keyHash },
      select: { failures: true },
    });
    if (bucket && bucket.failures >= loginAttemptLimit) {
      await prisma.loginAttemptBucket.update({
        where: { keyHash },
        data: { blockedUntil: new Date(now.getTime() + loginBlockDurationMs) },
      });
    }
  }
}

export async function clearBadgeLoginFailures(badge: string, ipHash?: string) {
  const keyHashes = [bucketKey("badge", badge)];
  if (ipHash) keyHashes.push(bucketKey("ip", ipHash));
  await prisma.loginAttemptBucket.deleteMany({ where: { keyHash: { in: keyHashes } } });
}
