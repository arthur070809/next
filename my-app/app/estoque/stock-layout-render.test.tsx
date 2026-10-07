import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/almoxarifado/estoque",
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

import PortalShell from "../components/PortalShell";
import StockPage from "./page";

describe("rendered stock scroll layout", () => {
  it("keeps inventory controls outside the only scrollable list region", () => {
    const markup = renderToStaticMarkup(
      <PortalShell userName="Almoxarife" role="almoxarifado">
        <StockPage />
      </PortalShell>,
    );

    expect(markup).toContain("aria-label=\"Navegação do almoxarifado\"");
    expect(markup).toContain("fixed left-0 top-0");
    expect(markup).toContain("h-dvh");
    expect(markup).toContain("overflow-y-auto");
    expect(markup).not.toContain("sticky top-0");
    expect(markup).toContain("Novo item / registrar entrada");
    expect(markup).toContain("Itens do estoque");
    expect(markup).toContain("aria-label=\"Filtrar por categoria\"");
    expect(markup).toContain("aria-label=\"Buscar item por nome ou categoria\"");
    expect(markup).toContain("aria-label=\"Lista de itens do estoque\"");
    expect(markup).toContain('role="region"');
    const listStart = markup.indexOf('aria-label="Lista de itens do estoque"');
    const headerStart = markup.indexOf("Itens do estoque");
    const categoryStart = markup.indexOf('aria-label="Filtrar por categoria"');
    const searchStart = markup.indexOf('aria-label="Buscar item por nome ou categoria"');
    expect(headerStart).toBeLessThan(listStart);
    expect(categoryStart).toBeLessThan(listStart);
    expect(searchStart).toBeLessThan(listStart);
    expect(markup).toContain("Carregando estoque...");
    expect(markup).toContain("id=\"categoria\"");
    expect(markup).toContain("id=\"nome\"");
    const listOpening = markup.slice(markup.lastIndexOf("<div", listStart), listStart);
    expect(listOpening).toMatch(/role="region"/);
    expect(listOpening).toMatch(/tabindex="0"/);
  });
});
