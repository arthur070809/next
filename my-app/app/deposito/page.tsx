"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { KeyboardEvent, useEffect, useRef, useState } from "react";
import styles from "./deposito.module.css";
import { MANUAL_DEPOSIT_REASONS, MAX_MANUAL_DEPOSIT_QUANTITY } from "@/lib/deposito-constants";

type DepositoItem = { id: string; nome: string; codigo: string | null; categoria: string; quantidade: number; ultimaMovimentacaoEm: string | null };
type Movement = {
  id: string;
  tipo: "SAIDA_REQUISICAO" | "ENTRADA_SOBRA" | "ENTRADA_MANUAL" | "AJUSTE";
  quantidade: number;
  saldoDepois: number;
  criadoEm: string;
  motivo: string | null;
  item: { id: string; nome: string; codigo: string | null };
  usuario: { nome: string };
  requisicao: { id: string; numero: number } | null;
};
type Adjustment = { id: string; nome: string; quantidade: number };
type StockOption = { id: string; nome: string; codigo: string | null; categoria: string; unidade: string; quantidade: number; quantidadeDeposito: number };
type RequestPreview = { id: string; numero: number; item: string; estoqueItemId: string | null; quantidade: number; qtdDevolvida: number; status: string };
type RequestLookup = { numero: number | null; loading: boolean; error: string; requisicao: RequestPreview | null };

const tabNames = ["saldos", "historico"] as const;
type Tab = typeof tabNames[number];
const typeLabels = { SAIDA_REQUISICAO: "Saída por requisição", ENTRADA_SOBRA: "Entrada de sobra", ENTRADA_MANUAL: "Entrada manual", AJUSTE: "Ajuste" };
const dateLabel = (value: string | null) => value ? new Date(value).toLocaleString("pt-BR") : "Sem movimentações";

export default function DepositoPage() {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin/");
  const estoquePrefix = isAdmin ? "/admin" : pathname.startsWith("/almoxarifado/") ? "/almoxarifado" : "";
  const estoqueHref = `${estoquePrefix}/estoque`;
  const requisicaoPrefix = isAdmin ? "/admin/requisicao" : "/almoxarifado/requisicao";
  const [tab, setTab] = useState<Tab>("saldos");
  const [itens, setItens] = useState<DepositoItem[]>([]);
  const [movimentacoes, setMovimentacoes] = useState<Movement[]>([]);
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState("");
  const [usuario, setUsuario] = useState("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [mostrarZerados, setMostrarZerados] = useState(false);
  const [reloadCounter, setReloadCounter] = useState(0);
  const [fetchState, setFetchState] = useState({ key: "", error: "" });
  const [mutationError, setMutationError] = useState("");
  const [adjustment, setAdjustment] = useState<Adjustment | null>(null);
  const [adjustmentQuantity, setAdjustmentQuantity] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [entryOpen, setEntryOpen] = useState(false);
  const [entryItems, setEntryItems] = useState<StockOption[]>([]);
  const [entryCatalogLoaded, setEntryCatalogLoaded] = useState(false);
  const [entryLoading, setEntryLoading] = useState(false);
  const [entrySaving, setEntrySaving] = useState(false);
  const [entryError, setEntryError] = useState("");
  const [entrySearch, setEntrySearch] = useState("");
  const [entryItemId, setEntryItemId] = useState("");
  const [entryListOpen, setEntryListOpen] = useState(false);
  const [entryActiveIndex, setEntryActiveIndex] = useState(-1);
  const [entryQuantity, setEntryQuantity] = useState("");
  const [entryRequisition, setEntryRequisition] = useState("");
  const [entryRequestLookup, setEntryRequestLookup] = useState<RequestLookup | null>(null);
  const [entryReason, setEntryReason] = useState("");
  const [entryObservation, setEntryObservation] = useState("");
  const entryKey = useRef<string | null>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const fetchKey = JSON.stringify([tab, busca, mostrarZerados, tipo, usuario, inicio, fim, pagina, reloadCounter]);
  const carregando = fetchState.key !== fetchKey;
  const erro = fetchState.key === fetchKey ? fetchState.error : mutationError;
  const selectedEntryItem = entryItems.find((item) => item.id === entryItemId);
  const entryLabel = (item: StockOption) => `${item.codigo ? `${item.codigo} · ` : ""}${item.nome} · ${item.categoria}`;
  const entryMatches = entryItems.filter((item) => !entrySearch.trim() || `${item.codigo ?? ""} ${item.nome} ${item.categoria}`.toLowerCase().includes(entrySearch.trim().toLowerCase()));
  const selectedEntryQuantity = Number(entryQuantity);
  const entryHasRequest = entryRequisition.trim() !== "";
  const requestedNumber = entryHasRequest ? Number(entryRequisition) : null;
  const requestNumberValid = requestedNumber !== null && Number.isSafeInteger(requestedNumber) && requestedNumber > 0;
  const matchingRequestLookup = entryRequestLookup?.numero === requestedNumber ? entryRequestLookup : null;
  const previewedRequest = matchingRequestLookup?.requisicao ?? null;
  const requestItemMismatch = Boolean(previewedRequest && selectedEntryItem && previewedRequest.estoqueItemId !== selectedEntryItem.id);
  const validRequest = Boolean(previewedRequest && previewedRequest.status === "RETIRADA" && selectedEntryItem && !requestItemMismatch);
  const remainingRequestAmount = previewedRequest ? previewedRequest.quantidade - previewedRequest.qtdDevolvida : 0;
  const requestError = !entryHasRequest ? "" : !requestNumberValid
    ? "Informe um número inteiro de requisição válido."
    : !matchingRequestLookup || matchingRequestLookup.loading
      ? "Verificando requisição…"
      : matchingRequestLookup.error
        ? matchingRequestLookup.error
        : requestItemMismatch
          ? `A requisição #${previewedRequest?.numero} é do item ${previewedRequest?.item}; selecione esse item.`
          : previewedRequest?.status !== "RETIRADA"
            ? `A requisição #${previewedRequest?.numero} do item ${previewedRequest?.item} ainda não foi retirada ou foi cancelada.`
            : "";
  const entryQuantityLimit = validRequest ? remainingRequestAmount : selectedEntryItem?.quantidade ?? 0;
  const entryQuantityValid = Number.isSafeInteger(selectedEntryQuantity) && selectedEntryQuantity > 0 && selectedEntryQuantity <= MAX_MANUAL_DEPOSIT_QUANTITY;
  const entryProjectionValid = entryQuantityValid && selectedEntryQuantity <= entryQuantityLimit;
  const projectedEntryBalance = selectedEntryItem && entryProjectionValid ? selectedEntryItem.quantidadeDeposito + selectedEntryQuantity : null;
  const projectedStockBalance = selectedEntryItem && entryProjectionValid
    ? validRequest ? selectedEntryItem.quantidade : selectedEntryItem.quantidade - selectedEntryQuantity
    : null;
  const entryBlockReason = !selectedEntryItem
    ? "Selecione um item do estoque."
    : !entryQuantityValid
      ? `Informe uma quantidade inteira entre 1 e ${MAX_MANUAL_DEPOSIT_QUANTITY.toLocaleString("pt-BR")}.`
      : entryHasRequest && !validRequest
        ? requestError
        : selectedEntryQuantity > entryQuantityLimit
          ? validRequest
            ? `Só é possível devolver até ${remainingRequestAmount} unidades desta requisição.`
            : `Saldo insuficiente no estoque. Disponível: ${selectedEntryItem.quantidade}.`
          : !entryHasRequest && !entryReason
            ? "Selecione o motivo da entrada."
            : !entryHasRequest && entryReason === MANUAL_DEPOSIT_REASONS.OUTRO && !entryObservation.trim()
              ? "Descreva o motivo da entrada."
              : entrySaving ? "Adicionando sobra…" : "";

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      if (!entryHasRequest) {
        setEntryRequestLookup(null);
        return;
      }
      if (!requestNumberValid || requestedNumber === null) {
        setEntryRequestLookup({ numero: null, loading: false, error: "Informe um número inteiro de requisição válido.", requisicao: null });
        return;
      }
      setEntryRequestLookup({ numero: requestedNumber, loading: true, error: "", requisicao: null });
      try {
        const response = await fetch(`/api/requests?numero=${requestedNumber}`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Não foi possível verificar a requisição.");
        if (active) setEntryRequestLookup({ numero: requestedNumber, loading: false, error: "", requisicao: data.requisicao as RequestPreview });
      } catch (cause) {
        if (active) setEntryRequestLookup({ numero: requestedNumber, loading: false, error: cause instanceof Error ? cause.message : "Não foi possível verificar a requisição.", requisicao: null });
      }
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [entryHasRequest, entryRequisition, requestNumberValid, requestedNumber]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const url = new URL(window.location.href);
      const initialTab = url.searchParams.get("aba");
      const itemName = url.searchParams.get("item");
      const nextTab: Tab = itemName ? "historico" : initialTab === "historico" ? "historico" : "saldos";
      setTab(nextTab);
      if (itemName) setBusca(itemName);
      url.searchParams.set("aba", nextTab);
      window.history.replaceState(null, "", url);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let active = true;
    if (tab === "saldos") {
      const params = new URLSearchParams({ q: busca, zerados: String(mostrarZerados) });
      fetch(`/api/deposito?${params}`, { cache: "no-store" })
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) throw new Error(data.error ?? "Não foi possível carregar os saldos.");
          return data.itens as DepositoItem[];
        })
        .then((data) => { if (active) { setItens(data); setFetchState({ key: fetchKey, error: "" }); } })
        .catch((cause) => { if (active) setFetchState({ key: fetchKey, error: cause instanceof Error ? cause.message : "Não foi possível carregar os saldos." }); });
    } else {
      const params = new URLSearchParams({ page: String(pagina) });
      if (busca) params.set("item", busca);
      if (tipo) params.set("tipo", tipo);
      if (usuario) params.set("usuario", usuario);
      if (inicio) params.set("inicio", inicio);
      if (fim) params.set("fim", fim);
      fetch(`/api/deposito/historico?${params}`, { cache: "no-store" })
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) throw new Error(data.error ?? "Não foi possível carregar o histórico.");
          return data as { movimentacoes: Movement[]; totalPaginas: number };
        })
          .then((data) => { if (active) { setMovimentacoes(data.movimentacoes); setTotalPaginas(data.totalPaginas); setFetchState({ key: fetchKey, error: "" }); } })
          .catch((cause) => { if (active) setFetchState({ key: fetchKey, error: cause instanceof Error ? cause.message : "Não foi possível carregar o histórico." }); });
    }
    return () => { active = false; };
        }, [tab, busca, mostrarZerados, tipo, usuario, inicio, fim, pagina, fetchKey]);

  function changeTab(nextTab: Tab) {
    setTab(nextTab);
    setFeedback("");
    const url = new URL(window.location.href);
    url.searchParams.set("aba", nextTab);
    if (nextTab !== "historico") url.searchParams.delete("item");
    window.history.replaceState(null, "", url);
  }

  function handleTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const offset = event.key === "ArrowRight" ? 1 : -1;
    const next = (index + offset + tabNames.length) % tabNames.length;
    changeTab(tabNames[next]);
    tabRefs.current[next]?.focus();
  }

  function selectEntryItem(item: StockOption) {
    setEntryItemId(item.id);
    setEntrySearch(entryLabel(item));
    setEntryListOpen(false);
    setEntryActiveIndex(-1);
    entryKey.current = null;
  }

  async function openEntryForm() {
    setEntryOpen(true);
    setEntryError("");
    setEntrySearch("");
    setEntryItemId("");
    setEntryListOpen(false);
    setEntryActiveIndex(-1);
    setEntryQuantity("");
    setEntryRequisition("");
    setEntryRequestLookup(null);
    setEntryReason("");
    setEntryObservation("");
    entryKey.current = null;
    if (entryCatalogLoaded) return;
    setEntryLoading(true);
    try {
      const response = await fetch("/api/estoque", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Não foi possível carregar os itens do estoque.");
      setEntryItems(data.itens as StockOption[]);
      setEntryCatalogLoaded(true);
    } catch (cause) {
      setEntryError(cause instanceof Error ? cause.message : "Não foi possível carregar os itens do estoque.");
    } finally {
      setEntryLoading(false);
    }
  }

  async function submitEntry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (entrySaving) return;
    if (entryBlockReason) {
      setEntryError(entryBlockReason);
      return;
    }
    if (!selectedEntryItem || !entryQuantityValid) return;
    entryKey.current ??= crypto.randomUUID();
    setEntrySaving(true);
    setEntryError("");
    try {
      const response = await fetch("/api/deposito/entrada-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": entryKey.current },
        body: JSON.stringify({
          itemId: selectedEntryItem.id,
          quantidade: selectedEntryQuantity,
          requisicaoNumero: entryHasRequest ? requestedNumber : null,
          ...(!validRequest ? { motivo: entryReason, observacao: entryObservation.trim() } : {}),
        }),
      });
      const data = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(data.error ?? "Não foi possível adicionar a sobra ao depósito.");
      setFeedback(data.message ?? "Sobra adicionada ao depósito.");
      setEntryOpen(false);
      setEntryCatalogLoaded(false);
      setEntryItems([]);
      entryKey.current = null;
      setReloadCounter((current) => current + 1);
    } catch (cause) {
      setEntryError(cause instanceof Error ? cause.message : "Não foi possível adicionar a sobra ao depósito.");
    } finally {
      setEntrySaving(false);
    }
  }

  async function saveAdjustment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!adjustment || saving) return;
    setSaving(true);
    setMutationError("");
    try {
      const response = await fetch("/api/deposito/ajuste", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: adjustment.id, quantidade: Number(adjustmentQuantity), motivo: adjustmentReason }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Não foi possível ajustar o saldo.");
      setFeedback(`Saldo ajustado: ${data.ajuste.saldoAntes} → ${data.ajuste.saldoDepois} un.`);
      setAdjustment(null);
      setTab("saldos");
      setMostrarZerados(true);
    } catch (cause) {
      setMutationError(cause instanceof Error ? cause.message : "Não foi possível ajustar o saldo.");
    } finally {
      setSaving(false);
    }
  }

  const openHistory = (item: DepositoItem) => {
    setBusca(item.nome);
    setPagina(1);
    changeTab("historico");
    const url = new URL(window.location.href);
    url.searchParams.set("aba", "historico");
    url.searchParams.set("item", item.nome);
    window.history.replaceState(null, "", url);
  };

  return <main className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-7xl flex-col px-4 py-6 sm:px-8">
    <header className="border-b border-slate-200 pb-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-royal">Almoxarifado Marcon</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-slate-950">Depósito de sobras</h1><p className="mt-1 text-sm text-slate-600">Saldos avulsos disponíveis para retirada na produção.</p></div>
        <Link href={estoqueHref} className="rounded-lg border border-royal px-3 py-2 text-sm font-semibold text-royal hover:bg-blue-50">Estoque principal</Link>
      </div>
    </header>

    <div role="tablist" aria-label="Visualização do depósito" className="mt-5 flex border-b border-slate-200">
      {tabNames.map((name, index) => <button key={name} ref={(element) => { tabRefs.current[index] = element; }} id={`tab-${name}`} type="button" role="tab" aria-selected={tab === name} aria-controls={`panel-${name}`} tabIndex={tab === name ? 0 : -1} onKeyDown={(event) => handleTabKey(event, index)} onClick={() => changeTab(name)} className={`min-h-11 border-b-2 px-4 text-sm font-semibold capitalize focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal ${tab === name ? "border-royal text-royal" : "border-transparent text-slate-500 hover:text-slate-800"}`}>{name}</button>)}
    </div>

    {feedback && <p role="status" className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{feedback}</p>}
    {erro && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}

    {tab === "saldos" ? <section id="panel-saldos" role="tabpanel" aria-labelledby="tab-saldos" className="min-h-0 flex-1 pt-4">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <label className="block flex-1 text-sm font-medium text-slate-700">Buscar item<input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Código ou descrição" className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-royal focus:ring-2 focus:ring-royal/20" /></label>
        <div className="flex flex-wrap items-center gap-3"><label className="inline-flex min-h-10 items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={mostrarZerados} onChange={(event) => setMostrarZerados(event.target.checked)} className="h-4 w-4 accent-[#4169E1]" />Mostrar zerados</label><button type="button" onClick={() => void openEntryForm()} className="min-h-10 rounded-lg bg-royal px-4 text-sm font-semibold text-white hover:bg-blue-700">Adicionar sobra</button></div>
      </div>
      {carregando ? <p role="status" className="py-10 text-center text-sm text-slate-500">Carregando saldos…</p> : itens.length === 0 ? <div role="status" className="my-6 rounded-lg border border-dashed border-slate-300 bg-white px-5 py-8 text-center"><p className="font-semibold text-slate-800">{!busca && !mostrarZerados ? "O depósito ainda não tem saldo disponível." : "Nenhum item encontrado com este filtro."}</p><p className="mt-1 text-sm text-slate-500">Pesquise qualquer item do estoque ou registre uma sobra para iniciar o saldo.</p><button type="button" onClick={() => void openEntryForm()} className="mt-4 min-h-10 rounded-lg bg-royal px-4 text-sm font-semibold text-white hover:bg-blue-700">Adicionar sobra</button></div> : <div className="divide-y divide-slate-200">
        {itens.map((item) => <article key={item.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0"><p className="font-semibold text-slate-900">{item.nome}</p><p className="mt-1 text-sm text-slate-500">{item.codigo ? `${item.codigo} · ` : ""}{item.categoria}</p><p className="mt-1 text-xs text-slate-500">Última movimentação: {dateLabel(item.ultimaMovimentacaoEm)}</p></div>
          <div className="flex flex-wrap items-center gap-3"><span className="min-w-24 text-sm font-bold text-emerald-800">{item.quantidade} un</span><button type="button" onClick={() => openHistory(item)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Histórico</button>{isAdmin && <button type="button" onClick={() => { setAdjustment(item); setAdjustmentQuantity(String(item.quantidade)); setAdjustmentReason(""); }} className="rounded-lg bg-royal px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">Ajustar saldo</button>}</div>
        </article>)}
      </div>}
    </section> : <section id="panel-historico" role="tabpanel" aria-labelledby="tab-historico" className="min-h-0 flex-1 pt-4">
      <div className="grid gap-3 border-b border-slate-200 pb-4 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-sm font-medium text-slate-700">Item<input value={busca} onChange={(event) => { setBusca(event.target.value); setPagina(1); }} placeholder="Código ou descrição" className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-royal" /></label>
        <label className="text-sm font-medium text-slate-700">Tipo<select value={tipo} onChange={(event) => { setTipo(event.target.value); setPagina(1); }} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2"><option value="">Todos</option><option value="ENTRADA_SOBRA">Entrada de sobra</option><option value="ENTRADA_MANUAL">Entrada manual</option><option value="SAIDA_REQUISICAO">Saída por requisição</option><option value="AJUSTE">Ajuste</option></select></label>
        <label className="text-sm font-medium text-slate-700">De<input type="date" value={inicio} onChange={(event) => { setInicio(event.target.value); setPagina(1); }} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
        <label className="text-sm font-medium text-slate-700">Até<input type="date" value={fim} onChange={(event) => { setFim(event.target.value); setPagina(1); }} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
        <label className="text-sm font-medium text-slate-700">Usuário<input value={usuario} onChange={(event) => { setUsuario(event.target.value); setPagina(1); }} placeholder="Nome" className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
      </div>
      {carregando ? <p role="status" className="py-10 text-center text-sm text-slate-500">Carregando histórico…</p> : movimentacoes.length === 0 ? <p className="py-10 text-center text-sm text-slate-500">Nenhuma movimentação encontrada.</p> : <>
        <div className="divide-y divide-slate-200">
          {movimentacoes.map((movement) => <article key={movement.id} className={`grid gap-2 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center ${movement.tipo === "ENTRADA_MANUAL" ? styles.manualMovement : ""}`}>
            <div><p className="font-semibold text-slate-900">{movement.item.nome}</p><p className="mt-1 text-sm text-slate-600">{typeLabels[movement.tipo]} · {movement.quantidade} un · saldo após: {movement.saldoDepois}</p><p className="mt-1 text-xs text-slate-500">{movement.usuario.nome} · {dateLabel(movement.criadoEm)}{movement.motivo ? ` · ${movement.motivo}` : ""}</p></div>
            {movement.requisicao ? <Link href={`${requisicaoPrefix}/${encodeURIComponent(movement.requisicao.id)}`} className="text-sm font-semibold text-royal hover:underline">#{movement.requisicao.numero}</Link> : <span className="text-xs text-slate-400">Sem requisição</span>}
          </article>)}
        </div>
        <nav aria-label="Paginação do histórico" className="flex items-center justify-between border-t border-slate-200 py-4 text-sm"><span>Página {pagina} de {totalPaginas}</span><div className="flex gap-2"><button type="button" disabled={pagina <= 1 || carregando} onClick={() => setPagina((current) => current - 1)} className="rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-40">Anterior</button><button type="button" disabled={pagina >= totalPaginas || carregando} onClick={() => setPagina((current) => current + 1)} className="rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-40">Próxima</button></div></nav>
      </>}
    </section>}

    {entryOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4"><section role="dialog" aria-modal="true" aria-labelledby="entry-title" className={`${styles.entryDialog} rounded-xl bg-white p-5 shadow-xl`}>
      <div className="mb-4 flex items-start justify-between gap-4"><div><h2 id="entry-title" className="text-lg font-bold text-slate-950">Adicionar sobra</h2><p className="mt-1 text-sm text-slate-600">Entrada manual de até {MAX_MANUAL_DEPOSIT_QUANTITY.toLocaleString("pt-BR")} unidades por operação.</p></div><button type="button" aria-label="Fechar" onClick={() => setEntryOpen(false)} disabled={entrySaving} className="rounded-md border border-slate-300 px-3 py-1 text-slate-700">Fechar</button></div>
      {entryLoading ? <p role="status" className="py-8 text-center text-sm text-slate-500">Carregando itens do estoque…</p> : <form onSubmit={(event) => void submitEntry(event)} className={styles.entryForm}>
        <div className={`${styles.entryField} text-sm font-medium text-slate-800`}>
          <label htmlFor="entry-item">Item do estoque</label>
          <div className={styles.entryCombobox}>
            <input id="entry-item" role="combobox" aria-autocomplete="list" aria-haspopup="listbox" aria-expanded={entryListOpen} aria-controls="entry-item-options" aria-activedescendant={entryListOpen && entryActiveIndex >= 0 ? `entry-option-${entryMatches[entryActiveIndex]?.id}` : undefined} autoComplete="off" value={entrySearch} onFocus={() => setEntryListOpen(true)} onBlur={() => window.setTimeout(() => setEntryListOpen(false), 100)} onChange={(event) => {
              setEntrySearch(event.target.value);
              setEntryItemId("");
              setEntryListOpen(true);
              setEntryActiveIndex(0);
              entryKey.current = null;
            }} onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setEntryListOpen(true);
                setEntryActiveIndex((current) => Math.min(current + 1, entryMatches.length - 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setEntryActiveIndex((current) => Math.max(current - 1, 0));
              } else if (event.key === "Enter" && entryListOpen && entryActiveIndex >= 0 && entryMatches[entryActiveIndex]) {
                event.preventDefault();
                selectEntryItem(entryMatches[entryActiveIndex]);
              } else if (event.key === "Escape") {
                setEntryListOpen(false);
                setEntryActiveIndex(-1);
              }
            }} placeholder="Buscar por código ou descrição" />
            <div id="entry-item-options" role="listbox" aria-label="Itens do estoque" hidden={!entryListOpen} className={styles.entryOptionList}>{entryListOpen && (entryMatches.length === 0 ? <p className="px-3 py-2 text-sm text-slate-500">Nenhum item encontrado.</p> : entryMatches.map((item, index) => <div key={item.id} id={`entry-option-${item.id}`} role="option" aria-selected={entryActiveIndex === index} onMouseDown={(event) => event.preventDefault()} onClick={() => selectEntryItem(item)} className={`${styles.entryOption} ${entryActiveIndex === index ? styles.entryOptionActive : ""}`}><span>{entryLabel(item)}</span><small>Depósito {item.quantidadeDeposito} · estoque {item.quantidade}</small></div>))}</div>
          </div>
        </div>
        {selectedEntryItem && <div className="grid gap-2 rounded-lg bg-slate-50 p-3 text-sm sm:grid-cols-2"><p>Saldo atual no depósito: <strong>{selectedEntryItem.quantidadeDeposito}</strong></p><p>Saldo no estoque: <strong>{selectedEntryItem.quantidade}</strong></p></div>}
        <label htmlFor="entry-quantity" className={`${styles.entryField} text-sm font-medium text-slate-800`}>Quantidade
          <input id="entry-quantity" type="number" inputMode="numeric" min={1} max={entryQuantityLimit} step={1} required value={entryQuantity} onChange={(event) => { setEntryQuantity(event.target.value); entryKey.current = null; }} />
        </label>
        <label htmlFor="entry-requisition" className={`${styles.entryField} text-sm font-medium text-slate-800`}>Requisição de origem (opcional)
          <input id="entry-requisition" type="number" inputMode="numeric" min={1} step={1} value={entryRequisition} onChange={(event) => { setEntryRequisition(event.target.value); setEntryRequestLookup(null); entryKey.current = null; }} placeholder="Número da requisição" />
        </label>
        {entryHasRequest && <div className="flex flex-wrap items-center justify-between gap-2">{requestError && <p role="status" className="text-sm text-amber-800">{requestError}</p>}<button type="button" onClick={() => { setEntryRequisition(""); setEntryRequestLookup(null); entryKey.current = null; }} className="text-sm font-semibold text-royal underline">Limpar requisição</button></div>}
        {!validRequest && <>
          <label htmlFor="entry-reason" className={`${styles.entryField} text-sm font-medium text-slate-800`}>Motivo
            <select id="entry-reason" required value={entryReason} onChange={(event) => { setEntryReason(event.target.value); entryKey.current = null; }}><option value="">Selecione o motivo</option>{Object.values(MANUAL_DEPOSIT_REASONS).map((reason) => <option key={reason} value={reason}>{reason}</option>)}</select>
          </label>
          {entryReason === MANUAL_DEPOSIT_REASONS.OUTRO && <label htmlFor="entry-observation" className={`${styles.entryField} text-sm font-medium text-slate-800`}>Observação (até 160 caracteres)
            <textarea id="entry-observation" required maxLength={160} rows={2} value={entryObservation} onChange={(event) => { setEntryObservation(event.target.value); entryKey.current = null; }} />
          </label>}
        </>}
        <p aria-live="polite" className={styles.entrySummary}>{selectedEntryItem && projectedEntryBalance !== null && entryQuantityValid ? `Estoque: ${selectedEntryItem.quantidade} → ${projectedStockBalance}${validRequest ? " (sem alteração)" : ""} · Depósito: ${selectedEntryItem.quantidadeDeposito} → ${projectedEntryBalance}` : "Selecione um item e uma quantidade válida para ver o resumo."}</p>
        {entryBlockReason && <p id="entry-form-hint" role="status" className="text-sm text-amber-800">{entryBlockReason}</p>}
        {entryError && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{entryError}</p>}
        <div className="flex justify-end gap-2"><button type="button" disabled={entrySaving} onClick={() => setEntryOpen(false)} className="min-h-10 rounded-lg border border-slate-300 px-4 text-sm">Cancelar</button><button type="submit" disabled={Boolean(entryBlockReason)} aria-describedby={entryBlockReason ? "entry-form-hint" : undefined} className="min-h-10 rounded-lg bg-royal px-4 text-sm font-semibold text-white disabled:opacity-50">{entrySaving ? "Adicionando…" : "Adicionar sobra"}</button></div>
      </form>}
    </section></div>}

    {adjustment && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4"><form role="dialog" aria-modal="true" aria-labelledby="adjust-title" onSubmit={(event) => void saveAdjustment(event)} className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
      <h2 id="adjust-title" className="text-lg font-bold text-slate-950">Ajustar saldo</h2><p className="mt-1 text-sm text-slate-600">{adjustment.nome}</p>
      <label className="mt-4 block text-sm font-medium text-slate-700">Quantidade contada<input autoFocus type="number" inputMode="numeric" min={0} step={1} required value={adjustmentQuantity} onChange={(event) => setAdjustmentQuantity(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
      <label className="mt-3 block text-sm font-medium text-slate-700">Motivo<input required maxLength={200} value={adjustmentReason} onChange={(event) => setAdjustmentReason(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
      <div className="mt-5 flex justify-end gap-2"><button type="button" disabled={saving} onClick={() => setAdjustment(null)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">Cancelar</button><button type="submit" disabled={saving} className="rounded-lg bg-royal px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Salvando…" : "Registrar ajuste"}</button></div>
    </form></div>}
  </main>;
}