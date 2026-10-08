"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { KeyboardEvent, useEffect, useRef, useState } from "react";
import styles from "./deposito.module.css";
import { MANUAL_DEPOSIT_REASONS, MAX_MANUAL_DEPOSIT_QUANTITY } from "@/lib/deposito-constants";
import DepositoBalanceContent from "./DepositoBalanceContent";
import { Button, EmptyState, ErrorState, LoadingState } from "../components/ui";

type DepositoItem = { id: string; nome: string; codigo: string | null; categoria: string; quantidade: number; ultimaMovimentacaoEm: string | null };
type Movement = {
  id: string;
  tipo: "SAIDA_REQUISICAO" | "SAIDA_REAPROVEITAMENTO" | "ENTRADA_SOBRA" | "ENTRADA_MANUAL" | "AJUSTE";
  quantidade: number;
  saldoDepois: number;
  criadoEm: string;
  motivo: string | null;
  item: { id: string; nome: string; codigo: string | null };
  usuario: { nome: string };
  requisicao: { id: string; numero: number } | null;
};
type Adjustment = { id: string; nome: string; quantidade: number };
type Withdrawal = { id: string; nome: string; quantidade: number };
type StockOption = { id: string; nome: string; codigo: string | null; categoria: string; unidade: string; quantidade: number; disponivel: number; quantidadeDeposito: number };
type RequestPreview = { id: string; numero: string; item: string; estoqueItemId: string | null; quantidade: number; qtdDevolvida: number; status: string };
type RequestLookup = { numero: string | null; loading: boolean; error: string; requisicao: RequestPreview | null };

const tabNames = ["saldos", "historico"] as const;
type Tab = typeof tabNames[number];
const typeLabels = { SAIDA_REQUISICAO: "Saída por requisição", SAIDA_REAPROVEITAMENTO: "Retirada para reaproveitamento", ENTRADA_SOBRA: "Entrada de sobra", ENTRADA_MANUAL: "Entrada manual", AJUSTE: "Ajuste" };
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
  const [withdrawal, setWithdrawal] = useState<Withdrawal | null>(null);
  const [withdrawalQuantity, setWithdrawalQuantity] = useState("");
  const [withdrawalReason, setWithdrawalReason] = useState("");
  const [withdrawalSaving, setWithdrawalSaving] = useState(false);
  const [withdrawalError, setWithdrawalError] = useState("");
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
  const withdrawalKey = useRef<string | null>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const fetchKey = JSON.stringify([tab, busca, mostrarZerados, tipo, usuario, inicio, fim, pagina, reloadCounter]);
  const carregando = fetchState.key !== fetchKey;
  const fetchFailed = fetchState.key === fetchKey && Boolean(fetchState.error);
  const erro = fetchState.key === fetchKey ? fetchState.error : mutationError;
  const selectedEntryItem = entryItems.find((item) => item.id === entryItemId);
  const entryLabel = (item: StockOption) => `${item.codigo ? `${item.codigo} · ` : ""}${item.nome} · ${item.categoria}`;
  const entryMatches = entryItems.filter((item) => !entrySearch.trim() || `${item.codigo ?? ""} ${item.nome} ${item.categoria}`.toLowerCase().includes(entrySearch.trim().toLowerCase()));
  const selectedEntryQuantity = Number(entryQuantity);
  const entryHasRequest = entryRequisition.trim() !== "";
  const requestedNumber = entryHasRequest ? entryRequisition.trim() : null;
  const requestNumberValid = requestedNumber !== null && /^[A-Za-z0-9-]{1,20}$/.test(requestedNumber);
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
  const entryQuantityLimit = validRequest ? remainingRequestAmount : selectedEntryItem?.disponivel ?? 0;
  const entryQuantityValid = Number.isSafeInteger(selectedEntryQuantity) && selectedEntryQuantity > 0 && selectedEntryQuantity <= MAX_MANUAL_DEPOSIT_QUANTITY;
  const entryProjectionValid = entryQuantityValid && selectedEntryQuantity <= entryQuantityLimit;
  const projectedEntryBalance = selectedEntryItem && entryProjectionValid ? selectedEntryItem.quantidadeDeposito + selectedEntryQuantity : null;
  const entryBlockReason = !selectedEntryItem
    ? "Selecione um item do estoque."
    : !entryQuantityValid
      ? `Informe uma quantidade inteira entre 1 e ${MAX_MANUAL_DEPOSIT_QUANTITY.toLocaleString("pt-BR")}.`
      : entryHasRequest && !validRequest
        ? requestError
        : selectedEntryQuantity > entryQuantityLimit
          ? validRequest
            ? `Só é possível devolver até ${remainingRequestAmount} unidades desta requisição.`
            : `Saldo livre insuficiente no estoque. Disponível: ${selectedEntryItem.disponivel}.`
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
        setEntryRequestLookup({ numero: requestedNumber, loading: false, error: "Informe um número de requisição válido.", requisicao: null });
        return;
      }
      if (!selectedEntryItem) {
        setEntryRequestLookup({ numero: requestedNumber, loading: false, error: "Selecione o item da requisição para conferir a devolução.", requisicao: null });
        return;
      }
      setEntryRequestLookup({ numero: requestedNumber, loading: true, error: "", requisicao: null });
      try {
        const params = new URLSearchParams({ numero: requestedNumber, itemId: selectedEntryItem.id });
        const response = await fetch(`/api/requests?${params}`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Não foi possível verificar a requisição.");
        if (active) setEntryRequestLookup({ numero: requestedNumber, loading: false, error: "", requisicao: data.requisicao as RequestPreview });
      } catch (cause) {
        if (active) setEntryRequestLookup({ numero: requestedNumber, loading: false, error: cause instanceof Error ? cause.message : "Não foi possível verificar a requisição.", requisicao: null });
      }
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [entryHasRequest, entryRequisition, requestNumberValid, requestedNumber, selectedEntryItem]);

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

  async function saveWithdrawal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!withdrawal || withdrawalSaving) return;
    withdrawalKey.current ??= crypto.randomUUID();
    setWithdrawalSaving(true);
    setWithdrawalError("");
    try {
      const response = await fetch("/api/deposito/saida", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": withdrawalKey.current,
        },
        body: JSON.stringify({
          itemId: withdrawal.id,
          quantidade: Number(withdrawalQuantity),
          motivo: withdrawalReason.trim(),
        }),
      });
      const data = await response.json() as { error?: string; deposito?: { quantidade: number } };
      if (!response.ok) throw new Error(data.error ?? "Não foi possível retirar a sobra.");
      setFeedback(`Retirada registrada. Saldo restante no depósito: ${data.deposito?.quantidade ?? 0} un.`);
      setWithdrawal(null);
      setWithdrawalQuantity("");
      setWithdrawalReason("");
      withdrawalKey.current = null;
      setReloadCounter((current) => current + 1);
    } catch (cause) {
      setWithdrawalError(cause instanceof Error ? cause.message : "Não foi possível retirar a sobra.");
    } finally {
      setWithdrawalSaving(false);
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
  const unidadesNoDeposito = itens.reduce((total, item) => total + item.quantidade, 0);

  return <main className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-7xl flex-col px-4 py-6 sm:px-8">
    <header className="rounded-2xl bg-surface p-5 shadow-card">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">Almoxarifado Marcon</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-foreground">Depósito de sobras</h1><p className="mt-1 text-sm text-text-secondary">Saldos avulsos disponíveis para retirada na produção.</p></div>
        <Link href={estoqueHref} className="inline-flex min-h-11 items-center justify-center rounded-control border border-brand px-4 py-2 text-sm font-semibold text-brand hover:bg-priority-surface">Estoque principal</Link>
      </div>
    </header>

    <div role="tablist" aria-label="Visualização do depósito" className="mt-4 flex border-b border-border-subtle">
      {tabNames.map((name, index) => <button key={name} ref={(element) => { tabRefs.current[index] = element; }} id={`tab-${name}`} type="button" role="tab" aria-selected={tab === name} aria-controls={`panel-${name}`} tabIndex={tab === name ? 0 : -1} onKeyDown={(event) => handleTabKey(event, index)} onClick={() => changeTab(name)} className={`min-h-11 border-b-2 px-4 text-sm font-semibold ${tab === name ? "border-brand text-brand" : "border-transparent text-text-secondary hover:text-foreground"}`}>{name === "historico" ? "Histórico" : "Saldos"}</button>)}
    </div>

    {tab === "saldos" && <section aria-label="Resumo dos saldos do depósito" aria-busy={carregando} className="mt-4 grid gap-3 sm:grid-cols-2">
      <div className="flex items-center justify-between rounded-2xl bg-surface px-4 py-3 shadow-card">
        <p className="text-sm text-text-secondary">Materiais listados</p>
        <p className="text-xl font-bold text-foreground">{carregando || fetchFailed ? "—" : itens.length}</p>
      </div>
      <div className="flex items-center justify-between rounded-2xl bg-surface px-4 py-3 shadow-card">
        <p className="text-sm text-text-secondary">Unidades no depósito</p>
        <p className="text-xl font-bold text-foreground">{carregando || fetchFailed ? "—" : unidadesNoDeposito.toLocaleString("pt-BR")}</p>
      </div>
    </section>}

    {feedback && <p role="status" className="mt-4 rounded-lg border border-success/30 bg-success-surface px-4 py-3 text-sm text-success">{feedback}</p>}
    {erro && !fetchFailed && <p role="alert" className="mt-4 rounded-lg border border-error/30 bg-error-surface px-4 py-3 text-sm text-error">{erro}</p>}

    {tab === "saldos" ? <section id="panel-saldos" role="tabpanel" aria-labelledby="tab-saldos" className="min-h-0 flex-1 pt-4">
      <div className="flex flex-col gap-3 border-b border-border-subtle pb-4 sm:flex-row sm:items-end sm:justify-between">
        <label className="block flex-1 text-sm font-medium text-foreground">Buscar item<input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Código ou descrição" className="mt-1 block min-h-11 w-full rounded-lg border border-border px-3 py-2 text-base" /></label>
        <div className="flex flex-wrap items-center gap-3"><label className="inline-flex min-h-11 items-center gap-2 text-sm text-foreground"><input type="checkbox" checked={mostrarZerados} onChange={(event) => setMostrarZerados(event.target.checked)} className="h-4 w-4 accent-brand" />Mostrar zerados</label><Button onClick={() => void openEntryForm()}>Adicionar sobra</Button></div>
      </div>
      <DepositoBalanceContent
        loading={carregando}
        error={fetchFailed ? fetchState.error : ""}
        empty={itens.length === 0}
        filtered={Boolean(busca || mostrarZerados)}
        onAdd={() => void openEntryForm()}
        onRetry={() => setReloadCounter((current) => current + 1)}
      >
        {itens.map((item) => <article key={item.id} className="grid min-w-0 gap-3 rounded-2xl border border-border-subtle bg-surface p-4 shadow-card sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="min-w-0"><p className="break-words font-semibold text-foreground">{item.nome}</p><p className="mt-1 text-sm text-text-secondary">{item.codigo ? `${item.codigo} · ` : ""}{item.categoria}</p><p className="mt-1 text-sm text-text-secondary">Última movimentação: {dateLabel(item.ultimaMovimentacaoEm)}</p></div>
          <div className="flex min-w-0 flex-wrap items-center gap-2"><span className="inline-flex min-h-11 items-center rounded-full bg-success-surface px-3 text-sm font-bold text-success">{item.quantidade} un</span><button type="button" onClick={() => openHistory(item)} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-3 text-sm font-semibold text-foreground hover:bg-background">Histórico</button>{item.quantidade > 0 && <button type="button" onClick={() => { withdrawalKey.current = null; setWithdrawal(item); setWithdrawalQuantity(""); setWithdrawalReason(""); setWithdrawalError(""); }} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-success/30 px-3 text-sm font-semibold text-success hover:bg-success-surface">Reaproveitar sobra</button>}{isAdmin && <button type="button" onClick={() => { setAdjustment(item); setAdjustmentQuantity(String(item.quantidade)); setAdjustmentReason(""); }} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand px-3 text-sm font-semibold text-surface hover:bg-brand-hover">Ajustar saldo</button>}</div>
        </article>)}
      </DepositoBalanceContent>
    </section> : <section id="panel-historico" role="tabpanel" aria-labelledby="tab-historico" className="min-h-0 flex-1 pt-4">
      <div className="grid gap-3 border-b border-border-subtle pb-4 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-sm font-medium text-foreground">Item<input value={busca} onChange={(event) => { setBusca(event.target.value); setPagina(1); }} placeholder="Código ou descrição" className="mt-1 block min-h-11 w-full rounded-lg border border-border px-3 py-2 text-base outline-none focus:border-brand" /></label>
        <label className="text-sm font-medium text-foreground">Tipo<select value={tipo} onChange={(event) => { setTipo(event.target.value); setPagina(1); }} className="mt-1 block min-h-11 w-full rounded-lg border border-border bg-surface px-3 py-2 text-base"><option value="">Todos</option><option value="ENTRADA_SOBRA">Entrada de sobra</option><option value="ENTRADA_MANUAL">Entrada manual</option><option value="SAIDA_REQUISICAO">Saída por requisição</option><option value="SAIDA_REAPROVEITAMENTO">Retirada para reaproveitamento</option><option value="AJUSTE">Ajuste</option></select></label>
        <label className="text-sm font-medium text-foreground">De<input type="date" value={inicio} onChange={(event) => { setInicio(event.target.value); setPagina(1); }} className="mt-1 block min-h-11 w-full rounded-lg border border-border px-3 py-2 text-base" /></label>
        <label className="text-sm font-medium text-foreground">Até<input type="date" value={fim} onChange={(event) => { setFim(event.target.value); setPagina(1); }} className="mt-1 block min-h-11 w-full rounded-lg border border-border px-3 py-2 text-base" /></label>
        <label className="text-sm font-medium text-foreground">Usuário<input value={usuario} onChange={(event) => { setUsuario(event.target.value); setPagina(1); }} placeholder="Nome" className="mt-1 block min-h-11 w-full rounded-lg border border-border px-3 py-2 text-base" /></label>
      </div>
      {carregando ? <LoadingState label="Carregando histórico do depósito…" rows={4} /> : fetchFailed ? <ErrorState message={fetchState.error} onRetry={() => setReloadCounter((current) => current + 1)} /> : movimentacoes.length === 0 ? <EmptyState title="Nenhuma movimentação encontrada" message="As movimentações do depósito aparecerão aqui." /> : <>
        <div className="space-y-3">
          {movimentacoes.map((movement) => <article key={movement.id} className={`grid min-w-0 gap-2 rounded-2xl border border-border-subtle bg-surface p-4 shadow-card sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center ${movement.tipo === "ENTRADA_MANUAL" ? styles.manualMovement : ""}`}>
            <div className="min-w-0"><p className="break-words font-semibold text-foreground">{movement.item.nome}</p><p className="mt-1 text-sm text-text-secondary">{typeLabels[movement.tipo]} · {movement.quantidade} un · saldo após: {movement.saldoDepois}</p><p className="mt-1 text-sm text-text-secondary">{movement.usuario.nome} · {dateLabel(movement.criadoEm)}{movement.motivo ? ` · ${movement.motivo}` : ""}</p></div>
            {movement.requisicao ? <Link href={`${requisicaoPrefix}/${encodeURIComponent(movement.requisicao.id)}`} className="inline-flex min-h-11 items-center font-semibold text-brand hover:underline">Requisição #{movement.requisicao.numero}</Link> : <span className="text-sm text-text-secondary">Sem requisição</span>}
          </article>)}
        </div>
        <nav aria-label="Paginação do histórico" className="flex items-center justify-between border-t border-border-subtle py-4 text-sm"><span>Página {pagina} de {totalPaginas}</span><div className="flex gap-2"><button type="button" disabled={pagina <= 1 || carregando} onClick={() => setPagina((current) => current - 1)} className="min-h-11 rounded-lg border border-border px-3 disabled:opacity-40">Anterior</button><button type="button" disabled={pagina >= totalPaginas || carregando} onClick={() => setPagina((current) => current + 1)} className="min-h-11 rounded-lg border border-border px-3 disabled:opacity-40">Próxima</button></div></nav>
      </>}
    </section>}

    {entryOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/60 p-4"><section role="dialog" aria-modal="true" aria-labelledby="entry-title" className={`${styles.entryDialog} rounded-xl bg-surface p-5 shadow-xl`}>
      <div className="mb-4 flex items-start justify-between gap-4"><div><h2 id="entry-title" className="text-lg font-bold text-foreground">Adicionar sobra</h2><p className="mt-1 text-sm text-text-secondary">Entrada manual de até {MAX_MANUAL_DEPOSIT_QUANTITY.toLocaleString("pt-BR")} unidades por operação.</p><p className="mt-1 text-sm text-text-secondary">Destino: Depósito de sobras. O usuário autenticado e o local ficam registrados no histórico.</p></div><button type="button" aria-label="Fechar" onClick={() => setEntryOpen(false)} disabled={entrySaving} className="min-h-11 rounded-md border border-border px-3 text-foreground">Fechar</button></div>
      {entryLoading ? <LoadingState label="Carregando itens do estoque…" rows={3} /> : !entryCatalogLoaded && entryError
        ? <ErrorState message={entryError} onRetry={() => void openEntryForm()} />
        : <form onSubmit={(event) => void submitEntry(event)} className={styles.entryForm}>
        <div className={`${styles.entryField} text-sm font-medium text-foreground`}>
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
            <div id="entry-item-options" role="listbox" aria-label="Itens do estoque" hidden={!entryListOpen} className={styles.entryOptionList}>{entryListOpen && (entryMatches.length === 0 ? <p className="px-3 py-2 text-sm text-text-secondary">Nenhum item encontrado.</p> : entryMatches.map((item, index) => <div key={item.id} id={`entry-option-${item.id}`} role="option" aria-selected={entryActiveIndex === index} onMouseDown={(event) => event.preventDefault()} onClick={() => selectEntryItem(item)} className={`${styles.entryOption} ${entryActiveIndex === index ? styles.entryOptionActive : ""}`}><span>{entryLabel(item)}</span><small>Depósito {item.quantidadeDeposito} · livre no estoque {item.disponivel}</small></div>))}</div>
          </div>
        </div>
        {selectedEntryItem && <div className="grid gap-2 rounded-lg bg-background p-3 text-sm sm:grid-cols-2"><p>Saldo atual no depósito: <strong>{selectedEntryItem.quantidadeDeposito}</strong></p><p>Saldo no estoque: <strong>{selectedEntryItem.quantidade}</strong></p></div>}
        <label htmlFor="entry-quantity" className={`${styles.entryField} text-sm font-medium text-foreground`}>Quantidade
          <input id="entry-quantity" type="number" inputMode="numeric" min={1} max={entryQuantityLimit} step={1} required value={entryQuantity} onChange={(event) => { setEntryQuantity(event.target.value); entryKey.current = null; }} />
        </label>
        <label htmlFor="entry-requisition" className={`${styles.entryField} text-sm font-medium text-foreground`}>Requisição de origem (opcional)
          <input id="entry-requisition" type="text" maxLength={20} value={entryRequisition} onChange={(event) => { setEntryRequisition(event.target.value); setEntryRequestLookup(null); entryKey.current = null; }} placeholder="Ex.: REQ-000123" />
        </label>
        {entryHasRequest && <div className="flex flex-wrap items-center justify-between gap-2">{requestError && <p role="status" className="text-sm text-warning">{requestError}</p>}<button type="button" onClick={() => { setEntryRequisition(""); setEntryRequestLookup(null); entryKey.current = null; }} className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-brand underline">Limpar requisição</button></div>}
        {!validRequest && <>
          <label htmlFor="entry-reason" className={`${styles.entryField} text-sm font-medium text-foreground`}>Motivo
            <select id="entry-reason" required value={entryReason} onChange={(event) => { setEntryReason(event.target.value); entryKey.current = null; }}><option value="">Selecione o motivo</option>{Object.values(MANUAL_DEPOSIT_REASONS).map((reason) => <option key={reason} value={reason}>{reason}</option>)}</select>
          </label>
          {entryReason === MANUAL_DEPOSIT_REASONS.OUTRO && <label htmlFor="entry-observation" className={`${styles.entryField} text-sm font-medium text-foreground`}>Observação (até 160 caracteres)
            <textarea id="entry-observation" required maxLength={160} rows={2} value={entryObservation} onChange={(event) => { setEntryObservation(event.target.value); entryKey.current = null; }} />
          </label>}
        </>}
        <p aria-live="polite" className={styles.entrySummary}>{selectedEntryItem && projectedEntryBalance !== null && entryQuantityValid ? `Estoque livre: ${selectedEntryItem.disponivel} → ${validRequest ? selectedEntryItem.disponivel : selectedEntryItem.disponivel - selectedEntryQuantity}${validRequest ? " (sem alteração)" : ""} · Depósito: ${selectedEntryItem.quantidadeDeposito} → ${projectedEntryBalance}` : "Selecione um item e uma quantidade válida para ver o resumo."}</p>
        {entryBlockReason && <p id="entry-form-hint" role="status" className="text-sm text-warning">{entryBlockReason}</p>}
        {entryError && <p role="alert" className="rounded-lg bg-error-surface px-3 py-2 text-sm text-error">{entryError}</p>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="secondary" disabled={entrySaving} onClick={() => setEntryOpen(false)}>Cancelar</Button><Button type="submit" loading={entrySaving} loadingLabel="Adicionando…" disabled={Boolean(entryBlockReason)} aria-describedby={entryBlockReason ? "entry-form-hint" : undefined}>Adicionar sobra</Button></div>
      </form>}
    </section></div>}

    {adjustment && <div className="fixed inset-0 z-50 grid place-items-end bg-foreground/60 sm:place-items-center sm:p-4"><form role="dialog" aria-modal="true" aria-labelledby="adjust-title" onSubmit={(event) => void saveAdjustment(event)} className="safe-area-inset h-dvh w-full max-w-none overflow-y-auto bg-surface p-5 shadow-overlay sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:max-w-md sm:rounded-panel">
      <h2 id="adjust-title" className="text-lg font-bold text-foreground">Ajustar saldo</h2><p className="mt-1 text-sm text-text-secondary">{adjustment.nome}</p>
      <label className="mt-4 block text-sm font-medium text-foreground">Quantidade contada<input autoFocus type="number" inputMode="numeric" min={0} step={1} required value={adjustmentQuantity} onChange={(event) => setAdjustmentQuantity(event.target.value)} className="mt-1 block min-h-11 w-full rounded-lg border border-border px-3 py-2 text-base" /></label>
      <label className="mt-3 block text-sm font-medium text-foreground">Motivo<input required maxLength={200} value={adjustmentReason} onChange={(event) => setAdjustmentReason(event.target.value)} className="mt-1 block min-h-11 w-full rounded-lg border border-border px-3 py-2 text-base" /></label>
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="secondary" disabled={saving} onClick={() => setAdjustment(null)}>Cancelar</Button><Button type="submit" loading={saving} loadingLabel="Salvando…">Registrar ajuste</Button></div>
    </form></div>}
    {withdrawal && <div className="fixed inset-0 z-50 grid place-items-end bg-foreground/60 sm:place-items-center sm:p-4"><form role="dialog" aria-modal="true" aria-labelledby="withdraw-title" onSubmit={(event) => void saveWithdrawal(event)} className="safe-area-inset h-dvh w-full max-w-none overflow-y-auto bg-surface p-5 shadow-overlay sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:max-w-md sm:rounded-panel">
      <h2 id="withdraw-title" className="text-lg font-bold text-foreground">Reaproveitar sobra</h2><p className="mt-1 text-sm text-text-secondary">{withdrawal.nome} · saldo disponível {withdrawal.quantidade} un</p>
      <label className="mt-4 block text-sm font-medium text-foreground">Quantidade<input autoFocus type="number" inputMode="numeric" min={1} max={withdrawal.quantidade} step={1} required value={withdrawalQuantity} onChange={(event) => { setWithdrawalQuantity(event.target.value); withdrawalKey.current = null; }} className="mt-1 block min-h-11 w-full rounded-lg border border-border px-3 py-2 text-base" /></label>
      <label className="mt-3 block text-sm font-medium text-foreground">Destino ou motivo<input required maxLength={160} value={withdrawalReason} onChange={(event) => { setWithdrawalReason(event.target.value); withdrawalKey.current = null; }} className="mt-1 block min-h-11 w-full rounded-lg border border-border px-3 py-2 text-base" /></label>
      {withdrawalError && <p role="alert" className="mt-3 rounded-lg bg-error-surface px-3 py-2 text-sm text-error">{withdrawalError}</p>}
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="secondary" disabled={withdrawalSaving} onClick={() => { setWithdrawal(null); withdrawalKey.current = null; }}>Cancelar</Button><Button type="submit" loading={withdrawalSaving} loadingLabel="Registrando…" disabled={!Number.isSafeInteger(Number(withdrawalQuantity)) || Number(withdrawalQuantity) < 1 || Number(withdrawalQuantity) > withdrawal.quantidade || !withdrawalReason.trim()}>Confirmar retirada</Button></div>
    </form></div>}
  </main>;
}