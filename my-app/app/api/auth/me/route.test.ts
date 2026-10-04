import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getAuthenticatedFuncionario: vi.fn(), papelParaRole: vi.fn((papel) => papel.toLowerCase()) }));

import { GET } from "./route";
import { getAuthenticatedFuncionario } from "@/lib/auth";

describe("me route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 to unauthenticated requests", async () => {
    vi.mocked(getAuthenticatedFuncionario).mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("returns the authenticated employee payload", async () => {
    vi.mocked(getAuthenticatedFuncionario).mockResolvedValue({ id: 1, role: "admin", nome: "Ana", criadoEm: new Date(), login: "ana", email: "ana@local", senha: "secret", cargo: "usuario", cracha: "1000", papel: "ADMIN", mustChangePassword: false, ativo: true, atualizadoEm: new Date() } as never);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toHaveProperty("funcionario");
  });
});
