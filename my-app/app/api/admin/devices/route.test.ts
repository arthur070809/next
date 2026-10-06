import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  trustedDevice: { findMany: vi.fn() },
  funcionario: { findMany: vi.fn() },
  $transaction: vi.fn(async (cb) => cb({
    trustedDevice: { count: vi.fn(), create: vi.fn() },
    devicePairing: { create: vi.fn() },
    securityAuditEvent: { create: vi.fn() },
  })),
} }));
vi.mock("@/lib/security", () => ({ isSameOrigin: vi.fn(() => true) }));
vi.mock("@/lib/webauthn", () => ({ getClientIpHash: vi.fn(() => "client-hash"), hashSecret: vi.fn(() => "hash"), pairingCodeTtlMs: 60000 }));

import { GET, POST } from "./route";
import { requireAdmin } from "@/lib/auth";

describe("admin devices route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires admin authentication to list devices", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ funcionario: null, status: 401 });
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("rejects malformed payloads", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ funcionario: { id: 1, nome: "Admin", role: "admin", criadoEm: new Date(), login: "admin", email: "admin@local", senha: "hashed", cargo: "admin", cracha: "1000", papel: "ADMIN", mustChangePassword: false, ativo: true, atualizadoEm: new Date() } as never, status: 200 });
    const response = await POST(new Request("http://localhost/api/admin/devices", { method: "POST", headers: { "content-type": "application/json", origin: "http://localhost" }, body: JSON.stringify({}) }));
    expect(response.status).toBe(400);
  });
});
