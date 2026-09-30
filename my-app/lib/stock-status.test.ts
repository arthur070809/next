import { describe, expect, it } from "vitest";
import { getStockStatus } from "./stock-status";

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
});