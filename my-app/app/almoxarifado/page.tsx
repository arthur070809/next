"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import type { RequisicaoMock } from "../../lib/types/almoxarifado"
import FiltrosRequisicoes from "../components/FiltrosRequisicoes"
import TabelaRequisicoes from "../components/TabelaRequisicoes"
import ModalAcaoRequisicao from "../components/ModalAcaoRequisicao"
import { aplicarFiltros, ordenarRequisicoes } from "./utils"

type Acao = "assumir" | "anular" | "devolver"
type ModalState = { requisicao: RequisicaoMock; acao: Acao } | null

export default function AlmoxarifadoPage() {
  const router = useRouter()
  const [requisicoes, setRequisicoes] = useState<RequisicaoMock[]>([])
  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState("")
  const [filters, setFilters] = useState<{ almoxarifado?: string; item?: string; date?: string }>({})
  const [modal, setModal] = useState<ModalState>(null)

  async function loadRequests() {
    setLoading(true)
    try {
      const response = await fetch("/api/almoxarifado/requisicoes", { cache: "no-store" })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Não foi possível carregar a fila.")
      setRequisicoes(data.requisicoes as RequisicaoMock[])
      setApiError("")
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Falha de conexão com o MySQL.")
    } finally { setLoading(false) }
  }
  useEffect(() => { void loadRequests() }, [])

  const itensDisponiveis = useMemo(() => Array.from(new Set(requisicoes.map((r) => r.item))), [requisicoes])
  const ordered = useMemo(() => ordenarRequisicoes(aplicarFiltros(requisicoes, filters)), [requisicoes, filters])

  async function confirmAction(requisicao: RequisicaoMock, codigoCracha: string, motivo: string) {
    if (!modal) return
    const action = modal.acao
    try {
      const response = await fetch(`/api/almoxarifado/requisicoes/${encodeURIComponent(requisicao.numeroPedido)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, codigoCracha, descricaoMotivo: motivo }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Não foi possível registrar a ação.")
      setModal(null)
      if (action === "assumir") router.push(`/almoxarifado/requisicao/${encodeURIComponent(requisicao.numeroPedido)}`)
      else await loadRequests()
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Falha ao registrar no MySQL.")
    }
  }

  return <main className="min-h-screen bg-[#f6f8fc] px-4 py-6 sm:px-6 lg:px-8"><div className="mx-auto max-w-[1600px]">
    <header className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-royal">Marcon · Central</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Painel do almoxarifado</h1><p className="mt-1 text-sm text-slate-500">Acompanhe e atenda as requisições em aberto.</p></div><nav className="flex flex-wrap gap-2"><Link href="/historico" className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">Histórico</Link><Link href="/estoque" className="rounded-lg bg-royal px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">Controle de Estoque/Reserva</Link></nav></header>
    <div className="mb-5 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-sm text-slate-500">Na fila</p><p className="mt-1 text-2xl font-bold text-slate-900">{requisicoes.filter((r) => r.status === "pendente").length}</p></div><div className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm"><p className="text-sm text-slate-500">Em atendimento</p><p className="mt-1 text-2xl font-bold text-amber-700">{requisicoes.filter((r) => r.status === "assumida").length}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-sm text-slate-500">Prioritárias abertas</p><p className="mt-1 text-2xl font-bold text-slate-900">{requisicoes.filter((r) => r.prioridade === "prioridade").length}</p></div></div>
    {apiError && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{apiError}</p>}
    <FiltrosRequisicoes filters={filters} setFilters={setFilters} items={itensDisponiveis}/>
    {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">Carregando requisições do MySQL…</div> : <TabelaRequisicoes list={ordered} onAssume={(requisicao) => setModal({ requisicao, acao: "assumir" })} onCancel={(requisicao) => setModal({ requisicao, acao: "anular" })} onReturn={(requisicao) => setModal({ requisicao, acao: "devolver" })}/>}
    <ModalAcaoRequisicao requisicao={modal?.requisicao ?? null} acao={modal?.acao ?? null} onClose={() => setModal(null)} onConfirm={confirmAction}/>
  </div></main>
}
