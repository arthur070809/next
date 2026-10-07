import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin",
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

import PortalShell from "./PortalShell";

describe("PortalShell navigation", () => {
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
