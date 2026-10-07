"use client"

import React from "react"

export default function FiltrosRequisicoes({ filters, setFilters, items }: { filters: { almoxarifado?: string; item?: string; date?: string }; setFilters: (s: { almoxarifado?: string; item?: string; date?: string }) => void; items: string[] }) {
  return (
    <section className="mb-5 rounded-2xl border border-border-subtle bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-3"><h2 className="font-semibold text-foreground">Filtros</h2><p className="mt-1 text-sm text-text-secondary">Encontre uma requisição por almoxarifado, item ou data.</p></div>
      <div className="flex flex-col gap-3 lg:flex-row">
        <select aria-label="Filtrar por almoxarifado" value={filters.almoxarifado || ""} onChange={(e) => setFilters({ ...filters, almoxarifado: e.target.value || undefined })} className="rounded-lg border border-border bg-white px-3 py-2.5 text-sm">
          <option value="">Todos os almoxarifados</option>
          <option value="central">Central</option>
          <option value="embalagens">Embalagens</option>
          <option value="materia-prima">Matéria-prima</option>
          <option value="importados">Produtos importados</option>
        </select>

        <input aria-label="Buscar item" placeholder="Buscar item" value={filters.item || ""} onChange={(e) => setFilters({ ...filters, item: e.target.value || undefined })} className="min-w-0 flex-1 rounded-lg border border-border px-3 py-2.5 text-sm" list="itens-list" />
        <datalist id="itens-list">
          {items.map((it) => (
            <option key={it} value={it} />
          ))}
        </datalist>

        <input aria-label="Filtrar por data" type="date" value={filters.date || ""} onChange={(e) => setFilters({ ...filters, date: e.target.value || undefined })} className="rounded-lg border border-border px-3 py-2.5 text-sm" />

        <button onClick={() => setFilters({})} className="rounded-lg bg-background px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-border-subtle">Limpar filtros</button>
      </div>
    </section>
  )
}
