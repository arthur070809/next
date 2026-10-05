import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  adminTotpCredential: { findUnique: vi.fn(), upsert: vi.fn() },
  securityAuditEvent: { create: vi.fn() },
  $transaction: vi.fn(async (callback) => callback({
    adminTotpCredential: { updateMany: vi.fn(), delete: vi.fn() },
    securityAuditEvent: { create: vi.fn() },
  })),
} }));
vi.mock("@/lib/security", () => ({ isSameOrigin: vi.fn(() => true) }));
vi.mock("@/lib/security-crypto", () => ({ decryptSecuritySecret: vi.fn(() => "SUPERSECRET"), encryptSecuritySecret: vi.fn(() => ({ ciphertext: "cipher", iv: "iv", tag: "tag" })) }));
vi.mock("@/lib/totp", () => ({ createTotpSecret: vi.fn(() => ({ secret: "SECRET", uri: "otpauth://test/test" })), verifyTotp: vi.fn(() => 123456) }));
vi.mock("@/lib/webauthn", () => ({ getClientIpHash: vi.fn(() => "client-hash") }));

import { GET, POST } from "./route";
import { requireAdmin } from "@/lib/auth";

describe("admin TOTP route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires admin authentication", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ funcionario: null, status: 401 });
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("starts setup when admin is authenticated", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ funcionario: { id: 1, nome: "Admin", role: "admin", criadoEm: new Date(), login: "admin", email: "admin@local", senha: "hashed", cargo: "admin", cracha: "1000", papel: "ADMIN", mustChangePassword: false, ativo: true, atualizadoEm: new Date() } as never, status: 200 });
    const response = await POST(new Request("http://localhost/api/admin/totp", { method: "POST", headers: { origin: "http://localhost" } }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ otpauthUrl: expect.stringContaining("otpauth") });
  });
});
