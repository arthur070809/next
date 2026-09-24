"use client"

import React, { useState, useEffect } from "react"
import type { RequisicaoMock } from "../../lib/types/almoxarifado"

export default function ConfirmacaoAnular({ requisicao, onCancel, onConfirm }: { requisicao: RequisicaoMock | null; onCancel: () => void; onConfirm: (numeroPedido: string, cracha: string) => void }) {
  const [cracha, setCracha] = useState("")

  useEffect(() => {
    setCracha("")
  }, [requisicao])

  if (!requisicao) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-5">
        <h3 className="text-lg font-semibold mb-2">Realmente deseja anular esse pedido?</h3>
        <p className="text-sm text-slate-600 mb-4">{requisicao.numeroPedido} — {requisicao.item} — {requisicao.setor}</p>

        <label className="block text-sm font-medium mb-1">Código do crachá (será salvo no histórico)</label>
        <input value={cracha} onChange={(e) => setCracha(e.target.value)} className="w-full rounded-lg border px-3 py-2 mb-4" />

        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg border">Cancelar</button>
          <button onClick={() => onConfirm(requisicao.numeroPedido, cracha)} disabled={!cracha} className="px-4 py-2 rounded-lg bg-red-600 text-white disabled:opacity-50">Confirmar anulação</button>
        </div>
      </div>
    </div>
  )
}
