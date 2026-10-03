import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {
  loginAttemptBucket: { findFirst: vi.fn(), deleteMany: vi.fn() },
  $executeRaw: vi.fn(),
} }));

import { prisma } from "@/lib/prisma";
import {
  clearBadgeLoginFailures,
  getLoginBlockRetryAfter,
  getLoginClientIpHash,
  isLoginAttemptStorageUnavailable,
  normalizeLoginCode,
  recordLoginFailure,
} from "@/lib/login-attempts";

describe("persistent login throttling helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.loginAttemptBucket.deleteMany).mockResolvedValue({ count: 0 } as never);
    vi.mocked(prisma.$executeRaw).mockResolvedValue(1);
  });

  it("normalizes login codes with NFKC, trimming, and invariant casing", () => {
    expect(normalizeLoginCode(" １２３４ ")).toBe("1234");
    expect(normalizeLoginCode("abC9")).toBe("ABC9");
  });

  it("ignores untrusted X-Forwarded-For and uses only a valid proxy-overwritten X-Real-IP", () => {
    const forwarded = new Request("https://app.example/api/login", {
      headers: { "x-real-ip": "192.0.2.10", "x-forwarded-for": "203.0.113.5" },
    });
    const sameProxyIp = new Request("https://app.example/api/login", {
      headers: { "x-real-ip": "192.0.2.10", "x-forwarded-for": "198.51.100.8" },
    });

    expect(getLoginClientIpHash(forwarded)).toBe(getLoginClientIpHash(sameProxyIp));
  });

  it("atomically increments badge and IP buckets and removes expired buckets", async () => {
    await recordLoginFailure(" １２３４ ", "hashed-ip", new Date("2026-01-01T00:00:00.000Z"));

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);
    expect(prisma.loginAttemptBucket.deleteMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        windowStartedAt: expect.any(Object),
        OR: expect.any(Array),
      }),
    }));
  });

  it("returns the remaining lock duration", async () => {
    vi.mocked(prisma.loginAttemptBucket.findFirst).mockResolvedValue({
      blockedUntil: new Date(Date.now() + 30_000),
    } as never);

    const remaining = await getLoginBlockRetryAfter("1234", "ip-hash");

    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(30);
  });

  it("marks missing persistent storage as an explicit fail-closed error", async () => {
    vi.mocked(prisma.loginAttemptBucket.findFirst).mockRejectedValue({ code: "P2021" });
    let caught: unknown;
    try {
      await getLoginBlockRetryAfter("1234", "ip-hash");
    } catch (error) {
      caught = error;
    }
    expect(isLoginAttemptStorageUnavailable(caught)).toBe(true);
  });

  it("clears only the successful badge bucket, not the shared IP bucket", async () => {
    await clearBadgeLoginFailures("1234");

    const where = vi.mocked(prisma.loginAttemptBucket.deleteMany).mock.calls[0][0]?.where;
    expect(where?.keyHash).toEqual(expect.any(String));
  });
});
