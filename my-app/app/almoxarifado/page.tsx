"use client"

import React, { useMemo, useState } from "react"
import { REQUISICOES_MOCK } from "./mocks"
import { aplicarFiltros, ordenarRequisicoes } from "./utils"
import FiltrosRequisicoes from "../components/FiltrosRequisicoes"
import TabelaRequisicoes from "../components/TabelaRequisicoes"
import ConfirmacaoAnular from "../components/ConfirmacaoAnular"

export default function AlmoxarifadoPage() {
  const [filters, setFilters] = useState<{ almoxarifado?: string; item?: string; date?: string }>({})
  const [selected, setSelected] = useState(null)
  const [toConfirm, setToConfirm] = useState(null)

  const itensDisponiveis = useMemo(() => Array.from(new Set(REQUISICOES_MOCK.map((r) => r.item))), [])

  const filtered = useMemo(() => aplicarFiltros(REQUISICOES_MOCK, filters), [filters])
  const ordered = useMemo(() => ordenarRequisicoes(filtered), [filtered])

  function handleRequestAnular(r: any) {
    setToConfirm(r)
  }

  function handleConfirmAnular(numeroPedido: string, cracha: string) {
    // mark as anulado in mock list (would call API in real app)
    REQUISICOES_MOCK.forEach((rq) => {
      if (rq.numeroPedido === numeroPedido) {
        rq.status = "anulado"
        rq.anuladoPorCracha = cracha
        rq.anuladoAt = new Date().toISOString()
      }
    })
    setToConfirm(null)
  }

  return (
    <main className="p-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold text-[#212529]">Painel do Almoxarifado</h1>
        <a href="/estoque" className="bg-royal text-white px-4 py-2 rounded-lg">Controle de Estoque/Reserva</a>
      </div>

      <FiltrosRequisicoes filters={filters} setFilters={setFilters} items={itensDisponiveis} />

      <TabelaRequisicoes list={ordered} onOpen={() => {}} onRequestAnular={handleRequestAnular} />
      <ConfirmacaoAnular requisicao={toConfirm} onCancel={() => setToConfirm(null)} onConfirm={handleConfirmAnular} />
    </main>
  )
}
