"use client"

import React, { useState, useEffect } from "react"
import type { RequisicaoMock } from "../../lib/types/almoxarifado"

export default function ConfirmacaoAssumir({ requisicao, onCancel, onConfirm, onFinalizar }: { requisicao: RequisicaoMock | null; onCancel: () => void; onConfirm: (numeroPedido: string, cracha: string) => void; onFinalizar?: (requisicao: RequisicaoMock) => void }) {
  const [cracha, setCracha] = useState("")
  const [confirmouAssumir, setConfirmouAssumir] = useState(false)

  useEffect(() => {
    setCracha("")
    setConfirmouAssumir(false)
  }, [requisicao?.numeroPedido])

  if (!requisicao) return null

  const jaAssumida = requisicao.status === "assumida"
  const mostrarEstadoAssumido = confirmouAssumir || jaAssumida

  const detalhes = [
    { label: "Pedido", value: requisicao.numeroPedido },
    { label: "Almoxarifado", value: requisicao.almoxarifado },
    { label: "Setor", value: requisicao.setor },
    { label: "Item", value: requisicao.item },
    { label: "Quantidade", value: `${requisicao.quantidade} ${requisicao.unidadeMedida}` },
    { label: "Descrição", value: requisicao.descricao },
    { label: "Código", value: requisicao.codigoTratamento },
    { label: "Data", value: new Date(requisicao.data).toLocaleString() },
    { label: "Prioridade", value: requisicao.prioridade },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-lg max-w-lg w-full p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-blue-700">{mostrarEstadoAssumido ? "Requisição assumida" : "Assumir essa requisição?"}</h3>
          <button onClick={onCancel} className="text-slate-500 text-sm">Fechar</button>
        </div>

        {!mostrarEstadoAssumido ? (
          <>
            <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 text-sm font-semibold text-slate-700">Detalhes da requisição</div>
              <div className="space-y-2 text-sm text-slate-600">
                {detalhes.map((item) => (
                  <div key={item.label} className="flex justify-between gap-3 border-b border-slate-200 pb-1 last:border-b-0 last:pb-0">
                    <span className="font-medium text-slate-500">{item.label}</span>
                    <span className="text-right text-slate-700">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <label className="block text-sm font-medium mb-1">Código do crachá</label>
            <input value={cracha} onChange={(e) => setCracha(e.target.value)} className="w-full rounded-lg border px-3 py-2 mb-4" />

            <div className="flex justify-end gap-2">
              <button onClick={onCancel} className="px-4 py-2 rounded-lg border">Cancelar</button>
              <button
                onClick={() => {
                  onConfirm(requisicao.numeroPedido, cracha)
                  setConfirmouAssumir(true)
                }}
                disabled={!cracha}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-50 hover:bg-blue-700 active:opacity-80"
              >
                Confirmar
              </button>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
              <div className="mb-2 inline-flex items-center rounded-full bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white">Status: assumida</div>
              <div className="space-y-2 text-sm text-slate-700">
                {detalhes.map((item) => (
                  <div key={item.label} className="flex justify-between gap-3 border-b border-blue-100 pb-1 last:border-b-0 last:pb-0">
                    <span className="font-medium text-slate-500">{item.label}</span>
                    <span className="text-right">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => {
                onFinalizar?.(requisicao)
              }}
              className="w-full rounded-lg bg-amber-500 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-600 active:opacity-80"
            >
              Finalizar pedido
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
