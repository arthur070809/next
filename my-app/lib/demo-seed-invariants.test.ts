import { describe, expect, it } from "vitest";
import { assertDemoSeedInvariants } from "./demo-seed";

const validSnapshot = {
  stocks: [
    { itemId: "item-129", localId: "central", codigo: "129", slug: "estoque", quantidade: 34, reservada: 0 },
  ],
  movements: [
    { saldoEstoqueId: "saldo-129", tipo: "ENTRADA", quantidade: 34, saldoApos: 34 },
  ],
  requests: [
    { numeroPedido: "DEMO-000101", status: "CONCLUIDA", prioridade: "PADRAO", itens: [{ localId: "central", quantidade: 1 }] },
    { numeroPedido: "DEMO-000102", status: "CONCLUIDA", prioridade: "PADRAO", itens: [{ localId: "central", quantidade: 1 }] },
    { numeroPedido: "DEMO-000103", status: "CONCLUIDA", prioridade: "PADRAO", itens: [{ localId: "central", quantidade: 1 }] },
    { numeroPedido: "DEMO-000104", status: "PENDENTE", prioridade: "PADRAO", itens: [{ localId: "central", quantidade: 2 }] },
    { numeroPedido: "DEMO-000105", status: "PENDENTE", prioridade: "PRIORITARIO", itens: [{ localId: "central", quantidade: 3 }] },
    { numeroPedido: "DEMO-000106", status: "ASSUMIDA", prioridade: "PADRAO", itens: [{ localId: "central", quantidade: 4 }] },
  ],
};

describe("demo seed postconditions", () => {
  it("accepts coherent stock snapshots, active reservations, and fixture status counts", () => {
    expect(() => assertDemoSeedInvariants(validSnapshot)).not.toThrow();
  });

  it("fails when stock does not reconcile with movement snapshots", () => {
    expect(() => assertDemoSeedInvariants({
      ...validSnapshot,
      stocks: [{ ...validSnapshot.stocks[0], quantidade: 35 }],
    })).toThrow(/129.*saldo.*movimenta/i);
  });

  it("fails when an open request has no items or reservations disagree", () => {
    expect(() => assertDemoSeedInvariants({
      ...validSnapshot,
      requests: validSnapshot.requests.map((request) =>
        request.numeroPedido === "DEMO-000104" ? { ...request, itens: [] } : request,
      ),
    })).toThrow(/DEMO-000104.*sem itens/i);
    expect(() => assertDemoSeedInvariants({
      ...validSnapshot,
      stocks: [{ ...validSnapshot.stocks[0], reservada: 8 }],
    })).toThrow(/129.*reserva/i);
  });

  it("fails when fixture request counts or priorities differ", () => {
    expect(() => assertDemoSeedInvariants({
      ...validSnapshot,
      requests: validSnapshot.requests.filter(({ numeroPedido }) => numeroPedido !== "DEMO-000106"),
    })).toThrow(/contagem.*requisi/i);
  });
});
