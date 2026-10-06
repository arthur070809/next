import { describe, expect, it } from "vitest";
import type { EventoHistorico } from "@/lib/types/almoxarifado";
import { filterHistoricoEvents, paginateHistoricoEvents } from "./historico-filters";

const events: EventoHistorico[] = [
  {
    id: "first",
    requisicaoId: "req-1",
    numeroPedido: "DEMO-1",
    evento: "finalizada",
    codigoCracha: "2222",
    funcionarioId: 2,
    funcionarioNome: "Demo Almoxarife",
    descricaoMotivo: "pedido 2, separado 1 (FALTOU)",
    timestamp: "2026-10-04T12:00:00.000Z",
    produtos: [{ codigo: "7988", nome: "GARFO GGMX", quantidadePedida: 2, quantidadeSeparada: 1, motivo: "FALTOU" }],
  },
  {
    id: "second",
    requisicaoId: "req-2",
    numeroPedido: "DEMO-2",
    evento: "assumida",
    codigoCracha: "3333",
    funcionarioId: 3,
    funcionarioNome: "Demo Admin",
    descricaoMotivo: null,
    timestamp: "2026-10-02T12:00:00.000Z",
    produtos: [{ codigo: "129", nome: "RODIZIO", quantidadePedida: 4, quantidadeSeparada: 0 }],
  },
];

describe("history filters and pagination", () => {
  it("filters by product, executing employee, and inclusive calendar date range", () => {
    expect(filterHistoricoEvents(events, {
      produto: "7988",
      funcionarioId: 2,
      desde: new Date("2026-10-04T00:00:00.000Z"),
      ateExclusive: new Date("2026-10-05T00:00:00.000Z"),
    }).map(({ id }) => id)).toEqual(["first"]);
    expect(filterHistoricoEvents(events, { produto: "not found" })).toEqual([]);
    expect(filterHistoricoEvents(events, { funcionarioId: 9 })).toEqual([]);
  });

  it("sorts newest first and returns bounded pages", () => {
    expect(paginateHistoricoEvents(events, 2, 1)).toMatchObject({
      events: [events[1]],
      total: 2,
      page: 2,
      pageSize: 1,
      totalPages: 2,
    });
    expect(paginateHistoricoEvents(events, 9, 1).page).toBe(2);
  });
});
