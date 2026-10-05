import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ get: vi.fn(() => undefined) })) }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  devicePairing: { findUnique: vi.fn() },
  securityAuditEvent: { create: vi.fn() },
  $transaction: vi.fn(async (callback) => callback({
    devicePairing: { updateMany: vi.fn() },
    trustedDevice: { updateMany: vi.fn(), update: vi.fn() },
    webAuthnCredential: { create: vi.fn() },
    securityAuditEvent: { create: vi.fn() },
  })),
} }));
vi.mock("@/lib/security", () => ({ isSameOrigin: vi.fn(() => true), isRateLimited: vi.fn(() => false) }));
vi.mock("@/lib/webauthn", () => ({ getClientIpHash: vi.fn(() => "client-hash"), getWebAuthnRelyingParty: vi.fn(() => ({ origin: "http://localhost", rpID: "localhost" })), hashSecret: vi.fn(() => "hash"), trustedDeviceCookieName: "trusted-device", webauthnUserConsentVersion: "v1" }));
vi.mock("@simplewebauthn/server", () => ({ verifyRegistrationResponse: vi.fn(async () => ({ verified: true, registrationInfo: { userVerified: true, credential: { id: "cred", publicKey: Buffer.from("public"), counter: 1, transports: [] } } })) }));

import { POST } from "./route";

describe("device pairing complete route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires a valid pairing payload", async () => {
    const response = await POST(new Request("http://localhost/api/auth/device-pairing/complete", { method: "POST", headers: { "content-type": "application/json", origin: "http://localhost" }, body: JSON.stringify({}) }));
    expect(response.status).toBe(400);
  });
});
