"use client"

import React from "react"
import type { RequisicaoMock } from "../../lib/types/almoxarifado"

export default function ConfirmacaoFinalizar({ requisicao, onCancel, onConfirm }: { requisicao: RequisicaoMock | null; onCancel: () => void; onConfirm: (numeroPedido: string) => void }) {
  if (!requisicao) return null

  const detalhes = [
    { label: "Pedido", value: requisicao.numeroPedido },
    { label: "Almoxarifado", value: requisicao.almoxarifado },
    { label: "Setor", value: requisicao.setor },
    { label: "Item", value: requisicao.item },
    { label: "Quantidade", value: `${requisicao.quantidade} ${requisicao.unidadeMedida}` },
    { label: "Descrição", value: requisicao.descricao },
    { label: "Código", value: requisicao.codigoTratamento },
    { label: "Data", value: new Date(requisicao.data).toLocaleString() },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-lg max-w-lg w-full p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-amber-700">Finalizar pedido</h3>
          <button onClick={onCancel} className="text-sm text-slate-500">Fechar</button>
        </div>

        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <div className="mb-2 text-sm font-semibold text-slate-700">Resumo do produto</div>
          <div className="space-y-2 text-sm text-slate-700">
            {detalhes.map((item) => (
              <div key={item.label} className="flex justify-between gap-3 border-b border-amber-100 pb-1 last:border-b-0 last:pb-0">
                <span className="font-medium text-slate-500">{item.label}</span>
                <span className="text-right">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-lg border px-4 py-2">Cancelar</button>
          <button onClick={() => onConfirm(requisicao.numeroPedido)} className="rounded-lg bg-amber-500 px-4 py-2 font-medium text-white hover:bg-amber-600 active:opacity-80">
            Pedido finalizado
          </button>
        </div>
      </div>
    </div>
  )
}
