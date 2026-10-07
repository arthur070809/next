import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import BadgeBarcodeScanner from "./BadgeBarcodeScanner";

describe("BadgeBarcodeScanner", () => {
  it("renders an accessible 44px camera trigger without submitting its parent form", () => {
    const markup = renderToStaticMarkup(
      <BadgeBarcodeScanner
        label="Ler o código de barras do crachá"
        validate={() => true}
        onDetect={vi.fn()}
      />,
    );
    expect(markup).toContain('type="button"');
    expect(markup).toContain('aria-label="Ler o código de barras do crachá"');
    expect(markup).toContain("min-h-11");
    expect(markup).toContain("Ler crachá");
  });
});
