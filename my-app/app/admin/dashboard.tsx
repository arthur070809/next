import { ActionTile, PageHeader, SummaryCard } from "../components/industrial";

type Stats = {
  estoqueTotal: number;
  requisicoesPendentes: number;
  usuariosAtivos: number;
  itensNoDeposito: number;
  sobrasHoje: number;
};

export default function AdminDashboard({ stats }: { stats: Stats }) {
  const cards = [
    { label: "Itens ativos no estoque", value: stats.estoqueTotal, tone: "brand" as const },
    { label: "Requisições pendentes", value: stats.requisicoesPendentes, tone: "warning" as const },
    { label: "Usuários ativos", value: stats.usuariosAtivos, tone: "default" as const },
    { label: "Itens no depósito", value: stats.itensNoDeposito, tone: "success" as const },
    { label: "Sobras registradas hoje", value: stats.sobrasHoje, tone: "default" as const },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Visão geral"
        title="Início"
        description="Acompanhe a operação e acesse rapidamente as áreas que exigem atenção hoje."
      />

      <section aria-label="Resumo da operação" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => (
          <SummaryCard key={card.label} label={card.label} value={card.value} tone={card.tone} />
        ))}
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-black tracking-tight text-slate-900">Ações rápidas</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <ActionTile href="/admin/usuarios" title="Cadastrar usuário" description="Adicione um funcionário pelo código do crachá." icon="◉" tone="brand" />
          <ActionTile href="/admin/estoque" title="Gerenciar estoque" description="Cadastre materiais e atualize quantidades." icon="▦" tone="default" />
          <ActionTile href="/admin/deposito" title="Depósito de sobras" description="Consulte saldos e movimentações do depósito." icon="◇" tone="success" />
        </div>
      </section>
    </div>
  );
}