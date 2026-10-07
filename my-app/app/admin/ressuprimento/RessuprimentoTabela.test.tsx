import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import RessuprimentoTabela from "./RessuprimentoTabela";
import { sugestao } from "@/lib/ressuprimento/analise";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("RessuprimentoTabela", () => {
  it("shows the explicit empty reorder state", () => {
    const markup = renderToStaticMarkup(createElement(RessuprimentoTabela, {
      sugestoes: [],
      fonte: "Dados simulados",
    }));

    expect(markup).toContain("Nenhum item precisa de ressuprimento");
  });

  it("renders an editable current point and omits the removed columns", () => {
    const suggestions = [
      sugestao({
        id: "low-stock",
        nome: "Item sem ponto",
        estoque: 0,
        pontoAtual: null,
        movimentosSaida: [],
      }, undefined, undefined, new Date("2026-10-06T12:00:00Z")),
      sugestao({
        id: "needs-restock",
        nome: "Item abaixo do mínimo",
        estoque: 2,
        pontoAtual: 5,
        movimentosSaida: [],
      }, undefined, undefined, new Date("2026-10-06T12:00:00Z")),
    ];
    const markup = renderToStaticMarkup(createElement(RessuprimentoTabela, {
      sugestoes: suggestions,
      fonte: "Dados simulados",
    }));

    expect(markup).toContain("Quantidade sugerida");
    expect(markup).toContain("Ponto atual para Item sem ponto");
    expect(markup).toContain('type="number"');
    expect(markup).toContain("Item abaixo do mínimo");
    expect(markup).toContain("3");
    expect(markup).not.toContain("Ponto sugerido");
    expect(markup).not.toContain("Confiança");
    expect(markup).not.toContain("Ação");
    expect(markup).not.toContain("NaN");
    expect(markup).not.toContain("Infinity");
    expect(markup).not.toContain("undefined");
  });
});
