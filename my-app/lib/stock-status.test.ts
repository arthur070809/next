import { describe, expect, it } from "vitest";
import { demoCatalog } from "./demo-seed";
import { freeStock, getStockStatus, isAtOrBelowReorderPoint } from "./stock-status";

describe("getStockStatus", () => {
  it("applies status precedence", () => {
    expect(getStockStatus(0, 1000, 350)).toBe("SEM_ESTOQUE");
    expect(getStockStatus(999, 1000, 350)).toBe("CRITICO");
    expect(getStockStatus(350, 100, 350)).toBe("REPOR");
    expect(getStockStatus(351, 100, 350)).toBe("DISPONIVEL");
  });

  it("does not treat zero thresholds as alerts", () => {
    expect(getStockStatus(1, 0, 0)).toBe("DISPONIVEL");
  });

  it("marks balances at or below the configured reorder point", () => {
    expect(isAtOrBelowReorderPoint(7, 7)).toBe(true);
    expect(isAtOrBelowReorderPoint(6, 7)).toBe(true);
    expect(isAtOrBelowReorderPoint(8, 7)).toBe(false);
    expect(isAtOrBelowReorderPoint(0, 0)).toBe(false);
  });

  it("compares free stock after reservations and ignores unset reorder points", () => {
    expect(isAtOrBelowReorderPoint(7, 5, 2)).toBe(true);
    expect(isAtOrBelowReorderPoint(9, 5, 2)).toBe(false);
    expect(isAtOrBelowReorderPoint(2, 5, 2)).toBe(true);
    expect(isAtOrBelowReorderPoint(0, 5, 0)).toBe(true);
    expect(isAtOrBelowReorderPoint(0, 0, 0)).toBe(false);
    expect(isAtOrBelowReorderPoint(0, null, 0)).toBe(false);
    expect(freeStock(1, 4)).toBe(0);
  });

  it("flags only the three demo products at or below the central reorder point", () => {
    expect(demoCatalog
      .filter((item) => isAtOrBelowReorderPoint(item.central, item.pontoPedido))
      .map((item) => item.codigo)).toEqual(["7988", "17940", "5746"]);
  });
});