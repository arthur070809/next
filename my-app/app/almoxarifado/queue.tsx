"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import ModalAcaoRequisicao from "../components/ModalAcaoRequisicao";
import type { RequisicaoMock } from "../../lib/types/almoxarifado";
import { startVisibilityPolling } from "../../lib/visibility-polling";

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
  const [assumindo, setAssumindo] = useState(false);
  const [erroAcao, setErroAcao] = useState("");
  const carregado = useRef(false);

  useEffect(() => {
    let active = true;
    let loadingRequests = false;
    const loadRequests = () => {
      if (!active || document.visibilityState === "hidden" || loadingRequests) return;
      loadingRequests = true;
      if (!carregado.current) setCarregando(true);
      fetch("/api/almoxarifado/requisicoes", { cache: "no-store" }).then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Não foi possível carregar as requisições.");
        return data.requisicoes as RequisicaoMock[];
      }).then((rows) => {
        if (active) {
          setRequisicoes(rows);
          setErro("");
        }
      }).catch((cause) => {
        if (active) setErro(cause instanceof Error ? cause.message : "Não foi possível carregar as requisições.");
      }).finally(() => {
        if (active) {
          carregado.current = true;
          setCarregando(false);
        }
        loadingRequests = false;
      });
    };
    const stopPolling = startVisibilityPolling(document, loadRequests, 10000);
    loadRequests();
    return () => {
      active = false;
      stopPolling();
    };
  }, [atualizacao]);

  const filtradas = useMemo(() => requisicoes.filter((request) =>
    `${request.numeroPedido} ${request.item} ${request.solicitante ?? ""}`.toLowerCase().includes(busca.toLowerCase())
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

  return <main className="mx-auto max-w-7xl p-4 sm:p-6">
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-semibold text-[#212529]">Fila de requisições</h1><p className="mt-1 text-sm text-slate-600">Pedidos enviados pelos operadores, aguardando atendimento do almoxarifado.</p></div><div className="flex flex-wrap items-end gap-3"><label className="text-sm font-medium text-slate-700">Buscar<input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Número, item ou solicitante" className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 sm:w-72" /></label><button type="button" onClick={() => setAtualizacao((current) => current + 1)} disabled={carregando} className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">Atualizar fila</button></div></div>
    {erro && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
    {carregando ? <p role="status" className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">Carregando requisições…</p> : filtradas.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">Nenhuma requisição encontrada.</p> : <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full min-w-[900px] border-collapse text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{["Nº", "Setor", "Itens", "Idade", "Prioridade", "Status", "Solicitante", "Checklist"].map((heading) => <th key={heading} className="border-b border-slate-200 px-4 py-3 font-semibold">{heading}</th>)}</tr></thead>
        <tbody>{filtradas.map((request) => <tr key={request.numeroPedido} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
          <td className="px-4 py-3 font-semibold text-slate-900">{request.numeroPedido}</td>
          <td className="px-4 py-3 text-slate-600">Não informado</td>
          <td className="px-4 py-3">{request.itens?.length ?? 0}</td>
          <td className="px-4 py-3 whitespace-nowrap">{formatarIdade(request.data)}</td>
          <td className="px-4 py-3">{request.prioridade === "prioridade" ? "Prioritária" : "Padrão"}</td>
          <td className="px-4 py-3">{request.status === "pendente" ? "Aguardando" : "Em atendimento"}</td>
          <td className="px-4 py-3">{request.solicitante ?? "—"}</td>
          <td className="px-4 py-3">{request.status === "pendente" ? <button type="button" onClick={() => { setErroAcao(""); setRequisicaoParaAssumir(request); }} className="font-semibold text-royal hover:underline">Assumir</button> : <Link href={`/almoxarifado/requisicoes/${encodeURIComponent(request.numeroPedido)}`} className="font-semibold text-royal hover:underline">Abrir checklist</Link>}</td>
        </tr>)}</tbody>
      </table>
    </div>}
    {erroAcao && <p role="alert" aria-live="assertive" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{erroAcao}</p>}
    {requisicaoParaAssumir && <ModalAcaoRequisicao
      requisicao={requisicaoParaAssumir}
      acao="assumir"
      busy={assumindo}
      onClose={() => { if (!assumindo) setRequisicaoParaAssumir(null); }}
      onConfirm={(request, cracha) => void assumirRequisicao(request, cracha)}
    />}
  </main>;
}