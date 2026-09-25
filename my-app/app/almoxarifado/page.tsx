"use client"

import React, { useMemo, useState } from "react"
import { REQUISICOES_MOCK } from "./mocks"
import { aplicarFiltros, ordenarRequisicoes } from "./utils"
import FiltrosRequisicoes from "../components/FiltrosRequisicoes"
import TabelaRequisicoes from "../components/TabelaRequisicoes"
import ConfirmacaoAnular from "../components/ConfirmacaoAnular"
import ConfirmacaoAssumir from "../components/ConfirmacaoAssumir"
import ConfirmacaoFinalizar from "../components/ConfirmacaoFinalizar"

export default function AlmoxarifadoPage() {
  const [requisicoes, setRequisicoes] = useState(REQUISICOES_MOCK)
  const [filters, setFilters] = useState<{ almoxarifado?: string; item?: string; date?: string }>({})
  const [toConfirm, setToConfirm] = useState<any>(null)
  const [toAssumir, setToAssumir] = useState<any>(null)
  const [toFinalizar, setToFinalizar] = useState<any>(null)

  const itensDisponiveis = useMemo(() => Array.from(new Set(requisicoes.map((r) => r.item))), [requisicoes])

  const filtered = useMemo(() => aplicarFiltros(requisicoes, filters), [requisicoes, filters])
  const ordered = useMemo(() => ordenarRequisicoes(filtered), [filtered])

  function handleRequestAnular(r: any) {
    setToConfirm(r)
  }

  function handleRequestAssumir(r: any) {
    if (r.status === "anulado") return
    setToAssumir(r)
  }

  function handleConfirmAnular(numeroPedido: string, cracha: string) {
    setRequisicoes((prev) =>
      prev.map((rq) =>
        rq.numeroPedido === numeroPedido
          ? {
              ...rq,
              status: "anulado",
              anuladoPorCracha: cracha,
              anuladoAt: new Date().toISOString(),
            }
          : rq,
      ),
    )
    setToConfirm(null)
  }

  function handleConfirmAssumir(numeroPedido: string, cracha: string) {
    const requisicaoAtualizada = requisicoes.find((rq) => rq.numeroPedido === numeroPedido)

    if (!requisicaoAtualizada) return

    const requisicaoAssumida = {
      ...requisicaoAtualizada,
      status: "assumida" as const,
      assumidaPorCracha: cracha,
      assumidaAt: new Date().toISOString(),
    }

    setRequisicoes((prev) =>
      prev.map((rq) => (rq.numeroPedido === numeroPedido ? requisicaoAssumida : rq)),
    )

    setToAssumir(requisicaoAssumida)
    setToFinalizar(null)
  }

  function handleFinalizarPedido(numeroPedido: string) {
    setRequisicoes((prev) =>
      prev.map((rq) => (rq.numeroPedido === numeroPedido ? { ...rq, status: "pronto" } : rq)),
    )
    setToFinalizar(null)
  }

  return (
    <main className="p-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold text-[#212529]">Painel do Almoxarifado</h1>
        <a href="/estoque" className="bg-royal text-white px-4 py-2 rounded-lg">Controle de Estoque/Reserva</a>
      </div>

      <FiltrosRequisicoes filters={filters} setFilters={setFilters} items={itensDisponiveis} />

      <TabelaRequisicoes list={ordered} onOpen={handleRequestAssumir} onRequestAnular={handleRequestAnular} />
      <ConfirmacaoAnular requisicao={toConfirm} onCancel={() => setToConfirm(null)} onConfirm={handleConfirmAnular} />
      <ConfirmacaoAssumir
        requisicao={toAssumir}
        onCancel={() => setToAssumir(null)}
        onConfirm={handleConfirmAssumir}
        onFinalizar={(requisicao) => {
          setToAssumir(null)
          setToFinalizar(requisicao)
        }}
      />
      <ConfirmacaoFinalizar requisicao={toFinalizar} onCancel={() => setToFinalizar(null)} onConfirm={handleFinalizarPedido} />
    </main>
  )
}
