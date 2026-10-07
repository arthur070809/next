import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import DepositoBalanceContent from "./DepositoBalanceContent";

const add = vi.fn();

function renderState(overrides: Partial<Omit<Parameters<typeof DepositoBalanceContent>[0], "children">>) {
  return renderToStaticMarkup(createElement(
    DepositoBalanceContent,
    {
      loading: false,
      error: "",
      empty: false,
      filtered: false,
      onAdd: add,
      ...overrides,
    },
    createElement("article", null, "Arruela · 3 un"),
  ));
}

describe("DepositoBalanceContent", () => {
  it("renders balance items when the list is populated", () => {
    const markup = renderState({});
    expect(markup).toContain("Arruela · 3 un");
    expect(markup).not.toContain("undefined");
    expect(markup).not.toContain("null");
  });

  it("renders loading and error states accessibly", () => {
    expect(renderState({ loading: true })).toContain("Carregando saldos");
    expect(renderState({ error: "Falha ao carregar o depósito." })).toContain(
      'role="alert"',
    );
    expect(renderState({ error: "Falha ao carregar o depósito." })).toContain(
      "Falha ao carregar o depósito.",
    );
  });

  it("renders the unfiltered empty-deposit state", () => {
    expect(renderState({ empty: true })).toContain("Nenhuma sobra registrada no depósito.");
  });
});
