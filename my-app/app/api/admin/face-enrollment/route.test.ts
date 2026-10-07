import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  funcionario: { findMany: vi.fn(), findFirst: vi.fn() },
  faceTemplate: { count: vi.fn(), findMany: vi.fn() },
} }));
vi.mock("@/lib/security", () => ({ isSameOrigin: vi.fn(() => true) }));
vi.mock("@/lib/face", () => ({
  analyzeEnrollmentEmbeddings: vi.fn(() => ({ consistent: true, distances: [], discardedOutlier: false, acceptedEmbeddings: [[1, 2, 3]] })),
  decryptEmbedding: vi.fn(() => [1, 2, 3]),
  encryptEmbedding: vi.fn(() => ({ ciphertext: "cipher", iv: "iv", tag: "tag" })),
  enrollFaceSamples: vi.fn(async () => [[1, 2, 3]]),
  faceEmbeddingDistance: vi.fn(() => 0),
  faceEnrollmentConsistencyDistance: 0.35,
  faceEnrollmentDuplicateDistance: 0.1,
  FaceEnrollmentVerificationError: class extends Error { constructor(message: string, readonly code = "FACE_INVALID") { super(message); } },
  faceConsentVersion: "v1",
}));
vi.mock("@/lib/face-enrollment-attempts", () => ({ faceEnrollmentAttemptLimit: 5, getFaceEnrollmentLimit: vi.fn(async () => null), recordFaceEnrollmentFailure: vi.fn(async () => ({ count: 0, retryAfterSeconds: 0 })) }));
vi.mock("@/lib/face-enrollment-session", () => ({ createFaceEnrollmentSession: vi.fn(async () => ({ id: "s1", token: "token", expiraEm: new Date(Date.now() + 60000) })), findFaceEnrollmentSession: vi.fn(async () => ({ id: "s1", token: "token", expiraEm: new Date(Date.now() + 60000) })), renewFaceEnrollmentSession: vi.fn(async () => ({})) }));
vi.mock("@/lib/webauthn", () => ({ getClientIpHash: vi.fn(() => "client-hash"), hashSecret: vi.fn(() => "hash") }));

import { GET, POST } from "./route";
import { requireAdmin } from "@/lib/auth";
import { analyzeEnrollmentEmbeddings, enrollFaceSamples, FaceEnrollmentVerificationError } from "@/lib/face";
import { prisma } from "@/lib/prisma";

describe("admin face enrollment route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires admin authentication", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ funcionario: null, status: 401 });
    const response = await GET(new Request("http://localhost/api/admin/face-enrollment"));
    expect(response.status).toBe(401);
  });

  it("does not allow non-admin users to submit facial enrollment captures", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ funcionario: null, status: 403 });
    const response = await POST(new Request("http://localhost/api/admin/face-enrollment", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost" },
      body: JSON.stringify({ funcionarioId: 1, samples: ["private-image"] }),
    }));
    expect(response.status).toBe(403);
  });

  it("identifies the remote service as the source of its consistency rejection", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ funcionario: { id: 9 }, status: 200 } as never);
    vi.mocked(prisma.funcionario.findFirst).mockResolvedValue({ id: 10 } as never);
    vi.mocked(enrollFaceSamples).mockRejectedValueOnce(
      new FaceEnrollmentVerificationError("As capturas ficaram diferentes. Tente novamente.", "FACE_INCONSISTENT_SAMPLES"),
    );
    const response = await POST(enrollmentRequest());

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      code: "FACE_INCONSISTENT_SAMPLES",
      consistency: { source: "servico-facial" },
    });
  });

  it("identifies local median consistency rejection and returns numeric diagnostics only", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ funcionario: { id: 9 }, status: 200 } as never);
    vi.mocked(prisma.funcionario.findFirst).mockResolvedValue({ id: 10 } as never);
    vi.mocked(enrollFaceSamples).mockResolvedValueOnce([[1, 2, 3], [2, 3, 4], [3, 4, 5]]);
    vi.mocked(analyzeEnrollmentEmbeddings).mockReturnValueOnce({
      consistent: false,
      reason: undefined,
      distances: [0.1, 0.4, 0.2],
      discardedOutlier: false,
      acceptedEmbeddings: [],
    });
    const response = await POST(enrollmentRequest());
    const body = await response.json();

    expect(body.consistency.source).toBe("comparacao-local-com-mediana");
    expect(body.consistency.distances).toEqual([0.1, 0.4, 0.2]);
    expect(JSON.stringify(body)).not.toMatch(/\[\[|\d{10,}/);
  });
});

function enrollmentRequest() {
  return new Request("http://localhost/api/admin/face-enrollment", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost" },
    body: JSON.stringify({
      funcionarioId: 10,
      sessionId: "s1",
      sessionToken: "token",
      consent: true,
      samples: ["opaque", "opaque", "opaque"],
    }),
  });
}
