import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import DepositoEmptyState from "./DepositoEmptyState";

describe("DepositoEmptyState", () => {
  it("explains that no surplus has been registered and offers the add action", () => {
    const markup = renderToStaticMarkup(createElement(DepositoEmptyState, {
      filtered: false,
      onAdd: vi.fn(),
    }));

    expect(markup).toContain("Nenhuma sobra registrada no depósito.");
    expect(markup).toContain("Adicionar sobra");
    expect(markup).not.toContain("null");
    expect(markup).not.toContain("undefined");
  });

  it("distinguishes an empty filtered result from an empty deposit", () => {
    const markup = renderToStaticMarkup(createElement(DepositoEmptyState, {
      filtered: true,
      onAdd: vi.fn(),
    }));

    expect(markup).toContain("Nenhum item encontrado com este filtro.");
    expect(markup).not.toContain("Nenhuma sobra registrada");
  });
});
