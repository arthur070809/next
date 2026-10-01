"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { RequisicaoAtendida } from "../../lib/types/requisicao";

export default function RequisicoesQueuePage() {
  const [requisicoes, setRequisicoes] = useState<RequisicaoAtendida[]>([]);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/requests", { cache: "no-store" }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Não foi possível carregar as requisições.");
      return data.requisicoes as RequisicaoAtendida[];
    }).then((rows) => { if (active) setRequisicoes(rows); })
      .catch((cause) => { if (active) setErro(cause instanceof Error ? cause.message : "Não foi possível carregar as requisições."); })
      .finally(() => { if (active) setCarregando(false); });
    return () => { active = false; };
  }, []);

  const filtradas = useMemo(() => requisicoes.filter((request) =>
    `${request.numero} ${request.item} ${request.funcionario.nome}`.toLowerCase().includes(busca.toLowerCase())
  ), [requisicoes, busca]);

  return <main className="mx-auto max-w-7xl p-4 sm:p-6">
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-semibold text-[#212529]">Requisições retiradas</h1><p className="mt-1 text-sm text-slate-600">Registro de sobras por requisição.</p></div><label className="text-sm font-medium text-slate-700">Buscar<input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Número, item ou solicitante" className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 sm:w-72" /></label></div>
    {erro && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
    {carregando ? <p role="status" className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">Carregando requisições…</p> : filtradas.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">Nenhuma requisição encontrada.</p> : <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full min-w-[760px] border-collapse text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{["Nº", "Item", "Qtd.", "Origem", "Devolvido", "Solicitante", "Data", ""].map((heading) => <th key={heading} className="border-b border-slate-200 px-4 py-3 font-semibold">{heading}</th>)}</tr></thead>
        <tbody>{filtradas.map((request) => <tr key={request.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
          <td className="px-4 py-3 font-semibold text-slate-900">#{request.numero}</td><td className="px-4 py-3"><span className="font-medium text-slate-800">{request.item}</span>{request.estoqueItem?.codigo && <span className="block text-xs text-slate-500">{request.estoqueItem.codigo}</span>}</td><td className="px-4 py-3">{request.quantidade} {request.unidadeMedida}</td><td className="px-4 py-3">{request.origem === "DEPOSITO" ? "Depósito" : "Estoque"}</td><td className="px-4 py-3">{request.qtdDevolvida}</td><td className="px-4 py-3">{request.funcionario.nome}</td><td className="px-4 py-3 whitespace-nowrap">{new Date(request.createdAt).toLocaleString("pt-BR")}</td><td className="px-4 py-3"><Link href={`/almoxarifado/requisicao/${encodeURIComponent(request.id)}`} className="font-semibold text-royal hover:underline">Detalhes / sobra</Link></td>
        </tr>)}</tbody>
      </table>
    </div>}
  </main>;
}