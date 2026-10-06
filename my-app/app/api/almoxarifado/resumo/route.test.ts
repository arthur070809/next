import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getAuthenticatedFuncionario: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    item: { count: vi.fn() },
    saldoEstoque: { count: vi.fn() },
    requisicao: { count: vi.fn() },
    movimentacao: { aggregate: vi.fn() },
  },
}));

import { GET } from "./route";
import { getAuthenticatedFuncionario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TipoMovimentacao } from "@/generated/prisma/client";

describe("GET /api/almoxarifado/resumo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAuthenticatedFuncionario).mockResolvedValue({ id: 7 } as Awaited<ReturnType<typeof getAuthenticatedFuncionario>>);
    vi.mocked(prisma.item.count).mockResolvedValue(12);
    vi.mocked(prisma.saldoEstoque.count)
      .mockResolvedValueOnce(2) // materiaisSemEstoque
      .mockResolvedValueOnce(4); // itensComSobras
    vi.mocked(prisma.requisicao.count).mockResolvedValue(3);
    vi.mocked(prisma.movimentacao.aggregate).mockResolvedValue({ _sum: { quantidade: 6 } } as never);
  });

  it("returns only aggregate counts from the authenticated database scope", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      resumo: {
        materiaisAtivos: 12,
        materiaisSemEstoque: 2,
        requisicoesPendentes: 3,
        itensComSobras: 4,
        sobrasHoje: 6,
      },
    });
    expect(prisma.requisicao.count).toHaveBeenCalledWith({ where: { status: "PENDENTE" } });
    expect(prisma.movimentacao.aggregate).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        tipo: TipoMovimentacao.ENTRADA,
        saldoEstoque: { local: { slug: "deposito" } },
      }),
      _sum: { quantidade: true },
    }));
  });

  it("returns 401 without a session and does not query data", async () => {
    vi.mocked(getAuthenticatedFuncionario).mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(prisma.item.count).not.toHaveBeenCalled();
  });

  it("returns a friendly error without database details", async () => {
    vi.mocked(prisma.item.count).mockReset().mockRejectedValueOnce(new Error("Prisma table error"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Não foi possível carregar o resumo agora.");
    expect(JSON.stringify(body)).not.toMatch(/prisma|table/i);
    expect(body.errorId).toEqual(expect.any(String));
  });
});