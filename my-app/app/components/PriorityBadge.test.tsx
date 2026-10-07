import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import PriorityBadge, { PRIORITY_BADGE_CLASS, PRIORITY_QUEUE_ROW_CLASS } from "./PriorityBadge";

describe("PriorityBadge", () => {
  it("shows a textual priority label and a decorative icon", () => {
    const markup = renderToStaticMarkup(createElement(PriorityBadge, { priority: "prioridade" }));
    expect(markup).toContain("Prioridade");
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain(PRIORITY_BADGE_CLASS);
    expect(PRIORITY_BADGE_CLASS).toContain("text-priority");
    expect(PRIORITY_BADGE_CLASS).toContain("bg-priority-surface");
  });

  it("renders nothing for a normal request", () => {
    expect(renderToStaticMarkup(createElement(PriorityBadge, { priority: "padrao" }))).toBe("");
  });

  it("exposes a shared tinted row treatment for the priority queue", () => {
    expect(PRIORITY_QUEUE_ROW_CLASS).toContain("border-l-priority");
    expect(PRIORITY_QUEUE_ROW_CLASS).toContain("bg-priority-surface/70");
  });
});
