import { describe, expect, it } from "vitest";
import {
  assertDemoSeedInvariants,
  demoCatalog,
  demoLocations,
  demoSeedRequests,
} from "./demo-seed";
import { StatusRequisicao } from "@/generated/prisma/client";

function makeValidSnapshot() {
  const completedQuantities = new Map<string, number>();
  const activeReservations = new Map<string, number>();
  for (const request of demoSeedRequests) {
    for (const item of request.items) {
      if (request.status === StatusRequisicao.CONCLUIDA) {
        completedQuantities.set(item.codigo, (completedQuantities.get(item.codigo) ?? 0) + item.quantidade);
      } else {
        activeReservations.set(item.codigo, (activeReservations.get(item.codigo) ?? 0) + item.quantidade);
      }
    }
  }

  const stocks = demoCatalog.flatMap((fixture) =>
    demoLocations.map(({ slug }) => {
      const id = `saldo-${fixture.codigo}-${slug}`;
      return {
        id,
        itemId: `item-${fixture.codigo}`,
        codigo: fixture.codigo,
        localId: slug,
        slug,
        quantidade: slug === "estoque"
          ? fixture.central + (completedQuantities.get(fixture.codigo) ?? 0)
          : fixture.importados,
        reservada: slug === "estoque" ? activeReservations.get(fixture.codigo) ?? 0 : 0,
      };
    }),
  );
  const movements = stocks.map((stock) => {
    const opening = stock.quantidade;
    return {
      saldoEstoqueId: stock.id,
      tipo: "ENTRADA",
      quantidade: opening,
      saldoApos: opening,
    };
  });
  for (const request of demoSeedRequests.filter(({ status }) => status === StatusRequisicao.CONCLUIDA)) {
    for (const item of request.items) {
      const stockId = `saldo-${item.codigo}-estoque`;
      const stock = stocks.find(({ id }) => id === stockId)!;
      const lastMovement = movements.filter(({ saldoEstoqueId }) => saldoEstoqueId === stockId).at(-1)!;
      movements.push({
        saldoEstoqueId: stockId,
        tipo: "SAIDA",
        quantidade: item.quantidade,
        saldoApos: lastMovement.saldoApos - item.quantidade,
      });
      stock.quantidade -= item.quantidade;
    }
  }
  return {
    stocks,
    movements,
    requests: demoSeedRequests.map((request) => ({
      numeroPedido: request.numeroPedido,
      status: request.status,
      prioridade: request.prioridade,
      itens: request.items.map((item) => ({
        itemId: `item-${item.codigo}`,
        localId: "estoque",
        quantidade: item.quantidade,
      })),
    })),
  };
}

describe("demo seed postconditions", () => {
  it("accepts coherent stock snapshots, active reservations, and fixture status counts", () => {
    expect(() => assertDemoSeedInvariants(makeValidSnapshot())).not.toThrow();
  });

  it("fails when stock does not reconcile with movement snapshots", () => {
    const snapshot = makeValidSnapshot();
    expect(() => assertDemoSeedInvariants({
      ...snapshot,
      stocks: snapshot.stocks.map((stock) =>
        stock.codigo === "129" && stock.slug === "estoque"
          ? { ...stock, quantidade: stock.quantidade + 1 }
          : stock,
      ),
    })).toThrow(/saldo 129.*movimenta/i);
  });

  it("fails when an open request has no items or reservations disagree", () => {
    const snapshot = makeValidSnapshot();
    expect(() => assertDemoSeedInvariants({
      ...snapshot,
      requests: snapshot.requests.map((request) =>
        request.numeroPedido === "DEMO-000104" ? { ...request, itens: [] } : request,
      ),
    })).toThrow(/DEMO-000104.*sem itens/i);
    expect(() => assertDemoSeedInvariants({
      ...snapshot,
      stocks: snapshot.stocks.map((stock) =>
        stock.codigo === "129" && stock.slug === "estoque"
          ? { ...stock, reservada: stock.reservada + 1 }
          : stock,
      ),
    })).toThrow(/reserva.*129/i);
  });

  it("fails when fixture request counts or priorities differ", () => {
    const snapshot = makeValidSnapshot();
    expect(() => assertDemoSeedInvariants({
      ...snapshot,
      requests: snapshot.requests.filter(({ numeroPedido }) => numeroPedido !== "DEMO-000106"),
    })).toThrow(/contagem.*requisi/i);
  });
});
