import { describe, expect, it } from "vitest";
import type { RequisicaoMock } from "../../lib/types/almoxarifado";
import { sortRequisitionsByPriority } from "./utils";

const requisicao = (
  id: string,
  numeroPedido: string,
  prioridade: RequisicaoMock["prioridade"],
  data: string,
): RequisicaoMock => ({
  id,
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

describe("sortRequisitionsByPriority", () => {
  it("places priority requests first and sorts each group oldest-first with stable id tie-breaking", () => {
    const input = [
      requisicao("p2", "P-mais-novo", "padrao", "2026-10-06T12:00:00Z"),
      requisicao("r2", "R-prioridade-nova", "prioridade", "2026-10-06T14:00:00Z"),
      requisicao("p1", "P-mais-antigo", "padrao", "2026-10-06T08:00:00Z"),
      requisicao("r1", "R-prioridade-antiga", "prioridade", "2026-10-06T09:00:00Z"),
      requisicao("r0", "R-prioridade-empate", "prioridade", "2026-10-06T09:00:00Z"),
    ];

    expect(sortRequisitionsByPriority(input).map((item) => item.numeroPedido)).toEqual([
      "R-prioridade-empate",
      "R-prioridade-antiga",
      "R-prioridade-nova",
      "P-mais-antigo",
      "P-mais-novo",
    ]);
  });

  it("handles empty input and a list containing only normal requests", () => {
    expect(sortRequisitionsByPriority([])).toEqual([]);
    expect(sortRequisitionsByPriority([
      requisicao("n2", "normal-novo", "padrao", "2026-10-06T12:00:00Z"),
      requisicao("n1", "normal-antigo", "padrao", "2026-10-06T08:00:00Z"),
    ]).map((item) => item.numeroPedido)).toEqual(["normal-antigo", "normal-novo"]);
  });
});
