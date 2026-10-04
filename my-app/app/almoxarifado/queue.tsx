"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader, StatusBadge } from "../components/industrial";
import type { RequisicaoMock } from "../../lib/types/almoxarifado";

export default function RequisicoesQueuePage() {
  const [requisicoes, setRequisicoes] = useState<RequisicaoMock[]>([]);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [atualizacao, setAtualizacao] = useState(0);
  const carregado = useRef(false);

  useEffect(() => {
    let active = true;
    const loadRequests = () => {
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
      });
    };
    loadRequests();
    const refreshTimer = window.setInterval(loadRequests, 30000);
    return () => { active = false; window.clearInterval(refreshTimer); };
  }, [atualizacao]);

  const filtradas = useMemo(() => requisicoes.filter((request) =>
    `${request.numeroPedido} ${request.item} ${request.solicitante ?? ""}`.toLowerCase().includes(busca.toLowerCase())
  ), [requisicoes, busca]);

  return (
    <div>
      <PageHeader
        eyebrow="Operação"
        title="Fila de requisições"
        description="Pedidos recebidos e organizados por prioridade para agilizar o atendimento do almoxarifado."
        action={
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-medium text-slate-700">
              Buscar
              <input
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                placeholder="Número, item ou solicitante"
                className="mt-1 block w-full min-w-[220px] rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none sm:w-72"
              />
            </label>
            <button
              type="button"
              onClick={() => setAtualizacao((current) => current + 1)}
              disabled={carregando}
              className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 disabled:opacity-50"
            >
              Atualizar fila
            </button>
          </div>
        }
      />

      {erro && <p role="alert" className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</p>}

      {carregando ? (
        <div role="status" className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
          Carregando requisições…
        </div>
      ) : filtradas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500 shadow-sm">
          Nenhuma requisição encontrada.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  {['Nº', 'Item', 'Qtd.', 'Prioridade', 'Status', 'Solicitante', 'Data'].map((heading) => (
                    <th key={heading} className="border-b border-slate-200 px-4 py-3 font-semibold">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtradas.map((request) => (
                  <tr key={request.numeroPedido} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3 font-bold text-slate-900">{request.numeroPedido}</td>
                    <td className="px-4 py-3">
                      {request.itens?.length ? (
                        <ul className="space-y-1">
                          {request.itens.map((item) => (
                            <li key={item.id} className="font-medium text-slate-800">
                              {item.nome} · {item.quantidade} {item.unidadeMedida}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="font-medium text-slate-800">
                          {request.item} · {request.quantidade} {request.unidadeMedida}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-700">{request.quantidade}</td>
                    <td className="px-4 py-3">
                      <StatusBadge label={request.prioridade === "prioridade" ? "Prioritária" : "Padrão"} tone={request.prioridade === "prioridade" ? "danger" : "brand"} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge label={request.status === "pendente" ? "Aguardando" : "Em atendimento"} tone={request.status === "pendente" ? "warning" : "success"} />
                    </td>
                    <td className="px-4 py-3 text-slate-700">{request.solicitante ?? "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">{new Date(request.data).toLocaleString("pt-BR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 p-3 md:hidden">
            {filtradas.map((request) => (
              <article key={request.numeroPedido} className="rounded-2xl border border-slate-200 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Requisição</p>
                    <p className="mt-1 text-lg font-black text-slate-900">#{request.numeroPedido}</p>
                  </div>
                  <StatusBadge label={request.prioridade === "prioridade" ? "Prioritária" : "Padrão"} tone={request.prioridade === "prioridade" ? "danger" : "brand"} />
                </div>
                <div className="mt-3 space-y-2 text-sm text-slate-600">
                  <p className="font-medium text-slate-800">{request.itens?.length ? request.itens.map((item) => `${item.nome} · ${item.quantidade} ${item.unidadeMedida}`).join(" · ") : `${request.item} · ${request.quantidade} ${request.unidadeMedida}`}</p>
                  <p>Solicitante: {request.solicitante ?? "—"}</p>
                  <div className="flex items-center justify-between gap-3">
                    <p>Data: {new Date(request.data).toLocaleString("pt-BR")}</p>
                    <StatusBadge label={request.status === "pendente" ? "Aguardando" : "Em atendimento"} tone={request.status === "pendente" ? "warning" : "success"} />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}