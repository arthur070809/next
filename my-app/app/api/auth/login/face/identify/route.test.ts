import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    authChallenge: { findUnique: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
    faceTemplate: { findMany: vi.fn() },
    funcionario: { findFirst: vi.fn() },
    adminTotpCredential: { findUnique: vi.fn() },
    securityAuditEvent: { create: vi.fn() },
    loginAttemptBucket: { findFirst: vi.fn(), deleteMany: vi.fn() },
  },
}));
vi.mock("@/lib/face", () => ({
  areFaceTemplateVersionsCompatible: vi.fn(() => true),
  bestFaceMatchPerEmployee: vi.fn((candidates) => candidates),
  decryptEmbedding: vi.fn(() => [1, ...Array(255).fill(0)]),
  faceEmbeddingDistance: vi.fn(() => 0.1),
  FaceRecognitionUnavailableError: class FaceRecognitionUnavailableError extends Error {},
  getFaceIdentifyMinMargin: vi.fn(() => 0.08),
  getFaceMatchThreshold: vi.fn(() => 0.7),
  hashFaceNonce: vi.fn(() => "nonce-hash"),
  isFaceEmbeddingMatch: vi.fn(() => true),
  validateFaceEmbedding: vi.fn(() => [1, ...Array(255).fill(0)]),
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
  createLoginSessionResponse: vi.fn(() => new Response("ok")),
  getLoginAccessArea: vi.fn(() => "admin"),
  verifyIdentifyFaceState: vi.fn(),
}));
vi.mock("@/lib/security", () => ({
  isRateLimited: vi.fn(() => false),
  isSameOrigin: vi.fn(() => true),
}));
vi.mock("@/lib/webauthn", () => ({
  createSecret: vi.fn(() => "new-secret"),
  hashSecret: vi.fn(() => "secret-hash"),
}));

import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { isFaceEmbeddingMatch } from "@/lib/face";
import { createLoginSessionResponse, verifyIdentifyFaceState } from "@/lib/login-flow";

describe("local facial identification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isFaceEmbeddingMatch).mockReturnValue(true);
    vi.stubEnv("FACE_LOGIN_ENABLED", "true");
    vi.mocked(prisma.loginAttemptBucket.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.authChallenge.findUnique).mockResolvedValue({
      id: "challenge-admin",
      tipo: "LOGIN_FACE_IDENTIFY",
      challenge: "blink",
      preAuthTokenHash: "secret-hash",
      ipHash: "ip-hash",
      expiraEm: new Date(Date.now() + 60_000),
      usadoEm: null,
    } as never);
    vi.mocked(prisma.authChallenge.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(verifyIdentifyFaceState).mockReturnValue({
      challengeId: "challenge-admin",
      challenge: "blink",
      expiresAt: Date.now() + 60_000,
      nonceHash: "nonce-hash",
    } as never);
    vi.mocked(prisma.faceTemplate.findMany).mockResolvedValue([{
      funcionarioId: 7,
      embeddingEncrypted: new Uint8Array([1]),
      iv: new Uint8Array([2]),
      tag: new Uint8Array([3]),
      modelVersion: "human-3.3.6-mobileface-v3-a4bcf70",
      funcionario: { papel: "ADMIN", cracha: "3333" },
    }] as never);
    vi.mocked(prisma.funcionario.findFirst).mockResolvedValue({
      id: 7,
      nome: "Admin",
      email: "admin@example.test",
      cargo: "Admin",
      cracha: "3333",
      papel: "ADMIN",
      mustChangePassword: false,
    } as never);
    vi.mocked(prisma.adminTotpCredential.findUnique).mockResolvedValue(null);
  });

  it("compares the candidate on the server and creates a session after consuming the one-use challenge", async () => {
    const response = await POST(identifyRequest());
    expect(response.status).toBe(200);
    expect(prisma.authChallenge.updateMany).toHaveBeenCalledOnce();
    expect(prisma.faceTemplate.findMany).toHaveBeenCalledOnce();
    expect(prisma.funcionario.findFirst).toHaveBeenCalledOnce();
    expect(prisma.securityAuditEvent.create).toHaveBeenCalled();
    expect(createLoginSessionResponse).toHaveBeenCalledOnce();
  });

  it("rejects the login when the server-side comparison fails", async () => {
    vi.mocked(isFaceEmbeddingMatch).mockReturnValue(false);
    const response = await POST(identifyRequest());
    expect(response.status).toBe(401);
    expect(prisma.funcionario.findFirst).not.toHaveBeenCalled();
  });

  it("rejects a replay when the one-use challenge was already consumed", async () => {
    vi.mocked(prisma.authChallenge.updateMany).mockResolvedValue({ count: 0 } as never);
    const response = await POST(identifyRequest());
    expect(response.status).toBe(401);
    expect(prisma.faceTemplate.findMany).not.toHaveBeenCalled();
    expect(createLoginSessionResponse).not.toHaveBeenCalled();
  });
});

function identifyRequest() {
  return new Request("http://localhost/api/auth/login/face/identify", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost" },
    body: JSON.stringify({
      challengeId: "challenge-admin",
      loginToken: "signed-login-token",
      nonce: "client-nonce",
      challengeCompleted: true,
      embedding: [1, ...Array(255).fill(0)],
    }),
  });
}
