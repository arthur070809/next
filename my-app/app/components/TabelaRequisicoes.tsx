"use client"

import React from "react"
import type { RequisicaoMock } from "../../lib/types/almoxarifado"
import PriorityBadge from "./PriorityBadge"

export default function TabelaRequisicoes({ list, onOpen, onRequestAnular }: { list: RequisicaoMock[]; onOpen: (r: RequisicaoMock) => void; onRequestAnular?: (r: RequisicaoMock) => void }) {
  if (list.length === 0) return <p className="text-sm text-slate-600">Nenhuma requisição encontrada.</p>

  const getStatusColor = (status: string) => {
    // Por requisito: bolinha é naturalmente verde para todos os status,
    // exceto quando a requisição estiver 'anulado' (então fica cinza).
    if (status === "anulado") return "bg-gray-400"
    return "bg-green-500"
  }

  return (
    <div className="overflow-x-auto bg-white rounded-lg shadow-sm">
      <table className="w-full min-w-[900px]">
        <thead className="bg-slate-50 text-left text-sm text-slate-600 sticky top-0">
          <tr>
            <th className="p-3">Status</th>
            <th className="p-3">Pedido</th>
            <th>Almox.</th>
            <th>Setor</th>
            <th>Item</th>
            <th>Qtd</th>
            <th>Unid.</th>
            <th>Data</th>
            <th>Cod.</th>
            <th>Prioridade</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {list.map((r) => (
            <tr key={r.numeroPedido} className={`border-b ${r.prioridade === "prioridade" ? "border-amber-200" : ""}`}>
              <td className="p-3 pr-1">
                <button onClick={() => r.status !== "anulado" && onRequestAnular && onRequestAnular(r)} title={r.status} aria-label={`Status ${r.numeroPedido}`} className="flex items-center gap-2">
                  <span className="text-slate-500 text-xs" aria-hidden="true">›</span>
                  <span className={`${getStatusColor(r.status)} inline-block h-4 w-4 rounded-full border border-black`} aria-hidden="true" />
                </button>
              </td>
              <td className="border-l border-slate-100 pl-3 p-3 font-medium">{r.numeroPedido}</td>
              <td>{r.almoxarifado}</td>
              <td>{r.setor}</td>
              <td>{r.item}</td>
              <td>{r.quantidade}</td>
              <td>{r.unidadeMedida}</td>
              <td>{new Date(r.data).toLocaleString()}</td>
              <td>{r.codigoTratamento}</td>
              <td><PriorityBadge priority={r.prioridade} /></td>
              <td className="text-right p-3"></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
