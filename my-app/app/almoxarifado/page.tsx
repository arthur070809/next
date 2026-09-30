"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import FiltrosRequisicoes from "../components/FiltrosRequisicoes"
import ModalAcaoRequisicao from "../components/ModalAcaoRequisicao"
import TabelaRequisicoes from "../components/TabelaRequisicoes"
import type { RequisicaoMock } from "../../lib/types/almoxarifado"
import { aplicarFiltros, ordenarRequisicoes } from "./utils"

type Filtros = { almoxarifado?: string; item?: string; date?: string }
type AcaoRequisicao = "assumir" | "anular" | "devolver"
type RespostaFila = { requisicoes?: RequisicaoMock[]; error?: string }

async function carregarFila() {
  const response = await fetch("/api/almoxarifado/requisicoes", { cache: "no-store" })
  const data = await response.json() as RespostaFila
  if (!response.ok) throw new Error(data.error ?? "Não foi possível carregar as requisições.")
  return Array.isArray(data.requisicoes) ? data.requisicoes : []
}

export default function AlmoxarifadoPage() {
  const [requisicoes, setRequisicoes] = useState<RequisicaoMock[]>([])
  const [filters, setFilters] = useState<Filtros>({})
  const [selecionada, setSelecionada] = useState<RequisicaoMock | null>(null)
  const [acao, setAcao] = useState<AcaoRequisicao | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState("")

  useEffect(() => {
    let ativo = true
    carregarFila()
      .then((fila) => {
        if (ativo) setRequisicoes(fila)
      })
      .catch((cause: unknown) => {
        if (ativo) setErro(cause instanceof Error ? cause.message : "Não foi possível carregar as requisições.")
      })
      .finally(() => {
        if (ativo) setCarregando(false)
      })
    return () => { ativo = false }
  }, [])

  const itensDisponiveis = useMemo(() => Array.from(new Set(requisicoes.map((requisicao) => requisicao.item))), [requisicoes])
  const filtered = useMemo(() => aplicarFiltros(requisicoes, filters), [requisicoes, filters])
  const ordered = useMemo(() => ordenarRequisicoes(filtered), [filtered])

  function abrirAcao(requisicao: RequisicaoMock, proximaAcao: AcaoRequisicao) {
    setSelecionada(requisicao)
    setAcao(proximaAcao)
  }

  async function confirmarAcao(requisicao: RequisicaoMock, codigoCracha: string, descricaoMotivo: string) {
    if (!acao || salvando) return
    setSalvando(true)
    setErro("")
    try {
      const response = await fetch(`/api/almoxarifado/requisicoes/${encodeURIComponent(requisicao.numeroPedido)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: acao, codigoCracha, descricaoMotivo }),
      })
      const data = await response.json() as { error?: string }
      if (!response.ok) throw new Error(data.error ?? "Não foi possível registrar a ação.")
      setSelecionada(null)
      setAcao(null)
      setRequisicoes(await carregarFila())
    } catch (cause) {
      setErro(cause instanceof Error ? cause.message : "Não foi possível registrar a ação.")
    } finally {
      setSalvando(false)
    }
  }

  return (
    <main className="mx-auto max-w-7xl p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-[#212529]">Painel do Almoxarifado</h1>
        <Link href="/estoque" className="rounded-lg bg-royal px-4 py-2 text-white">Controle de Estoque/Reserva</Link>
      </div>

      {erro && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}
      {carregando ? <p role="status" className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">Carregando requisições...</p> : <>
        <FiltrosRequisicoes filters={filters} setFilters={setFilters} items={itensDisponiveis} />
        <TabelaRequisicoes
          list={ordered}
          onAssume={(requisicao) => abrirAcao(requisicao, "assumir")}
          onCancel={(requisicao) => abrirAcao(requisicao, "anular")}
          onReturn={(requisicao) => abrirAcao(requisicao, "devolver")}
        />
      </>}
      {selecionada && acao && <ModalAcaoRequisicao
        key={`${selecionada.numeroPedido}-${acao}`}
        requisicao={selecionada}
        acao={acao}
        busy={salvando}
        onClose={() => { setSelecionada(null); setAcao(null) }}
        onConfirm={(requisicao, cracha, motivo) => void confirmarAcao(requisicao, cracha, motivo)}
      />}
      {salvando && <p role="status" className="sr-only">Salvando ação...</p>}
    </main>
  )
}
