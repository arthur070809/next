"use client";

import { useEffect, useState } from "react";
import PriorityBadge from "../components/PriorityBadge";
import ItemDescription from "../components/ItemDescription";
import { Button, Card, EmptyState, ErrorState, LoadingState, StatusBadge } from "../components/ui";
import { PageHeader } from "../components/industrial";
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
  const [retryCount, setRetryCount] = useState(0);

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
  }, [page, retryCount]);

  return <main className="min-w-0">
    <PageHeader eyebrow="Área do operador" title="Minhas requisições" description="Acompanhe seus pedidos mais recentes e o resultado da separação." />
    {error ? <ErrorState message={error} onRetry={() => {
      setError("");
      setLoading(true);
      setRetryCount((current) => current + 1);
    }} />
      : loading ? <LoadingState label="Carregando suas requisições…" />
      : requests.length === 0 ? <EmptyState title="Você ainda não enviou requisições" message="Quando fizer um pedido, ele aparecerá aqui com o andamento da separação." />
        : <>
          <p className="mb-3 text-sm text-text-secondary">Página {page} · da mais recente para a mais antiga.</p>
          <section aria-label="Requisições do operador" className="space-y-3">
            {requests.map((request) => <Card as="article" key={request.numeroPedido} className="p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2"><h2 className="font-bold text-foreground">{request.numeroPedido}</h2><PriorityBadge priority={request.prioridade} /></div>
                <time className="text-sm text-text-secondary">{new Date(request.criadoEm).toLocaleString("pt-BR")}</time>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <StatusBadge label={REQUISITION_STATUS_LABELS[request.status]} tone="brand" />
                <span className="text-sm font-medium text-text-secondary">{request.itens.length} {request.itens.length === 1 ? "item" : "itens"}</span>
              </div>
              <ul className="mt-3 divide-y divide-border-subtle">
                {request.itens.map((item, index) => <li key={`${item.codigo ?? item.nome}-${index}`} className="py-3">
                  <p className="font-semibold text-foreground">{item.codigo ? `${item.codigo} · ` : ""}{item.nome}</p>
                  <ItemDescription className="mt-1 text-text-secondary" categoria={item.categoria} descricao={item.descricao} />
                  <p className="mt-1 text-foreground">Pedido {item.quantidadePedida} {item.unidadeMedida} × separado {item.quantidadeSeparada} {item.unidadeMedida}</p>
                  {item.motivo && <p className="mt-1 text-warning">Motivo da divergência: {item.motivo.replaceAll("_", " ").toLocaleLowerCase("pt-BR")}</p>}
                </li>)}
              </ul>
            </Card>)}
          </section>
          <nav aria-label="Paginação das requisições" className="mt-5 flex items-center justify-between gap-3">
            <Button
              variant="secondary"
              disabled={page === 1 || loading}
              onClick={() => {
                setError("");
                setLoading(true);
                setPage((current) => Math.max(1, current - 1));
              }}
            >
              Anterior
            </Button>
            <span className="text-sm text-text-secondary">Página {page}</span>
            <Button
              variant="secondary"
              disabled={!hasMore || loading}
              onClick={() => {
                setError("");
                setLoading(true);
                setPage((current) => current + 1);
              }}
            >
              Próxima
            </Button>
          </nav>
        </>}
  </main>;
}
