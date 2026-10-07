import { describe, expect, it } from "vitest";
import type { RequisicaoMock } from "../../lib/types/almoxarifado";
import { ordenarRequisicoes } from "./utils";

const requisicao = (numeroPedido: string, prioridade: RequisicaoMock["prioridade"], data: string): RequisicaoMock => ({
  numeroPedido,
  almoxarifado: "central",
  setor: "setor1",
  item: "Material",
  quantidade: 1,
  unidadeMedida: "un",
  descricao: "",
  data,
  codigoTratamento: "209",
  prioridade,
  status: "pendente",
});

describe("ordenarRequisicoes", () => {
  it("places priority requests first while preserving the incoming order within each group", () => {
    const input = [
      requisicao("P-mais-novo", "padrao", "2026-10-06T12:00:00Z"),
      requisicao("R-prioridade-1", "prioridade", "2026-10-06T14:00:00Z"),
      requisicao("P-mais-antigo", "padrao", "2026-10-06T08:00:00Z"),
      requisicao("R-prioridade-2", "prioridade", "2026-10-06T09:00:00Z"),
    ];

    expect(ordenarRequisicoes(input).map((item) => item.numeroPedido)).toEqual([
      "R-prioridade-1",
      "R-prioridade-2",
      "P-mais-novo",
      "P-mais-antigo",
    ]);
  });
});
