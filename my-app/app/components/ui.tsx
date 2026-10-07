"use client";

import { useEffect, useId, type ButtonHTMLAttributes, type HTMLAttributes, type LabelHTMLAttributes, type ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "danger";
export type IconName = "home" | "list" | "history" | "route" | "inventory" | "warehouse" | "users" | "shield" | "device" | "plus" | "qr" | "check" | "alert" | "info" | "close" | "menu" | "arrow-right" | "package";

const iconShapes: Record<IconName, ReactNode> = {
  home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" /><path d="M9 21v-6h6v6" /></>,
  list: <><path d="M8 6h13M8 12h13M8 18h13" /><path d="M3 6h.01M3 12h.01M3 18h.01" /></>,
  history: <><path d="M3 12a9 9 0 1 0 2.6-6.4L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></>,
  route: <><circle cx="6" cy="18" r="2" /><circle cx="18" cy="6" r="2" /><path d="M8 18h3a4 4 0 0 0 4-4V10a4 4 0 0 1 4-4" /></>,
  inventory: <><path d="m3 7 9-4 9 4v10l-9 4-9-4z" /><path d="m3 7 9 4 9-4M12 11v10M7.5 5l9 4" /></>,
  warehouse: <><path d="m3 10 9-7 9 7v10H3z" /><path d="M7 21v-7h10v7M7 10h.01M12 10h.01M17 10h.01" /></>,
  users: <><circle cx="9" cy="8" r="3" /><path d="M3 20v-1a6 6 0 0 1 12 0v1zM16 5.5a3 3 0 0 1 0 5.8M18 14a5 5 0 0 1 3 4.6V20h-3" /></>,
  shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z" /><path d="m9 12 2 2 4-4" /></>,
  device: <><rect x="5" y="2" width="14" height="20" rx="2" /><path d="M11 18h2" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  qr: <><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM19 14v2M19 19h2M14 19v2M17 19h2" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  alert: <><path d="m10.3 3.9-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.1l-8-14a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" /></>,
  info: <><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></>,
  close: <path d="m18 6-12 12M6 6l12 12" />,
  menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
  "arrow-right": <><path d="M5 12h14M13 6l6 6-6 6" /></>,
  package: <><path d="m3 7 9-4 9 4-9 4zM3 7v10l9 4 9-4V7M12 11v10" /></>,
};

export function Icon({ name, size = 20, className = "" }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {iconShapes[name]}
    </svg>
  );
}

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-brand text-surface hover:bg-brand-hover active:bg-brand-pressed",
  secondary: "border border-brand bg-surface text-brand hover:bg-priority-surface active:bg-brand/10",
  danger: "bg-error text-surface hover:bg-error/90 active:bg-error",
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
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-control px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${buttonVariants[variant]} ${className}`}
    >
      {loading ? (
        <>
          <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none" />
          {loadingLabel}
        </>
      ) : children}
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
      className={`rounded-card bg-surface shadow-card ${className}`}
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
  const defaultIcons: Record<StatusTone, IconName> = {
    neutral: "info",
    success: "check",
    warning: "alert",
    error: "close",
    danger: "close",
    brand: "info",
    priority: "alert",
  };
  return (
    <span className={`inline-flex min-h-6 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusTones[tone]} ${className}`}>
      {icon ?? <Icon name={defaultIcons[tone]} size={14} />}
      {label}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: "normal" | "high" }) {
  return priority === "high"
    ? <StatusBadge label="Prioridade" tone="priority" icon={<Icon name="alert" size={14} />} />
    : <StatusBadge label="Padrão" tone="neutral" icon={<Icon name="info" size={14} />} />;
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
  onRetry,
  emptyMessage = "Nenhum registro encontrado.",
}: {
  columns: TableColumn<Row>[];
  rows: Row[];
  getRowKey: (row: Row) => string | number;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  emptyMessage?: string;
}) {
  if (loading) return <LoadingState label="Carregando registros…" />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (!rows.length) return <EmptyState message={emptyMessage} />;

  return (
    <div className="min-w-0">
      <div className="hidden overflow-x-auto rounded-card bg-surface shadow-card md:block">
        <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 bg-background text-text-secondary">
            <tr>{columns.map((column) => <th key={column.key} scope="col" className="px-4 py-3 font-semibold">{column.label}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {rows.map((row) => (
              <tr key={getRowKey(row)} className="align-top odd:bg-background/60 hover:bg-priority-surface">
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
      {onDismiss ? <Button variant="secondary" className="px-3" onClick={onDismiss}>Fechar</Button> : null}
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
    <div className="rounded-card bg-surface px-5 py-8 text-center shadow-card">
      <span aria-hidden="true" className="mx-auto inline-flex size-11 items-center justify-center rounded-full bg-priority-surface text-xl font-semibold text-brand">—</span>
      <h3 className="mt-3 font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-sm text-text-secondary">{message}</p>
    </div>
  );
}

export function LoadingState({ label = "Carregando…", rows = 3 }: { label?: string; rows?: number }) {
  return (
    <div role="status" aria-live="polite" aria-label={label} className="grid gap-3 rounded-card bg-surface p-4 shadow-card">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} aria-hidden="true" className="flex animate-pulse items-center gap-3 py-2 motion-reduce:animate-none">
          <span className="size-10 shrink-0 rounded-control bg-background" />
          <span className="grid flex-1 gap-2">
            <span className="h-4 w-2/5 rounded bg-background" />
            <span className="h-3 w-4/5 rounded bg-background" />
          </span>
        </div>
      ))}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
  retryLabel = "Tentar de novo",
}: {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-card border border-error/30 bg-error-surface p-4 text-error sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-medium">{message}</p>
      {onRetry ? <Button variant="secondary" onClick={onRetry}>{retryLabel}</Button> : null}
    </div>
  );
}
