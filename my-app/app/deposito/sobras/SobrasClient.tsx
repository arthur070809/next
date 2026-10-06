"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { filtrarExcedentesPorProduto, totalizarExcedentesPorSetor, type ExcedenteRegistro } from "@/lib/deposito/excedentes";

type RegistroSobra = ExcedenteRegistro;

type SobrasResponse = {
  registros: RegistroSobra[];
  totaisPorSetor: Array<{ setor: string; quantidadePedida: number; quantidadeSeparada: number; quantidadeExcedente: number }>;
  totaisPorProduto: Array<{ itemId: string; produto: string; quantidadePedida: number; quantidadeSeparada: number; quantidadeExcedente: number }>;
  aviso: string;
  error?: string;
};

export default function SobrasPage() {
  const [registros, setRegistros] = useState<RegistroSobra[]>([]);
  const [aviso, setAviso] = useState("");
  const [produtoBusca, setProdutoBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;
    void fetch("/api/deposito/sobras", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as SobrasResponse;
        if (!response.ok) throw new Error(data.error ?? "Não foi possível carregar as sobras.");
        if (ativo) {
          setRegistros(data.registros);
          setAviso(data.aviso);
        }
      })
      .catch((cause: unknown) => {
        if (ativo) setErro(cause instanceof Error ? cause.message : "Não foi possível carregar as sobras.");
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => { ativo = false; };
  }, []);

  const registrosFiltrados = useMemo(
    () => filtrarExcedentesPorProduto(registros, produtoBusca),
    [produtoBusca, registros],
  );
  const totaisPorSetor = useMemo(
    () => totalizarExcedentesPorSetor(registrosFiltrados),
    [registrosFiltrados],
  );

  return <main className="mx-auto max-w-7xl p-4 sm:p-6">
    <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Depósito</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-950">Excedentes por setor e produto</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">Resumo das quantidades entregues além do pedido quando foi registrado motivo de lote mínimo.</p>
      </div>
      <Link href="/almoxarifado/deposito" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">
        Abrir saldos do depósito
      </Link>
    </header>

    <p className="mb-5 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">{aviso || "Os excedentes são quantidades entregues; não significam saldo físico disponível para reaproveitamento."}</p>

    <label className="mb-4 block max-w-md text-sm font-semibold text-slate-800">
      Filtrar por produto
      <input value={produtoBusca} onChange={(event) => setProdutoBusca(event.target.value)} placeholder="Nome ou código" className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 font-normal" />
    </label>
    {!carregando && !erro && totaisPorSetor.length > 0 && <section aria-label="Totais de excedentes por setor" className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {totaisPorSetor.map((total) => <article key={total.setor} className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-900">{total.setor}</h2>
        <p className="mt-1 text-sm text-slate-700">Pedido {total.quantidadePedida} · separado {total.quantidadeSeparada}</p>
        <p className="mt-1 text-sm font-bold text-amber-900">Excedente entregue: {total.quantidadeExcedente}</p>
      </article>)}
    </section>}
    {carregando
      ? <p role="status" className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-600">Carregando resumo…</p>
      : erro
        ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800">{erro}</p>
        : registrosFiltrados.length === 0
          ? <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">Nenhum excedente por lote mínimo foi encontrado em requisições concluídas.</p>
          : <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[900px] border-collapse text-left text-sm">
              <caption className="sr-only">Excedentes entregues agrupados por setor e produto</caption>
              <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                <tr>{["Setor", "Produto", "Pedido", "Separado", "Excedente entregue", "Livre no estoque central", "Saldo global no depósito", "Requisições"].map((title) =>
                  <th key={title} scope="col" className="border-b border-slate-200 px-4 py-3 font-semibold">{title}</th>)}</tr>
              </thead>
              <tbody>
                {registrosFiltrados.map((registro) => <tr key={`${registro.itemId}-${registro.setor}`} className="border-b border-slate-100 last:border-0">
                  <th scope="row" className="px-4 py-3 font-semibold text-slate-900">{registro.setor}</th>
                  <td className="px-4 py-3">{registro.produto}{registro.codigo ? ` (${registro.codigo})` : ""}<span className="mt-1 block text-xs text-slate-600">{registro.categoria?.trim() || "—"}</span></td>
                  <td className="px-4 py-3">{registro.quantidadePedida}</td>
                  <td className="px-4 py-3">{registro.quantidadeSeparada}</td>
                  <td className="px-4 py-3 font-semibold text-amber-900">{registro.quantidadeExcedente}</td>
                  <td className="px-4 py-3">{registro.estoqueLivre}</td>
                  <td className="px-4 py-3">{registro.saldoDeposito}</td>
                  <td className="px-4 py-3">{registro.pedidos.join(", ")}</td>
                </tr>)}
              </tbody>
            </table>
          </div>}
  </main>;
}
