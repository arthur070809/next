import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import PriorityBadge from "./PriorityBadge";

describe("PriorityBadge", () => {
  it("shows a textual priority label and a decorative icon", () => {
    const markup = renderToStaticMarkup(createElement(PriorityBadge, { priority: "prioridade" }));
    expect(markup).toContain("Prioridade");
    expect(markup).toContain('aria-hidden="true"');
  });
});
