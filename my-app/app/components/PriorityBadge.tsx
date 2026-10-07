"use client"

export type Priority = "padrao" | "prioridade"

export const PRIORITY_BADGE_CLASS =
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold bg-amber-100 text-amber-950 ring-1 ring-inset ring-amber-600 dark:bg-amber-950 dark:text-amber-100 dark:ring-amber-400"
export const PRIORITY_QUEUE_ROW_CLASS =
  "border-l-4 border-l-amber-700 bg-amber-50/80 hover:bg-amber-100/80 dark:border-l-amber-400 dark:bg-amber-950/40 dark:hover:bg-amber-950/60"

export default function PriorityBadge({ priority }: { priority: Priority }) {
  if (priority === "padrao") return null
  return <span aria-label="Pedido prioritário" className={PRIORITY_BADGE_CLASS}>
    <span aria-hidden="true">⚠</span>
    PRIORIDADE
  </span>
}
