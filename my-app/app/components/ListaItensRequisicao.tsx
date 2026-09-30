"use client"

import React from "react"
import PriorityBadge from "./PriorityBadge"
import type { ItemFormData } from "./FormularioItem"

export default function ListaItensRequisicao({
  itens,
  onEdit,
  onRemove,
}: {
  itens: ItemFormData[]
  onEdit: (index: number) => void
  onRemove: (index: number) => void
}) {
  if (itens.length === 0) {
    return <p className="text-sm text-slate-600">Nenhum item adicionado.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full table-auto min-w-[640px]">
        <thead>
          <tr className="text-left text-sm text-slate-600 border-b">
            <th className="py-2">Item</th>
            <th>Qtd</th>
            <th>Setor</th>
            <th>Prioridade</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {itens.map((it, idx) => (
            <tr key={idx} className="odd:bg-slate-50">
              <td className="py-3">
                <div className="font-medium text-slate-800">{it.itemNome}</div>
                <div className="text-sm text-slate-500">{it.descricao}</div>
              </td>
              <td>{it.quantidade} {it.unidadeMedida}</td>
              <td>{it.setor}</td>
              <td><PriorityBadge priority={it.prioridade} /></td>
              <td className="text-right">
                <div className="flex justify-end gap-2">
                  <button onClick={() => onEdit(idx)} className="text-sm text-royal">Editar</button>
                  <button onClick={() => onRemove(idx)} className="text-sm text-red-600">Remover</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
