"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type DepositoItem = {
  id: string;
  nome: string;
  categoria: string;
  unidade: string;
  quantidadeDeposito: number;
};

export default function DepositoPage() {
  const [itens, setItens] = useState<DepositoItem[]>([]);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const carregarItens = async () => {
    setCarregando(true);
    try {
      const response = await fetch("/api/estoque", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        setErro(data.error ?? "Nao foi possivel carregar o deposito.");
        return;
      }
      setItens(data.itens ?? []);
    } catch {
      setErro("Nao foi possivel comunicar com o servidor.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    void carregarItens();
  }, []);

  const itensFiltrados = useMemo(
    () => itens.filter((item) => `${item.nome} ${item.categoria}`.toLowerCase().includes(busca.toLowerCase())),
    [itens, busca]
  );

  const alterarQuantidade = async (item: DepositoItem, delta: number) => {
    const quantidade = Math.max(0, item.quantidadeDeposito + delta);
    const response = await fetch("/api/deposito", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estoqueItemId: item.id, quantidade }),
    });
    if (response.ok) await carregarItens();
  };

  const totalSobras = itens.reduce((total, item) => total + item.quantidadeDeposito, 0);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-7xl">
        <header className="border-b border-slate-200 pb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">Almoxarifado Marcon</p>
          <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-950">Deposito de sobras</h1>
              <p className="mt-1 text-slate-600">Itens avulsos devolvidos depois da abertura de uma caixa.</p>
            </div>
            <Link href="/estoque" className="inline-flex min-h-10 items-center justify-center rounded-lg border border-royal px-4 text-sm font-semibold text-royal hover:bg-blue-50">Ir para o estoque principal</Link>
          </div>
        </header>

        <section className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-emerald-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Itens com sobras</p><p className="mt-2 text-3xl font-bold text-slate-950">{itens.filter((item) => item.quantidadeDeposito > 0).length}</p></div>
          <div className="rounded-xl border border-emerald-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Total de itens avulsos</p><p className="mt-2 text-3xl font-bold text-emerald-700">{totalSobras}</p></div>
        </section>

        <section className="mt-6 rounded-xl border border-emerald-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="text-xl font-bold text-slate-950">Sobras disponíveis</h2><p className="mt-1 text-sm text-slate-500">Aumente quando uma sobra for devolvida e diminua quando ela for entregue.</p></div>
            <input aria-label="Buscar sobra por nome ou categoria" placeholder="Buscar material ou categoria" value={busca} onChange={(event) => setBusca(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600" />
          </div>

          <div className="mt-5 space-y-3">
            {carregando ? <p className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">Carregando deposito...</p> : erro ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-8 text-center text-sm text-red-700">{erro}</p> : itensFiltrados.length === 0 ? <p className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">Nenhum item encontrado.</p> : itensFiltrados.map((item) => (
              <article key={item.id} className="flex flex-col gap-4 rounded-lg border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div><p className="font-semibold text-slate-900">{item.nome}</p><p className="mt-1 text-sm text-slate-500">{item.categoria} · sobra medida em unidades</p><p className="mt-2 text-sm text-emerald-700">Disponivel no deposito: <strong>{item.quantidadeDeposito} unidades</strong></p></div>
                <div className="flex items-center gap-3"><button type="button" onClick={() => void alterarQuantidade(item, -1)} disabled={item.quantidadeDeposito === 0} aria-label={`Diminuir sobra de ${item.nome}`} className="h-9 w-9 rounded border border-slate-300 text-lg text-slate-700 disabled:opacity-40">-</button><span className="min-w-12 text-center font-bold text-slate-900">{item.quantidadeDeposito}</span><button type="button" onClick={() => void alterarQuantidade(item, 1)} aria-label={`Aumentar sobra de ${item.nome}`} className="h-9 w-9 rounded bg-emerald-600 text-lg text-white">+</button></div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
