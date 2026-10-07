import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {
  authChallenge: { findUnique: vi.fn(), updateMany: vi.fn() },
  livenessChallenge: { findUnique: vi.fn(), updateMany: vi.fn() },
  faceTemplate: { findMany: vi.fn() },
  sessao: { create: vi.fn() },
  faceAuthAttempt: { create: vi.fn() },
  trustedDevice: { update: vi.fn() },
  funcionario: { findFirst: vi.fn() },
  securityAuditEvent: { create: vi.fn() },
  loginAttemptBucket: { findFirst: vi.fn(), deleteMany: vi.fn() },
} }));
vi.mock("@/lib/face", () => ({
  decryptEmbedding: vi.fn(() => Array.from({ length: 64 }, () => 0.1)),
  FaceServiceUnavailableError: class FaceServiceUnavailableError extends Error {},
  faceAttemptLimit: 3,
  hashFaceNonce: vi.fn(() => "nonce-hash"),
  verifyFaceCapture: vi.fn(),
}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: () => ({ value: "device-token" }) })),
}));
vi.mock("@/lib/login-attempts", () => ({
  clearBadgeLoginFailures: vi.fn(async () => undefined),
  getLoginBlockRetryAfter: vi.fn(async () => null),
  getLoginClientIpHash: vi.fn(() => "ip-hash"),
  isLoginAttemptStorageUnavailable: vi.fn(() => false),
  loginAttemptStorageUnavailableResponse: vi.fn(),
  recordLoginFailure: vi.fn(async () => undefined),
}));
vi.mock("@/lib/login-flow", () => ({
  createLoginSessionSuccessResponse: vi.fn(),
  getLoginAccessArea: vi.fn(),
  verifyLoginFaceState: vi.fn(),
}));
vi.mock("@/lib/security", () => ({
  isRateLimited: vi.fn(() => false),
  isSameOrigin: vi.fn(() => true),
}));
vi.mock("@/lib/security-attempts", () => ({
  clearFactorFailures: vi.fn(),
  isFactorBlocked: vi.fn(() => false),
  recordFactorFailure: vi.fn(() => 1),
}));
vi.mock("@/lib/webauthn", () => ({
  hashSecret: vi.fn(() => "secret-hash"),
  trustedDeviceCookieName: "trusted-device",
}));

import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { FaceServiceUnavailableError, verifyFaceCapture } from "@/lib/face";

describe("login face verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.loginAttemptBucket.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.livenessChallenge.findUnique).mockResolvedValue(null);
  });

  it("rejects direct attempts to bypass the signed facial challenge", async () => {
    const request = new Request("http://localhost/api/auth/login/face/verify", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost" },
      body: JSON.stringify({
        challengeId: "invented",
        nonce: "invented",
        capture: "data:image/jpeg;base64,not-a-face",
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(prisma.sessao.create).not.toHaveBeenCalled();
  });

  it("reports provider outage without consuming the challenge or counting a failed identity", async () => {
    vi.mocked(prisma.livenessChallenge.findUnique).mockResolvedValue({
      id: "challenge-1",
      funcionarioId: 7,
      usadoEm: null,
      expiraEm: new Date(Date.now() + 60_000),
      nonceHash: "nonce-hash",
      tipo: "piscar",
      trustedDeviceId: "device-1",
      trustedDevice: { id: "device-1", revogadoEm: null, tokenHash: "secret-hash" },
      funcionario: { id: 7, cracha: "123", ativo: true, papel: "ALMOXARIFE" },
    } as never);
    vi.mocked(prisma.faceTemplate.findMany).mockResolvedValue([
      { embeddingEncrypted: new Uint8Array([1]), iv: new Uint8Array([1]), tag: new Uint8Array([1]) },
    ] as never);
    vi.mocked(verifyFaceCapture).mockRejectedValueOnce(new FaceServiceUnavailableError());
    const response = await POST(new Request("http://localhost/api/auth/login/face/verify", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost" },
      body: JSON.stringify({
        challengeId: "challenge-1",
        nonce: "nonce",
        capture: `data:image/jpeg;base64,${"A".repeat(1400)}`,
      }),
    }));

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining("temporariamente indisponível") });
    expect(prisma.livenessChallenge.updateMany).not.toHaveBeenCalled();
    expect(prisma.faceAuthAttempt.create).not.toHaveBeenCalled();
    expect(prisma.securityAuditEvent.create).not.toHaveBeenCalled();
  });
});
