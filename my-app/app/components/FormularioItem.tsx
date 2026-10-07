"use client";

import { useEffect, useState } from "react";
import PriorityBadge from "./PriorityBadge";
import {
  DESCRIPTION_MAX_LENGTH,
  DESCRIPTION_MAX_LENGTH_ERROR,
  limitRequisitionDescriptionInput,
  normalizeRequisitionDescription,
} from "@/lib/requisition-description";

type CatalogItem = {
  id: string;
  nome: string;
  unidade: string;
  quantidade: number;
  reservada: number;
  disponivel: number;
  quantidadeDeposito: number;
};
export type ItemFormData = {
  itemId: string;
  itemNome: string;
  setor: "Setor 1" | "Setor 2" | "Setor 3";
  quantidade: number | string;
  unidadeMedida: string;
  descricao: string;
  prioridade: "padrao" | "prioridade";
  saldoDepositoPrevio: number;
  saldoEstoquePrevio: number;
};

const emptyForm: ItemFormData = {
  itemId: "",
  itemNome: "",
  setor: "Setor 1",
  quantidade: 1,
  unidadeMedida: "un",
  descricao: "",
  prioridade: "padrao",
  saldoDepositoPrevio: 0,
  saldoEstoquePrevio: 0,
};

export default function FormularioItem({
  onAdd,
  editingItem,
}: {
  onAdd: (item: ItemFormData) => void;
  editingItem?: ItemFormData;
}) {
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [catalogError, setCatalogError] = useState("");
  const [form, setForm] = useState<ItemFormData>(editingItem ?? emptyForm);
  const [descriptionInputError, setDescriptionInputError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/estoque", { cache: "no-store" }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Falha ao carregar o estoque.");
      return data.itens as CatalogItem[];
    }).then((items) => { if (active) setCatalogItems(items); })
      .catch((error: unknown) => { if (active) setCatalogError(error instanceof Error ? error.message : "Falha ao carregar o catálogo."); });
    return () => { active = false; };
  }, []);

  const selectedItem = catalogItems.find((item) => item.id === form.itemId);
  const quantity = Number(form.quantidade);
  const validQuantity = Number.isSafeInteger(quantity) && quantity > 0;
  const previewOrigin = selectedItem && validQuantity && selectedItem.disponivel >= quantity
    ? "ESTOQUE"
    : null;
  const insufficientFreeStock = selectedItem && validQuantity && selectedItem.disponivel < quantity;
  const descricaoObrigatoria = form.prioridade === "prioridade";
  const isValid = Boolean(form.itemId && validQuantity && !descriptionInputError && (!descricaoObrigatoria || form.descricao.trim()));

  function update<K extends keyof ItemFormData>(key: K, value: ItemFormData[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return <form onSubmit={(event) => {
    event.preventDefault();
    if (!isValid || !selectedItem) return;
    onAdd({
      ...form,
      itemNome: selectedItem.nome,
      unidadeMedida: selectedItem.unidade,
      descricao: normalizeRequisitionDescription(form.descricao),
      saldoDepositoPrevio: selectedItem.quantidadeDeposito,
      saldoEstoquePrevio: selectedItem.quantidade,
    });
    setDescriptionInputError("");
    setForm(emptyForm);
  }} className="space-y-3">
    <div>
      <label htmlFor="item-requisicao" className="text-sm font-medium text-slate-800">Item do estoque</label>
      <select id="item-requisicao" required value={form.itemId} onChange={(event) => {
        const item = catalogItems.find((entry) => entry.id === event.target.value);
        setForm((current) => ({ ...current, itemId: item?.id ?? "", itemNome: item?.nome ?? "", unidadeMedida: item?.unidade ?? "un", saldoDepositoPrevio: item?.quantidadeDeposito ?? 0, saldoEstoquePrevio: item?.quantidade ?? 0 }));
      }} className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
        <option value="">Escolha um item...</option>
        {catalogItems.map((item) => <option key={item.id} value={item.id}>{item.nome} · {item.disponivel} livre · {item.reservada} reservado</option>)}
      </select>
      {catalogError && <p role="alert" className="mt-1 text-xs text-red-600">{catalogError}</p>}
      {selectedItem && <p className="mt-1 text-xs text-slate-600">
        Estoque físico: {selectedItem.quantidade} {selectedItem.unidade} · Reservado: {selectedItem.reservada} · Livre: {selectedItem.disponivel}
      </p>}
    </div>

    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label className="text-sm font-medium text-slate-800">Setor<select value={form.setor} onChange={(event) => update("setor", event.target.value as ItemFormData["setor"])} className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2"><option>Setor 1</option><option>Setor 2</option><option>Setor 3</option></select></label>
      <label className="text-sm font-medium text-slate-800">Quantidade em {selectedItem?.unidade ?? "unidades"}<input type="number" inputMode="numeric" min={1} step={1} value={String(form.quantidade)} onChange={(event) => update("quantidade", event.target.value === "" ? "" : Number(event.target.value))} className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
    </div>

    <div>
      <span className="text-sm font-medium text-slate-800">Prioridade</span>
      <div className="mt-2 flex gap-2"><button type="button" aria-pressed={form.prioridade === "padrao"} onClick={() => update("prioridade", "padrao")} className={`rounded-lg px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-royal ${form.prioridade === "padrao" ? "ring-2 ring-royal" : "border border-slate-200"}`}><span className="text-sm font-semibold text-slate-700">Padrão</span></button><button type="button" aria-pressed={form.prioridade === "prioridade"} onClick={() => update("prioridade", "prioridade")} className={`rounded-lg px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-royal ${form.prioridade === "prioridade" ? "ring-2 ring-royal" : "border border-slate-200"}`}><PriorityBadge priority="prioridade" /></button></div>
    </div>

    <div>
      <label htmlFor="descricao-requisicao" className="block text-sm font-medium text-slate-800">Descrição / Motivo{descricaoObrigatoria ? " (obrigatória para prioridade)" : " (opcional)"}</label>
      <textarea
        id="descricao-requisicao"
        value={form.descricao}
        maxLength={DESCRIPTION_MAX_LENGTH * 2}
        aria-describedby="descricao-contador descricao-erro"
        aria-invalid={Boolean(descriptionInputError)}
        onChange={(event) => {
          const input = event.target.value.replace(/\r\n?|\n/g, " ");
          setDescriptionInputError(
            Array.from(input).length > DESCRIPTION_MAX_LENGTH
              ? DESCRIPTION_MAX_LENGTH_ERROR
              : "",
          );
          update("descricao", limitRequisitionDescriptionInput(input));
        }}
        rows={3}
        className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2"
      />
      <p id="descricao-contador" aria-live="polite" className="mt-1 text-right text-xs text-slate-600">
        {Array.from(form.descricao).length}/{DESCRIPTION_MAX_LENGTH}
      </p>
      {descriptionInputError && <p id="descricao-erro" role="alert" className="mt-1 text-sm text-red-700">{descriptionInputError}</p>}
      {descricaoObrigatoria && !form.descricao.trim() && <p className="mt-1 text-xs text-amber-800">Informe o motivo do pedido prioritário.</p>}
    </div>

    <div aria-live="polite" className="min-h-12 rounded-lg bg-slate-50 px-3 py-2 text-sm">
      {previewOrigin === "ESTOQUE" && <p className="font-medium text-slate-700">Será atendido pelo estoque.</p>}
      {insufficientFreeStock && <p className="mt-1 text-amber-800">Saldo livre insuficiente: {selectedItem.disponivel} disponível, {quantity} solicitado.</p>}
      {!selectedItem && <p className="text-slate-500">Escolha um item para ver o saldo livre.</p>}
      {selectedItem && !validQuantity && <p className="text-slate-500">Informe uma quantidade inteira positiva.</p>}
    </div>
    <div className="flex gap-3"><button type="submit" disabled={!isValid} className="min-h-11 flex-1 rounded-lg bg-royal py-3 text-white disabled:opacity-50">Adicionar item</button><button type="button" onClick={() => { setForm(emptyForm); setDescriptionInputError(""); }} className="min-h-11 flex-1 rounded-lg border border-slate-300 py-3">Limpar</button></div>
  </form>;
}