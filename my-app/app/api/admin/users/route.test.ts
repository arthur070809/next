import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/generated/prisma/client", () => ({
  Prisma: {
    PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {
      code: string;
      constructor(message: string, meta: { code: string }) {
        super(message);
        this.code = meta.code;
      }
    },
  },
  PapelFuncionario: {
    USUARIO: "USUARIO",
    OPERADOR: "OPERADOR",
    ALMOXARIFE: "ALMOXARIFE",
    ADMIN: "ADMIN",
  },
}));

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(),
  papelParaRole: vi.fn((papel: string) => papel.toLowerCase()),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    funcionario: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    auditoria: { create: vi.fn() },
  },
}));
vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(),
  papelParaRole: vi.fn((papel: string) => papel.toLowerCase()),
}));
vi.mock("@/lib/prisma", () => ({ prisma: {
  $transaction: vi.fn(),
  funcionario: { findMany: vi.fn(), create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), count: vi.fn() },
  auditoria: { create: vi.fn() },
  sessao: { deleteMany: vi.fn() },
  webAuthnCredential: { deleteMany: vi.fn() },
  faceTemplate: { deleteMany: vi.fn() },
  livenessChallenge: { deleteMany: vi.fn() },
  devicePairing: { deleteMany: vi.fn() },
  authChallenge: { deleteMany: vi.fn() },
  emergencyAccessGrant: { deleteMany: vi.fn() },
  adminTotpCredential: { deleteMany: vi.fn() },
  securityAuditEvent: { create: vi.fn() },
} }));

import { POST as publicRegistration } from "../../auth/cadastro/route";
import { PATCH, POST } from "./route";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const admin = {
  id: 1,
  papel: "ADMIN",
} as NonNullable<Awaited<ReturnType<typeof requireAdmin>>["funcionario"]>;

function request(body: unknown) {
  return new Request("http://localhost/api/admin/users", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost" },
    body: JSON.stringify(body),
  });
}

describe("admin user API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdmin).mockResolvedValue({ funcionario: admin, status: 200 });
    vi.mocked(prisma.$transaction).mockImplementation(((callback: (tx: typeof prisma) => Promise<unknown>) => callback(prisma)) as never);
  });

  it("blocks public registration with 404", async () => {
    expect((await publicRegistration()).status).toBe(404);
  });

  it("returns 401 without a session and 403 for a regular user", async () => {
    vi.mocked(requireAdmin).mockResolvedValueOnce({ funcionario: null, status: 401 });
    expect((await POST(request({}))).status).toBe(401);
    vi.mocked(requireAdmin).mockResolvedValueOnce({ funcionario: null, status: 403 });
    expect((await POST(request({}))).status).toBe(403);
  });

  it("rejects weak passwords", async () => {
    expect((await POST(request({ nome: "Ana", cracha: "1234", senha: "fraca" }))).status).toBe(400);
  });

  it("creates a user and ignores role from the payload", async () => {
    vi.mocked(prisma.funcionario.create).mockResolvedValue({
      id: 2,
      nome: "Ana",
      cracha: "1234",
      cargo: "usuario",
      papel: "USUARIO",
      ativo: true,
      mustChangePassword: true,
    } as never);
    const response = await POST(
      request({ nome: "Ana", cracha: "1234", senha: "SenhaInicial123", role: "admin" })
    );
    expect(response.status).toBe(201);
    expect(vi.mocked(prisma.funcionario.create).mock.calls[0][0].data).toHaveProperty("papel", "USUARIO");
    expect(prisma.auditoria.create).toHaveBeenCalled();
  });

  it("returns 409 for a duplicate badge", async () => {
    const PrismaError = (await import("@/generated/prisma/client")).Prisma
      .PrismaClientKnownRequestError;
    vi.mocked(prisma.funcionario.create).mockRejectedValue(
      new PrismaError("duplicate", { code: "P2002", clientVersion: "test" })
    );
    expect(
      (await POST(request({ nome: "Ana", cracha: "1234", senha: "SenhaInicial123" }))).status
    ).toBe(409);
  });

  it("resets a user password and records an audit event", async () => {
    vi.mocked(prisma.funcionario.findUnique).mockResolvedValue({ id: 2 } as never);
    vi.mocked(prisma.funcionario.update).mockResolvedValue({} as never);
    const response = await PATCH(
      request({ action: "reset-password", userId: 2, senha: "SenhaNova123" })
    );
    expect(response.status).toBe(200);
    expect(prisma.funcionario.update).toHaveBeenCalledWith({ where: { id: 2 }, data: expect.objectContaining({ mustChangePassword: true }) });
    expect(prisma.sessao.deleteMany).toHaveBeenCalledWith({ where: { funcionarioId: 2 } });
    expect(prisma.auditoria.create).toHaveBeenCalled();
  });

  it("deletes biometric credentials and sessions when an employee is deactivated", async () => {
    vi.mocked(prisma.funcionario.findUnique).mockResolvedValue({ id: 2 } as never);
    vi.mocked(prisma.funcionario.update).mockResolvedValue({} as never);

    const response = await PATCH(request({ action: "set-active", userId: 2, ativo: false }));

    expect(response.status).toBe(200);
    expect(prisma.webAuthnCredential.deleteMany).toHaveBeenCalledWith({ where: { funcionarioId: 2 } });
    expect(prisma.faceTemplate.deleteMany).toHaveBeenCalledWith({ where: { funcionarioId: 2 } });
    expect(prisma.livenessChallenge.deleteMany).toHaveBeenCalledWith({ where: { funcionarioId: 2 } });
    expect(prisma.sessao.deleteMany).toHaveBeenCalledWith({ where: { funcionarioId: 2 } });
    expect(prisma.emergencyAccessGrant.deleteMany).toHaveBeenCalledWith({ where: { funcionarioId: 2 } });
  });

  it("does not allow the admin to deactivate itself", async () => {
    const response = await PATCH(request({ action: "set-active", userId: 1, ativo: false }));
    expect(response.status).toBe(400);
  });
});