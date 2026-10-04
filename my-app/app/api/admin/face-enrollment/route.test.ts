import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  funcionario: { findMany: vi.fn() },
  faceTemplate: { count: vi.fn() },
} }));
vi.mock("@/lib/security", () => ({ isSameOrigin: vi.fn(() => true) }));
vi.mock("@/lib/face", () => ({ areEnrollmentEmbeddingsConsistent: vi.fn(() => true), decryptEmbedding: vi.fn(() => [1, 2, 3]), encryptEmbedding: vi.fn(() => ({ ciphertext: "cipher", iv: "iv", tag: "tag" })), enrollFaceSamples: vi.fn(async () => [[1, 2, 3]]), faceEmbeddingDistance: vi.fn(() => 0), faceEnrollmentDuplicateDistance: 0.1, FaceEnrollmentVerificationError: class extends Error { code = "FACE_INVALID"; }, faceConsentVersion: "v1" }));
vi.mock("@/lib/face-enrollment-attempts", () => ({ faceEnrollmentAttemptLimit: 5, getFaceEnrollmentLimit: vi.fn(async () => null), recordFaceEnrollmentFailure: vi.fn(async () => ({ count: 0, retryAfterSeconds: 0 })) }));
vi.mock("@/lib/face-enrollment-session", () => ({ createFaceEnrollmentSession: vi.fn(async () => ({ id: "s1", token: "token", expiraEm: new Date(Date.now() + 60000) })), findFaceEnrollmentSession: vi.fn(async () => ({ id: "s1", token: "token", expiraEm: new Date(Date.now() + 60000) })), renewFaceEnrollmentSession: vi.fn(async () => ({})) }));
vi.mock("@/lib/webauthn", () => ({ getClientIpHash: vi.fn(() => "client-hash"), hashSecret: vi.fn(() => "hash") }));

import { GET } from "./route";
import { requireAdmin } from "@/lib/auth";

describe("admin face enrollment route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires admin authentication", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ funcionario: null, status: 401 });
    const response = await GET(new Request("http://localhost/api/admin/face-enrollment"));
    expect(response.status).toBe(401);
  });
});
