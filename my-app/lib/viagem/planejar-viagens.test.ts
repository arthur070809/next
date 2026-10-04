import { describe, expect, it } from "vitest";
import { planejarViagens, type RequisicaoViagemInput } from "./planejar-viagens";

const embalagens = { id: "local-emb", nome: "Embalagens" };
const central = { id: "local-central", nome: "Estoque Central" };

function requisicao(
  numeroPedido: string,
  prioridade: RequisicaoViagemInput["prioridade"],
  criadoEm: string,
  itens: RequisicaoViagemInput["itens"],
): RequisicaoViagemInput {
  return { id: numeroPedido, numeroPedido, prioridade, criadoEm, itens };
}

describe("planejarViagens", () => {
  it("agrupa uma requisição em um único local", () => {
    const result = planejarViagens([
      requisicao("REQ-1", "PADRAO", "2026-10-01T10:00:00.000Z", [
        { itemId: "i1", nome: "Caixa", quantidade: 3, local: embalagens },
      ]),
    ]);

    expect(result.viagens).toHaveLength(1);
    expect(result.viagens[0]).toMatchObject({
      localId: "local-emb",
      localNome: "Embalagens",
      quantidadeRequisicoes: 1,
      quantidadeItens: 1,
    });
    expect(result.metricas).toEqual({
      idasSemAgrupar: 1,
      idasAgrupadas: 1,
      idasEconomizadas: 0,
    });
  });

  it("combina várias requisições do mesmo local e não duplica itens", () => {
    const result = planejarViagens([
      requisicao("REQ-1", "PADRAO", "2026-10-01T10:00:00.000Z", [
        { itemId: "i1", nome: "Caixa", quantidade: 2, local: embalagens },
        { itemId: "i1", nome: "Caixa", quantidade: 1, local: embalagens },
      ]),
      requisicao("REQ-2", "PADRAO", "2026-10-01T11:00:00.000Z", [
        { itemId: "i1", nome: "Caixa", quantidade: 4, local: embalagens },
        { itemId: "i2", nome: "Fita", quantidade: 3, local: embalagens },
      ]),
    ]);

    expect(result.viagens).toHaveLength(1);
    expect(result.viagens[0].quantidadeRequisicoes).toBe(2);
    expect(result.viagens[0].itens).toHaveLength(2);
    expect(result.viagens[0].itens[0]).toMatchObject({
      itemId: "i1",
      quantidadeTotal: 7,
      requisicoes: [
        { numeroPedido: "REQ-1", quantidade: 3 },
        { numeroPedido: "REQ-2", quantidade: 4 },
      ],
    });
  });

  it("inclui uma requisição em cada local sem duplicar o item dentro do grupo", () => {
    const result = planejarViagens([
      requisicao("REQ-1", "PADRAO", "2026-10-01T10:00:00.000Z", [
        { itemId: "i1", nome: "Caixa", quantidade: 2, local: embalagens },
        { itemId: "i2", nome: "Parafuso", quantidade: 5, local: central },
        { itemId: "i1", nome: "Caixa", quantidade: 1, local: embalagens },
      ]),
    ]);

    expect(result.viagens).toHaveLength(2);
    expect(result.viagens.find((trip) => trip.localId === "local-emb")).toMatchObject({
      quantidadeRequisicoes: 1,
      quantidadeItens: 1,
      itens: [{ itemId: "i1", quantidadeTotal: 3 }],
    });
    expect(result.viagens.find((trip) => trip.localId === "local-central")).toMatchObject({
      requisicoes: [{ numeroPedido: "REQ-1" }],
      itens: [{ itemId: "i2", quantidadeTotal: 5 }],
    });
    expect(result.metricas.idasSemAgrupar).toBe(2);
  });

  it("agrupa itens sem local em Sem origem sem quebrar as métricas", () => {
    const result = planejarViagens([
      requisicao("REQ-1", "PADRAO", "2026-10-01T10:00:00.000Z", [
        { itemId: "i1", nome: "Caixa", quantidade: 1, local: null },
      ]),
      requisicao("REQ-2", "PADRAO", "2026-10-01T11:00:00.000Z", [
        { itemId: "i2", nome: "Fita", quantidade: 2, local: null },
      ]),
    ]);

    expect(result.viagens).toHaveLength(1);
    expect(result.viagens[0]).toMatchObject({
      localId: null,
      localNome: "Sem origem",
      quantidadeRequisicoes: 2,
      quantidadeItens: 2,
    });
    expect(result.metricas).toEqual({
      idasSemAgrupar: 2,
      idasAgrupadas: 1,
      idasEconomizadas: 1,
    });
  });

  it("ordena prioridades antes e as requisições mais antigas primeiro", () => {
    const result = planejarViagens([
      requisicao("REQ-1", "PADRAO", "2026-10-01T08:00:00.000Z", [
        { itemId: "i1", nome: "Item", quantidade: 1, local: embalagens },
      ]),
      requisicao("REQ-2", "PRIORITARIO", "2026-10-01T10:00:00.000Z", [
        { itemId: "i2", nome: "Item", quantidade: 1, local: embalagens },
      ]),
      requisicao("REQ-3", "PRIORITARIO", "2026-10-01T09:00:00.000Z", [
        { itemId: "i3", nome: "Item", quantidade: 1, local: embalagens },
      ]),
    ]);

    expect(result.viagens[0].requisicoes.map((request) => request.numeroPedido)).toEqual([
      "REQ-3",
      "REQ-2",
      "REQ-1",
    ]);
  });

  it("calcula economia agregando 4 idas em 2 locais", () => {
    const result = planejarViagens([
      requisicao("REQ-1", "PADRAO", "2026-10-01T08:00:00.000Z", [
        { itemId: "i1", nome: "Item", quantidade: 1, local: embalagens },
        { itemId: "i2", nome: "Outro", quantidade: 1, local: central },
      ]),
      requisicao("REQ-2", "PADRAO", "2026-10-01T09:00:00.000Z", [
        { itemId: "i3", nome: "Item 3", quantidade: 1, local: embalagens },
      ]),
      requisicao("REQ-3", "PADRAO", "2026-10-01T10:00:00.000Z", [
        { itemId: "i4", nome: "Item 4", quantidade: 1, local: central },
      ]),
    ]);

    expect(result.metricas).toEqual({
      idasSemAgrupar: 4,
      idasAgrupadas: 2,
      idasEconomizadas: 2,
    });
  });

  it("retorna zero viagens para lista vazia", () => {
    expect(planejarViagens([])).toEqual({
      viagens: [],
      metricas: {
        idasSemAgrupar: 0,
        idasAgrupadas: 0,
        idasEconomizadas: 0,
      },
    });
  });
});
