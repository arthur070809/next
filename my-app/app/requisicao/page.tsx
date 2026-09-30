"use client"

import Link from "next/link"
import { useState } from "react"
import FormularioItem, { type ItemFormData } from "../components/FormularioItem"
import ListaItensRequisicao from "../components/ListaItensRequisicao"
import PriorityBadge from "../components/PriorityBadge"
import type { RequisicaoPayload } from "../../lib/types/requisicao"

export default function RequisicaoPage() {
  const [itens, setItens] = useState<ItemFormData[]>([])
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")

  function handleAddItem(item: ItemFormData) {
    if (editingIndex !== null) {
      const copy = [...itens]
      copy[editingIndex] = item
      setItens(copy)
      setEditingIndex(null)
    } else setItens((current) => [...current, item])
  }

  async function handleEnviarRequisicao() {
    setSubmitError("")
    const rawUser = localStorage.getItem("marcon-user")
    const user = rawUser ? JSON.parse(rawUser) as { id?: number } : null
    if (!user?.id) {
      setSubmitError("Entre na sua conta antes de enviar a requisição.")
      return
    }
    const payload: RequisicaoPayload = {
      solicitanteId: user.id,
      itens: itens.map((it) => ({
        itemNome: it.itemNome,
        setor: it.setor === "Setor 1" ? "setor1" : it.setor === "Setor 2" ? "setor2" : "setor3",
        quantidade: Number(it.quantidade),
        unidadeMedida: it.unidadeMedida,
        descricao: it.descricao,
        prioridade: it.prioridade,
      })),
      createdAt: new Date().toISOString(),
    }
    setIsSubmitting(true)
    try {
      const response = await fetch("/api/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Não foi possível salvar a requisição.")
      alert(`Requisição ${data.numeroPedido} enviada ao almoxarifado.`)
      setItens([])
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Falha ao salvar no MySQL.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return <main className="mx-auto max-w-5xl p-4"><div className="mb-5 flex items-center justify-between gap-3"><h1 className="text-2xl font-semibold text-[#212529]">Nova requisição</h1><Link href="/almoxarifado" className="text-sm font-semibold text-royal">Painel do almoxarifado</Link></div><div className="grid grid-cols-1 gap-6 lg:grid-cols-2"><section className="rounded-lg bg-white p-4 shadow-sm"><h2 className="mb-3 text-lg font-medium">Adicionar item</h2><FormularioItem key={editingIndex ?? "new"} onAdd={handleAddItem} editingItem={editingIndex !== null ? itens[editingIndex] : undefined}/></section><section className="rounded-lg bg-white p-4 shadow-sm"><div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-medium">Resumo da requisição</h2><PriorityBadge priority={itens.some((item) => item.prioridade === "prioridade") ? "prioridade" : "padrao"}/></div><ListaItensRequisicao itens={itens} onEdit={setEditingIndex} onRemove={(index) => { setItens((current) => current.filter((_, itemIndex) => itemIndex !== index)); setEditingIndex(null) }}/><div className="mt-4">{submitError && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{submitError} {submitError.startsWith("Entre") && <Link href="/login" className="font-semibold underline">Entrar</Link>}</p>}<button className="w-full rounded-lg bg-royal py-3 text-white shadow-sm disabled:opacity-50" disabled={!itens.length || isSubmitting} onClick={handleEnviarRequisicao}>{isSubmitting ? "Enviando…" : "Enviar requisição"}</button></div></section></div></main>
}
