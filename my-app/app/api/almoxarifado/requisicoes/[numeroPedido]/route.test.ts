import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getAuthenticatedFuncionario: vi.fn() }));
vi.mock("@/lib/security", () => ({ isSameOrigin: vi.fn(() => true) }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: vi.fn(async (cb) => cb({ requisicao: { findUnique: vi.fn() }, funcionario: { findFirst: vi.fn() }, requisicaoItem: { updateMany: vi.fn() }, auditoria: { create: vi.fn() } })) } }));

import { GET, PATCH } from "./route";
import { getAuthenticatedFuncionario } from "@/lib/auth";

describe("almoxarifado requisicao detail route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects anonymous reads", async () => {
    vi.mocked(getAuthenticatedFuncionario).mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/almoxarifado/requisicoes/1"), { params: Promise.resolve({ numeroPedido: "1" }) });
    expect(response.status).toBe(401);
  });

  it("requires a valid action payload for updates", async () => {
    vi.mocked(getAuthenticatedFuncionario).mockResolvedValue({ id: 1, role: "almoxarife", nome: "Atendente", criadoEm: new Date(), login: "almox", email: "almox@local", senha: "hashed", cargo: "almoxarife", cracha: "1000", papel: "ALMOXARIFE", mustChangePassword: false, ativo: true, atualizadoEm: new Date() } as never);
    const response = await PATCH(new Request("http://localhost/api/almoxarifado/requisicoes/1", { method: "PATCH", headers: { "content-type": "application/json", origin: "http://localhost" }, body: JSON.stringify({ action: "x", codigoCracha: "1000" }) }), { params: Promise.resolve({ numeroPedido: "1" }) });
    expect(response.status).toBe(400);
  });
});
