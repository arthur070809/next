import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ get: vi.fn(() => undefined) })) }));
vi.mock("@/lib/login-attempts", () => ({ getLoginBlockRetryAfter: vi.fn(async () => null), getLoginClientIpHash: vi.fn(() => "client-hash"), isLoginAttemptStorageUnavailable: vi.fn(() => false), loginAttemptStorageUnavailableResponse: vi.fn(() => new Response(null, { status: 503 })), recordLoginFailure: vi.fn(async () => undefined) }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  authChallenge: { findUnique: vi.fn() },
  $transaction: vi.fn(async (callback) => callback({ authChallenge: { updateMany: vi.fn() }, securityAuditEvent: { create: vi.fn() }, webAuthnCredential: { updateMany: vi.fn() }, trustedDevice: { update: vi.fn() }, faceTemplate: { count: vi.fn() }, livenessChallenge: { create: vi.fn() }, funcionario: { findFirst: vi.fn() } })),
  webAuthnCredential: { findFirst: vi.fn() },
  securityAuditEvent: { create: vi.fn() },
  trustedDevice: { update: vi.fn() },
  faceTemplate: { count: vi.fn() },
  livenessChallenge: { create: vi.fn() },
  funcionario: { findFirst: vi.fn() },
} }));
vi.mock("@/lib/security", () => ({ isRateLimited: vi.fn(() => false), isSameOrigin: vi.fn(() => true) }));
vi.mock("@/lib/security-attempts", () => ({ isFactorBlocked: vi.fn(() => false), recordFactorFailure: vi.fn(() => undefined) }));
vi.mock("@/lib/webauthn", () => ({ getWebAuthnRelyingParty: vi.fn(() => ({ origin: "http://localhost", rpID: "localhost" })), hashSecret: vi.fn(() => "hash"), trustedDeviceCookieName: "trusted-device" }));
vi.mock("@/lib/face", () => ({ createFaceNonce: vi.fn(() => "nonce"), hashFaceNonce: vi.fn(() => "hash"), livenessChallengeTtlMs: 60000 }));
vi.mock("@simplewebauthn/server", () => ({ verifyAuthenticationResponse: vi.fn(async () => ({ verified: false, authenticationInfo: { userVerified: false } })) }));

import { POST } from "./route";

describe("login webauthn verification route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fails closed when the payload is incomplete", async () => {
    const response = await POST(new Request("http://localhost/api/auth/login/webauthn/verify", { method: "POST", headers: { "content-type": "application/json", origin: "http://localhost" }, body: JSON.stringify({}) }));
    expect(response.status).toBe(401);
  });
});
