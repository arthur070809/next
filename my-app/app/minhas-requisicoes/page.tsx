"use client";

import { useEffect, useState } from "react";
import PriorityBadge from "../components/PriorityBadge";
import ItemDescription from "../components/ItemDescription";
import { REQUISITION_STATUS_LABELS } from "@/lib/requisition-status";
import type { StatusRequisicao } from "@/generated/prisma/client";

type RequestItem = {
  nome: string;
  codigo: string | null;
  categoria?: string;
  quantidadePedida: number;
  quantidadeSeparada: number;
  unidadeMedida: string;
  descricao: string;
  motivo: string | null;
};
type OwnRequest = {
  numeroPedido: string;
  status: StatusRequisicao;
  criadoEm: string;
  prioridade: "padrao" | "prioridade";
  itens: RequestItem[];
};
export default function MinhasRequisicoesPage() {
  const [requests, setRequests] = useState<OwnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/minhas-requisicoes?page=${page}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json() as { error?: string; requisicoes?: OwnRequest[]; temMais?: boolean };
        if (!response.ok) throw new Error(data.error ?? "Não foi possível carregar suas requisições.");
        setRequests(data.requisicoes ?? []);
        setHasMore(data.temMais ?? false);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "Não foi possível carregar suas requisições.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page]);

  return <main className="mx-auto max-w-5xl p-4 sm:p-6">
    <header className="mb-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-royal">Área do operador</p>
      <h1 className="mt-1 text-2xl font-bold text-slate-950">Minhas Requisições</h1>
      <p className="mt-1 text-sm text-slate-600">Seus pedidos mais recentes e o resultado da separação.</p>
    </header>
    {error && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {loading ? <p role="status" className="rounded-xl bg-white p-8 text-center text-slate-600">Carregando suas requisições…</p>
      : requests.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-600">Você ainda não enviou requisições.</p>
        : <>
          <p className="mb-3 text-xs text-slate-500">Página {page} · da mais recente para a mais antiga.</p>
          <section aria-label="Requisições do operador" className="space-y-3">
            {requests.map((request) => <article key={request.numeroPedido} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2"><h2 className="font-bold text-slate-950">{request.numeroPedido}</h2><PriorityBadge priority={request.prioridade} /></div>
                <time className="text-sm text-slate-600">{new Date(request.criadoEm).toLocaleString("pt-BR")}</time>
              </div>
              <p className="mt-2 text-sm font-medium text-slate-700">{REQUISITION_STATUS_LABELS[request.status]} · {request.itens.length} {request.itens.length === 1 ? "item" : "itens"}</p>
              <ul className="mt-3 divide-y divide-slate-100">
                {request.itens.map((item, index) => <li key={`${item.codigo ?? item.nome}-${index}`} className="py-3 text-sm">
                  <p className="font-semibold text-slate-900">{item.codigo ? `${item.codigo} · ` : ""}{item.nome}</p>
                  <ItemDescription className="mt-1 text-slate-600" categoria={item.categoria} descricao={item.descricao} />
                  <p className="mt-1 text-slate-700">Pedido {item.quantidadePedida} {item.unidadeMedida} × separado {item.quantidadeSeparada} {item.unidadeMedida}</p>
                  {item.motivo && <p className="mt-1 text-amber-800">Motivo da divergência: {item.motivo.replaceAll("_", " ").toLocaleLowerCase("pt-BR")}</p>}
                </li>)}
              </ul>
            </article>)}
          </section>
          <nav aria-label="Paginação das requisições" className="mt-5 flex items-center justify-between gap-3">
            <button
              type="button"
              disabled={page === 1 || loading}
              onClick={() => {
                setError("");
                setLoading(true);
                setPage((current) => Math.max(1, current - 1));
              }}
              className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Anterior
            </button>
            <span className="text-sm text-slate-600">Página {page}</span>
            <button
              type="button"
              disabled={!hasMore || loading}
              onClick={() => {
                setError("");
                setLoading(true);
                setPage((current) => current + 1);
              }}
              className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Próxima
            </button>
          </nav>
        </>}
  </main>;
}
