"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import FormularioItem, { type CatalogItem, type ItemFormData } from "../components/FormularioItem";
import ListaItensRequisicao from "../components/ListaItensRequisicao";
import PriorityBadge from "../components/PriorityBadge";
import type { RequisicaoPayload } from "../../lib/types/requisicao";
import { startVisibilityPolling } from "../../lib/visibility-polling";

type CreatedRequest = { numeroPedido: string; totalItens: number };

export default function RequisicaoPage() {
  const [itens, setItens] = useState<ItemFormData[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [resultado, setResultado] = useState<CreatedRequest[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [catalogError, setCatalogError] = useState("");
  const idempotencyKey = useRef<string | null>(null);

  const refreshStock = useCallback(async () => {
    try {
      const response = await fetch("/api/requests/stock", { cache: "no-store" });
      const data = await response.json() as { error?: string; items?: CatalogItem[] };
      if (!response.ok) throw new Error(data.error ?? "Não foi possível consultar o saldo.");
      setCatalogItems(data.items ?? []);
      setCatalogError("");
    } catch (error) {
      setCatalogError(error instanceof Error ? error.message : "Não foi possível consultar o saldo.");
    }
  }, []);

  useEffect(
    () => startVisibilityPolling(document, () => { void refreshStock(); }, 10_000),
    [refreshStock],
  );

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
      const data = await response.json() as {
        error?: string;
        code?: string;
        disponivel?: number;
        numeroPedido?: string;
        requisicao?: { itens?: unknown[] };
      };
      if (!response.ok) {
        if (response.status === 409 && data.code === "SALDO_INSUFICIENTE") {
          await refreshStock();
          throw new Error(data.error || `Saldo livre mudou: agora há ${data.disponivel ?? 0}. Atualize a quantidade e tente novamente.`);
        }
        throw new Error(data.error || "Não foi possível salvar a requisição.");
      }
      if (!data.numeroPedido) throw new Error("A requisição foi enviada, mas o servidor não retornou o número do pedido.");
      await refreshStock();
      setResultado([{ numeroPedido: data.numeroPedido, totalItens: data.requisicao?.itens?.length ?? itens.length }]);
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
    <div className="mb-5"><h1 className="text-2xl font-semibold text-[#212529]">Nova requisição</h1><p className="mt-1 text-sm text-slate-600">Envie seu pedido para atendimento pelo almoxarifado.</p></div>
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <section className="rounded-lg bg-white p-4 shadow-sm"><h2 className="mb-3 text-lg font-medium">Adicionar item</h2><FormularioItem key={editingIndex ?? "new"} catalogItems={catalogItems} catalogError={catalogError} onAdd={handleAddItem} editingItem={editingIndex !== null ? itens[editingIndex] : undefined} /></section>
      <section className="rounded-lg bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-medium">Resumo da requisição</h2><PriorityBadge priority={itens.some((item) => item.prioridade === "prioridade") ? "prioridade" : "padrao"} /></div>
        <ListaItensRequisicao itens={itens} catalogItems={catalogItems} onEdit={(index) => { idempotencyKey.current = null; setEditingIndex(index); }} onRemove={(index) => { idempotencyKey.current = null; setItens((current) => current.filter((_, itemIndex) => itemIndex !== index)); setEditingIndex(null); }} />
        {submitError && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{submitError}</p>}
        {resultado.length > 0 && <div role="status" className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"><p className="font-semibold">Requisição enviada ao almoxarifado.</p>{resultado.map((request) => <p key={request.numeroPedido} className="mt-1">Pedido #{request.numeroPedido} · {request.totalItens} {request.totalItens === 1 ? "item" : "itens"} aguardando atendimento.</p>)}</div>}
        <button className="mt-4 min-h-11 w-full rounded-lg bg-royal py-3 font-semibold text-white disabled:cursor-wait disabled:opacity-50" disabled={!itens.length || isSubmitting} onClick={() => void handleEnviarRequisicao()}>{isSubmitting ? "Enviando…" : "Enviar requisição"}</button>
      </section>
    </div>
  </main>;
}