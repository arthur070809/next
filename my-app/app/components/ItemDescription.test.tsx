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
    expect(renderedText(markup)).toContain("Descrição do pedido: Sem descrição");
    expect(markup).not.toContain("undefined");
  });

  it("renders only a sanitized description or a dash in checklist mode", () => {
    const marker = `[[idem:v1:${"a".repeat(64)}:${"b".repeat(64)}]]`;
    const withDescription = renderToStaticMarkup(createElement(ItemDescription, {
      descricao: `${marker}Inspeção — seção A`,
      variant: "checklist",
    }));
    const withoutDescription = renderToStaticMarkup(createElement(ItemDescription, {
      descricao: `[[setor:v1:setor1]]${marker}`,
      variant: "checklist",
    }));

    expect(renderedText(withDescription)).toBe("Inspeção — seção A");
    expect(withDescription).not.toContain("Descrição do pedido");
    expect(withDescription).not.toContain("[[");
    expect(renderedText(withoutDescription)).toBe("—");
    expect(withoutDescription).toContain("text-text-secondary");
  });

  it("sanitizes free-standing item descriptions before rendering", () => {
    const markup = renderToStaticMarkup(createElement(TextoDescricao, {
      value: `[[idem:v1:${"a".repeat(64)}:${"b".repeat(64)}]]Reparo – revisão`,
    }));
    expect(markup).toContain("Reparo – revisão");
    expect(markup).not.toContain("[[");
  });

  it.each([null, undefined, "", "   "])("renders an honest fallback for absent descriptions (%s)", (description) => {
    const markup = renderToStaticMarkup(createElement(ItemDescription, {
      categoria: "Fixadores",
      descricao: description,
    }));

    expect(renderedText(markup)).toContain("Descrição do pedido: Sem descrição");
    expect(markup).toContain("text-text-secondary");
    expect(markup).not.toContain(">null<");
    expect(markup).not.toContain(">undefined<");
  });

  it("preserves plain text and line breaks while allowing unspaced descriptions to wrap", () => {
    const longText = "x".repeat(300);
    const markup = renderToStaticMarkup(createElement(ItemDescription, {
      descricao: `${longText}\nsegunda linha`,
    }));

    expect(renderedText(markup)).toContain(`Descrição do pedido: ${longText}\nsegunda linha`);
    expect(markup).toContain("whitespace-pre-wrap");
    expect(markup).toContain("[overflow-wrap:anywhere]");
    expect(markup).not.toContain("dangerouslySetInnerHTML");
  });
});
