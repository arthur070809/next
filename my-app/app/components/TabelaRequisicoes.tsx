"use client"

import React from "react"
import type { RequisicaoMock } from "../../lib/types/almoxarifado"
import PriorityBadge from "./PriorityBadge"

export default function TabelaRequisicoes({ list, onOpen, onRequestAnular }: { list: RequisicaoMock[]; onOpen: (r: RequisicaoMock) => void; onRequestAnular?: (r: RequisicaoMock) => void }) {
  if (list.length === 0) return <p className="text-sm text-slate-600">Nenhuma requisição encontrada.</p>

  const getStatusColor = (status: string) => {
    if (status === "anulado") return "bg-gray-400"
    if (status === "assumida") return "bg-blue-600"
    return "bg-green-500"
  }

  return (
    <div className="rounded-lg bg-white shadow-sm">
      <div className="hidden sm:block overflow-x-auto">
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
              <tr
                key={r.numeroPedido}
                onClick={() => onOpen(r)}
                className={`cursor-pointer border-b ${r.prioridade === "prioridade" ? "border-amber-200" : ""}`}
              >
                <td className="p-3 pr-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (r.status !== "anulado" && onRequestAnular) onRequestAnular(r)
                    }}
                    title={r.status}
                    aria-label={`Status ${r.numeroPedido}`}
                    className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-slate-50 transition active:bg-gray-200 active:opacity-80 touch-manipulation"
                  >
                    <span className={`${getStatusColor(r.status)} inline-block h-5 w-5 rounded-sm border border-black`} aria-hidden="true" />
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

      <div className="space-y-3 p-3 sm:hidden">
        {list.map((r) => (
          <div key={r.numeroPedido} className={`rounded-xl border bg-slate-50 p-3 shadow-sm ${r.prioridade === "prioridade" ? "border-amber-200 bg-amber-50/40" : "border-slate-200"}`}>
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  if (r.status !== "anulado" && onRequestAnular) onRequestAnular(r)
                }}
                title={r.status}
                aria-label={`Status ${r.numeroPedido}`}
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border-2 border-slate-800 shadow-sm transition active:bg-gray-200 active:opacity-80 touch-manipulation ${getStatusColor(r.status)}`}
              >
                <span className="h-5 w-5 rounded-sm border border-black bg-white/10" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={() => onOpen(r)}
                title={`Assumir pedido ${r.numeroPedido}`}
                aria-label={`Assumir ${r.numeroPedido}`}
                className="min-w-0 flex-1 rounded-lg p-2 text-left active:bg-gray-100 active:opacity-80 touch-manipulation"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-base font-semibold text-slate-800">Pedido {r.numeroPedido}</p>
                  <PriorityBadge priority={r.prioridade} />
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-slate-600">
                  <div>
                    <span className="block text-[10px] uppercase tracking-wide text-slate-400">Almox.</span>
                    <span>{r.almoxarifado}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase tracking-wide text-slate-400">Setor</span>
                    <span>{r.setor}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase tracking-wide text-slate-400">Item</span>
                    <span className="break-words">{r.item}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase tracking-wide text-slate-400">Qtd</span>
                    <span>{r.quantidade} {r.unidadeMedida}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="block text-[10px] uppercase tracking-wide text-slate-400">Data</span>
                    <span>{new Date(r.data).toLocaleString()}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="block text-[10px] uppercase tracking-wide text-slate-400">Cód.</span>
                    <span>{r.codigoTratamento}</span>
                  </div>
                </div>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
