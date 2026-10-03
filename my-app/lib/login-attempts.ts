import { isIP } from "node:net";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashSecret } from "@/lib/webauthn";

export const loginAttemptLimit = 5;
export const loginAttemptWindowMs = 15 * 60 * 1000;
export const loginBlockDurationMs = 15 * 60 * 1000;

export class LoginAttemptStorageUnavailableError extends Error {
  constructor() {
    super("Persistent login attempt storage is unavailable.");
    this.name = "LoginAttemptStorageUnavailableError";
  }
}

function hasPrismaCode(error: unknown, codes: string[]) {
  if (!error || typeof error !== "object") return false;
  const prismaError = error as { code?: unknown; meta?: { code?: unknown } };
  return codes.includes(String(prismaError.code)) || codes.includes(String(prismaError.meta?.code));
}

function wrapMissingAttemptTable(error: unknown): never {
  if (hasPrismaCode(error, ["P2021", "P2022"]) ||
    (hasPrismaCode(error, ["P2010"]) && hasPrismaCode(error, ["1146"]))) {
    throw new LoginAttemptStorageUnavailableError();
  }
  throw error;
}

export function isLoginAttemptStorageUnavailable(error: unknown): error is LoginAttemptStorageUnavailableError {
  return error instanceof LoginAttemptStorageUnavailableError;
}

export function loginAttemptStorageUnavailableResponse() {
  const errorId = randomUUID();
  console.error("Persistent login throttling is unavailable", {
    errorId,
    errorName: LoginAttemptStorageUnavailableError.name,
  });
  return NextResponse.json(
    { error: "O login está temporariamente indisponível. Tente novamente mais tarde.", errorId },
    { status: 503 },
  );
}

export function normalizeLoginCode(value: string) {
  return value.normalize("NFKC").trim().toUpperCase();
}

function bucketKey(scope: "badge" | "ip", value: string) {
  return hashSecret(`login:${scope}:${value}`);
}

export function getLoginClientIpHash(request: Request) {
  const address = request.headers.get("x-real-ip")?.trim() ?? "";
  const trustedAddress = isIP(address) ? address : "unknown";
  return hashSecret(trustedAddress);
}

export async function getLoginBlockRetryAfter(badge: string, ipHash: string, now = new Date()) {
  const keys = [bucketKey("badge", normalizeLoginCode(badge)), bucketKey("ip", ipHash)];
  try {
    const blocked = await prisma.loginAttemptBucket.findFirst({
      where: { keyHash: { in: keys }, blockedUntil: { gt: now } },
      select: { blockedUntil: true },
      orderBy: { blockedUntil: "desc" },
    });
    return blocked?.blockedUntil
      ? Math.max(1, Math.ceil((blocked.blockedUntil.getTime() - now.getTime()) / 1000))
      : null;
  } catch (error) {
    return wrapMissingAttemptTable(error);
  }
}

export async function isLoginTemporarilyBlocked(badge: string, ipHash: string, now = new Date()) {
  return (await getLoginBlockRetryAfter(badge, ipHash, now)) !== null;
}

export async function recordLoginFailure(badge: string, ipHash: string, now = new Date()) {
  const cutoff = new Date(now.getTime() - loginAttemptWindowMs);
  const retentionCutoff = new Date(now.getTime() - loginAttemptWindowMs - loginBlockDurationMs);
  const blockedUntil = new Date(now.getTime() + loginBlockDurationMs);
  const keys = [bucketKey("badge", normalizeLoginCode(badge)), bucketKey("ip", ipHash)];

  try {
    for (const keyHash of keys) {
      await prisma.$executeRaw`
        INSERT INTO login_attempt_buckets
          (key_hash, failures, window_started_at, blocked_until, updated_at)
        VALUES
          (${keyHash}, 1, ${now}, NULL, ${now})
        ON DUPLICATE KEY UPDATE
          blocked_until = CASE
            WHEN window_started_at <= ${cutoff} THEN NULL
            WHEN failures + 1 >= ${loginAttemptLimit} THEN ${blockedUntil}
            ELSE blocked_until
          END,
          failures = CASE
            WHEN window_started_at <= ${cutoff} THEN 1
            ELSE failures + 1
          END,
          window_started_at = CASE
            WHEN window_started_at <= ${cutoff} THEN ${now}
            ELSE window_started_at
          END,
          updated_at = ${now}
      `;
    }
    // Expired buckets are removed opportunistically on failed logins.
    await prisma.loginAttemptBucket.deleteMany({
      where: {
        windowStartedAt: { lte: retentionCutoff },
        OR: [{ blockedUntil: null }, { blockedUntil: { lte: now } }],
      },
    });
  } catch (error) {
    return wrapMissingAttemptTable(error);
  }
}

export async function clearBadgeLoginFailures(badge: string) {
  try {
    await prisma.loginAttemptBucket.deleteMany({
      where: { keyHash: bucketKey("badge", normalizeLoginCode(badge)) },
    });
  } catch (error) {
    return wrapMissingAttemptTable(error);
  }
}
