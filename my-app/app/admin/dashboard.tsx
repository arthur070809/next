"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ActionTile, PageHeader, StatusBadge, SummaryCard } from "../components/industrial";

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
    { label: "Itens ativos no estoque", value: stats.estoqueTotal, tone: "brand" as const },
    { label: "Requisições pendentes", value: stats.requisicoesPendentes, tone: "warning" as const },
    { label: "Usuários ativos", value: stats.usuariosAtivos, tone: "default" as const },
    { label: "Itens no depósito", value: stats.itensNoDeposito, tone: "success" as const },
    { label: "Sobras registradas hoje", value: stats.sobrasHoje, tone: "default" as const },
    {
      label: "Itens no ponto de pedido ou abaixo",
      value: stats.itensParaRepor.length,
      tone: stats.itensParaRepor.length ? "warning" as const : "success" as const,
    },
  ];

  async function resetDemo() {
    if (resettingDemo || !canResetDemo) return;
    if (!window.confirm("Restaurar os dados operacionais da apresentação? As requisições e movimentações serão removidas e o fixture será recriado.")) return;
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
      if (!response.ok) throw new Error(data.error ?? "Não foi possível restaurar os dados da apresentação.");
      setDemoResetMessage(data.message ?? "Dados de apresentação restaurados.");
      router.refresh();
    } catch (error) {
      setDemoResetError(error instanceof Error ? error.message : "Não foi possível restaurar os dados da apresentação.");
    } finally {
      setResettingDemo(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Visão geral"
        title="Início"
        description="Acompanhe a operação e acesse rapidamente as áreas que exigem atenção hoje."
      />

      <section aria-label="Resumo da operação" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <SummaryCard key={card.label} label={card.label} value={card.value} tone={card.tone} />
        ))}
      </section>

      <section aria-label="Alerta de ponto de pedido" className={`mt-5 rounded-card p-5 shadow-card ${stats.itensParaRepor.length ? "bg-warning-surface" : "bg-success-surface"}`}>
        <StatusBadge label={stats.itensParaRepor.length ? "Atenção necessária" : "Estoque regular"} tone={stats.itensParaRepor.length ? "warning" : "success"} />
        <h2 className="mt-3 font-bold text-foreground">Alerta de ponto de pedido</h2>
        {stats.itensParaRepor.length
          ? <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-foreground">{stats.itensParaRepor.map((item) => <li key={`${item.codigo ?? ""}-${item.nome}`}>{item.codigo ? `${item.codigo} · ` : ""}{item.nome}</li>)}</ul>
          : <p className="mt-2 text-sm text-text-secondary">Nenhum item está no ponto de pedido ou abaixo.</p>}
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-black tracking-tight text-foreground">Ações rápidas</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <ActionTile href="/admin/usuarios" title="Cadastrar usuário" description="Adicione um funcionário pelo código do crachá." icon="◉" tone="brand" />
          <ActionTile href="/admin/estoque" title="Gerenciar estoque" description="Cadastre materiais e atualize quantidades." icon="▦" tone="default" />
          <ActionTile href="/admin/deposito" title="Depósito de sobras" description="Consulte saldos e movimentações do depósito." icon="◇" tone="success" />
        </div>
      </section>
      {canResetDemo && <section aria-labelledby="demo-reset-heading" className="mt-8 rounded-card bg-surface p-4 shadow-card">
        <h2 id="demo-reset-heading" className="font-semibold text-foreground">Ferramentas de manutenção</h2>
        <p className="mt-1 text-sm text-text-secondary">Restaura requisições, movimentos e saldos da apresentação. Usuários e catálogo são preservados.</p>
        {demoResetError && <p role="alert" className="mt-3 rounded-lg bg-error-surface p-3 text-sm text-error">{demoResetError}</p>}
        {demoResetMessage && <p role="status" className="mt-3 rounded-lg bg-success-surface p-3 text-sm text-success">{demoResetMessage}</p>}
        <button type="button" onClick={() => void resetDemo()} disabled={resettingDemo} className="mt-4 min-h-11 rounded-control border border-brand bg-surface px-4 py-2 text-sm font-semibold text-brand hover:bg-priority-surface disabled:cursor-wait disabled:opacity-60">
          {resettingDemo ? "Restaurando…" : "Restaurar dados da apresentação"}
        </button>
      </section>}
    </div>
  );
}