import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const transaction = {
  funcionario: { findFirst: vi.fn() },
  authChallenge: { updateMany: vi.fn() },
  sessao: { create: vi.fn() },
  trustedDevice: { update: vi.fn() },
  faceAuthAttempt: { create: vi.fn() },
  securityAuditEvent: { create: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (callback: (client: typeof transaction) => unknown) => callback(transaction)),
    authChallenge: { findUnique: vi.fn(), updateMany: vi.fn() },
    livenessChallenge: { findUnique: vi.fn(), updateMany: vi.fn() },
    faceTemplate: { findMany: vi.fn() },
    sessao: { create: vi.fn() },
    faceAuthAttempt: { create: vi.fn() },
    trustedDevice: { update: vi.fn() },
    funcionario: { findFirst: vi.fn() },
    securityAuditEvent: { create: vi.fn() },
    loginAttemptBucket: { findFirst: vi.fn(), deleteMany: vi.fn() },
  },
}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: () => ({ value: "device-token" }) })),
}));
vi.mock("@/lib/face", () => ({
  areFaceTemplateVersionsCompatible: vi.fn(() => false),
  decryptEmbedding: vi.fn(() => Array(256).fill(0)),
  FaceRecognitionUnavailableError: class FaceRecognitionUnavailableError extends Error {},
  faceAttemptLimit: 3,
  faceEmbeddingDistance: vi.fn(() => 0.1),
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
import { areFaceTemplateVersionsCompatible, decryptEmbedding } from "@/lib/face";
import { createLoginSessionSuccessResponse, verifyLoginFaceState } from "@/lib/login-flow";

describe("local facial login verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(areFaceTemplateVersionsCompatible).mockReturnValue(false);
    vi.stubEnv("FACE_LOGIN_ENABLED", "true");
    vi.mocked(prisma.loginAttemptBucket.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.authChallenge.findUnique).mockResolvedValue({
      id: "challenge-admin",
      tipo: "LOGIN_FACE",
      usadoEm: null,
      expiraEm: new Date(Date.now() + 60_000),
      funcionarioId: 7,
      preAuthTokenHash: "secret-hash",
      challenge: "piscar",
      ipHash: "ip-hash",
      funcionario: { id: 7, cracha: "1234", ativo: true, papel: "ADMIN" },
    } as never);
    vi.mocked(verifyLoginFaceState).mockReturnValue({
      challengeId: "challenge-admin",
      funcionarioId: 7,
      expiresAt: Date.now() + 60_000,
      nonceHash: "nonce-hash",
      challenge: "piscar",
    } as never);
    vi.mocked(prisma.faceTemplate.findMany).mockResolvedValue([
      { embeddingEncrypted: new Uint8Array([1]), iv: new Uint8Array([2]), tag: new Uint8Array([3]), modelVersion: "legacy-unknown" },
    ] as never);
    transaction.authChallenge.updateMany.mockResolvedValue({ count: 1 });
    transaction.funcionario.findFirst.mockResolvedValue({
      id: 7, nome: "Admin", email: "admin@example.test", cargo: "Admin", cracha: "1234",
      papel: "ADMIN", mustChangePassword: false,
    } as never);
    vi.mocked(createLoginSessionSuccessResponse).mockReturnValue(new Response("ok") as never);
  });

  afterEach(() => vi.unstubAllEnvs());

  it("rejects direct attempts that omit the signed facial challenge", async () => {
    const response = await POST(new Request("http://localhost/api/auth/login/face/verify", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost" },
      body: JSON.stringify({ challengeId: "invented", nonce: "invented", embedding: [] }),
    }));
    expect(response.status).toBe(401);
    expect(prisma.sessao.create).not.toHaveBeenCalled();
  });

  it("does not permit an operator to complete an administrator facial challenge", async () => {
    vi.mocked(prisma.authChallenge.findUnique).mockResolvedValue({
      id: "challenge-operator",
      tipo: "LOGIN_FACE",
      usadoEm: null,
      expiraEm: new Date(Date.now() + 60_000),
      funcionarioId: 8,
      preAuthTokenHash: "secret-hash",
      challenge: "piscar",
      ipHash: "ip-hash",
      funcionario: { id: 8, cracha: "4321", ativo: true, papel: "OPERADOR" },
    } as never);
    vi.mocked(verifyLoginFaceState).mockReturnValue({
      challengeId: "challenge-operator",
      funcionarioId: 8,
      expiresAt: Date.now() + 60_000,
      nonceHash: "nonce-hash",
      challenge: "piscar",
    } as never);
    const response = await POST(loginRequest());
    expect(response.status).toBe(401);
    expect(prisma.faceTemplate.findMany).not.toHaveBeenCalled();
    expect(prisma.sessao.create).not.toHaveBeenCalled();
  });

  it("fails closed for legacy templates incompatible with the local model", async () => {
    vi.mocked(areFaceTemplateVersionsCompatible).mockReturnValue(false);
    const response = await POST(loginRequest());
    expect(response.status).toBe(503);
    expect(areFaceTemplateVersionsCompatible).toHaveBeenCalledWith(["legacy-unknown"]);
    expect(transaction.authChallenge.updateMany).not.toHaveBeenCalled();
    expect(prisma.sessao.create).not.toHaveBeenCalled();
  });

  it("creates a session only after the server matches the submitted vector to an active template", async () => {
    vi.mocked(areFaceTemplateVersionsCompatible).mockReturnValue(true);
    vi.mocked(prisma.faceTemplate.findMany).mockResolvedValue([
      {
        embeddingEncrypted: new Uint8Array([1]),
        iv: new Uint8Array([2]),
        tag: new Uint8Array([3]),
        modelVersion: "human-3.3.6-mobileface-v3-a4bcf70",
      },
    ] as never);
    vi.mocked(decryptEmbedding).mockReturnValue([1, ...Array(255).fill(0)]);
    const response = await POST(loginRequest());
    expect(response.status).toBe(200);
    expect(areFaceTemplateVersionsCompatible).toHaveBeenCalledWith(["human-3.3.6-mobileface-v3-a4bcf70"]);
    expect(decryptEmbedding).toHaveBeenCalledOnce();
    expect(transaction.authChallenge.updateMany).toHaveBeenCalledOnce();
    expect(transaction.sessao.create).toHaveBeenCalledOnce();
    expect(createLoginSessionSuccessResponse).toHaveBeenCalledOnce();
  });

  it("accepts demo-photo login only for an allowlisted admin and after the signed challenge", async () => {
    vi.stubEnv("FACE_DEMO_PHOTO_MODE", "true");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("LOGIN_DEMO_CRACHAS", "1111,2222,3333");
    vi.mocked(prisma.authChallenge.findUnique).mockResolvedValue({
      id: "challenge-admin", tipo: "LOGIN_FACE", usadoEm: null, expiraEm: new Date(Date.now() + 60_000),
      funcionarioId: 7, preAuthTokenHash: "secret-hash", challenge: "piscar", ipHash: "ip-hash",
      funcionario: { id: 7, cracha: "3333", ativo: true, papel: "ADMIN" },
    } as never);
    vi.mocked(prisma.faceTemplate.findMany).mockResolvedValue([
      { modelVersion: "demo-photo" },
    ] as never);

    const response = await POST(loginRequest({
      demoPhotoLogin: true,
      demoFaceDetected: true,
      demoDetectorUnavailable: false,
    }));
    expect(response.status).toBe(200);
    expect(transaction.authChallenge.updateMany).toHaveBeenCalledOnce();
    expect(transaction.sessao.create).toHaveBeenCalledOnce();
    expect(decryptEmbedding).not.toHaveBeenCalled();
  });

  it("never simulates login for a real template or an operator, even with an allowlisted badge", async () => {
    vi.stubEnv("FACE_DEMO_PHOTO_MODE", "true");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("LOGIN_DEMO_CRACHAS", "1111,2222,3333");
    vi.mocked(prisma.authChallenge.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.authChallenge.findUnique).mockResolvedValue({
      id: "challenge-admin", tipo: "LOGIN_FACE", usadoEm: null, expiraEm: new Date(Date.now() + 60_000),
      funcionarioId: 7, preAuthTokenHash: "secret-hash", challenge: "piscar", ipHash: "ip-hash",
      funcionario: { id: 7, cracha: "3333", ativo: true, papel: "ADMIN" },
    } as never);
    vi.mocked(prisma.faceTemplate.findMany).mockResolvedValue([
      { modelVersion: "human-3.3.6-mobileface-v3-a4bcf70" },
    ] as never);
    const payload = {
      demoPhotoLogin: true,
      demoFaceDetected: true,
      demoDetectorUnavailable: false,
    };
    const realTemplateResponse = await POST(loginRequest(payload));
    expect(realTemplateResponse.status).toBe(401);
    expect(decryptEmbedding).not.toHaveBeenCalled();
    expect(transaction.sessao.create).not.toHaveBeenCalled();

    vi.mocked(prisma.authChallenge.findUnique).mockResolvedValue({
      id: "challenge-operator", tipo: "LOGIN_FACE", usadoEm: null, expiraEm: new Date(Date.now() + 60_000),
      funcionarioId: 8, preAuthTokenHash: "secret-hash", challenge: "piscar", ipHash: "ip-hash",
      funcionario: { id: 8, cracha: "2222", ativo: true, papel: "OPERADOR" },
    } as never);
    const operatorResponse = await POST(loginRequest(payload));
    expect(operatorResponse.status).toBe(401);
    expect(prisma.faceTemplate.findMany).toHaveBeenCalledOnce();
    expect(transaction.sessao.create).not.toHaveBeenCalled();
  });

  it("requires face detection or explicit client fallback and only the configured demo badge", async () => {
    vi.stubEnv("FACE_DEMO_PHOTO_MODE", "true");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("LOGIN_DEMO_CRACHAS", "1111,2222,3333");
    vi.mocked(prisma.faceTemplate.findMany).mockResolvedValue([{ modelVersion: "demo-photo" }] as never);
    vi.mocked(prisma.authChallenge.updateMany).mockResolvedValue({ count: 1 } as never);
    transaction.authChallenge.updateMany.mockResolvedValue({ count: 1 });
    vi.mocked(prisma.authChallenge.findUnique).mockResolvedValue({
      id: "challenge-admin", tipo: "LOGIN_FACE", usadoEm: null, expiraEm: new Date(Date.now() + 60_000),
      funcionarioId: 7, preAuthTokenHash: "secret-hash", challenge: "piscar", ipHash: "ip-hash",
      funcionario: { id: 7, cracha: "3333", ativo: true, papel: "ADMIN" },
    } as never);

    const noFace = await POST(loginRequest({
      demoPhotoLogin: true, demoFaceDetected: false, demoDetectorUnavailable: false,
    }));
    expect(noFace.status).toBe(401);
    expect(transaction.sessao.create).not.toHaveBeenCalled();

    vi.mocked(prisma.authChallenge.findUnique).mockResolvedValue({
      id: "challenge-admin", tipo: "LOGIN_FACE", usadoEm: null, expiraEm: new Date(Date.now() + 60_000),
      funcionarioId: 7, preAuthTokenHash: "secret-hash", challenge: "piscar", ipHash: "ip-hash",
      funcionario: { id: 7, cracha: "9999", ativo: true, papel: "ADMIN" },
    } as never);
    const notListed = await POST(loginRequest({
      demoPhotoLogin: true, demoFaceDetected: true, demoDetectorUnavailable: false,
    }));
    expect(notListed.status).toBe(401);
    expect(transaction.sessao.create).not.toHaveBeenCalled();
  });

  it("allows detector-unavailable fallback only with the demo-photo mode and challenge", async () => {
    vi.stubEnv("FACE_DEMO_PHOTO_MODE", "true");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("LOGIN_DEMO_CRACHAS", "1111,2222,3333");
    vi.mocked(prisma.authChallenge.findUnique).mockResolvedValue({
      id: "challenge-admin", tipo: "LOGIN_FACE", usadoEm: null, expiraEm: new Date(Date.now() + 60_000),
      funcionarioId: 7, preAuthTokenHash: "secret-hash", challenge: "piscar", ipHash: "ip-hash",
      funcionario: { id: 7, cracha: "3333", ativo: true, papel: "ADMIN" },
    } as never);
    vi.mocked(prisma.faceTemplate.findMany).mockResolvedValue([{ modelVersion: "demo-photo" }] as never);

    const response = await POST(loginRequest({
      demoPhotoLogin: true, demoFaceDetected: false, demoDetectorUnavailable: true,
    }));
    expect(response.status).toBe(200);
    expect(transaction.authChallenge.updateMany).toHaveBeenCalledOnce();
  });

  it("keeps the face login kill switch server-side", async () => {
    vi.stubEnv("FACE_LOGIN_ENABLED", "false");
    const response = await POST(loginRequest());
    expect(response.status).toBe(401);
    expect(prisma.authChallenge.findUnique).not.toHaveBeenCalled();
  });

  it("does not log embeddings or input biometric values", async () => {
    vi.stubEnv("FACE_LOGIN_ENABLED", "true");
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await POST(loginRequest({ embedding: [0.123456] }));
    expect(response.status).toBe(503);
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain("0.123456");
    errorLog.mockRestore();
  });
});

function loginRequest(overrides: Record<string, unknown> = {}) {
  return new Request("http://localhost/api/auth/login/face/verify", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost" },
    body: JSON.stringify({
      challengeId: "challenge-admin",
      loginToken: "signed-token",
      nonce: "nonce",
      challengeCompleted: true,
      embedding: [1, ...Array(255).fill(0)],
      ...overrides,
    }),
  });
}
