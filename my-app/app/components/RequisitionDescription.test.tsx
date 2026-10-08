import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import RequisitionDescription from "./RequisitionDescription";

function renderedText(markup: string) {
  return markup.replace(/<[^>]*>/g, "");
}

describe("RequisitionDescription queue variant", () => {
  it("renders only the description text with a readable accessible name", () => {
    const markup = renderToStaticMarkup(createElement(RequisitionDescription, {
      value: "Parada de máquina",
      variant: "queue",
    }));

    expect(renderedText(markup)).toBe("Parada de máquina");
    expect(markup).toContain("text-sm");
    expect(markup).toContain("leading-5");
    expect(markup).toContain("text-foreground");
    expect(markup).toContain('aria-label="Descrição: Parada de máquina"');
    expect(markup).toContain('title="Parada de máquina"');
  });

  it("shows a secondary dash for an absent description", () => {
    for (const value of [null, undefined, "", "   "]) {
      const markup = renderToStaticMarkup(createElement(RequisitionDescription, {
        value,
        variant: "queue",
      }));

      expect(renderedText(markup)).toBe("—");
      expect(markup).toContain("text-text-secondary");
      expect(markup).not.toContain("title=");
      expect(markup).not.toContain(">null<");
      expect(markup).not.toContain(">undefined<");
    }
  });

  it("clamps a legacy unspaced description in the queue but preserves full detail text", () => {
    const legacy = "x".repeat(300);
    const queueMarkup = renderToStaticMarkup(createElement(RequisitionDescription, {
      value: legacy,
      variant: "queue",
    }));
    const detailMarkup = renderToStaticMarkup(createElement(RequisitionDescription, { value: legacy }));

    expect(queueMarkup).toContain("line-clamp-2");
    expect(queueMarkup).toContain("break-words");
    expect(queueMarkup).toContain(`title="${legacy}"`);
    expect(renderedText(queueMarkup)).toContain(legacy);
    expect(renderedText(detailMarkup)).toContain(legacy);
    expect(detailMarkup).not.toContain("line-clamp-2");
    expect(queueMarkup).not.toContain(">null<");
    expect(queueMarkup).not.toContain(">undefined<");
  });
});
