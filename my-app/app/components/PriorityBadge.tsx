"use client"

import { Icon, StatusBadge } from "./ui"

export type Priority = "padrao" | "prioridade"

export const PRIORITY_BADGE_CLASS =
  "inline-flex items-center gap-1.5 rounded-full bg-priority-surface px-2.5 py-1 text-xs font-bold text-priority ring-1 ring-inset ring-priority/25"
export const PRIORITY_QUEUE_ROW_CLASS =
  "border-l-4 border-l-priority bg-priority-surface/70 hover:bg-priority-surface"

export default function PriorityBadge({ priority }: { priority: Priority }) {
  if (priority === "padrao") return <StatusBadge label="Padrão" tone="neutral" icon={<Icon name="info" size={14} />} />
  return <StatusBadge label="Prioridade" tone="priority" icon={<Icon name="alert" size={14} />} className={PRIORITY_BADGE_CLASS} />
}
