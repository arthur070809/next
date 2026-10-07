import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const transaction = {
  faceEnrollmentSession: { updateMany: vi.fn() },
  faceTemplate: { updateMany: vi.fn(), create: vi.fn() },
  securityAuditEvent: { create: vi.fn() },
  faceEnrollmentAttempt: { deleteMany: vi.fn() },
};

vi.mock("@/lib/auth", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (callback: (client: typeof transaction) => unknown) => callback(transaction)),
    funcionario: { findMany: vi.fn(), findFirst: vi.fn() },
    faceTemplate: { count: vi.fn(), findMany: vi.fn() },
  },
}));
vi.mock("@/lib/security", () => ({ isSameOrigin: vi.fn(() => true) }));
vi.mock("@/lib/face", () => ({
  aggregateEnrollmentEmbeddings: vi.fn(() => ({
    consistent: true,
    distances: [0.01, 0.02, 0.03, 0.04, 0.5],
    discardedOutlier: true,
    embedding: Array.from({ length: 64 }, () => 0.125),
    acceptedEmbeddings: [Array.from({ length: 64 }, () => 0.125)],
  })),
  assertFaceTemplateConfiguration: vi.fn(() => "provider-model-2026.10"),
  decryptEmbedding: vi.fn(() => Array.from({ length: 64 }, () => 0.125)),
  encryptEmbedding: vi.fn(() => ({ ciphertext: Buffer.from("cipher"), iv: Buffer.from("iv"), tag: Buffer.from("tag") })),
  enrollFaceSamples: vi.fn(async (samples: unknown[]) => Array.from({ length: samples.length }, () => Array.from({ length: 64 }, () => 0.125))),
  FaceServiceUnavailableError: class FaceServiceUnavailableError extends Error {},
  faceEmbeddingDistance: vi.fn(() => 1),
  faceEnrollmentConsistencyDistance: 0.35,
  faceEnrollmentDuplicateDistance: 0.42,
  FaceEnrollmentVerificationError: class extends Error {
    constructor(message: string, readonly code = "FACE_INVALID") { super(message); }
  },
  FaceEncryptionKeyUnavailableError: class FaceEncryptionKeyUnavailableError extends Error {},
  faceConsentVersion: "v1",
}));
vi.mock("@/lib/face-enrollment-attempts", () => ({
  faceEnrollmentAttemptLimit: 5,
  getFaceEnrollmentLimit: vi.fn(async () => null),
  recordFaceEnrollmentFailure: vi.fn(async () => ({ count: 0, retryAfterSeconds: 0 })),
}));
vi.mock("@/lib/face-enrollment-session", () => ({
  createFaceEnrollmentSession: vi.fn(async () => ({ id: "s1", token: "token", expiraEm: new Date(Date.now() + 60000) })),
  findFaceEnrollmentSession: vi.fn(async () => ({ id: "s1", tokenHash: "hash", expiraEm: new Date(Date.now() + 60000) })),
  renewFaceEnrollmentSession: vi.fn(async () => new Date(Date.now() + 60000)),
}));
vi.mock("@/lib/webauthn", () => ({
  getClientIpHash: vi.fn(() => "client-hash"),
  hashSecret: vi.fn(() => "hash"),
}));

import { GET, POST } from "./route";
import { requireAdmin } from "@/lib/auth";
import {
  aggregateEnrollmentEmbeddings,
  encryptEmbedding,
  enrollFaceSamples,
  FaceEnrollmentVerificationError,
  FaceServiceUnavailableError,
  assertFaceTemplateConfiguration,
} from "@/lib/face";
import { prisma } from "@/lib/prisma";
import { recordFaceEnrollmentFailure } from "@/lib/face-enrollment-attempts";
import { getFaceEnrollmentFrameCount } from "@/lib/facial/config";

describe("admin face enrollment route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("FACE_EMBEDDING_MODEL_VERSION", "provider-model-2026.10");
    vi.stubEnv("FACE_DIAGNOSTICS_ENABLED", "false");
    vi.stubEnv("FACE_ENROLL_FRAMES", "1");
    vi.mocked(requireAdmin).mockResolvedValue({ funcionario: { id: 9 }, status: 200 } as never);
    vi.mocked(prisma.funcionario.findFirst).mockResolvedValue({ id: 10 } as never);
    vi.mocked(prisma.faceTemplate.count).mockResolvedValue(0);
    vi.mocked(prisma.faceTemplate.findMany).mockResolvedValue([]);
    transaction.faceEnrollmentSession.updateMany.mockResolvedValue({ count: 1 });
    transaction.faceTemplate.updateMany.mockResolvedValue({ count: 0 });
    transaction.faceTemplate.create.mockResolvedValue({ id: "template-1" });
    transaction.securityAuditEvent.create.mockResolvedValue({});
    transaction.faceEnrollmentAttempt.deleteMany.mockResolvedValue({ count: 0 });
  });

  afterEach(() => vi.unstubAllEnvs());

  it("requires admin authentication", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ funcionario: null, status: 401 });
    const response = await GET(new Request("http://localhost/api/admin/face-enrollment"));
    expect(response.status).toBe(401);
  });

  it("does not allow non-admin users to submit facial enrollment captures", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ funcionario: null, status: 403 });
    const response = await POST(enrollmentRequest({ samples: ["private-image"] }));
    expect(response.status).toBe(403);
  });

  it("stores one encrypted, versioned template for the default single frame", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const response = await POST(enrollmentRequest());

    expect(response.status).toBe(201);
    expect(enrollFaceSamples).toHaveBeenCalledWith([expect.any(String)], { nonce: "token" });
    expect(aggregateEnrollmentEmbeddings).toHaveBeenCalledOnce();
    expect(aggregateEnrollmentEmbeddings).toHaveBeenCalledWith([
      Array.from({ length: 64 }, () => 0.125),
    ]);
    expect(encryptEmbedding).toHaveBeenCalledOnce();
    expect(transaction.faceTemplate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        funcionarioId: 10,
        modelVersion: "provider-model-2026.10",
        embeddingEncrypted: Buffer.from("cipher"),
        iv: Buffer.from("iv"),
        tag: Buffer.from("tag"),
        criadoPorId: 9,
      }),
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain("data:image/jpeg");
    expect(JSON.stringify(log.mock.calls)).not.toContain("0.125");
    log.mockRestore();
  });

  it("requires an explicit confirmation before replacing an active template", async () => {
    vi.mocked(prisma.faceTemplate.count).mockResolvedValue(1);
    const response = await POST(enrollmentRequest({ replaceConfirmed: false }));

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "FACE_REPLACEMENT_CONFIRMATION_REQUIRED" });
    expect(enrollFaceSamples).not.toHaveBeenCalled();
    expect(transaction.faceTemplate.create).not.toHaveBeenCalled();
  });

  it("silently requests a fresh burst when the provider reports incoherent frames", async () => {
    vi.mocked(enrollFaceSamples).mockRejectedValueOnce(
      new FaceEnrollmentVerificationError("provider private message", "FACE_INCONSISTENT_SAMPLES"),
    );
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const response = await POST(enrollmentRequest());
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toMatchObject({ code: "FACE_CAPTURE_RETRY" });
    expect(JSON.stringify(body)).not.toContain("capturas ficaram diferentes");
    expect(recordFaceEnrollmentFailure).not.toHaveBeenCalled();
    expect(JSON.stringify(log.mock.calls)).not.toContain("provider private message");
    log.mockRestore();
  });

  it("silently retries incoherent local burst measurements and exposes no biometrics when diagnostics are off", async () => {
    vi.stubEnv("FACE_ENROLL_FRAMES", "3");
    vi.mocked(aggregateEnrollmentEmbeddings).mockReturnValueOnce({
      consistent: false,
      distances: [0.1, 0.4, 0.2, 0.3, 0.5],
      discardedOutlier: false,
      acceptedEmbeddings: [],
      embedding: null,
      reason: undefined,
    } as never);
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const response = await POST(enrollmentRequest({ samples: enrollmentSamples(3) }));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "Mantenha apenas seu rosto diante da câmera.",
      code: "FACE_CAPTURE_RETRY",
    });
    expect(log).not.toHaveBeenCalled();
    expect(transaction.faceTemplate.create).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it("fails closed when the model version is not configured", async () => {
    vi.mocked(assertFaceTemplateConfiguration).mockImplementationOnce(() => {
      throw new FaceServiceUnavailableError();
    });
    const response = await POST(enrollmentRequest());

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "FACE_CONFIGURATION_UNAVAILABLE" });
    expect(enrollFaceSamples).not.toHaveBeenCalled();
  });

  it("fails closed with an actionable response if the face-template migration is absent", async () => {
    vi.mocked(prisma.faceTemplate.count).mockRejectedValueOnce(Object.assign(new Error(), { code: "P2022" }));
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await POST(enrollmentRequest());

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "FACE_SCHEMA_UNAVAILABLE" });
    expect(JSON.stringify(errorLog.mock.calls)).toContain("aplique a migration");
    errorLog.mockRestore();
  });

  it("reports provider outage as technical without persisting", async () => {
    vi.mocked(enrollFaceSamples).mockRejectedValueOnce(new FaceServiceUnavailableError());

    const response = await POST(enrollmentRequest());

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "FACE_SERVICE_UNAVAILABLE" });
    expect(transaction.faceTemplate.create).not.toHaveBeenCalled();
  });

  it("keeps three configured frames on the median aggregation path", async () => {
    vi.stubEnv("FACE_ENROLL_FRAMES", "3");
    const response = await POST(enrollmentRequest({ samples: enrollmentSamples(3) }));

    expect(response.status).toBe(201);
    expect(getFaceEnrollmentFrameCount()).toBe(3);
    expect(enrollFaceSamples).toHaveBeenCalledWith(enrollmentSamples(3), { nonce: "token" });
    expect(aggregateEnrollmentEmbeddings).toHaveBeenCalledWith(
      Array.from({ length: 3 }, () => Array.from({ length: 64 }, () => 0.125)),
    );
    expect(encryptEmbedding).toHaveBeenCalledOnce();
  });

  it.each([
    ["FACE_LOW_LIGHT", "Mais luz no ambiente e tente novamente."],
    ["FACE_POSE_INVALID", "Olhe de frente para a câmera e tente novamente."],
  ])("returns corrective feedback for single-frame quality rejection (%s)", async (code, instruction) => {
    vi.mocked(enrollFaceSamples).mockRejectedValueOnce(
      new FaceEnrollmentVerificationError(instruction, code),
    );
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const response = await POST(enrollmentRequest());
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error).toContain(instruction);
    expect(transaction.faceTemplate.create).not.toHaveBeenCalled();
    expect(JSON.stringify(log.mock.calls)).not.toContain(instruction);
    log.mockRestore();
  });

  it("rejects payload sizes above the budget for the configured frame count", async () => {
    const response = await POST(enrollmentRequest({
      samples: [`data:image/jpeg;base64,${"A".repeat(500_000)}`],
    }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "FACE_ENROLLMENT_PAYLOAD_INVALID" });
  });
});

function enrollmentRequest(overrides: Record<string, unknown> = {}) {
  return new Request("http://localhost/api/admin/face-enrollment", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost" },
    body: JSON.stringify({
      funcionarioId: 10,
      sessionId: "s1",
      sessionToken: "token",
      consent: true,
      consentAt: new Date().toISOString(),
      replaceConfirmed: false,
      samples: enrollmentSamples(getFaceEnrollmentFrameCount()),
      ...overrides,
    }),
  });
}

function enrollmentSamples(count: number) {
  return Array.from({ length: count }, () => `data:image/jpeg;base64,${"A".repeat(1400)}`);
}
