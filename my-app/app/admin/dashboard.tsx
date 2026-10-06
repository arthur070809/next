"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Stats = {
  estoqueTotal: number;
  requisicoesPendentes: number;
  usuariosAtivos: number;
  itensNoDeposito: number;
  sobrasHoje: number;
  itensParaRepor: Array<{ nome: string; codigo: string | null }>;
};

export default function AdminDashboard({ stats, canResetDemo }: { stats: Stats; canResetDemo: boolean }) {
  const router = useRouter();
  const [resettingDemo, setResettingDemo] = useState(false);
  const [demoResetMessage, setDemoResetMessage] = useState("");
  const [demoResetError, setDemoResetError] = useState("");
  const cards = [
    { label: "Itens ativos no estoque", value: stats.estoqueTotal, tone: "text-slate-950" },
    { label: "Requisições pendentes", value: stats.requisicoesPendentes, tone: "text-amber-700" },
    { label: "Usuários ativos", value: stats.usuariosAtivos, tone: "text-royal" },
    { label: "Itens no depósito", value: stats.itensNoDeposito, tone: "text-emerald-800" },
    { label: "Sobras registradas hoje", value: stats.sobrasHoje, tone: "text-emerald-800" },
    { label: "Itens no ponto de pedido ou abaixo", value: stats.itensParaRepor.length, tone: stats.itensParaRepor.length ? "text-amber-800" : "text-emerald-800" },
  ];

  async function resetDemo() {
    if (resettingDemo || !canResetDemo) return;
    if (!window.confirm("Resetar os dados operacionais da demonstração? As requisições e movimentações serão removidas e o fixture será recriado.")) return;
    setResettingDemo(true);
    setDemoResetError("");
    setDemoResetMessage("");
    try {
      const response = await fetch("/api/admin/demo/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(data.error ?? "Não foi possível resetar a demonstração.");
      setDemoResetMessage(data.message ?? "Demonstração resetada.");
      router.refresh();
    } catch (error) {
      setDemoResetError(error instanceof Error ? error.message : "Não foi possível resetar a demonstração.");
    } finally {
      setResettingDemo(false);
    }
  }

  return <main className="min-h-[calc(100vh-4rem)] px-4 py-8 sm:px-8">
    <div className="mx-auto max-w-7xl">
      <header><p className="text-sm font-semibold uppercase tracking-[0.2em] text-royal">Visão geral</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Início</h1><p className="mt-1 text-slate-600">Acompanhe a operação e acesse as tarefas principais.</p></header>
      <section aria-label="Resumo da operação" className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {cards.map((card) => <article key={card.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{card.label}</p><p className={`mt-3 text-3xl font-bold ${card.tone}`}>{card.value}</p></article>)}
      </section>
      <section aria-label="Alerta de ponto de pedido" className={`mt-5 rounded-xl border p-5 ${stats.itensParaRepor.length ? "border-amber-300 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
        <h2 className={`font-bold ${stats.itensParaRepor.length ? "text-amber-950" : "text-emerald-950"}`}>Alerta de ponto de pedido</h2>
        {stats.itensParaRepor.length
          ? <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-amber-900">{stats.itensParaRepor.map((item) => <li key={`${item.codigo ?? ""}-${item.nome}`}>{item.codigo ? `${item.codigo} · ` : ""}{item.nome}</li>)}</ul>
          : <p className="mt-2 text-sm text-emerald-900">Nenhum item está no ponto de pedido ou abaixo.</p>}
      </section>
      <section className="mt-8">
        <h2 className="text-xl font-bold text-slate-950">Ações rápidas</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Link href="/admin/usuarios" className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-royal focus-visible:outline-2 focus-visible:outline-royal"><p className="font-semibold text-slate-900">Cadastrar usuário</p><p className="mt-1 text-sm text-slate-500">Adicione um funcionário pelo código do crachá.</p></Link>
          <Link href="/admin/estoque" className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-royal focus-visible:outline-2 focus-visible:outline-royal"><p className="font-semibold text-slate-900">Gerenciar estoque</p><p className="mt-1 text-sm text-slate-500">Cadastre materiais e atualize quantidades.</p></Link>
          <Link href="/admin/deposito" className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-royal focus-visible:outline-2 focus-visible:outline-royal"><p className="font-semibold text-slate-900">Depósito de sobras</p><p className="mt-1 text-sm text-slate-500">Consulte saldos e movimentações.</p></Link>
        </div>
      </section>
      {canResetDemo && <section aria-labelledby="demo-reset-heading" className="mt-8 rounded-xl border border-amber-300 bg-amber-50 p-5">
        <h2 id="demo-reset-heading" className="font-bold text-amber-950">Ambiente de demonstração</h2>
        <p className="mt-1 text-sm text-amber-900">Restaura as requisições, movimentos e saldos do fixture. Usuários e catálogo são preservados.</p>
        {demoResetError && <p role="alert" className="mt-3 rounded-lg bg-red-100 p-3 text-sm text-red-800">{demoResetError}</p>}
        {demoResetMessage && <p role="status" className="mt-3 rounded-lg bg-emerald-100 p-3 text-sm text-emerald-900">{demoResetMessage}</p>}
        <button type="button" onClick={() => void resetDemo()} disabled={resettingDemo} className="mt-4 min-h-11 rounded-lg border border-amber-700 px-4 py-2 text-sm font-semibold text-amber-950 disabled:cursor-wait disabled:opacity-60">
          {resettingDemo ? "Resetando…" : "Resetar demonstração"}
        </button>
      </section>}
    </div>
  </main>;
}