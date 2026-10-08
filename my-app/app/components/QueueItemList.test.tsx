import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ItemChecklist } from "@/lib/types/almoxarifado";
import QueueItemList from "./QueueItemList";
import RequisitionDescription from "./RequisitionDescription";

function renderedText(markup: string) {
  return markup.replace(/<[^>]*>/g, "");
}

function createItems(count: number): ItemChecklist[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `item-${index + 1}`,
    nome: `Material ${index + 1}`,
    quantidade: index + 1,
    unidadeMedida: "un",
  }));
}

describe("QueueItemList", () => {
  it.each([1, 2, 5])("shows a single compact row per item and caps the list at three (%i items)", (count) => {
    const markup = renderToStaticMarkup(createElement(QueueItemList, { items: createItems(count) }));
    const text = renderedText(markup);

    for (let index = 1; index <= Math.min(count, 3); index += 1) {
      expect(text).toContain(`Material ${index}${index} un`);
    }
    expect(markup.match(/<li\b/g) ?? []).toHaveLength(Math.min(count, 3) + (count > 3 ? 1 : 0));
    expect(text).toContain(count > 3 ? "+2 itens" : `Material ${count}`);
  });

  it("uses an ellipsized name with the full name in title and omits missing quantities", () => {
    const longName = "Material ".repeat(20);
    const markup = renderToStaticMarkup(createElement(QueueItemList, {
      items: [{ id: "long-name", nome: longName, unidadeMedida: "un" }],
    }));

    expect(markup).toContain('title="' + longName + '"');
    expect(markup).toContain("truncate");
    expect(markup).not.toContain("undefined un");
  });

  it.each([1, 2, 5])("keeps request description separate for %i-item requests, whether present or absent", (count) => {
    for (const description of ["Interrupção de linha", ""]) {
      const markup = renderToStaticMarkup(createElement("section", null,
        createElement("p", null, `${count} ${count === 1 ? "item" : "itens"}`),
        createElement(QueueItemList, { items: createItems(count) }),
        createElement(RequisitionDescription, { value: description, variant: "queue" }),
      ));
      const text = renderedText(markup);

      expect(text).toContain(`${count} ${count === 1 ? "item" : "itens"}`);
      expect(text).toContain(description || "—");
      expect(markup).not.toContain("Categoria:");
      expect(markup).not.toContain("Descrição do pedido:");
    }
  });
});
