import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    funcionario: { findFirst: vi.fn() },
    sessao: { create: vi.fn() },
  },
}));

import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { PapelFuncionario } from "@/generated/prisma/client";

const admin = {
  id: 1,
  nome: "Admin",
  email: "admin@local.invalid",
  cracha: "ADMIN",
  papel: PapelFuncionario.ADMIN,
  senha: "",
  ativo: true,
  cargo: "admin",
  mustChangePassword: true,
};

const almoxarife = {
  id: 2,
  nome: "Carlos",
  email: "carlos@local.invalid",
  cracha: "1234",
  papel: PapelFuncionario.ALMOXARIFE,
  senha: "",
  ativo: true,
  cargo: "almoxarife",
  mustChangePassword: false,
};

function request(portal: string, identificador: string) {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost" },
    body: JSON.stringify({ portal, identificador, senha: "Senha123" }),
  });
}

describe("login by portal", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    admin.senha = await bcrypt.hash("Senha123", 4);
    almoxarife.senha = await bcrypt.hash("Senha123", 4);
    vi.mocked(prisma.sessao.create).mockResolvedValue({} as never);
  });

  it("authenticates admin only through the admin portal", async () => {
    vi.mocked(prisma.funcionario.findFirst).mockResolvedValue(admin as never);
    const response = await POST(request("admin", "admin"));
    expect(response.status).toBe(200);
    expect(prisma.funcionario.findFirst).toHaveBeenCalledWith({
      where: { login: "admin", papel: PapelFuncionario.ADMIN },
    });
    expect(prisma.sessao.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ accessArea: "admin" }),
      })
    );
  });

  it("authenticates employees only by badge through the warehouse portal", async () => {
    vi.mocked(prisma.funcionario.findFirst).mockResolvedValue(almoxarife as never);
    const response = await POST(request("almoxarifado", "1234"));
    expect(response.status).toBe(200);
    expect(prisma.funcionario.findFirst).toHaveBeenCalledWith({
      where: {
        cracha: "1234",
        papel: { in: [PapelFuncionario.ALMOXARIFE, PapelFuncionario.ADMIN] },
      },
    });
  });

  it("rejects cross-portal credentials with a generic error", async () => {
    vi.mocked(prisma.funcionario.findFirst).mockResolvedValue(null);
    const response = await POST(request("almoxarifado", "admin"));
    expect(response.status).toBe(401);
    expect((await response.json()).error).toBe("Credenciais inválidas.");
  });
});