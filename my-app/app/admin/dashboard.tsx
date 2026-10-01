import Link from "next/link";

type Stats = {
  estoqueTotal: number;
  requisicoesPendentes: number;
  usuariosAtivos: number;
  itensNoDeposito: number;
  sobrasHoje: number;
};

export default function AdminDashboard({ stats }: { stats: Stats }) {
  const cards = [
    { label: "Itens ativos no estoque", value: stats.estoqueTotal, tone: "text-slate-950" },
    { label: "Requisições pendentes", value: stats.requisicoesPendentes, tone: "text-amber-700" },
    { label: "Usuários ativos", value: stats.usuariosAtivos, tone: "text-royal" },
    { label: "Itens no depósito", value: stats.itensNoDeposito, tone: "text-emerald-800" },
    { label: "Sobras registradas hoje", value: stats.sobrasHoje, tone: "text-emerald-800" },
  ];

  return <main className="min-h-[calc(100vh-4rem)] px-4 py-8 sm:px-8">
    <div className="mx-auto max-w-7xl">
      <header><p className="text-sm font-semibold uppercase tracking-[0.2em] text-royal">Visão geral</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Início</h1><p className="mt-1 text-slate-600">Acompanhe a operação e acesse as tarefas principais.</p></header>
      <section aria-label="Resumo da operação" className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => <article key={card.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{card.label}</p><p className={`mt-3 text-3xl font-bold ${card.tone}`}>{card.value}</p></article>)}
      </section>
      <section className="mt-8">
        <h2 className="text-xl font-bold text-slate-950">Ações rápidas</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Link href="/admin/usuarios" className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-royal focus-visible:outline-2 focus-visible:outline-royal"><p className="font-semibold text-slate-900">Cadastrar usuário</p><p className="mt-1 text-sm text-slate-500">Adicione um funcionário pelo código do crachá.</p></Link>
          <Link href="/admin/estoque" className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-royal focus-visible:outline-2 focus-visible:outline-royal"><p className="font-semibold text-slate-900">Gerenciar estoque</p><p className="mt-1 text-sm text-slate-500">Cadastre materiais e atualize quantidades.</p></Link>
          <Link href="/admin/deposito" className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-royal focus-visible:outline-2 focus-visible:outline-royal"><p className="font-semibold text-slate-900">Depósito de sobras</p><p className="mt-1 text-sm text-slate-500">Consulte saldos e movimentações.</p></Link>
        </div>
      </section>
    </div>
  </main>;
}