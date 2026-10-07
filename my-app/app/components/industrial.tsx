import Link from "next/link";
import type { ReactNode } from "react";
import { Card, StatusBadge } from "./ui";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 border-b border-border-subtle pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">{eyebrow}</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

export function SummaryCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "success" | "warning" | "danger" | "brand";
}) {
  const tones = {
    default: "text-foreground",
    success: "text-success",
    warning: "text-warning",
    danger: "text-error",
    brand: "text-brand",
  };

  return (
    <Card className="p-4 sm:p-5">
      <p className="text-sm font-medium text-text-secondary">{label}</p>
      <p className={`mt-2 text-2xl font-bold tracking-tight sm:text-3xl ${tones[tone]}`}>{value}</p>
      {hint ? <p className="mt-2 text-xs text-text-secondary">{hint}</p> : null}
    </Card>
  );
}

export function ActionTile({
  href,
  title,
  description,
  icon,
  tone = "default",
}: {
  href: string;
  title: string;
  description: string;
  icon: string;
  tone?: "default" | "success" | "warning" | "danger" | "brand";
}) {
  const tones = {
    default: "hover:border-brand/50",
    success: "hover:border-success/50",
    warning: "hover:border-warning/50",
    danger: "hover:border-error/50",
    brand: "hover:border-brand/50",
  };

  return (
    <Link
      href={href}
      className={`block rounded-card border border-border-subtle bg-surface p-4 shadow-card transition-colors hover:bg-background sm:p-5 ${tones[tone]}`}
    >
      <div className="flex items-center justify-between gap-4">
        <span aria-hidden="true" className="inline-flex size-11 items-center justify-center rounded-control bg-brand text-lg font-semibold text-white">
          {icon}
        </span>
      </div>
      <p className="mt-4 text-lg font-bold text-foreground">{title}</p>
      <p className="mt-2 text-sm leading-6 text-text-secondary">{description}</p>
    </Link>
  );
}

export { StatusBadge };
