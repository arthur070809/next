"use client"

import React, { useEffect, useState } from "react"
import PriorityBadge from "./PriorityBadge"

export type ItemFormData = {
  itemNome: string
  setor: "Setor 1" | "Setor 2" | "Setor 3"
  quantidade: number | string
  unidadeMedida: "UN" | "DZ" | "CT"
  descricao: string
  prioridade: "padrao" | "prioridade"
}

const itensMock = Array.from({ length: 20 }, (_, i) => `Item ${i + 1}`)

export default function FormularioItem({
  onAdd,
  editingItem,
}: {
  onAdd: (item: ItemFormData) => void
  editingItem?: ItemFormData
}) {
  const [form, setForm] = useState<ItemFormData>({
    itemNome: "",
    setor: "Setor 1",
    quantidade: 1,
    unidadeMedida: "UN",
    descricao: "",
    prioridade: "padrao",
  })

  useEffect(() => {
    if (editingItem) setForm(editingItem)
  }, [editingItem])

  function update<K extends keyof ItemFormData>(k: K, v: ItemFormData[K]) {
    setForm((s) => ({ ...s, [k]: v }))
  }

  const isValid =
    form.itemNome.trim() !== "" &&
    String(form.quantidade).trim() !== "" &&
    Number(form.quantidade) >= 1 &&
    form.descricao.trim() !== ""

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!isValid) return
        onAdd(form)
        setForm({ itemNome: "", setor: "Setor 1", quantidade: 1, unidadeMedida: "UN", descricao: "", prioridade: "padrao" })
      }}
      className="space-y-3"
    >
      <div>
        <label className="text-sm font-medium text-slate-800">Nome do item</label>
        <select value={form.itemNome} onChange={(e) => update("itemNome", e.target.value)} className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2 bg-white">
          <option value="">Escolha um item...</option>
          {itensMock.map((it) => (
            <option key={it} value={it}>
              {it}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium text-slate-800">Setor</label>
          <select value={form.setor} onChange={(e) => update("setor", e.target.value as any)} className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2 bg-white">
            <option>Setor 1</option>
            <option>Setor 2</option>
            <option>Setor 3</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-800">Quantidade</label>
          <input type="number" min={1} value={String(form.quantidade)} onChange={(e) => update("quantidade", Number(e.target.value) || "") as any} className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2 bg-white" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium text-slate-800">Unidade</label>
          <select value={form.unidadeMedida} onChange={(e) => update("unidadeMedida", e.target.value as any)} className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2 bg-white">
            <option>UN</option>
            <option>DZ</option>
            <option>CT</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-800">Prioridade</label>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => update("prioridade", "padrao")}
              className={`rounded-lg px-3 py-2 ${form.prioridade === "padrao" ? "ring-2 ring-royal" : "border border-slate-200"}`}>
              <PriorityBadge priority="padrao" />
            </button>
            <button type="button" onClick={() => update("prioridade", "prioridade")}
              className={`rounded-lg px-3 py-2 ${form.prioridade === "prioridade" ? "ring-2 ring-royal" : "border border-slate-200"}`}>
              <PriorityBadge priority="prioridade" />
            </button>
          </div>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-800">Descrição / Motivo</label>
        <textarea value={form.descricao} onChange={(e) => update("descricao", e.target.value)} rows={3} className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2 bg-white" />
      </div>

      <div className="flex gap-3">
        <button type="submit" disabled={!isValid} className="flex-1 bg-royal text-white py-3 rounded-lg shadow-sm disabled:opacity-50">Adicionar item</button>
        <button type="button" onClick={() => setForm({ itemNome: "", setor: "Setor 1", quantidade: 1, unidadeMedida: "UN", descricao: "", prioridade: "padrao" })} className="flex-1 border rounded-lg py-3">Limpar</button>
      </div>
    </form>
  )
}
