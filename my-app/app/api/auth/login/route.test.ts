import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {
  funcionario: { findFirst: vi.fn() },
  sessao: { create: vi.fn() },
  $transaction: vi.fn(),
  adminTotpCredential: { findUnique: vi.fn() },
  trustedDevice: { findUnique: vi.fn() },
  webAuthnCredential: { findMany: vi.fn() },
  emergencyAccessGrant: { findFirst: vi.fn() },
  authChallenge: { create: vi.fn() },
  faceTemplate: { count: vi.fn() },
  securityAuditEvent: { create: vi.fn() },
  loginAttemptBucket: { findFirst: vi.fn(), deleteMany: vi.fn() },
  $executeRaw: vi.fn(),
} }));
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ get: vi.fn(() => undefined) })) }));

import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { PapelFuncionario } from "@/generated/prisma/client";

const admin = {
  id: 1,
  nome: "Admin",
  email: "admin@local.invalid",
  cracha: "1000",
  papel: PapelFuncionario.ADMIN,
  senha: "unused",
  ativo: true,
  cargo: "admin",
  mustChangePassword: false,
};

const operator = {
  id: 2,
  nome: "Operador",
  email: "operator@local.invalid",
  cracha: "2000",
  papel: PapelFuncionario.OPERADOR,
  senha: "unused",
  ativo: true,
  cargo: "operador",
  mustChangePassword: false,
};

function request(codigoCracha: string) {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost" },
    body: JSON.stringify({ codigoCracha }),
  });
}

describe("login by badge code", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.LOGIN_FACIAL_OBRIGATORIO = "false";
    process.env.LOGIN_CHALLENGE_SECRET = "test-login-secret-that-is-at-least-32-characters";
    vi.mocked(prisma.sessao.create).mockResolvedValue({} as never);
    vi.mocked(prisma.$transaction).mockImplementation(((callback: (transaction: typeof prisma) => Promise<unknown>) => callback(prisma)) as never);
    vi.mocked(prisma.funcionario.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.adminTotpCredential.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.webAuthnCredential.findMany).mockResolvedValue([]);
    vi.mocked(prisma.emergencyAccessGrant.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.loginAttemptBucket.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.faceTemplate.count).mockResolvedValue(1);
    vi.mocked(prisma.$executeRaw).mockResolvedValue(1);
    vi.mocked(prisma.authChallenge.create).mockResolvedValue({ id: "face-challenge" } as never);
    vi.mocked(prisma.loginAttemptBucket.deleteMany).mockResolvedValue({ count: 0 } as never);
  });

  it("finds the employee by badge, discovers the role, and creates an admin session", async () => {
    vi.mocked(prisma.funcionario.findFirst).mockResolvedValue(admin as never);

    const response = await POST(request("1000"));

    expect(response.status).toBe(200);
    expect(prisma.funcionario.findFirst).toHaveBeenCalledWith({ where: { cracha: "1000" } });
    expect(prisma.sessao.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ funcionarioId: admin.id, accessArea: "admin" }) }),
    );
  });

  it("authenticates operators without a facial challenge", async () => {
    process.env.LOGIN_FACIAL_OBRIGATORIO = "true";
    vi.mocked(prisma.funcionario.findFirst).mockResolvedValue(operator as never);

    const response = await POST(request("2000"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.funcionario.role).toBe("operador");
    expect(prisma.sessao.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ funcionarioId: operator.id, accessArea: "operador" }) }),
    );
    expect(prisma.authChallenge.create).not.toHaveBeenCalled();
  });

  it("requires the signed one-use facial challenge for admins by default", async () => {
    process.env.LOGIN_FACIAL_OBRIGATORIO = "true";
    vi.mocked(prisma.funcionario.findFirst).mockResolvedValue(admin as never);

    const response = await POST(request("1000"));
    const data = await response.json();

    expect(response.status).toBe(202);
    expect(data.step).toBe("face");
    expect(typeof data.loginToken).toBe("string");
    expect(prisma.sessao.create).not.toHaveBeenCalled();
  });

  it("fails closed for an admin without a face template or TOTP", async () => {
    process.env.LOGIN_FACIAL_OBRIGATORIO = "true";
    vi.mocked(prisma.funcionario.findFirst).mockResolvedValue(admin as never);
    vi.mocked(prisma.faceTemplate.count).mockResolvedValue(0);

    const response = await POST(request("1000"));

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: expect.stringContaining("habilitar o TOTP"),
    });
    expect(prisma.sessao.create).not.toHaveBeenCalled();
    expect(prisma.authChallenge.create).not.toHaveBeenCalled();
  });

  it("routes an admin without a face template to configured TOTP", async () => {
    process.env.LOGIN_FACIAL_OBRIGATORIO = "true";
    vi.mocked(prisma.funcionario.findFirst).mockResolvedValue(admin as never);
    vi.mocked(prisma.adminTotpCredential.findUnique).mockResolvedValue({ enabledAt: new Date() } as never);
    vi.mocked(prisma.faceTemplate.count).mockResolvedValue(0);

    const response = await POST(request("1000"));
    const data = await response.json();

    expect(response.status).toBe(202);
    expect(data.step).toBe("totp");
    expect(prisma.sessao.create).not.toHaveBeenCalled();
  });

  it("returns one generic invalid-code response for malformed and unknown codes", async () => {
    vi.mocked(prisma.funcionario.findFirst).mockResolvedValue(null);

    const response = await POST(request("12 x"));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Código inválido." });
    expect(prisma.funcionario.findFirst).toHaveBeenCalledWith({ where: { cracha: "__INVALID_BADGE__" } });
    expect(prisma.sessao.create).not.toHaveBeenCalled();
  });

  it("does not authenticate inactive employees", async () => {
    vi.mocked(prisma.funcionario.findFirst).mockResolvedValue({ ...admin, ativo: false } as never);

    const response = await POST(request("1000"));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Código inválido." });
    expect(prisma.sessao.create).not.toHaveBeenCalled();
  });

  it("blocks a badge or IP with an active persistent lock", async () => {
    vi.mocked(prisma.loginAttemptBucket.findFirst).mockResolvedValue({ blockedUntil: new Date(Date.now() + 60_000) } as never);

    const response = await POST(request("1000"));

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBeTruthy();
    expect(prisma.funcionario.findFirst).not.toHaveBeenCalled();
  });

  it("normalizes full-width badge digits before both lookup and failure accounting", async () => {
    vi.mocked(prisma.funcionario.findFirst).mockResolvedValue(null);

    const response = await POST(request(" １２３４ "));

    expect(response.status).toBe(401);
    expect(prisma.funcionario.findFirst).toHaveBeenCalledWith({ where: { cracha: "1234" } });
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);
  });

  it("fails closed with a controlled 503 when the required throttling table is absent", async () => {
    vi.mocked(prisma.loginAttemptBucket.findFirst).mockRejectedValue({ code: "P2021" });

    const response = await POST(request("1234"));

    expect(response.status).toBe(503);
    expect((await response.json()).error).toContain("temporariamente indisponível");
    expect(prisma.funcionario.findFirst).not.toHaveBeenCalled();
  });

  it("does not create a session if the employee becomes inactive during login", async () => {
    vi.mocked(prisma.funcionario.findFirst)
      .mockResolvedValueOnce(operator as never)
      .mockResolvedValueOnce(null);

    const response = await POST(request("2000"));

    expect(response.status).toBe(401);
    expect(prisma.sessao.create).not.toHaveBeenCalled();
  });
});
