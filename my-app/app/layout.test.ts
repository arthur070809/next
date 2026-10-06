import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const layoutSource = readFileSync(new URL("./layout.tsx", import.meta.url), "utf8");

describe("root layout", () => {
  it("does not render the global demo banner", () => {
    expect(layoutSource).not.toContain("AMBIENTE DE DEMONSTRAÇÃO");
    expect(layoutSource).not.toContain("data-demo-active");
  });
});
