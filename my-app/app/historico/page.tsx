"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import type { EventoHistorico } from "../../lib/types/almoxarifado"

const labels: Record<EventoHistorico["evento"], string> = { assumida: "Assumida", cancelada: "Cancelada", finalizada: "Finalizada", devolvida: "Devolvida" }
const colors: Record<EventoHistorico["evento"], string> = { assumida: "bg-blue-50 text-royal", cancelada: "bg-red-50 text-red-700", finalizada: "bg-green-50 text-green-700", devolvida: "bg-amber-50 text-amber-800" }
const kinds: EventoHistorico["evento"][] = ["assumida", "cancelada", "finalizada", "devolvida"]

function FiltrosHistorico({ selected, onToggle, search, onSearch, onClear }: { selected: EventoHistorico["evento"][]; onToggle: (event: EventoHistorico["evento"]) => void; search: string; onSearch: (value: string) => void; onClear: () => void }) {
  return <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="flex flex-col gap-4"><label className="block text-sm font-medium text-slate-700">Buscar pedido ou crachá<input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Ex.: #0004 ou 209" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-royal focus:ring-2 focus:ring-blue-100"/></label><div className="flex flex-wrap items-center gap-2">{kinds.map((kind) => <button key={kind} onClick={() => onToggle(kind)} aria-pressed={selected.includes(kind)} className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${selected.includes(kind) ? `${colors[kind]} border-transparent` : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{labels[kind]}</button>)}<button onClick={onClear} className="ml-auto rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">Limpar filtros</button></div></div></section>
}

function ListaHistorico({ events }: { events: EventoHistorico[] }) {
  if (!events.length) return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">Nenhum evento encontrado para estes filtros.</div>
  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[850px] text-left"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{["Pedido", "Evento", "Crachá", "Data e hora", "Descrição"].map((h) => <th key={h} className="px-5 py-3 font-semibold">{h}</th>)}</tr></thead><tbody>{events.map((e) => <tr key={e.id} className="border-t border-slate-100 hover:bg-slate-50"><td className="px-5 py-4 font-semibold text-slate-900">{e.numeroPedido}</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${colors[e.evento]}`}>{labels[e.evento]}</span></td><td className="px-5 py-4 text-sm text-slate-700">{e.codigoCracha}</td><td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">{new Date(e.timestamp).toLocaleString("pt-BR")}</td><td className="px-5 py-4 text-sm text-slate-600">{e.descricaoMotivo ?? (e.itensFinalizados ? `${e.itensFinalizados.filter((i) => i.separado).length}/${e.itensFinalizados.length} itens separados` : "—")}</td></tr>)}</tbody></table></div><div className="space-y-3 p-3 md:hidden">{events.map((e) => <article key={e.id} className="rounded-xl border border-slate-200 p-4"><div className="flex items-center justify-between gap-3"><strong className="text-slate-900">{e.numeroPedido}</strong><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${colors[e.evento]}`}>{labels[e.evento]}</span></div><p className="mt-3 text-sm text-slate-600">Crachá {e.codigoCracha} · {new Date(e.timestamp).toLocaleString("pt-BR")}</p>{e.descricaoMotivo && <p className="mt-2 text-sm text-slate-500">{e.descricaoMotivo}</p>}</article>)}</div></section>
}

export default function HistoricoPage() {
  const [events, setEvents] = useState<EventoHistorico[]>([])
  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState("")
  const [selected, setSelected] = useState<EventoHistorico["evento"][]>([])
  const [search, setSearch] = useState("")
  useEffect(() => {
    fetch("/api/historico", { cache: "no-store" }).then(async (response) => {
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Falha ao carregar o histórico.")
      setEvents(data.eventos as EventoHistorico[])
    }).catch((error: unknown) => setApiError(error instanceof Error ? error.message : "Falha ao conectar ao MySQL.")).finally(() => setLoading(false))
  }, [])
  const filtered = useMemo(() => events.filter((e) => (!selected.length || selected.includes(e.evento)) && (!search.trim() || e.numeroPedido.toLowerCase().includes(search.trim().toLowerCase()) || e.codigoCracha.toLowerCase().includes(search.trim().toLowerCase()))).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()), [events, selected, search])
  function toggle(kind: EventoHistorico["evento"]) { setSelected((current) => current.includes(kind) ? current.filter((e) => e !== kind) : [...current, kind]) }
  return <main className="min-h-screen bg-[#f6f8fc] px-4 py-6 sm:px-6 lg:px-8"><div className="mx-auto max-w-7xl"><header className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-royal">Marcon · Auditoria</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Histórico de movimentações</h1><p className="mt-1 text-sm text-slate-500">Ações registradas sobre as requisições do almoxarifado.</p></div><Link href="/almoxarifado" className="w-fit rounded-lg bg-royal px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">Voltar ao painel</Link></header>{apiError && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{apiError}</p>}<div className="mb-4 flex items-center justify-between"><p className="text-sm text-slate-500">{filtered.length} eventos</p></div><FiltrosHistorico selected={selected} onToggle={toggle} search={search} onSearch={setSearch} onClear={() => { setSelected([]); setSearch("") }}/>{loading ? <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">Carregando histórico do MySQL…</div> : <ListaHistorico events={filtered}/>}</div></main>
}
