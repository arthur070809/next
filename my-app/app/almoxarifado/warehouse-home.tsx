"use client";

import { useEffect, useState } from "react";
import { ActionTile, PageHeader, SummaryCard } from "../components/industrial";
import { ErrorState } from "../components/ui";

type Resumo = {
  materiaisAtivos: number;
  materiaisSemEstoque: number;
  requisicoesPendentes: number;
  itensComSobras: number;
  sobrasHoje: number;
};

const cards: Array<{ key: keyof Resumo; label: string; detail: string; tone: "default" | "success" | "warning" | "danger" | "brand" }> = [
  { key: "materiaisAtivos", label: "Materiais ativos", detail: "Itens cadastrados no estoque", tone: "brand" },
  { key: "materiaisSemEstoque", label: "Sem estoque", detail: "Materiais ativos com saldo zero", tone: "danger" },
  { key: "requisicoesPendentes", label: "Requisições pendentes", detail: "Pedidos aguardando atendimento", tone: "warning" },
  { key: "itensComSobras", label: "Itens no depósito", detail: "Materiais com saldo disponível", tone: "success" },
  { key: "sobrasHoje", label: "Sobras registradas hoje", detail: "Unidades devolvidas ao depósito", tone: "default" },
];

export default function WarehouseHome({ userName, badge }: { userName: string; badge: string }) {
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const primeiroNome = userName.trim().split(/\s+/)[0] || badge;

  useEffect(() => {
    let ativo = true;
    fetch("/api/almoxarifado/resumo", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Não foi possível carregar o resumo.");
        return data.resumo as Resumo;
      })
      .then((data) => {
        if (ativo) {
          setResumo(data);
          setErro("");
        }
      })
      .catch((cause: unknown) => {
        if (ativo) setErro(cause instanceof Error ? cause.message : "Não foi possível carregar o resumo.");
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => { ativo = false; };
  }, [retryCount]);

  return (
    <div>
      <PageHeader
        eyebrow="Visão geral"
        title={`Olá, ${primeiroNome}`}
        description="Acompanhe a operação e acesse rapidamente o que exige ação no dia a dia."
      />

      {!carregando && !erro && resumo?.materiaisAtivos === 0 && (
        <p role="status" className="mb-6 rounded-2xl border border-dashed border-border bg-white px-4 py-5 text-sm text-text-secondary">
          O estoque está vazio no momento.
        </p>
      )}

      <section aria-label="Resumo do almoxarifado" aria-live="polite" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {carregando ? (
          cards.map((card) => (
            <div key={card.key} aria-hidden="true" className="h-32 animate-pulse rounded-2xl border border-border-subtle bg-white p-5">
              <div className="h-4 w-2/3 rounded bg-border-subtle" />
              <div className="mt-5 h-8 w-1/3 rounded bg-border-subtle" />
            </div>
          ))
        ) : erro ? (
          <div className="sm:col-span-2 xl:col-span-5">
            <ErrorState message={erro} onRetry={() => {
              setErro("");
              setCarregando(true);
              setRetryCount((current) => current + 1);
            }} />
          </div>
        ) : (
          cards.map((card) => (
            <SummaryCard
              key={card.key}
              label={card.label}
              value={resumo?.[card.key] ?? 0}
              hint={card.detail}
              tone={card.tone}
            />
          ))
        )}
      </section>

      <section className="mt-8" aria-labelledby="warehouse-shortcuts">
        <h2 id="warehouse-shortcuts" className="text-xl font-black tracking-tight text-foreground">
          Ações rápidas
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ActionTile href="/almoxarifado/requisicoes" title="Fila de requisições" description="Receba e acompanhe os pedidos dos operadores." icon="▤" tone="warning" />
          <ActionTile href="/almoxarifado/estoque" title="Estoque" description="Consulte materiais e saldos em tempo real." icon="▦" tone="brand" />
          <ActionTile href="/almoxarifado/estoque#novo-item" title="Cadastrar item" description="Registre uma entrada no estoque." icon="＋" tone="success" />
          <ActionTile href="/almoxarifado/deposito" title="Depósito" description="Acompanhe itens avulsos devolvidos." icon="◇" tone="default" />
        </div>
      </section>
    </div>
  );
}