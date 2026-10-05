import Link from "next/link";
import type { ReactNode } from "react";

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
    <header className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{description}</p> : null}
      </div>
      {action ? <div>{action}</div> : null}
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
  const toneClasses = {
    default: "border-slate-200 bg-white text-slate-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    danger: "border-red-200 bg-red-50 text-red-900",
    brand: "border-blue-200 bg-blue-50 text-blue-900",
  };

  return (
    <article className={`rounded-2xl border p-5 shadow-sm ${toneClasses[tone]}`}>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-black tracking-tight">{value}</p>
      {hint ? <p className="mt-2 text-xs text-slate-500">{hint}</p> : null}
    </article>
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
  const toneClasses = {
    default: "border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/40",
    success: "border-emerald-200 bg-emerald-50/60 hover:border-emerald-300 hover:bg-emerald-50",
    warning: "border-amber-200 bg-amber-50/60 hover:border-amber-300 hover:bg-amber-50",
    danger: "border-red-200 bg-red-50/60 hover:border-red-300 hover:bg-red-50",
    brand: "border-blue-200 bg-blue-50/60 hover:border-blue-300 hover:bg-blue-50",
  };

  return (
    <Link
      href={href}
      className={`block rounded-2xl border p-5 shadow-sm transition duration-200 ${toneClasses[tone]}`}
    >
      <div className="flex items-center justify-between gap-4">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-lg text-white">
          {icon}
        </span>
      </div>
      <p className="mt-4 text-lg font-bold text-slate-900">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </Link>
  );
}

export function StatusBadge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "brand";
}) {
  const toneClasses = {
    neutral: "bg-slate-100 text-slate-700 ring-slate-200",
    success: "bg-emerald-100 text-emerald-800 ring-emerald-200",
    warning: "bg-amber-100 text-amber-800 ring-amber-200",
    danger: "bg-red-100 text-red-800 ring-red-200",
    brand: "bg-blue-100 text-blue-800 ring-blue-200",
  };

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${toneClasses[tone]}`}>
      {label}
    </span>
  );
}
