import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import AdminHistoricoPage from "../admin/historico/page";
import HistoricoPage from "./page";

describe("history pages", () => {
  it("uses profile-specific dashboard links while sharing the same content", () => {
    const warehouseMarkup = renderToStaticMarkup(<HistoricoPage />);
    const adminMarkup = renderToStaticMarkup(<AdminHistoricoPage />);

    expect(warehouseMarkup).toContain('href="/almoxarifado"');
    expect(warehouseMarkup).toContain("Marcon · Auditoria");
    expect(adminMarkup).toContain('href="/admin"');
    expect(adminMarkup).toContain("Administração");
    expect(adminMarkup).toContain("Histórico de movimentações");
    expect(warehouseMarkup).toContain("Histórico de movimentações");
  });
});
