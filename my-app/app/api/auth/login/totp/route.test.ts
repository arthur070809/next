import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {
  authChallenge: { findUnique: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
  adminTotpCredential: { findUnique: vi.fn(), updateMany: vi.fn() },
  funcionario: { findFirst: vi.fn() },
  faceTemplate: { count: vi.fn() },
  sessao: { create: vi.fn() },
  securityAuditEvent: { create: vi.fn() },
  $transaction: vi.fn(),
} }));
vi.mock("@/lib/security", () => ({ isRateLimited: vi.fn(() => false), isSameOrigin: vi.fn(() => true) }));
vi.mock("@/lib/security-crypto", () => ({ decryptSecuritySecret: vi.fn(() => "totp-secret") }));
vi.mock("@/lib/totp", () => ({ verifyTotp: vi.fn(() => 123456) }));
vi.mock("@/lib/security-attempts", () => ({
  clearFactorFailures: vi.fn(),
  isFactorBlocked: vi.fn(() => false),
  recordFactorFailure: vi.fn(() => 1),
}));
vi.mock("@/lib/login-attempts", () => ({
  clearBadgeLoginFailures: vi.fn(),
  getLoginBlockRetryAfter: vi.fn(() => null),
  getLoginClientIpHash: vi.fn(() => "hashed-ip"),
  isLoginAttemptStorageUnavailable: vi.fn(() => false),
  loginAttemptStorageUnavailableResponse: vi.fn(),
  recordLoginFailure: vi.fn(),
}));

import { PapelFuncionario } from "@/generated/prisma/client";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { hashSecret } from "@/lib/webauthn";

const admin = {
  id: 1,
  nome: "Admin",
  email: "admin@example.invalid",
  cargo: "admin",
  cracha: "1000",
  papel: PapelFuncionario.ADMIN,
  ativo: true,
  mustChangePassword: false,
};

describe("admin TOTP login without a face template", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.LOGIN_FACIAL_OBRIGATORIO = "true";
    vi.mocked(prisma.authChallenge.findUnique).mockResolvedValue({
      id: "totp-challenge",
      tipo: "ADMIN_TOTP",
      usadoEm: null,
      expiraEm: new Date(Date.now() + 60_000),
      ipHash: "hashed-ip",
      funcionarioId: admin.id,
      funcionario: admin,
    } as never);
    vi.mocked(prisma.adminTotpCredential.findUnique).mockResolvedValue({
      id: 1,
      enabledAt: new Date(),
      lastVerifiedStep: BigInt(0),
      secretCiphertext: new Uint8Array(),
      secretIv: new Uint8Array(),
      secretTag: new Uint8Array(),
    } as never);
    vi.mocked(prisma.faceTemplate.count).mockResolvedValue(0);
    vi.mocked(prisma.funcionario.findFirst).mockResolvedValue(admin as never);
    vi.mocked(prisma.authChallenge.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.adminTotpCredential.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.sessao.create).mockResolvedValue({} as never);
    vi.mocked(prisma.$transaction).mockImplementation(((callback: (transaction: typeof prisma) => Promise<unknown>) =>
      callback(prisma)) as never);
  });

  it("creates a session after TOTP when facial is configured but no template exists", async () => {
    const request = new Request("http://localhost/api/auth/login/totp", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost" },
      body: JSON.stringify({ preAuthToken: "temporary-token", code: "123456" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(prisma.authChallenge.findUnique).toHaveBeenCalledWith({
      where: { preAuthTokenHash: hashSecret("temporary-token") },
      include: { funcionario: true },
    });
    expect(prisma.faceTemplate.count).toHaveBeenCalledWith({
      where: { funcionarioId: admin.id, revogadoEm: null },
    });
    expect(prisma.sessao.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ funcionarioId: admin.id, accessArea: "admin" }),
    }));
    expect(prisma.authChallenge.create).not.toHaveBeenCalled();
  });

  it("keeps the TOTP fallback available if the face-template migration is absent", async () => {
    vi.mocked(prisma.faceTemplate.count).mockRejectedValueOnce({ code: "P2021" } as never);
    const request = new Request("http://localhost/api/auth/login/totp", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost" },
      body: JSON.stringify({ preAuthToken: "temporary-token", code: "123456" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(prisma.sessao.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ funcionarioId: admin.id, accessArea: "admin" }),
    }));
  });
});
