import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ItemDescription from "./ItemDescription";
import TextoDescricao from "./TextoDescricao";

function renderedText(markup: string) {
  return markup.replace(/<[^>]*>/g, "");
}

describe("ItemDescription", () => {
  it("renders category and Unicode description without internal metadata", () => {
    const marker = `[[idem:v1:${"a".repeat(64)}:${"b".repeat(64)}]]`;
    const markup = renderToStaticMarkup(createElement(ItemDescription, {
      categoria: "Componentes mecânicos",
      descricao: `[[setor:v1:setor2]]${marker}\nInspeção — seção A`,
    }));
    expect(markup).toContain("Categoria: Componentes mecânicos");
    expect(renderedText(markup)).toContain("Descrição do pedido: Inspeção — seção A");
    expect(markup).not.toContain("[[");
  });

  it("renders dashes for empty or metadata-only values", () => {
    const markup = renderToStaticMarkup(createElement(ItemDescription, {
      descricao: `[[setor:v1:setor1]][[idem:v1:${"a".repeat(64)}:${"b".repeat(64)}]]`,
    }));
    expect(markup).toContain("Categoria: —");
    expect(renderedText(markup)).toContain("Descrição do pedido: —");
    expect(markup).not.toContain("undefined");
  });

  it("sanitizes free-standing item descriptions before rendering", () => {
    const markup = renderToStaticMarkup(createElement(TextoDescricao, {
      value: `[[idem:v1:${"a".repeat(64)}:${"b".repeat(64)}]]Reparo – revisão`,
    }));
    expect(markup).toContain("Reparo – revisão");
    expect(markup).not.toContain("[[");
  });
});
