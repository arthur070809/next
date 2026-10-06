import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ requireAlmoxarife: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { movimentacao: { findMany: vi.fn(), count: vi.fn() } },
}));

import { GET } from "./route";
import { requireAlmoxarife } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

describe("GET /api/deposito/historico", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAlmoxarife).mockResolvedValue({
      funcionario: { id: 27, papel: "ALMOXARIFE" },
      status: 200,
    } as never);
    vi.mocked(prisma.movimentacao.findMany).mockResolvedValue([{
      id: "movement-1",
      tipo: "SAIDA",
      quantidade: 2,
      saldoApos: 3,
      criadoEm: new Date("2026-10-05T12:00:00Z"),
      observacao: "Retirada para reaproveitamento: linha A. [[deposit-op:v1:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb]]",
      saldoEstoque: { item: { id: "item-1", nome: "Arruela", codigo: "A-1" } },
      funcionario: { id: 27, nome: "Demo Almoxarife" },
      requisicao: null,
    }] as never);
    vi.mocked(prisma.movimentacao.count).mockResolvedValue(1);
  });

  it("lists deposit outflows with the registering staff member and hides internal metadata", async () => {
    const response = await GET(new Request("http://localhost/api/deposito/historico?tipo=SAIDA_REAPROVEITAMENTO"));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      movimentacoes: [{
        tipo: "SAIDA_REAPROVEITAMENTO",
        quantidade: 2,
        saldoDepois: 3,
        motivo: "Retirada para reaproveitamento: linha A.",
        item: { id: "item-1", nome: "Arruela" },
        usuario: { id: 27, nome: "Demo Almoxarife" },
      }],
      total: 1,
    });
    expect(prisma.movimentacao.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        tipo: "SAIDA",
        observacao: { startsWith: "Retirada para reaproveitamento:" },
      }),
    }));
  });

  it("denies non-staff users before reading movements", async () => {
    vi.mocked(requireAlmoxarife).mockResolvedValueOnce({ funcionario: null, status: 403 } as never);
    const response = await GET(new Request("http://localhost/api/deposito/historico"));
    expect(response.status).toBe(403);
    expect(prisma.movimentacao.findMany).not.toHaveBeenCalled();
  });

  it("filters manual deposits separately from returned surpluses", async () => {
    await GET(new Request("http://localhost/api/deposito/historico?tipo=ENTRADA_SOBRA"));
    expect(prisma.movimentacao.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        tipo: "ENTRADA",
        observacao: { startsWith: "Entrada de sobra" },
      }),
    }));

    vi.mocked(prisma.movimentacao.findMany).mockClear();
    await GET(new Request("http://localhost/api/deposito/historico?tipo=ENTRADA_MANUAL"));
    expect(prisma.movimentacao.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        tipo: "ENTRADA",
        NOT: { observacao: { startsWith: "Entrada de sobra" } },
      }),
    }));
  });

  it("rejects unauthenticated requests before reading movements", async () => {
    vi.mocked(requireAlmoxarife).mockResolvedValueOnce({ funcionario: null, status: 401 } as never);
    const response = await GET(new Request("http://localhost/api/deposito/historico"));

    expect(response.status).toBe(401);
    expect(prisma.movimentacao.findMany).not.toHaveBeenCalled();
  });
});
