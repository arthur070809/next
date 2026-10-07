"use client";

import { useEffect, useId, type ButtonHTMLAttributes, type HTMLAttributes, type LabelHTMLAttributes, type ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "danger";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white hover:bg-brand-hover active:bg-brand-pressed",
  secondary: "border border-border bg-surface text-foreground hover:bg-background",
  danger: "bg-error text-white hover:bg-error/90",
};

export function Button({
  variant = "primary",
  loading = false,
  loadingLabel = "Carregando…",
  className = "",
  children,
  disabled,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  loading?: boolean;
  loadingLabel?: string;
}) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-control px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-wait disabled:opacity-60 ${buttonVariants[variant]} ${className}`}
    >
      {loading ? loadingLabel : children}
    </button>
  );
}

export function Label({
  className = "",
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label {...props} className={`text-sm font-semibold text-foreground ${className}`} />;
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className = "",
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  const messageId = `${htmlFor}-message`;
  return (
    <div className={`grid gap-1.5 ${className}`}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error || hint ? (
        <p id={messageId} className={`text-sm ${error ? "text-error" : "text-text-secondary"}`}>
          {error || hint}
        </p>
      ) : null}
    </div>
  );
}

export function Card({
  as: Component = "section",
  className = "",
  ...props
}: HTMLAttributes<HTMLElement> & {
  as?: "article" | "div" | "section";
}) {
  return (
    <Component
      {...props}
      className={`rounded-card border border-border-subtle bg-surface shadow-card ${className}`}
    />
  );
}

type StatusTone = "neutral" | "success" | "warning" | "error" | "danger" | "brand" | "priority";

const statusTones: Record<StatusTone, string> = {
  neutral: "bg-background text-foreground ring-border-subtle",
  success: "bg-success-surface text-success ring-success/30",
  warning: "bg-warning-surface text-warning ring-warning/30",
  error: "bg-error-surface text-error ring-error/30",
  danger: "bg-error-surface text-error ring-error/30",
  brand: "bg-priority-surface text-brand ring-brand/25",
  priority: "bg-priority-surface text-priority ring-priority/25",
};

export function StatusBadge({
  label,
  tone = "neutral",
  icon,
  className = "",
}: {
  label: string;
  tone?: StatusTone;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <span className={`inline-flex min-h-6 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusTones[tone]} ${className}`}>
      {icon ? <span aria-hidden="true">{icon}</span> : null}
      {label}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: "normal" | "high" }) {
  return priority === "high"
    ? <StatusBadge label="Prioridade" tone="priority" icon="!" />
    : <StatusBadge label="Padrão" tone="neutral" />;
}

type TableColumn<Row> = {
  key: string;
  label: string;
  render: (row: Row) => ReactNode;
};

export function ResponsiveTable<Row>({
  columns,
  rows,
  getRowKey,
  loading = false,
  error,
  emptyMessage = "Nenhum registro encontrado.",
}: {
  columns: TableColumn<Row>[];
  rows: Row[];
  getRowKey: (row: Row) => string | number;
  loading?: boolean;
  error?: string;
  emptyMessage?: string;
}) {
  if (loading) return <LoadingState label="Carregando registros…" />;
  if (error) return <ErrorState message={error} />;
  if (!rows.length) return <EmptyState message={emptyMessage} />;

  return (
    <div className="min-w-0">
      <div className="hidden overflow-x-auto rounded-card border border-border-subtle bg-surface md:block">
        <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
          <thead className="bg-background text-text-secondary">
            <tr>{columns.map((column) => <th key={column.key} scope="col" className="px-4 py-3 font-semibold">{column.label}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {rows.map((row) => (
              <tr key={getRowKey(row)} className="align-top">
                {columns.map((column) => <td key={column.key} className="px-4 py-3">{column.render(row)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 md:hidden">
        {rows.map((row) => (
          <Card key={getRowKey(row)} className="grid gap-3 p-4">
            {columns.map((column) => (
              <div key={column.key} className="grid min-w-0 gap-1">
                <span className="text-xs font-semibold text-text-secondary">{column.label}</span>
                <div className="min-w-0 break-words text-sm text-foreground">{column.render(row)}</div>
              </div>
            ))}
          </Card>
        ))}
      </div>
    </div>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children?: ReactNode;
}) {
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex bg-foreground/60 md:items-center md:justify-center md:p-6">
      <button type="button" className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Fechar janela" />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="safe-area-inset relative z-10 flex h-[100dvh] w-full flex-col overflow-y-auto bg-surface shadow-overlay md:h-auto md:max-h-[calc(100dvh-3rem)] md:max-w-2xl md:rounded-panel md:p-6"
      >
        <header className="mb-4 flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-xl font-bold text-foreground">{title}</h2>
          <Button variant="secondary" className="shrink-0 px-3" onClick={onClose} aria-label="Fechar">
            Fechar
          </Button>
        </header>
        {children}
      </section>
    </div>
  );
}

export function Toast({
  message,
  tone = "neutral",
  onDismiss,
}: {
  message: string;
  tone?: Exclude<StatusTone, "brand" | "priority">;
  onDismiss?: () => void;
}) {
  const roles = tone === "error" || tone === "danger" ? "alert" : "status";
  const toneClass = {
    neutral: "border-border-subtle bg-surface text-foreground",
    success: "border-success/30 bg-success-surface text-success",
    warning: "border-warning/30 bg-warning-surface text-warning",
    error: "border-error/30 bg-error-surface text-error",
    danger: "border-error/30 bg-error-surface text-error",
  }[tone];
  return (
    <div role={roles} className={`flex items-center justify-between gap-4 rounded-control border px-4 py-3 text-sm font-medium shadow-card ${toneClass}`}>
      <span>{message}</span>
      {onDismiss ? <Button variant="secondary" className="min-h-10 px-3" onClick={onDismiss}>Fechar</Button> : null}
    </div>
  );
}

export function EmptyState({
  title = "Nada por aqui",
  message,
}: {
  title?: string;
  message: string;
}) {
  return (
    <div className="rounded-card border border-dashed border-border bg-surface px-5 py-8 text-center">
      <h3 className="font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-sm text-text-secondary">{message}</p>
    </div>
  );
}

export function LoadingState({ label = "Carregando…" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex min-h-20 items-center justify-center gap-3 rounded-card border border-border-subtle bg-surface p-5 text-sm font-medium text-text-secondary">
      <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-border-subtle border-t-brand motion-reduce:animate-none" />
      {label}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-card border border-error/30 bg-error-surface p-4 text-error sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-medium">{message}</p>
      {onRetry ? <Button variant="secondary" onClick={onRetry}>Tentar novamente</Button> : null}
    </div>
  );
}
