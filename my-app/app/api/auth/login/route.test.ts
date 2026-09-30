import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: { funcionario: { findFirst: vi.fn() }, sessao: { create: vi.fn() } } }));

import { POST } from "./route";
import { prisma } from "@/lib/prisma";

const admin = { id: 1, nome: "Admin", email: "admin@local.invalid", cracha: "ADMIN", role: "admin", senha: "", ativo: true, cargo: "admin", mustChangePassword: true };
const user = { id: 2, nome: "Ana", email: "ana@local.invalid", cracha: "1234", role: "user", senha: "", ativo: true, cargo: "operador", mustChangePassword: false };

function request(portal: string, identificador: string) {
  return new Request("http://localhost/api/auth/login", { method: "POST", headers: { "content-type": "application/json", origin: "http://localhost" }, body: JSON.stringify({ portal, identificador, senha: "Senha123" }) });
}

describe("login by portal", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    admin.senha = await bcrypt.hash("Senha123", 4);
    user.senha = await bcrypt.hash("Senha123", 4);
    vi.mocked(prisma.sessao.create).mockResolvedValue({} as never);
  });

  it("authenticates admin only through the admin portal", async () => {
    vi.mocked(prisma.funcionario.findFirst).mockResolvedValue(admin as never);
    const response = await POST(request("admin", "admin"));
    expect(response.status).toBe(200);
    expect(prisma.funcionario.findFirst).toHaveBeenCalledWith({ where: { login: "admin", role: "admin" } });
    expect(prisma.sessao.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ accessArea: "admin" }) }));
  });

  it("authenticates employees only by badge through the warehouse portal", async () => {
    vi.mocked(prisma.funcionario.findFirst).mockResolvedValue(user as never);
    const response = await POST(request("almoxarifado", "1234"));
    expect(response.status).toBe(200);
    expect(prisma.funcionario.findFirst).toHaveBeenCalledWith({ where: { cracha: "1234", role: "user" } });
  });

  it("rejects cross-portal credentials with a generic error", async () => {
    vi.mocked(prisma.funcionario.findFirst).mockResolvedValue(null);
    const response = await POST(request("almoxarifado", "admin"));
    expect(response.status).toBe(401);
    expect((await response.json()).error).toBe("Credenciais inválidas.");
  });
});