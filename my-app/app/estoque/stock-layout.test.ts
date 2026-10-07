import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./stock-list.module.css", import.meta.url), "utf8");

describe("stock page scroll layout contract", () => {
  it("keeps the form first and prevents the inventory column from stretching it", () => {
    expect(page).toContain("grid items-start");
    expect(page).toContain("md:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]");
    expect(styles).toContain("min-width: 0");
  });

  it("uses only document vertical scrolling and keeps horizontal table overflow local", () => {
    expect(styles).not.toMatch(/overflow-y\s*:\s*(auto|scroll)/);
    expect(styles).not.toMatch(/max-height\s*:\s*[^;]*(dvh|vh)/);
    expect(styles).not.toMatch(/position\s*:\s*sticky/);
    expect(page.indexOf('id="novo-item"')).toBeLessThan(page.indexOf('aria-label="Lista de itens do estoque"'));
  });

  it("keeps search controls and product cards in their own labelled page section", () => {
    expect(page).toContain("aria-label=\"Lista de itens do estoque\"");
    expect(page).toContain("aria-label=\"Buscar item por nome ou categoria\"");
    expect(page).toContain("Ler etiqueta QR");
    expect(page).not.toMatch(/overflow-y-(auto|scroll)/);
    expect(page).not.toContain("h-screen");
    expect(page).not.toContain("min-h-screen");
  });

  it("retains the viewport-height document without constraining internal sections", () => {
    expect(page).toContain("min-h-dvh");
    expect(styles).not.toContain("100vh");
    expect(styles).not.toContain("100dvh");
  });
});
