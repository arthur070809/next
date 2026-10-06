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

  it("limits the mobile list to viewport height and scrolls only its product body", () => {
    expect(styles).toContain("max-height: 60dvh");
    expect(styles).toContain("overflow-y: auto");
    expect(styles.match(/overflow-y:\s*auto/g)).toHaveLength(1);
    expect(page.indexOf('id="novo-item"')).toBeLessThan(page.indexOf('aria-label="Lista de itens do estoque"'));
  });

  it("sticks the desktop list below the app header and bounds it to the viewport", () => {
    expect(styles).toContain("@media (min-width: 768px)");
    expect(styles).toContain("position: sticky");
    expect(styles).toContain("top: 5rem");
    expect(styles).toContain("max-height: calc(100dvh - 6rem)");
    expect(styles).toContain("stockHeader");
  });
});
