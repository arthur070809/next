import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import PriorityBadge, { PRIORITY_BADGE_CLASS, PRIORITY_QUEUE_ROW_CLASS } from "./PriorityBadge";

describe("PriorityBadge", () => {
  it("shows a textual priority label and a decorative icon", () => {
    const markup = renderToStaticMarkup(createElement(PriorityBadge, { priority: "prioridade" }));
    expect(markup).toContain("PRIORIDADE");
    expect(markup).toContain('aria-label="Pedido prioritário"');
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain(PRIORITY_BADGE_CLASS);
    expect(PRIORITY_BADGE_CLASS).toContain("text-amber-950");
    expect(PRIORITY_BADGE_CLASS).toContain("dark:text-amber-100");
  });

  it("renders nothing for a normal request", () => {
    expect(renderToStaticMarkup(createElement(PriorityBadge, { priority: "padrao" }))).toBe("");
  });

  it("exposes a shared tinted row treatment for the priority queue", () => {
    expect(PRIORITY_QUEUE_ROW_CLASS).toContain("border-l-amber-700");
    expect(PRIORITY_QUEUE_ROW_CLASS).toContain("bg-amber-50/80");
    expect(PRIORITY_QUEUE_ROW_CLASS).toContain("dark:bg-amber-950/40");
  });
});
