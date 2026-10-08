import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin",
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

import PortalShell from "./PortalShell";

describe("PortalShell navigation", () => {
  it("keeps the history destination inside each profile shell", () => {
    const adminMarkup = renderToStaticMarkup(
      <PortalShell userName="Admin" role="admin">Conteúdo</PortalShell>,
    );
    const warehouseMarkup = renderToStaticMarkup(
      <PortalShell userName="Almoxarife" role="almoxarifado">Conteúdo</PortalShell>,
    );

    expect(adminMarkup).toContain('href="/admin/historico"');
    expect(adminMarkup).toContain("Painel de administração");
    expect(adminMarkup).toContain("min-h-11 min-w-11 items-center justify-center rounded-control bg-surface p-1.5 lg:hidden");
    expect(warehouseMarkup).toContain('href="/historico"');
    expect(warehouseMarkup).toContain("Área do almoxarifado");
  });

  it.each(["admin", "almoxarifado"] as const)(
    "does not expose the removed surplus summary to %s",
    (role) => {
      const markup = renderToStaticMarkup(
        <PortalShell userName="Usuário" role={role}>Conteúdo</PortalShell>,
      );

      expect(markup).not.toContain('href="/deposito/sobras"');
      expect(markup).not.toContain("Resumo de excedentes");
      expect(markup).toContain("Depósito de sobras");
    },
  );
});
