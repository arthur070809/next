import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getAuthenticatedFuncionario: vi.fn() }));
vi.mock("@/lib/requisicoes-db", () => ({ listOpenRequisitions: vi.fn(async () => []) }));

import { GET } from "./route";
import { getAuthenticatedFuncionario } from "@/lib/auth";

describe("almoxarifado requisicoes route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects unauthenticated access", async () => {
    vi.mocked(getAuthenticatedFuncionario).mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("rejects non-warehouse staff", async () => {
    vi.mocked(getAuthenticatedFuncionario).mockResolvedValue({ id: 1, role: "operador", nome: "Operador", criadoEm: new Date(), login: "op", email: "op@local", senha: "hashed", cargo: "operador", cracha: "2000", papel: "OPERADOR", mustChangePassword: false, ativo: true, atualizadoEm: new Date() } as never);
    const response = await GET();
    expect(response.status).toBe(403);
  });
});
