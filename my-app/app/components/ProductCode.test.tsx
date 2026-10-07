import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ProductCode from "./ProductCode";

describe("ProductCode", () => {
  it("renders the product code in a prominent monospaced line", () => {
    const markup = renderToStaticMarkup(createElement(ProductCode, { code: "00129" }));

    expect(markup).toContain(">Código</span>");
    expect(markup).toContain(">00129</span>");
    expect(markup).toContain("font-mono");
    expect(markup).toContain("text-base");
    expect(markup).toContain("text-slate-950");
  });

  it.each([null, undefined, "", "   "])("shows a safe fallback for an absent product code (%s)", (code) => {
    const markup = renderToStaticMarkup(createElement(ProductCode, { code }));

    expect(markup).toContain("Sem código");
    expect(markup).not.toContain(">null<");
    expect(markup).not.toContain(">undefined<");
  });

  it("wraps long unspaced codes without changing them or injecting HTML", () => {
    const code = "CODIGO".repeat(20);
    const markup = renderToStaticMarkup(createElement(ProductCode, { code }));
    const escapedMarkup = renderToStaticMarkup(createElement(ProductCode, { code: "<img src=x>" }));

    expect(markup).toContain(code);
    expect(markup).toContain("break-all");
    expect(markup).toContain("[overflow-wrap:anywhere]");
    expect(markup).not.toContain("dangerouslySetInnerHTML");
    expect(escapedMarkup).toContain("&lt;img src=x&gt;");
    expect(escapedMarkup).not.toContain("<img src=x>");
  });
});
