import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  Modal,
  PriorityBadge,
  ResponsiveTable,
  StatusBadge,
  Toast,
} from "./ui";

describe("shared visual components", () => {
  it("exposes loading state on buttons and keeps their touch target", () => {
    const markup = renderToStaticMarkup(
      createElement(Button, { loading: true, loadingLabel: "Salvando…" }, "Salvar"),
    );

    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain("disabled");
    expect(markup).toContain("min-h-11");
    expect(markup).toContain("Salvando…");
  });

  it("renders a priority badge with text as well as an icon", () => {
    const markup = renderToStaticMarkup(createElement(PriorityBadge, { priority: "high" }));

    expect(markup).toContain("Prioridade");
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain("bg-priority-surface");
  });

  it("provides table and card layouts with loading, empty, and error states", () => {
    const columns = [{ key: "name", label: "Nome", render: (row: { name: string }) => row.name }];
    const table = (props: Partial<Parameters<typeof ResponsiveTable<{ name: string }>>[0]> = {}) =>
      renderToStaticMarkup(createElement(ResponsiveTable<{ name: string }>, {
        columns,
        rows: [{ name: "Arruela" }],
        getRowKey: (row) => row.name,
        ...props,
      }));

    expect(table()).toContain("md:hidden");
    expect(table({ loading: true })).toContain("Carregando registros");
    expect(table({ rows: [] })).toContain("Nenhum registro encontrado");
    expect(table({ error: "Falha ao carregar" })).toContain("Falha ao carregar");
  });

  it("keeps status meaning in text and provides accessible messages", () => {
    const status = renderToStaticMarkup(createElement(StatusBadge, { label: "Em separação", tone: "warning" }));
    const toast = renderToStaticMarkup(createElement(Toast, { message: "Salvo", tone: "success" }));
    const empty = renderToStaticMarkup(createElement(EmptyState, { message: "A lista está vazia." }));
    const loading = renderToStaticMarkup(createElement(LoadingState));
    const error = renderToStaticMarkup(createElement(ErrorState, { message: "Erro de conexão." }));

    expect(status).toContain("Em separação");
    expect(toast).toContain('role="status"');
    expect(empty).toContain("A lista está vazia.");
    expect(loading).toContain('aria-live="polite"');
    expect(error).toContain('role="alert"');
  });

  it("renders a labelled full-screen mobile modal", () => {
    const onClose = vi.fn();
    const markup = renderToStaticMarkup(
      createElement(Modal, { open: true, title: "Editar item", onClose }, "Conteúdo"),
    );

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain("Editar item");
    expect(markup).toContain("h-[100dvh]");
    expect(onClose).not.toHaveBeenCalled();
  });
});
