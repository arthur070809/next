"use client"

import React, { useState } from "react"
import FormularioItem, { ItemFormData } from "../components/FormularioItem"
import ListaItensRequisicao from "../components/ListaItensRequisicao"
import PriorityBadge from "../components/PriorityBadge"
import type { RequisicaoPayload } from "../../lib/types/requisicao"

export default function RequisicaoPage() {
  const [itens, setItens] = useState<ItemFormData[]>([])
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  function handleAddItem(item: ItemFormData) {
    if (editingIndex !== null) {
      const copy = [...itens]
      copy[editingIndex] = item
      setItens(copy)
      setEditingIndex(null)
    } else {
      setItens((s) => [...s, item])
    }
  }

  function handleEdit(index: number) {
    setEditingIndex(index)
  }

  function handleRemove(index: number) {
    setItens((s) => s.filter((_, i) => i !== index))
    setEditingIndex(null)
  }

  function handleEnviarRequisicao() {
    const now = new Date().toISOString()

    const payload: RequisicaoPayload = {
      solicitanteId: 1, // substituir por id real no futuro
      itens: itens.map((it) => ({
        itemNome: it.itemNome,
        setor: it.setor === "Setor 1" ? "setor1" : it.setor === "Setor 2" ? "setor2" : "setor3",
        quantidade: Number(it.quantidade),
        unidadeMedida: it.unidadeMedida.toLowerCase() as "un" | "dz" | "ct",
        descricao: it.descricao,
        prioridade: it.prioridade,
      })),
      createdAt: now,
    }

    console.log("Enviar requisição payload:", payload)
    alert("Requisição preparada. Verifique o console para o payload.")
    setItens([])
  }

  return (
    <main className="p-4 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold text-[#212529] mb-4">Nova Requisição</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h2 className="text-lg font-medium mb-3">Adicionar item</h2>
          <FormularioItem
            key={editingIndex ?? "new"}
            onAdd={handleAddItem}
            editingItem={editingIndex !== null ? itens[editingIndex] : undefined}
          />
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-medium">Resumo da requisição</h2>
            <PriorityBadge priority={itens.some((i) => i.prioridade === "prioridade") ? "prioridade" : "padrao"} />
          </div>

          <ListaItensRequisicao itens={itens} onEdit={handleEdit} onRemove={handleRemove} />

          <div className="mt-4">
            <button
              className="w-full bg-royal text-white py-3 rounded-lg shadow-sm disabled:opacity-50"
              disabled={itens.length === 0}
              onClick={handleEnviarRequisicao}
            >
              Enviar requisição
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
