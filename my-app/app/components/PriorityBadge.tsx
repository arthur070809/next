"use client"

import React from "react"

export type Priority = "padrao" | "prioridade"

export default function PriorityBadge({ priority }: { priority: Priority }) {
  const bg = priority === "padrao" ? "bg-green-500" : "bg-amber-400"
  const label = priority === "padrao" ? "Padrão" : "Prioridade"

  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium text-white ${bg}`}>
      <span className="h-2 w-2 rounded-full bg-white/40" />
      {label}
    </span>
  )
}
