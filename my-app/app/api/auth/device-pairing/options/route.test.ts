import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {
  devicePairing: { findUnique: vi.fn(), updateMany: vi.fn() },
  securityAuditEvent: { create: vi.fn() },
  webAuthnCredential: { findMany: vi.fn() },
} }));
vi.mock("@/lib/security", () => ({ isSameOrigin: vi.fn(() => true), isRateLimited: vi.fn(() => false) }));
vi.mock("@/lib/webauthn", () => ({ getClientIpHash: vi.fn(() => "client-hash"), getWebAuthnRelyingParty: vi.fn(() => ({ rpName: "Marcon", rpID: "localhost", origin: "http://localhost" })), hashSecret: vi.fn(() => "hash"), webauthnChallengeTtlMs: 60000 }));
vi.mock("@simplewebauthn/server", () => ({ generateRegistrationOptions: vi.fn(async () => ({ challenge: "challenge" })) }));

import { POST } from "./route";

describe("device pairing options route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("validates pairing codes before creating options", async () => {
    const response = await POST(new Request("http://localhost/api/auth/device-pairing/options", { method: "POST", headers: { "content-type": "application/json", origin: "http://localhost" }, body: JSON.stringify({ code: "invalid" }) }));
    expect(response.status).toBe(400);
  });
});
