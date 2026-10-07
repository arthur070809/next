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
import { carregarDadosRessuprimento } from "@/lib/ressuprimento/carregar-dados";
import { isAtOrBelowReorderPoint } from "@/lib/stock-status";

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
    expect(result.sugestoes[0].estoque).toBeLessThanOrEqual(result.sugestoes[0].pontoAtual ?? Number.POSITIVE_INFINITY);
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

  it("does not fail or suggest an alert when an item has no reorder point", async () => {
    vi.mocked(prisma.item.findMany).mockResolvedValueOnce([{
      id: "no-reorder-point",
      nome: "Sem ponto configurado",
      pontoPedido: null,
      saldos: [{ quantidade: 0, reservada: 0 }],
    }] as never);

    const result = await carregarDadosRessuprimento(new Date("2026-06-30T12:00:00Z"));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sugestoes[0].pontoAtual).toBeNull();
  });

  it("uses the shared free-stock alert rule for exact and below thresholds", async () => {
    vi.mocked(prisma.item.findMany).mockResolvedValueOnce([
      { id: "below", nome: "Abaixo", pontoPedido: 5, saldos: [{ quantidade: 7, reservada: 2 }] },
      { id: "equal", nome: "Igual", pontoPedido: 5, saldos: [{ quantidade: 5, reservada: 0 }] },
      { id: "above", nome: "Acima", pontoPedido: 5, saldos: [{ quantidade: 8, reservada: 0 }] },
      { id: "zero", nome: "Zerado", pontoPedido: 5, saldos: [{ quantidade: 0, reservada: 0 }] },
    ] as never);

    const result = await carregarDadosRessuprimento(new Date("2026-06-30T12:00:00Z"));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sugestoes.map((item) => [item.id, isAtOrBelowReorderPoint(item.estoque, item.pontoAtual)]))
      .toEqual([["below", true], ["equal", true], ["above", false], ["zero", true]]);
  });
});
