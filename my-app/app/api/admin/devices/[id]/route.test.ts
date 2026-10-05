import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/security", () => ({ isSameOrigin: vi.fn(() => true) }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  $transaction: vi.fn(async (cb) => cb({
    trustedDevice: { updateMany: vi.fn(), findFirst: vi.fn() },
    webAuthnCredential: { updateMany: vi.fn() },
    sessao: { deleteMany: vi.fn() },
    devicePairing: { updateMany: vi.fn() },
    securityAuditEvent: { create: vi.fn() },
    emergencyAccessGrant: { create: vi.fn() },
    funcionario: { findFirst: vi.fn() },
  })),
  trustedDevice: { findFirst: vi.fn() },
  funcionario: { findFirst: vi.fn() },
} }));
vi.mock("@/lib/webauthn", () => ({ getClientIpHash: vi.fn(() => "client-hash"), hashSecret: vi.fn(() => "hash"), pairingCodeTtlMs: 60000, emergencyGrantTtlMs: 60000 }));

import { PATCH } from "./route";
import { requireAdmin } from "@/lib/auth";

describe("admin device detail route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires admin access for actions", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ funcionario: null, status: 401 });
    const response = await PATCH(new Request("http://localhost/api/admin/devices/1", { method: "PATCH", headers: { "content-type": "application/json", origin: "http://localhost" }, body: JSON.stringify({ action: "revoke" }) }), { params: Promise.resolve({ id: "1" }) });
    expect(response.status).toBe(401);
  });
});
