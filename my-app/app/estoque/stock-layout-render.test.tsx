import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/almoxarifado/estoque",
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

import PortalShell from "../components/PortalShell";
import StockPage from "./page";

describe("rendered stock scroll layout", () => {
  it("renders the stock form and full inventory list inside the document-scrolling portal content", () => {
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
    expect(markup.match(/overflow-y-auto/g)).toHaveLength(1);
    const listClass = markup.match(/aria-label="Lista de itens do estoque" class="([^"]*)"/)?.[1] ?? "";
    expect(listClass).not.toMatch(/overflow-(?:y-)?(?:auto|scroll)|max-h-|sticky|h-screen|(?<!min-)h-dvh/);
  });
});
