import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./stock-list.module.css", import.meta.url), "utf8");
const shell = readFileSync(new URL("../components/PortalShell.tsx", import.meta.url), "utf8");
const rootLayout = readFileSync(new URL("../layout.tsx", import.meta.url), "utf8");
const warehouseLayout = readFileSync(new URL("../almoxarifado/layout.tsx", import.meta.url), "utf8");
const adminLayout = readFileSync(new URL("../admin/layout.tsx", import.meta.url), "utf8");
const warehouseStockRoute = readFileSync(new URL("../almoxarifado/estoque/page.tsx", import.meta.url), "utf8");
const adminStockRoute = readFileSync(new URL("../admin/estoque/page.tsx", import.meta.url), "utf8");
const shellContent = shell.slice(
  shell.indexOf('<div className="min-w-0 lg:pl-72">'),
  shell.indexOf('<nav className="fixed inset-x-0 bottom-0'),
);

describe("stock page scroll layout contract", () => {
  it("keeps the form first and prevents the inventory column from stretching it", () => {
    expect(page).toContain("grid items-start");
    expect(page).toContain("md:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]");
    expect(styles).toContain("min-width: 0");
  });

  it("limits vertical scrolling to the labelled inventory list", () => {
    const listStyles = styles.match(/\.stockBody\s*\{([^}]*)\}/)?.[1] ?? "";
    const panelStyles = styles.match(/\.stockPanel\s*\{([^}]*)\}/)?.[1] ?? "";
    const headerStyles = styles.match(/\.stockHeader\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(listStyles).toMatch(/overflow-y\s*:\s*auto/);
    expect(listStyles).toMatch(/min-height\s*:\s*0/);
    expect(listStyles).toMatch(/max-height\s*:\s*70dvh/);
    expect(styles).toMatch(/@media\s*\(min-width:\s*1024px\)[\s\S]*?\.stockBody\s*\{[^}]*max-height:\s*calc\(100dvh\s*-\s*10rem\)/);
    expect(listStyles).toMatch(/overscroll-behavior\s*:\s*contain/);
    expect(listStyles).toMatch(/scrollbar-gutter\s*:\s*stable/);
    expect(listStyles).not.toMatch(/100vh/);
    expect(styles.match(/overflow-y\s*:\s*(?:auto|scroll)/g)).toHaveLength(1);
    expect(panelStyles).not.toMatch(/overflow-y\s*:\s*(auto|scroll)/);
    expect(headerStyles).not.toMatch(/overflow-y\s*:\s*(auto|scroll)/);
    expect(shellContent).not.toContain("sticky");
    expect(shellContent).not.toMatch(/overflow-(?:y-)?(?:auto|scroll)/);
    expect(shellContent).not.toMatch(/max-h-|(?<!min-)h-(?:screen|dvh)\b/);
    expect(page).not.toMatch(/overflow-(?:y-)?(?:auto|scroll)/);
    expect(page).not.toMatch(/(?<!min-)h-(?:screen|dvh)\b/);
    expect(page.indexOf('id="novo-item"')).toBeLessThan(page.indexOf('aria-label="Lista de itens do estoque"'));
  });

  it("keeps vertical scrolling on the document and bounds only the fixed sidebar menu", () => {
    expect(rootLayout).not.toContain("h-full");
    expect(rootLayout).toContain('<body className="min-h-dvh">');
    expect(shell).toContain('className="min-h-dvh bg-slate-100 text-slate-900"');
    expect(shell).toContain("fixed left-0 top-0");
    expect(shell).toContain("h-dvh");
    expect(shell).toContain("min-h-0 flex-1 space-y-1 overflow-y-auto");
    expect(shellContent).not.toMatch(/<main[^>]*overflow-(?:auto|scroll)/);
    expect(shellContent).not.toMatch(/<div[^>]*overflow-(?:auto|scroll)/);
    expect(warehouseLayout).toContain("<PortalShell");
    expect(adminLayout).toContain("<PortalShell");
    expect(warehouseStockRoute).toContain('from "../../estoque/page"');
    expect(adminStockRoute).toContain('from "../../estoque/page"');
  });

  it("keeps search controls and product cards in their own labelled page section", () => {
    expect(page).toContain("aria-label=\"Lista de itens do estoque\"");
    expect(page).toContain("aria-label=\"Buscar item por nome ou categoria\"");
    expect(page).toContain("Ler etiqueta QR");
    expect(page).toContain("Nenhum item encontrado.");
    expect(page).toContain("role=\"region\"");
    expect(page).toContain("styles.stockBody");
    expect(page).not.toContain("h-screen");
    expect(page).not.toContain("min-h-screen");
  });

  it("keeps the empty-filter state inside the same bounded list region", () => {
    expect(page).toMatch(/itensFiltrados\.length === 0 \? <p[^>]*>Nenhum item encontrado\.<\/p> : itensFiltrados\.map/);
    expect(page).toContain('aria-label="Lista de itens do estoque"');
    expect(page).toContain("className={`${styles.stockBody}");
    expect(styles).toMatch(/\.stockBody\s*\{[^}]*max-height:\s*70dvh/);
  });

  it("retains the viewport-height document without constraining unrelated sections", () => {
    expect(page).toContain("min-h-dvh");
    expect(styles).not.toContain("100vh");
  });
});
