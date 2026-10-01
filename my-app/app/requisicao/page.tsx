"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import FormularioItem, { type ItemFormData } from "../components/FormularioItem";
import ListaItensRequisicao from "../components/ListaItensRequisicao";
import PriorityBadge from "../components/PriorityBadge";
import type { RequisicaoPayload } from "../../lib/types/requisicao";

type CreatedRequest = { id: string; numero: number; item: string; quantidade: number; origem: "DEPOSITO" | "ESTOQUE" };

export default function RequisicaoPage() {
  const [itens, setItens] = useState<ItemFormData[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [resultado, setResultado] = useState<CreatedRequest[]>([]);
  const [origemMudou, setOrigemMudou] = useState(false);
  const idempotencyKey = useRef<string | null>(null);

  function handleAddItem(item: ItemFormData) {
    idempotencyKey.current = null;
    setResultado([]);
    setSubmitError("");
    if (editingIndex !== null) {
      setItens((current) => current.map((existing, index) => index === editingIndex ? item : existing));
      setEditingIndex(null);
    } else setItens((current) => [...current, item]);
  }

  async function handleEnviarRequisicao() {
    if (isSubmitting || itens.length === 0) return;
    setSubmitError("");
    setOrigemMudou(false);
    idempotencyKey.current ??= crypto.randomUUID();
    const payload: RequisicaoPayload = {
      itens: itens.map((item) => ({
        itemId: item.itemId,
        setor: item.setor === "Setor 1" ? "setor1" : item.setor === "Setor 2" ? "setor2" : "setor3",
        quantidade: Number(item.quantidade),
        unidadeMedida: item.unidadeMedida,
        descricao: item.descricao,
        prioridade: item.prioridade,
      })),
    };
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey.current },
        body: JSON.stringify(payload),
      });
      const data = await response.json() as { error?: string; requisicoes?: CreatedRequest[] };
      if (!response.ok) throw new Error(data.error || "Não foi possível salvar a requisição.");
      const created = data.requisicoes ?? [];
      setResultado(created);
      setOrigemMudou(created.some((request, index) => {
        const item = itens[index];
        const preview = item.saldoDepositoPrevio >= Number(item.quantidade) ? "DEPOSITO" : "ESTOQUE";
        return request.origem !== preview;
      }));
      setItens([]);
      setEditingIndex(null);
      idempotencyKey.current = null;
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Não foi possível salvar a requisição.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return <main className="mx-auto max-w-5xl p-4">
    <div className="mb-5 flex items-center justify-between gap-3"><h1 className="text-2xl font-semibold text-[#212529]">Nova requisição</h1><Link href="/almoxarifado" className="text-sm font-semibold text-royal">Painel do almoxarifado</Link></div>
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <section className="rounded-lg bg-white p-4 shadow-sm"><h2 className="mb-3 text-lg font-medium">Adicionar item</h2><FormularioItem key={editingIndex ?? "new"} onAdd={handleAddItem} editingItem={editingIndex !== null ? itens[editingIndex] : undefined} /></section>
      <section className="rounded-lg bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-medium">Resumo da requisição</h2><PriorityBadge priority={itens.some((item) => item.prioridade === "prioridade") ? "prioridade" : "padrao"} /></div>
        <ListaItensRequisicao itens={itens} onEdit={(index) => { idempotencyKey.current = null; setEditingIndex(index); }} onRemove={(index) => { idempotencyKey.current = null; setItens((current) => current.filter((_, itemIndex) => itemIndex !== index)); setEditingIndex(null); }} />
        {submitError && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{submitError}</p>}
        {origemMudou && <p role="status" className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">O saldo mudou desde a prévia; a origem foi recalculada no servidor.</p>}
        {resultado.length > 0 && <div role="status" className="mt-4 space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"><p className="font-semibold">Requisição retirada com sucesso.</p>{resultado.map((request) => <p key={request.id}>{request.quantidade} retirados do {request.origem === "DEPOSITO" ? "depósito" : "estoque"} · <Link href={`/almoxarifado/requisicao/${encodeURIComponent(request.id)}`} className="font-semibold underline">#{request.numero}</Link></p>)}</div>}
        <button className="mt-4 min-h-11 w-full rounded-lg bg-royal py-3 font-semibold text-white disabled:cursor-wait disabled:opacity-50" disabled={!itens.length || isSubmitting} onClick={() => void handleEnviarRequisicao()}>{isSubmitting ? "Enviando…" : "Enviar requisição"}</button>
      </section>
    </div>
  </main>;
}