import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getAuthenticatedFuncionario: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    item: { findMany: vi.fn() },
    movimentacao: { findMany: vi.fn() },
  },
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { LOCAL_ESTOQUE_SLUG } from "@/lib/stock-locations";
import { carregarDadosRessuprimento } from "./page";

describe("carregarDadosRessuprimento", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.item.findMany).mockResolvedValue([{
      id: "item-central",
      nome: "Item central",
      pontoPedido: 5,
      saldos: [{ quantidade: 4, reservada: 1 }],
    }] as never);
    vi.mocked(prisma.movimentacao.findMany).mockResolvedValue([] as never);
  });

  it("calculates reorder stock from free central stock and limits outgoing history to that location", async () => {
    const result = await carregarDadosRessuprimento(new Date("2026-06-30T12:00:00Z"));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sugestoes[0].estoque).toBe(3);
    expect(result.sugestoes[0].estoque).toBeLessThanOrEqual(result.sugestoes[0].pontoAtual);
    expect(prisma.item.findMany).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({
        saldos: {
          where: { local: { slug: LOCAL_ESTOQUE_SLUG } },
          select: { quantidade: true, reservada: true },
        },
      }),
    }));
    expect(prisma.movimentacao.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        saldoEstoque: { local: { slug: LOCAL_ESTOQUE_SLUG } },
      }),
    }));
  });

  it("returns an explicit failure if stock data cannot be read", async () => {
    vi.mocked(prisma.item.findMany).mockRejectedValueOnce(new Error("query failed"));

    const result = await carregarDadosRessuprimento(new Date("2026-06-30T12:00:00Z"));

    expect(result.ok).toBe(false);
  });
});
