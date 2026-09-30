"use client"

export type Priority = "padrao" | "prioridade"

export default function PriorityBadge({ priority }: { priority: Priority }) {
  const standard = priority === "padrao"
  return <span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold ${standard ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-800"}`}>
    <span className={`h-1.5 w-1.5 rounded-full ${standard ? "bg-green-500" : "bg-amber-500"}`} aria-hidden="true" />
    {standard ? "Padrão" : "Prioridade"}
  </span>
}
