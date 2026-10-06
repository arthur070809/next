"use client"

export type Priority = "padrao" | "prioridade"

export default function PriorityBadge({ priority }: { priority: Priority }) {
  const standard = priority === "padrao"
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${standard ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-900 ring-1 ring-inset ring-amber-400"}`}>
    <span aria-hidden="true">{standard ? "•" : "!"}</span>
    {standard ? "Padrão" : "PRIORITÁRIA"}
  </span>
}
