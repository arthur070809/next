"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader, StatusBadge } from "./industrial";
import { EmptyState, ErrorState, LoadingState } from "./ui";
import type { EventoHistorico } from "@/lib/types/almoxarifado";
import PriorityBadge from "./PriorityBadge";
import ItemDescription from "./ItemDescription";

const labels: Record<EventoHistorico["evento"], string> = {
  assumida: "Assumida",
  cancelada: "Cancelada",
  finalizada: "Finalizada",
  devolvida: "Devolvida",
};

const tones: Record<EventoHistorico["evento"], "brand" | "danger" | "success" | "warning"> = {
  assumida: "brand",
  cancelada: "danger",
  finalizada: "success",
  devolvida: "warning",
};

const kinds: EventoHistorico["evento"][] = ["assumida", "cancelada", "finalizada", "devolvida"];
const pageSize = 50;

type HistoryResponse = {
  eventos: EventoHistorico[];
  total: number;
  pagina: number;
  totalPaginas: number;
  limiteRequisicoes: number;
  filtros: {
    produtos: Array<{ codigo: string | null; nome: string }>;
    funcionarios: Array<{ id: number; nome: string; cracha: string }>;
  };
};

function eventProducts(event: EventoHistorico) {
  if (event.produtos.length) {
    return event.produtos.map((product) => (
      <div key={`${product.codigo ?? ""}-${product.nome}`} className="text-sm leading-6 text-text-secondary">
        <p>{product.codigo ? `${product.codigo} · ` : ""}{product.nome}: pedido {product.quantidadePedida}, separado {product.quantidadeSeparada}</p>
        <ItemDescription categoria={product.categoria} descricao={product.descricao} />
        {product.motivo && <p>Motivo: {product.motivo}</p>}
      </div>
    ));
  }
  return event.descricaoMotivo
    ? <p className="text-sm leading-6 text-text-secondary">{event.descricaoMotivo}</p>
    : <p className="text-sm text-text-secondary">Sem detalhes adicionais.</p>;
}

export default function HistoricoContent({
  backHref,
  requisitionHrefBase,
  eyebrow = "Marcon · Auditoria",
}: {
  backHref: string;
  requisitionHrefBase: string;
  eyebrow?: string;
}) {
  const [events, setEvents] = useState<EventoHistorico[]>([]);
  const [loading, setLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [apiError, setApiError] = useState("");
  const [selected, setSelected] = useState<EventoHistorico["evento"][]>([]);
  const [search, setSearch] = useState("");
  const [product, setProduct] = useState("");
  const [employee, setEmployee] = useState("");
  const [desde, setDesde] = useState("");
  const [ate, setAte] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState<HistoryResponse["filtros"]>({ produtos: [], funcionarios: [] });
  const [sourceLimit, setSourceLimit] = useState(200);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ pagina: String(page) });
    if (product) params.set("produto", product);
    if (employee) params.set("funcionario", employee);
    if (desde) params.set("desde", desde);
    if (ate) params.set("ate", ate);
    if (selected.length) params.set("eventos", selected.join(","));

    fetch(`/api/historico?${params}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json() as HistoryResponse & { error?: string };
        if (!response.ok) throw new Error(data.error || "Falha ao carregar o histórico.");
        setEvents(data.eventos);
        setTotal(data.total);
        setTotalPages(data.totalPaginas);
        setFilters(data.filtros);
        setSourceLimit(data.limiteRequisicoes);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setApiError(error instanceof Error ? error.message : "Falha ao carregar o histórico.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [page, product, employee, desde, ate, selected, retryCount]);

  const term = search.trim().toLocaleLowerCase("pt-BR");
  const visibleEvents = events.filter((event) =>
    !term ||
    event.numeroPedido.toLocaleLowerCase("pt-BR").includes(term) ||
    event.codigoCracha.toLocaleLowerCase("pt-BR").includes(term) ||
    event.funcionarioNome.toLocaleLowerCase("pt-BR").includes(term),
  );

  function changeFilter(setter: (value: string) => void, value: string) {
    setLoading(true);
    setApiError("");
    setter(value);
    setPage(1);
  }

  function toggle(kind: EventoHistorico["evento"]) {
    setLoading(true);
    setApiError("");
    setSelected((current) => current.includes(kind)
      ? current.filter((event) => event !== kind)
      : [...current, kind]);
    setPage(1);
  }

  function clearFilters() {
    if (!selected.length && !search && !product && !employee && !desde && !ate && page === 1) return;
    setLoading(true);
    setApiError("");
    setSelected([]);
    setSearch("");
    setProduct("");
    setEmployee("");
    setDesde("");
    setAte("");
    setPage(1);
  }

  return (
    <div>
      <PageHeader
        eyebrow={eyebrow}
        title="Histórico de movimentações"
        description="Ações registradas sobre as requisições do almoxarifado, com busca e filtros."
        action={
          <Link href={backHref} className="inline-flex min-h-11 items-center rounded-control border border-brand px-4 text-sm font-semibold text-brand transition-colors hover:bg-priority-surface">
            Voltar ao painel
          </Link>
        }
      />

      {apiError && <ErrorState message={apiError} onRetry={() => {
        setLoading(true);
        setApiError("");
        setRetryCount((count) => count + 1);
      }} />}

      <section aria-label="Filtros do histórico" className="mb-5 rounded-card bg-surface p-4 shadow-card sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm font-medium text-foreground">
            Buscar pedido ou funcionário
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pedido, nome ou crachá" className="mt-1 min-h-11 w-full rounded-xl border border-border-subtle px-3 py-2.5 text-base" />
          </label>
          <label className="text-sm font-medium text-foreground">
            Produto
            <select value={product} onChange={(event) => changeFilter(setProduct, event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-border-subtle bg-surface px-3 py-2.5 text-base">
              <option value="">Todos os produtos</option>
              {filters.produtos.map((option) => <option key={`${option.codigo ?? ""}-${option.nome}`} value={option.codigo ?? option.nome}>{option.codigo ? `${option.codigo} · ` : ""}{option.nome}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-foreground">
            Quem executou
            <select value={employee} onChange={(event) => changeFilter(setEmployee, event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-border-subtle bg-surface px-3 py-2.5 text-base">
              <option value="">Todos os funcionários</option>
              {filters.funcionarios.map((option) => <option key={option.id} value={option.id}>{option.nome} · {option.cracha}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-foreground">
            De
            <input type="date" value={desde} onChange={(event) => changeFilter(setDesde, event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-border-subtle px-3 py-2.5 text-base" />
          </label>
          <label className="text-sm font-medium text-foreground">
            Até
            <input type="date" value={ate} onChange={(event) => changeFilter(setAte, event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-border-subtle px-3 py-2.5 text-base" />
          </label>
          <div className="flex items-end">
            <button type="button" onClick={clearFilters} className="min-h-11 rounded-xl px-3 py-2.5 text-sm font-semibold text-text-secondary hover:bg-background">Limpar filtros</button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {kinds.map((kind) => (
            <button key={kind} type="button" onClick={() => toggle(kind)} aria-pressed={selected.includes(kind)} className={`inline-flex min-h-11 items-center rounded-full border px-3 py-1.5 text-sm font-medium ${selected.includes(kind) ? "border-transparent ring-1 ring-inset ring-current" : "border-border-subtle text-text-secondary hover:bg-background"}`}>
              <StatusBadge label={labels[kind]} tone={tones[kind]} />
            </button>
          ))}
        </div>
      </section>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm text-text-secondary">
        <p>{total} eventos encontrados · até {sourceLimit} requisições recentes consultáveis</p>
        <p>Página {page} de {totalPages} · {pageSize} eventos por página</p>
      </div>

      {loading ? (
        <LoadingState label="Carregando histórico…" rows={4} />
      ) : apiError ? null : visibleEvents.length === 0 ? (
        <EmptyState title="Nenhum evento encontrado" message="Ajuste os filtros e tente novamente." />
      ) : (
        <section className="space-y-3">
          {visibleEvents.map((event) => (
            <article key={event.id} className="rounded-card bg-surface p-4 shadow-card sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Link href={`${requisitionHrefBase}/${encodeURIComponent(event.requisicaoId)}`} className="inline-flex min-h-11 items-center font-semibold text-brand underline underline-offset-2">{event.numeroPedido}</Link>
                  <StatusBadge label={labels[event.evento]} tone={tones[event.evento]} />
                  {event.prioridade && <PriorityBadge priority={event.prioridade} />}
                </div>
                <time className="text-sm text-text-secondary">{new Date(event.timestamp).toLocaleString("pt-BR")}</time>
              </div>
              <p className="mt-2 text-sm text-foreground">Executado por {event.funcionarioNome} · Crachá {event.codigoCracha}</p>
              <div className="mt-3 space-y-1">{eventProducts(event)}</div>
            </article>
          ))}
        </section>
      )}

      <nav aria-label="Paginação do histórico" className="mt-5 flex items-center justify-between">
        <button type="button" disabled={loading || page <= 1} onClick={() => { setLoading(true); setPage((current) => Math.max(1, current - 1)); }} className="min-h-11 rounded-control border border-brand bg-surface px-4 text-sm font-semibold text-brand disabled:opacity-50">Anterior</button>
        <button type="button" disabled={loading || page >= totalPages} onClick={() => { setLoading(true); setPage((current) => Math.min(totalPages, current + 1)); }} className="min-h-11 rounded-control border border-brand bg-surface px-4 text-sm font-semibold text-brand disabled:opacity-50">Próxima</button>
      </nav>
    </div>
  );
}
