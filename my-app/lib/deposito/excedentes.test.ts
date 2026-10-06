import { describe, expect, it } from "vitest";
import { filtrarExcedentesPorProduto, totalizarExcedentesPorSetor, type ExcedenteRegistro } from "./excedentes";

const registros: ExcedenteRegistro[] = [
  {
    itemId: "a", codigo: "129", produto: "Rodízio", categoria: "Rodízios", setor: "setor1",
    quantidadePedida: 2, quantidadeSeparada: 5, quantidadeExcedente: 3, pedidos: ["REQ-1"],
    estoqueLivre: 0, saldoDeposito: 0,
  },
  {
    itemId: "b", codigo: "1794", produto: "Pneu", categoria: "Pneus", setor: "setor1",
    quantidadePedida: 1, quantidadeSeparada: 4, quantidadeExcedente: 3, pedidos: ["REQ-2"],
    estoqueLivre: 0, saldoDeposito: 0,
  },
  {
    itemId: "a", codigo: "129", produto: "Rodízio", categoria: "Rodízios", setor: "setor2",
    quantidadePedida: 1, quantidadeSeparada: 2, quantidadeExcedente: 1, pedidos: ["REQ-3"],
    estoqueLivre: 0, saldoDeposito: 0,
  },
];

describe("read-only surplus view helpers", () => {
  it("filters by exact user-entered substring across name, code, and category", () => {
    expect(filtrarExcedentesPorProduto(registros, "  RODÍZIOS ")).toEqual([registros[0], registros[2]]);
    expect(filtrarExcedentesPorProduto(registros, "1794")).toEqual([registros[1]]);
    expect(filtrarExcedentesPorProduto(registros, "")).toEqual(registros);
  });

  it("aggregates filtered sector totals without including other products", () => {
    const filtered = filtrarExcedentesPorProduto(registros, "129");
    expect(totalizarExcedentesPorSetor(filtered)).toEqual([
      { setor: "setor1", quantidadePedida: 2, quantidadeSeparada: 5, quantidadeExcedente: 3 },
      { setor: "setor2", quantidadePedida: 1, quantidadeSeparada: 2, quantidadeExcedente: 1 },
    ]);
  });
});
