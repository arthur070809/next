import { describe, expect, it } from "vitest";
import { encontrarDivergenciasReserva } from "./reservation-consistency";

const stored = [{
  itemId: "item-1",
  localId: "local-1",
  fisico: 10,
  reservado: 3,
  codigo: "ABR-12-34",
  nome: "Abraçadeira",
  local: "Estoque Central",
}];

describe("encontrarDivergenciasReserva", () => {
  it("não relata divergência quando saldo reservado corresponde às requisições abertas", () => {
    expect(encontrarDivergenciasReserva(stored, [
      { itemId: "item-1", localId: "local-1", quantidade: 1 },
      { itemId: "item-1", localId: "local-1", quantidade: 2 },
    ])).toEqual([]);
  });

  it("retorna diferenças de soma sem modificar os dados recebidos", () => {
    const before = structuredClone(stored);
    expect(encontrarDivergenciasReserva(stored, [
      { itemId: "item-1", localId: "local-1", quantidade: 2 },
    ])).toEqual([{
      ...stored[0],
      esperado: 2,
    }]);
    expect(stored).toEqual(before);
  });

  it("relata reserva de requisição sem saldo correspondente", () => {
    expect(encontrarDivergenciasReserva([], [
      { itemId: "item-2", localId: "local-1", quantidade: 4 },
    ])).toEqual([{
      itemId: "item-2",
      localId: "local-1",
      codigo: null,
      nome: "Saldo não encontrado",
      local: "Local não encontrado",
      fisico: 0,
      reservado: 0,
      esperado: 4,
    }]);
  });
});
