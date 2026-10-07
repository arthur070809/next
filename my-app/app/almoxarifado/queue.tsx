"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import ModalAcaoRequisicao from "../components/ModalAcaoRequisicao";
import PriorityBadge, { PRIORITY_QUEUE_ROW_CLASS } from "../components/PriorityBadge";
import ItemDescription from "../components/ItemDescription";
import RequisitionDescription from "../components/RequisitionDescription";
import { PageHeader, StatusBadge } from "../components/industrial";
import { EmptyState, ErrorState, LoadingState } from "../components/ui";
import type { RequisicaoMock } from "../../lib/types/almoxarifado";
import { startVisibilityPolling } from "../../lib/visibility-polling";
import type { PlanoViagens } from "../../lib/viagem/planejar-viagens";
import {
  carregarPlanoViagem,
  consultarDadosReais,
  planoViagemDemonstracao,
  viagemDemoDisponivel,
} from "../../lib/viagem/demo-mode";
import {
  ExecutorAssuncaoLote,
  type ResultadoAssuncaoLote,
} from "../../lib/viagem/assumir-lote";
import { sortRequisitionsByPriority } from "./utils";

const podeAtivarDemonstracao = viagemDemoDisponivel(
  process.env.NODE_ENV,
  process.env.NEXT_PUBLIC_VIAGEM_DEMO,
);

function formatarIdade(data: string) {
  const minutos = Math.max(0, Math.floor((Date.now() - new Date(data).getTime()) / 60000));
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `${horas} h`;
  return `${Math.floor(horas / 24)} d`;
}

export default function RequisicoesQueuePage() {
  const router = useRouter();
  const [requisicoes, setRequisicoes] = useState<RequisicaoMock[]>([]);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [atualizacao, setAtualizacao] = useState(0);
  const [requisicaoParaAssumir, setRequisicaoParaAssumir] = useState<RequisicaoMock | null>(null);
  const [viagemParaAssumir, setViagemParaAssumir] = useState<RequisicaoMock[] | null>(null);
  const [assumindo, setAssumindo] = useState(false);
  const [assumindoLote, setAssumindoLote] = useState(false);
  const [resultadosLote, setResultadosLote] = useState<ResultadoAssuncaoLote[]>([]);
  const [erroAcao, setErroAcao] = useState("");
  const [mostrarViagens, setMostrarViagens] = useState(false);
  const [modoDemonstracao, setModoDemonstracao] = useState(false);
  const [planoViagens, setPlanoViagens] = useState<PlanoViagens | null>(null);
  const [carregandoViagens, setCarregandoViagens] = useState(false);
  const [erroViagens, setErroViagens] = useState("");
  const [retryViagens, setRetryViagens] = useState(0);
  const carregado = useRef(false);
  const executorAssuncaoLote = useRef(new ExecutorAssuncaoLote());
  const planoViagensExibido = modoDemonstracao ? planoViagemDemonstracao : planoViagens;

  useEffect(() => {
    let active = true;
    let loadingRequests = false;
    let requestController: AbortController | null = null;
    const loadRequests = () => {
      if (!active || document.visibilityState === "hidden" || loadingRequests) return;
      loadingRequests = true;
      if (!modoDemonstracao && !carregado.current) setCarregando(true);
      void consultarDadosReais(modoDemonstracao, async () => {
        requestController = new AbortController();
        const response = await fetch("/api/almoxarifado/requisicoes", {
          cache: "no-store",
          signal: requestController.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Não foi possível carregar as requisições.");
        return data.requisicoes as RequisicaoMock[];
      }).then((rows) => {
        if (active && rows) {
          setRequisicoes(rows);
          setErro("");
        }
      }).catch((cause) => {
        if (active) setErro(cause instanceof Error ? cause.message : "Não foi possível carregar as requisições.");
      }).finally(() => {
        if (active) {
          if (!modoDemonstracao) carregado.current = true;
          setCarregando(false);
        }
        requestController = null;
        loadingRequests = false;
      });
    };
    const stopPolling = startVisibilityPolling(document, loadRequests, 10000);
    loadRequests();
    return () => {
      active = false;
      requestController?.abort();
      stopPolling();
    };
  }, [atualizacao, modoDemonstracao]);

  useEffect(() => {
    if (!mostrarViagens) return;
    if (modoDemonstracao) return;

    let active = true;
    let loading = false;
    let requestController: AbortController | null = null;
    const carregarViagens = async () => {
      if (!active || document.visibilityState === "hidden" || loading) return;
      loading = true;
      setCarregandoViagens(true);
      try {
        const data = await carregarPlanoViagem(modoDemonstracao, async () => {
          requestController = new AbortController();
          const response = await fetch("/api/almoxarifado/viagens", {
            cache: "no-store",
            signal: requestController.signal,
          });
          const resultado = await response.json() as PlanoViagens & { error?: string };
          if (!response.ok) {
            throw new Error(resultado.error ?? "Não foi possível montar as viagens.");
          }
          return resultado;
        });
        if (active) {
          setPlanoViagens(data);
          setErroViagens("");
        }
      } catch (cause) {
        if (active) {
          setErroViagens(
            cause instanceof Error
              ? cause.message
              : "Não foi possível montar as viagens.",
          );
        }
      } finally {
        loading = false;
        requestController = null;
        if (active) setCarregandoViagens(false);
      }
    };

    const stopPolling = startVisibilityPolling(
      document,
      () => void carregarViagens(),
      10000,
    );
    void carregarViagens();
    return () => {
      active = false;
      requestController?.abort();
      stopPolling();
    };
  }, [mostrarViagens, modoDemonstracao, retryViagens]);

  const filtradas = useMemo(() => sortRequisitionsByPriority(requisicoes
    .filter((request) => `${request.numeroPedido} ${request.item} ${request.solicitante ?? ""}`.toLowerCase().includes(busca.toLowerCase()))
  ), [requisicoes, busca]);

  async function assumirRequisicao(requisicao: RequisicaoMock, codigoCracha: string) {
    if (assumindo) return;
    setAssumindo(true);
    setErroAcao("");
    try {
      const response = await fetch(`/api/almoxarifado/requisicoes/${encodeURIComponent(requisicao.numeroPedido)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "assumir", codigoCracha }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) {
        setErroAcao(data.error ?? "Não foi possível assumir a requisição.");
        setRequisicaoParaAssumir(null);
        setAtualizacao((current) => current + 1);
        return;
      }
      setRequisicaoParaAssumir(null);
      router.push(`/almoxarifado/requisicoes/${encodeURIComponent(requisicao.numeroPedido)}`);
    } catch {
      setErroAcao("Falha de comunicação ao assumir a requisição. Atualize a fila e tente novamente.");
      setRequisicaoParaAssumir(null);
    } finally {
      setAssumindo(false);
    }
  }

  async function assumirViagem(requisicoesDaViagem: RequisicaoMock[], codigoCracha: string) {
    setAssumindoLote(true);
    setErroAcao("");
    try {
      const resultados = await executorAssuncaoLote.current.executar(
        requisicoesDaViagem,
        codigoCracha,
        (requisicao, cracha) => fetch(
          `/api/almoxarifado/requisicoes/${encodeURIComponent(requisicao.numeroPedido)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "assumir", codigoCracha: cracha }),
          },
        ),
      );
      if (resultados) {
        setResultadosLote(resultados);
        setViagemParaAssumir(null);
        setAtualizacao((current) => current + 1);
      }
    } finally {
      setAssumindoLote(false);
    }
  }

  return (
    <main className="mx-auto max-w-7xl p-4 sm:p-6">
      <PageHeader
        eyebrow="Operação · Almoxarifado"
        title="Fila de requisições"
        description="Pedidos enviados pelos operadores, aguardando atendimento do almoxarifado."
      />

      <section aria-label="Controles da fila" className="mb-5 grid gap-3 rounded-2xl border border-border-subtle bg-white p-4 shadow-sm sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <label className="text-sm font-medium text-foreground">
          Buscar requisição
          <input
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Número, item ou solicitante"
            className="mt-1 block w-full rounded-xl border border-border px-3 py-2.5"
          />
        </label>
        <button
          type="button"
          onClick={() => setMostrarViagens((show) => !show)}
          aria-expanded={mostrarViagens}
          aria-controls="painel-viagens"
          className="min-h-11 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-hover active:bg-brand-pressed"
        >
          {mostrarViagens ? "Fechar viagens" : "Montar viagem"}
        </button>
        <button
          type="button"
          onClick={() => setAtualizacao((current) => current + 1)}
          disabled={carregando}
          className="min-h-11 rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-semibold text-foreground disabled:opacity-50"
        >
          Atualizar fila
        </button>
      </section>

      {mostrarViagens && (
        <section id="painel-viagens" aria-label="Viagens agrupadas por local" className="mb-6 rounded-2xl border border-border-subtle bg-background p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-foreground">Viagem única por origem</h2>
              <p className="text-sm text-text-secondary">As requisições continuam sendo assumidas individualmente pelo fluxo atual.</p>
            </div>
            {podeAtivarDemonstracao && (
              <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-sm font-medium text-foreground">
                <input
                  type="checkbox"
                  checked={modoDemonstracao}
                  onChange={(event) => setModoDemonstracao(event.target.checked)}
                  className="size-4 accent-brand"
                />
                Ver dados simulados
              </label>
            )}
            {planoViagensExibido && (
              <p className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-foreground" aria-live="polite">
                Idas sem agrupar: {planoViagensExibido.metricas.idasSemAgrupar} · Viagens agrupadas: {planoViagensExibido.metricas.idasAgrupadas} · Economia: {planoViagensExibido.metricas.idasEconomizadas}
                {planoViagensExibido.metricas.idasSemAgrupar === planoViagensExibido.metricas.idasAgrupadas && <span className="ml-2 font-normal">Sem ganho com a demanda atual.</span>}
              </p>
            )}
          </div>

          {erroViagens ? (
            <ErrorState message={erroViagens} onRetry={() => {
              setErroViagens("");
              setCarregandoViagens(true);
              setRetryViagens((current) => current + 1);
            }} />
          ) : carregandoViagens && !planoViagensExibido ? (
            <LoadingState label="Montando viagens…" rows={3} />
          ) : planoViagensExibido?.viagens.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {planoViagensExibido.viagens.map((viagem) => (
                <article key={viagem.localId ?? "sem-origem"} className="rounded-2xl border border-border-subtle bg-white p-4 shadow-sm">
                  <h3 className="font-bold text-foreground">{viagem.localNome}: {viagem.quantidadeRequisicoes} requisições, {viagem.quantidadeItens} itens</h3>
                  <p className="mt-1 text-sm text-text-secondary">
                    Mais antiga: {formatarIdade(viagem.requisicoes.reduce((maisAntiga, request) =>
                      new Date(request.criadoEm).getTime() < new Date(maisAntiga).getTime()
                        ? request.criadoEm
                        : maisAntiga,
                    viagem.requisicoes[0]?.criadoEm ?? new Date().toISOString()))}
                  </p>
                  <ul className="mt-3 space-y-3">
                    {viagem.itens.map((item) => (
                      <li key={item.itemId} className="border-t border-border-subtle pt-2 text-sm">
                        <p className="font-semibold text-foreground">{item.nome} · {item.quantidadeTotal}</p>
                        <p className="text-xs text-text-secondary">{item.requisicoes.map((request) => `${request.numeroPedido} (${request.quantidade})`).join(", ")}</p>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 border-t border-border-subtle pt-2 text-xs text-text-secondary">
                    Requisições: {viagem.requisicoes.map((request) => request.numeroPedido).join(", ")}
                  </p>
                  <button
                    type="button"
                    disabled={modoDemonstracao || assumindoLote}
                    title={modoDemonstracao ? "As requisições simuladas não existem no banco." : undefined}
                    onClick={() => {
                      const numeros = new Set(viagem.requisicoes.map((request) => request.numeroPedido));
                      const pendentes = requisicoes.filter((request) =>
                        request.status === "pendente" && numeros.has(request.numeroPedido),
                      );
                      if (!pendentes.length) {
                        setErroAcao("Nenhuma requisição desta viagem continua pendente na fila.");
                        return;
                      }
                      setErroAcao("");
                      setResultadosLote([]);
                      setViagemParaAssumir(pendentes);
                    }}
                    className="mt-4 min-h-11 rounded-xl border border-brand px-3 py-2 text-sm font-semibold text-brand hover:bg-priority-surface disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Assumir todas desta viagem
                  </button>
                  {modoDemonstracao && <p className="mt-2 text-sm text-foreground">As requisições simuladas não existem no banco e não podem ser assumidas.</p>}
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="Nenhuma viagem para montar" message="Não há requisições pendentes para agrupar no momento." />
          )}

          {resultadosLote.length > 0 && (
            <section aria-label="Resultado de assumir requisições" aria-live="polite" className="mt-5 rounded-2xl border border-border bg-white p-4">
              <h3 className="font-semibold text-foreground">Resultado da viagem</h3>
              <ul className="mt-2 space-y-2 text-sm">
                {resultadosLote.map((resultado) => (
                  <li key={resultado.numeroPedido}>
                    <span className="font-medium">Pedido {resultado.numeroPedido}:</span>{" "}
                    {resultado.tipo === "assumida"
                      ? <>assumida. <Link className="font-semibold text-brand underline" href={`/almoxarifado/requisicoes/${encodeURIComponent(resultado.numeroPedido)}`}>Abrir checklist</Link></>
                      : resultado.tipo === "ja-assumida"
                        ? `já assumida por ${resultado.atendente}.`
                        : `erro: ${resultado.mensagem}`}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </section>
      )}

      {erro ? (
        <ErrorState message={erro} onRetry={() => setAtualizacao((current) => current + 1)} />
      ) : carregando ? (
        <LoadingState label="Carregando requisições…" />
      ) : filtradas.length === 0 ? (
        <EmptyState title="Nenhuma requisição encontrada" message="Não há pedidos que correspondam aos filtros atuais." />
      ) : (
        <>
        <div className="hidden overflow-x-auto rounded-card bg-surface shadow-card md:block">
          <table className="w-full min-w-[64rem] border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-background text-xs uppercase tracking-wide text-text-secondary">
              <tr>{["Nº", "Setor", "Itens", "Idade", "Prioridade", "Descrição", "Status", "Solicitante", "Checklist"].map((heading) => <th key={heading} className="border-b border-border-subtle px-4 py-3 font-semibold">{heading}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {filtradas.map((request) => (
                <tr key={request.numeroPedido} className={`align-top odd:bg-background/60 hover:bg-priority-surface ${request.prioridade === "prioridade" ? PRIORITY_QUEUE_ROW_CLASS : ""}`}>
                  <td className="px-4 py-3 font-semibold text-foreground">{request.numeroPedido}</td>
                  <td className="px-4 py-3 text-text-secondary">{request.setor}</td>
                  <td className="max-w-sm break-words px-4 py-3">
                    <span className="font-medium">{request.itens?.length ?? 0} {request.itens?.length === 1 ? "item" : "itens"}</span>
                    {request.itens?.map((item) => <div key={item.id} className="mt-1 text-xs text-text-secondary">
                      {item.nome}<ItemDescription className="mt-1" categoria={item.categoria} descricao={item.descricao} />
                    </div>)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">{formatarIdade(request.data)}</td>
                  <td className="px-4 py-3"><PriorityBadge priority={request.prioridade} /></td>
                  <td className="max-w-64 px-4 py-3"><RequisitionDescription value={request.descricao} variant="queue" priority={request.prioridade === "prioridade"} /></td>
                  <td className="px-4 py-3"><StatusBadge label={request.status === "pendente" ? "Aguardando" : "Em atendimento"} tone={request.status === "pendente" ? "warning" : "brand"} /></td>
                  <td className="px-4 py-3">{request.solicitante ?? "—"}</td>
                  <td className="px-4 py-3">
                    {request.status === "pendente" ? (
                      <>
                        <button
                          type="button"
                          disabled={modoDemonstracao}
                          title={modoDemonstracao ? "As requisições não podem ser assumidas durante a simulação." : undefined}
                          onClick={() => { setErroAcao(""); setRequisicaoParaAssumir(request); }}
                          className="min-h-11 rounded-control px-3 font-semibold text-brand hover:bg-priority-surface hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Assumir
                        </button>
                        {modoDemonstracao && <span className="ml-2 text-xs text-text-secondary">Indisponível durante a simulação</span>}
                      </>
                    ) : (
                      <Link href={`/almoxarifado/requisicoes/${encodeURIComponent(request.numeroPedido)}`} className="font-semibold text-brand hover:underline">
                        Abrir checklist
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid gap-3 md:hidden">
          {filtradas.map((request) => (
            <article key={request.numeroPedido} className={`grid gap-4 rounded-card bg-surface p-4 shadow-card ${request.prioridade === "prioridade" ? "border-l-4 border-priority bg-priority-surface/50" : ""}`}>
              <header className="flex flex-wrap items-start justify-between gap-3">
                <div><h2 className="font-bold text-foreground">Pedido {request.numeroPedido}</h2><p className="mt-1 text-sm text-text-secondary">{request.setor} · {formatarIdade(request.data)}</p></div>
                <StatusBadge label={request.status === "pendente" ? "Aguardando" : "Em atendimento"} tone={request.status === "pendente" ? "warning" : "brand"} />
              </header>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-text-secondary">Materiais</dt><dd className="font-medium">{request.itens?.length ?? 0} {request.itens?.length === 1 ? "item" : "itens"}</dd></div>
                <div><dt className="text-text-secondary">Solicitante</dt><dd className="font-medium break-words">{request.solicitante ?? "—"}</dd></div>
                <div><dt className="text-text-secondary">Quantidade</dt><dd className="font-medium">{request.quantidade} {request.unidadeMedida}</dd></div>
                <div><dt className="text-text-secondary">Prioridade</dt><dd className="mt-1"><PriorityBadge priority={request.prioridade} /></dd></div>
              </dl>
              <ul className="divide-y divide-border-subtle">
                {request.itens?.map((item) => <li key={item.id} className="py-3 first:pt-0">
                  <p className="font-semibold text-foreground">{item.nome}</p>
                  <ItemDescription className="mt-1 text-text-secondary" categoria={item.categoria} descricao={item.descricao} />
                </li>)}
              </ul>
              {request.descricao && <RequisitionDescription value={request.descricao} variant="queue" priority={request.prioridade === "prioridade"} />}
              {request.status === "pendente" ? (
                <button type="button" disabled={modoDemonstracao} onClick={() => { setErroAcao(""); setRequisicaoParaAssumir(request); }} className="min-h-11 w-full rounded-control bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50">Assumir requisição</button>
              ) : (
                <Link href={`/almoxarifado/requisicoes/${encodeURIComponent(request.numeroPedido)}`} className="inline-flex min-h-11 items-center justify-center rounded-control border border-brand px-4 text-sm font-semibold text-brand">Abrir checklist</Link>
              )}
              {modoDemonstracao && request.status === "pendente" && <p className="text-sm text-text-secondary">Indisponível durante a simulação.</p>}
            </article>
          ))}
        </div>
        </>
      )}

      {erroAcao && <p role="alert" aria-live="assertive" className="mt-4 rounded-xl border border-error/30 bg-error-surface p-3 text-sm text-error">{erroAcao}</p>}
      {requisicaoParaAssumir && (
        <ModalAcaoRequisicao
          requisicao={requisicaoParaAssumir}
          acao="assumir"
          busy={assumindo}
          onClose={() => { if (!assumindo) setRequisicaoParaAssumir(null); }}
          onConfirm={(request, cracha) => void assumirRequisicao(request, cracha)}
        />
      )}
      {viagemParaAssumir && viagemParaAssumir.length > 0 && (
        <ModalAcaoRequisicao
          requisicao={viagemParaAssumir[0]}
          acao="assumir"
          titulo="Assumir todas desta viagem"
          descricao={`${viagemParaAssumir.length} requisições serão processadas uma por vez. O crachá será validado em cada pedido.`}
          busy={assumindoLote}
          onClose={() => { if (!assumindoLote) setViagemParaAssumir(null); }}
          onConfirm={(_, cracha) => void assumirViagem(viagemParaAssumir, cracha)}
        />
      )}
    </main>
  );
}