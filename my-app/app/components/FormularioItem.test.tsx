import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import FormularioItem from "./FormularioItem";

describe("FormularioItem description input", () => {
  it("renders a bounded accessible description input and live character counter", () => {
    const markup = renderToStaticMarkup(createElement(FormularioItem, { onAdd: () => undefined }));

    expect(markup).toContain('id="descricao-requisicao"');
    expect(markup).toContain('maxLength="100"');
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain('id="descricao-contador"');
    expect(markup).toContain("0/50");
  });
});
