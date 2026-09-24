"use client"

import React from "react"

export default function FiltrosRequisicoes({ filters, setFilters, items }: { filters: { almoxarifado?: string; item?: string; date?: string }; setFilters: (s: any) => void; items: string[] }) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
      <div className="flex flex-col lg:flex-row gap-3">
        <select value={filters.almoxarifado || ""} onChange={(e) => setFilters({ ...filters, almoxarifado: e.target.value || undefined })} className="rounded-lg border px-3 py-2">
          <option value="">Todos os almoxarifados</option>
          <option value="central">Central</option>
          <option value="embalagens">Embalagens</option>
          <option value="materia-prima">Matéria-prima</option>
          <option value="importados">Produtos importados</option>
        </select>

        <input placeholder="Buscar item" value={filters.item || ""} onChange={(e) => setFilters({ ...filters, item: e.target.value || undefined })} className="rounded-lg border px-3 py-2 flex-1" list="itens-list" />
        <datalist id="itens-list">
          {items.map((it) => (
            <option key={it} value={it} />
          ))}
        </datalist>

        <input type="date" value={filters.date || ""} onChange={(e) => setFilters({ ...filters, date: e.target.value || undefined })} className="rounded-lg border px-3 py-2" />

        <button onClick={() => setFilters({})} className="bg-slate-100 px-4 py-2 rounded-lg">Limpar</button>
      </div>
    </div>
  )
}
