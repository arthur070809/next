"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { EventoHistorico } from "@/lib/types/almoxarifado";

const labels: Record<EventoHistorico["evento"], string> = {
  assumida: "Assumida",
  cancelada: "Cancelada",
  finalizada: "Finalizada",
  devolvida: "Devolvida",
};
const colors: Record<EventoHistorico["evento"], string> = {
  assumida: "bg-blue-50 text-royal",
  cancelada: "bg-red-50 text-red-700",
  finalizada: "bg-green-50 text-green-700",
  devolvida: "bg-amber-50 text-amber-800",
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
      <p key={`${product.codigo ?? ""}-${product.nome}`} className="text-sm text-slate-600">
        {product.codigo ? `${product.codigo} · ` : ""}{product.nome}: pedido {product.quantidadePedida}, separado {product.quantidadeSeparada}
        {product.motivo ? ` · Motivo: ${product.motivo}` : ""}
      </p>
    ));
  }
  return event.descricaoMotivo && <p className="text-sm text-slate-600">{event.descricaoMotivo}</p>;
}

export default function HistoricoPage() {
  const [events, setEvents] = useState<EventoHistorico[]>([]);
  const [loading, setLoading] = useState(true);
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
  }, [page, product, employee, desde, ate, selected]);

  const visibleEvents = events.filter((event) => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return !term ||
      event.numeroPedido.toLocaleLowerCase("pt-BR").includes(term) ||
      event.codigoCracha.toLocaleLowerCase("pt-BR").includes(term) ||
      event.funcionarioNome.toLocaleLowerCase("pt-BR").includes(term);
  });

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
    <main className="min-h-screen bg-[#f6f8fc] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-royal">Marcon · Auditoria</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Histórico de movimentações</h1>
            <p className="mt-1 text-sm text-slate-500">Ações registradas sobre as requisições do almoxarifado.</p>
          </div>
          <Link href="/almoxarifado" className="w-fit rounded-lg bg-royal px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">Voltar ao painel</Link>
        </header>

        {apiError && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{apiError}</p>}
        <section aria-label="Filtros do histórico" className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-sm font-medium text-slate-700">Buscar pedido ou funcionário
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pedido, nome ou crachá" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5"/>
            </label>
            <label className="text-sm font-medium text-slate-700">Produto
              <select value={product} onChange={(event) => changeFilter(setProduct, event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5">
                <option value="">Todos os produtos</option>
                {filters.produtos.map((option) => <option key={`${option.codigo ?? ""}-${option.nome}`} value={option.codigo ?? option.nome}>{option.codigo ? `${option.codigo} · ` : ""}{option.nome}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">Quem executou
              <select value={employee} onChange={(event) => changeFilter(setEmployee, event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5">
                <option value="">Todos os funcionários</option>
                {filters.funcionarios.map((option) => <option key={option.id} value={option.id}>{option.nome} · {option.cracha}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">De
              <input type="date" value={desde} onChange={(event) => changeFilter(setDesde, event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5"/>
            </label>
            <label className="text-sm font-medium text-slate-700">Até
              <input type="date" value={ate} onChange={(event) => changeFilter(setAte, event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5"/>
            </label>
            <div className="flex items-end"><button type="button" onClick={clearFilters} className="rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100">Limpar filtros</button></div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {kinds.map((kind) => <button key={kind} type="button" onClick={() => toggle(kind)} aria-pressed={selected.includes(kind)} className={`rounded-full border px-3 py-1.5 text-sm font-medium ${selected.includes(kind) ? `${colors[kind]} border-transparent` : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{labels[kind]}</button>)}
          </div>
        </section>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
          <p>{total} eventos encontrados · até {sourceLimit} requisições recentes consultáveis</p>
          <p>Página {page} de {totalPages} · {pageSize} eventos por página</p>
        </div>
        {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">Carregando histórico…</div> : visibleEvents.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">Nenhum evento encontrado para estes filtros.</div> : (
          <section className="space-y-3">
            {visibleEvents.map((event) => (
              <article key={event.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3"><strong className="text-slate-900">{event.numeroPedido}</strong><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${colors[event.evento]}`}>{labels[event.evento]}</span></div>
                  <time className="text-sm text-slate-500">{new Date(event.timestamp).toLocaleString("pt-BR")}</time>
                </div>
                <p className="mt-2 text-sm text-slate-700">Executado por {event.funcionarioNome} · Crachá {event.codigoCracha}</p>
                <div className="mt-3 space-y-1">{eventProducts(event)}</div>
              </article>
            ))}
          </section>
        )}
        <nav aria-label="Paginação do histórico" className="mt-5 flex items-center justify-between">
          <button type="button" disabled={loading || page <= 1} onClick={() => { setLoading(true); setPage((current) => Math.max(1, current - 1)); }} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50">Anterior</button>
          <button type="button" disabled={loading || page >= totalPages} onClick={() => { setLoading(true); setPage((current) => Math.min(totalPages, current + 1)); }} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50">Próxima</button>
        </nav>
      </div>
    </main>
  );
}
