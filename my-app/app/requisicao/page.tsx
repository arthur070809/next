"use client";

import { useRef, useState } from "react";
import FormularioItem, { type ItemFormData } from "../components/FormularioItem";
import ListaItensRequisicao from "../components/ListaItensRequisicao";
import PriorityBadge from "../components/PriorityBadge";
import { Button, Card, ErrorState, Toast } from "../components/ui";
import { PageHeader } from "../components/industrial";
import type { RequisicaoPayload } from "../../lib/types/requisicao";

type CreatedRequest = { numeroPedido: string; totalItens: number };

export default function RequisicaoPage() {
  const [itens, setItens] = useState<ItemFormData[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [resultado, setResultado] = useState<CreatedRequest[]>([]);
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
        numeroPedido?: string;
        requisicao?: { itens?: unknown[] };
      };
      if (!response.ok) throw new Error(data.error || "Não foi possível salvar a requisição.");
      if (!data.numeroPedido) throw new Error("A requisição foi enviada, mas o servidor não retornou o número do pedido.");
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

  return <main className="min-w-0">
    <PageHeader eyebrow="Área do operador" title="Nova requisição" description="Monte o pedido de materiais para atendimento pelo almoxarifado." />
    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <Card className="min-w-0 p-4 sm:p-6"><h2 className="mb-4 text-lg font-semibold">Adicionar item</h2><FormularioItem key={editingIndex ?? "new"} onAdd={handleAddItem} editingItem={editingIndex !== null ? itens[editingIndex] : undefined} /></Card>
      <Card className="min-w-0 p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Resumo da requisição</h2><PriorityBadge priority={itens.some((item) => item.prioridade === "prioridade") ? "prioridade" : "padrao"} /></div>
        <ListaItensRequisicao itens={itens} onEdit={(index) => { idempotencyKey.current = null; setEditingIndex(index); }} onRemove={(index) => { idempotencyKey.current = null; setItens((current) => current.filter((_, itemIndex) => itemIndex !== index)); setEditingIndex(null); }} />
        {submitError && <div className="mt-4"><ErrorState message={submitError} onRetry={() => void handleEnviarRequisicao()} /></div>}
        {resultado.map((request) => <div key={request.numeroPedido} className="mt-4"><Toast tone="success" message={`Requisição #${request.numeroPedido} enviada. ${request.totalItens} ${request.totalItens === 1 ? "item aguardando" : "itens aguardando"} atendimento.`} /></div>)}
        <Button className="mt-4 w-full" disabled={!itens.length} loading={isSubmitting} loadingLabel="Enviando requisição…" onClick={() => void handleEnviarRequisicao()}>Enviar requisição</Button>
      </Card>
    </div>
  </main>;
}