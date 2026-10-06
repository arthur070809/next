import { describe, expect, it } from "vitest";
import { localizarItemEstoquePorCodigo } from "./localizarEstoqueItem";

describe("localizarItemEstoquePorCodigo", () => {
  it("finds the scanned item despite leading zeros", () => {
    expect(localizarItemEstoquePorCodigo("0129", [{ id: "item-1", codigo: "129" }]))
      .toEqual({ type: "found", item: { id: "item-1", codigo: "129" } });
  });

  it("returns a new-product path when the scanned code is unknown", () => {
    expect(localizarItemEstoquePorCodigo("129", [{ id: "item-1", codigo: null }]))
      .toEqual({ type: "not-found" });
  });

  it("matches 1794 and 17940 as distinct exact product codes", () => {
    const items = [
      { id: "short-code", codigo: "1794" },
      { id: "long-code", codigo: "17940" },
    ];

    expect(localizarItemEstoquePorCodigo("1794", items)).toEqual({
      type: "found",
      item: items[0],
    });
    expect(localizarItemEstoquePorCodigo("17940", items)).toEqual({
      type: "found",
      item: items[1],
    });
  });

  it("refuses ambiguous matches rather than selecting an arbitrary product", () => {
    expect(localizarItemEstoquePorCodigo("129", [
      { id: "item-1", codigo: "129" },
      { id: "item-2", codigo: "00129" },
    ])).toEqual({ type: "ambiguous" });
  });
});
