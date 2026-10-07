import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const unit = () => [1, ...Array.from({ length: 255 }, () => 0)];
const modelVersion = "human-3.3.6-mobileface-v3-a4bcf70";

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
  aggregateEnrollmentEmbeddings: vi.fn((embeddings: number[][]) => ({
    consistent: true,
    distances: [],
    discardedOutlier: false,
    embedding: embeddings[0],
    acceptedEmbeddings: embeddings,
  })),
  assertFaceTemplateConfiguration: vi.fn(() => modelVersion),
  decryptEmbedding: vi.fn(() => unit()),
  encryptEmbedding: vi.fn(() => ({ ciphertext: Buffer.from("cipher"), iv: Buffer.from("iv"), tag: Buffer.from("tag") })),
  faceEmbeddingDistance: vi.fn(() => 1),
  faceEnrollmentConsistencyDistance: 0.35,
  FaceEnrollmentVerificationError: class extends Error {
    constructor(message: string, readonly code = "FACE_INVALID") { super(message); }
  },
  FaceRecognitionUnavailableError: class FaceRecognitionUnavailableError extends Error {},
  FaceEncryptionKeyUnavailableError: class FaceEncryptionKeyUnavailableError extends Error {},
  faceConsentVersion: "v1",
  getFaceMatchThreshold: vi.fn(() => 0.7),
  validateFaceEmbedding: vi.fn((value: unknown) => value),
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
  FaceEnrollmentVerificationError,
  FaceRecognitionUnavailableError,
  assertFaceTemplateConfiguration,
  getFaceMatchThreshold,
  validateFaceEmbedding,
} from "@/lib/face";
import { prisma } from "@/lib/prisma";
import { recordFaceEnrollmentFailure } from "@/lib/face-enrollment-attempts";
import { getFaceEnrollmentFrameCount } from "@/lib/facial/config";

describe("admin face enrollment route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("FACE_EMBEDDING_MODEL_VERSION", modelVersion);
    vi.stubEnv("FACE_DIAGNOSTICS_ENABLED", "false");
    vi.stubEnv("FACE_ENROLL_FRAMES", "1");
    vi.mocked(requireAdmin).mockResolvedValue({ funcionario: { id: 9 }, status: 200 } as never);
    vi.mocked(prisma.funcionario.findFirst).mockResolvedValue({ id: 10 } as never);
    vi.mocked(prisma.faceTemplate.count).mockResolvedValue(0);
    vi.mocked(prisma.faceTemplate.findMany).mockResolvedValue([]);
    vi.mocked(getFaceMatchThreshold).mockReturnValue(0.7);
    transaction.faceEnrollmentSession.updateMany.mockResolvedValue({ count: 1 });
    transaction.faceTemplate.updateMany.mockResolvedValue({ count: 0 });
    transaction.faceTemplate.create.mockResolvedValue({ id: "template-1" });
    transaction.securityAuditEvent.create.mockResolvedValue({});
    transaction.faceEnrollmentAttempt.deleteMany.mockResolvedValue({ count: 0 });
  });

  afterEach(() => vi.unstubAllEnvs());

  it("requires admin authentication", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ funcionario: null, status: 401 });
    expect((await GET(new Request("http://localhost/api/admin/face-enrollment"))).status).toBe(401);
  });

  it("does not accept enrollment from a non-admin", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ funcionario: null, status: 403 });
    expect((await POST(enrollmentRequest())).status).toBe(403);
  });

  it("stores one encrypted, versioned MobileFace vector", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const response = await POST(enrollmentRequest());
    expect(response.status).toBe(201);
    expect(aggregateEnrollmentEmbeddings).toHaveBeenCalledWith([unit()]);
    expect(encryptEmbedding).toHaveBeenCalledOnce();
    expect(transaction.faceTemplate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        funcionarioId: 10,
        modelVersion,
        embeddingEncrypted: Buffer.from("cipher"),
        iv: Buffer.from("iv"),
        tag: Buffer.from("tag"),
        criadoPorId: 9,
      }),
    });
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it("requires explicit confirmation before replacing an active template", async () => {
    vi.mocked(prisma.faceTemplate.count).mockResolvedValue(1);
    const response = await POST(enrollmentRequest({ replaceConfirmed: false }));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "FACE_REPLACEMENT_CONFIRMATION_REQUIRED" });
    expect(transaction.faceTemplate.create).not.toHaveBeenCalled();
  });

  it("rejects malformed vectors and records a failed attempt", async () => {
    vi.mocked(assertFaceTemplateConfiguration).mockReturnValue(modelVersion);
    vi.mocked(validateFaceEmbedding).mockImplementationOnce(() => {
      throw new FaceEnrollmentVerificationError("invalid vector");
    });
    const response = await POST(enrollmentRequest({ samples: [Array(10).fill(0)] }));
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: "FACE_INVALID" });
    expect(recordFaceEnrollmentFailure).toHaveBeenCalledOnce();
    expect(transaction.faceTemplate.create).not.toHaveBeenCalled();
  });

  it("uses median aggregation for three configured frames", async () => {
    vi.stubEnv("FACE_ENROLL_FRAMES", "3");
    const response = await POST(enrollmentRequest({ samples: [unit(), unit(), unit()] }));
    expect(response.status).toBe(201);
    expect(getFaceEnrollmentFrameCount()).toBe(3);
    expect(aggregateEnrollmentEmbeddings).toHaveBeenCalledWith([unit(), unit(), unit()]);
  });

  it("returns real comparison distances only to an authenticated admin while calibration is unset", async () => {
    vi.stubEnv("FACE_DIAGNOSTICS_ENABLED", "true");
    vi.mocked(prisma.faceTemplate.count).mockResolvedValue(1);
    vi.mocked(prisma.faceTemplate.findMany).mockResolvedValue([{
      funcionarioId: 10,
      modelVersion,
      embeddingEncrypted: new Uint8Array([1]),
      iv: new Uint8Array([2]),
      tag: new Uint8Array([3]),
      funcionario: { nome: "Funcionário", cracha: "1111" },
    }] as never);
    vi.mocked(getFaceMatchThreshold).mockImplementation(() => { throw new FaceRecognitionUnavailableError(); });
    const response = await POST(enrollmentRequest({ replaceConfirmed: true }));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      code: "FACE_THRESHOLD_CALIBRATION_REQUIRED",
      diagnostics: {
        modelVersion,
        comparisons: [{ relation: "same", cracha: "1111", distance: 1 }],
      },
    });
    expect(transaction.faceTemplate.create).not.toHaveBeenCalled();
  });

  it("fails closed when the configured model version is unavailable", async () => {
    vi.mocked(assertFaceTemplateConfiguration).mockImplementationOnce(() => {
      throw new FaceRecognitionUnavailableError();
    });
    const response = await POST(enrollmentRequest());
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "FACE_CONFIGURATION_UNAVAILABLE" });
  });

  it("fails closed when the face-template schema is absent", async () => {
    vi.mocked(prisma.faceTemplate.count).mockRejectedValueOnce(Object.assign(new Error(), { code: "P2022" }));
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await POST(enrollmentRequest());
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "FACE_SCHEMA_UNAVAILABLE" });
    expect(JSON.stringify(errorLog.mock.calls)).toContain("aplique a migration");
    errorLog.mockRestore();
  });

  it("returns corrective guidance for vectors rejected by server validation", async () => {
    vi.mocked((await import("@/lib/face")).validateFaceEmbedding).mockImplementationOnce(() => {
      throw new FaceEnrollmentVerificationError("private", "FACE_INVALID_VECTOR_NORM");
    });
    const response = await POST(enrollmentRequest());
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      code: "FACE_INVALID_VECTOR_NORM",
      error: "Não foi possível validar a captura facial. Olhe de frente e tente novamente.",
    });
  });

  it("rejects oversized vector payloads", async () => {
    const response = await POST(enrollmentRequest({ samples: [Array(256).fill(1)] }, 100_000));
    expect(response.status).toBe(400);
  });
});

function enrollmentRequest(overrides: Record<string, unknown> = {}, declaredSize?: number) {
  return new Request("http://localhost/api/admin/face-enrollment", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost",
      ...(declaredSize === undefined ? {} : { "content-length": String(declaredSize) }),
    },
    body: JSON.stringify({
      funcionarioId: 10,
      sessionId: "s1",
      sessionToken: "token",
      consent: true,
      consentAt: new Date().toISOString(),
      replaceConfirmed: false,
      samples: [unit()],
      ...overrides,
    }),
  });
}
