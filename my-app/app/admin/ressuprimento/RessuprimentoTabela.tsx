"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  ClasseRessuprimento,
  SugestaoRessuprimento,
} from "@/lib/ressuprimento/analise";
import { ordenarPorDeficitRessuprimento } from "@/lib/ressuprimento/analise";
import { isAtOrBelowReorderPoint } from "@/lib/stock-status";
import { MAX_STOCK_INPUT } from "@/lib/stock-units";
import { PageHeader, StatusBadge } from "@/app/components/industrial";
import { EmptyState } from "@/app/components/ui";

const classes: Array<{ value: ClasseRessuprimento | "TODAS"; label: string }> = [
  { value: "TODAS", label: "Todas as classes" },
  { value: "VERMELHO", label: "Vermelho" },
  { value: "AMARELO", label: "Amarelo" },
  { value: "VERDE", label: "Verde" },
  { value: "SEM_DADOS", label: "Sem dados" },
];

const classeTexto: Record<ClasseRessuprimento, string> = {
  VERMELHO: "Vermelho — abaixo do prazo",
  AMARELO: "Amarelo — dentro da faixa de atenção",
  VERDE: "Verde — cobertura acima do dobro do prazo",
  SEM_DADOS: "Sem dados de consumo",
};

const classeCor: Record<ClasseRessuprimento, string> = {
  VERMELHO: "var(--error)",
  AMARELO: "var(--warning)",
  VERDE: "var(--success)",
  SEM_DADOS: "var(--text-secondary)",
};

const classeTom: Record<ClasseRessuprimento, "danger" | "warning" | "success" | "neutral"> = {
  VERMELHO: "danger",
  AMARELO: "warning",
  VERDE: "success",
  SEM_DADOS: "neutral",
};

function coberturaTexto(dias: number | null): string {
  if (dias === null) return "Sem dados";
  if (!Number.isFinite(dias)) return "Sem consumo";
  return `${dias.toFixed(1)} dias`;
}

function PontoAtualEditor({
  item,
}: {
  item: SugestaoRessuprimento;
}) {
  const router = useRouter();
  const [valor, setValor] = useState(item.pontoAtual === null ? "" : String(item.pontoAtual));
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: "erro" | "sucesso"; texto: string } | null>(null);

  async function salvar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const pontoAtual = Number(valor);
    if (!valor.trim() || !Number.isInteger(pontoAtual) || pontoAtual < 0 || pontoAtual > MAX_STOCK_INPUT) {
      setMensagem({ tipo: "erro", texto: `Informe um inteiro entre 0 e ${MAX_STOCK_INPUT.toLocaleString("pt-BR")}.` });
      return;
    }

    setSalvando(true);
    setMensagem(null);
    try {
      const response = await fetch("/api/admin/ressuprimento", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, pontoAtual }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) {
        setMensagem({ tipo: "erro", texto: body.error ?? "Não foi possível salvar o ponto atual." });
        return;
      }
      setValor(String(pontoAtual));
      setMensagem({ tipo: "sucesso", texto: "Ponto atual salvo." });
      router.refresh();
    } catch {
      setMensagem({ tipo: "erro", texto: "Não foi possível salvar o ponto atual. Verifique sua conexão e tente novamente." });
    } finally {
      setSalvando(false);
    }
  }

  const idMensagem = `ponto-atual-feedback-${item.id}`;
  return <form onSubmit={salvar} className="flex w-full min-w-0 flex-col gap-2">
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={0}
        max={MAX_STOCK_INPUT}
        step={1}
        required
        value={valor}
        onChange={(event) => setValor(event.target.value)}
        aria-label={`Ponto atual para ${item.nome}`}
        aria-describedby={mensagem ? idMensagem : undefined}
        className="min-h-11 w-24 rounded-control border border-border bg-surface px-2 py-1 text-foreground"
      />
      <button
        type="submit"
        disabled={salvando}
        className="min-h-11 rounded-control bg-brand px-3 py-2 font-semibold text-surface hover:bg-brand-hover active:bg-brand-pressed disabled:cursor-wait disabled:opacity-60"
      >
        {salvando ? "Salvando…" : "Salvar"}
      </button>
    </div>
    {mensagem && <p
      id={idMensagem}
      role={mensagem.tipo === "erro" ? "alert" : "status"}
      className={mensagem.tipo === "erro" ? "text-xs text-error" : "text-xs text-success"}
    >
      {mensagem.texto}
    </p>}
  </form>;
}

export default function RessuprimentoTabela({
  sugestoes,
  fonte,
}: {
  sugestoes: SugestaoRessuprimento[];
  fonte: "Dados reais" | "Dados simulados";
}) {
  const [classeFiltro, setClasseFiltro] = useState<ClasseRessuprimento | "TODAS">("TODAS");
  const [previsualizando, setPrevisualizando] = useState<string | null>(null);
  const filtradas = useMemo(() => ordenarPorDeficitRessuprimento(sugestoes
    .filter((item) => classeFiltro === "TODAS" || item.classe === classeFiltro)), [sugestoes, classeFiltro]);
  const itensNoPonto = useMemo(() => ordenarPorDeficitRessuprimento(sugestoes
    .filter((item) => isAtOrBelowReorderPoint(item.estoque, item.pontoAtual))), [sugestoes]);
  const maxCobertura = Math.max(
    1,
    ...filtradas
      .map(({ diasCobertura }) => diasCobertura)
      .filter((dias): dias is number => dias !== null && Number.isFinite(dias)),
  );
  const chartWidth = 680;
  const chartHeight = Math.max(48, filtradas.length * 34 + 12);

  return <main className="mx-auto min-h-dvh max-w-7xl p-4 sm:p-6">
    <PageHeader
      eyebrow="Administração · Estoque"
      title="Ressuprimento"
      description="Cobertura estimada e ponto de reposição sugerido a partir das saídas recentes."
      action={<span aria-live="polite" className="inline-flex min-h-11 items-center rounded-control bg-surface px-3 text-sm font-semibold text-text-secondary shadow-card">Fonte: {fonte}</span>}
    />

    {fonte === "Dados simulados" && <p className="mb-4 rounded-control border border-warning/30 bg-warning-surface p-3 text-sm font-semibold text-warning">
      O histórico real disponível não atende ao mínimo para análise; estes valores são simulados e não devem ser usados como medição.
    </p>}

    <section aria-labelledby="itens-ponto-pedido" className="mb-6 rounded-card bg-warning-surface p-4 shadow-card sm:p-5">
      <h2 id="itens-ponto-pedido" className="text-lg font-semibold text-warning">Itens no ponto de pedido ou abaixo</h2>
      {itensNoPonto.length === 0
        ? <p className="mt-2 text-sm text-warning">Nenhum item precisa de ressuprimento</p>
        : <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {itensNoPonto.map((item) => <li key={item.id} className="rounded-control bg-surface p-3 text-sm">
            <span className="font-semibold text-foreground">{item.nome}</span>
            <span className="mt-1 block text-text-secondary">{item.categoria?.trim() || "—"}</span>
            <span className="mt-1 block text-foreground">Livre: {item.estoque} · ponto: {item.pontoAtual}</span>
          </li>)}
        </ul>}
    </section>

    <div className="mb-4 max-w-xs">
      <label htmlFor="filtro-classe" className="block text-sm font-medium text-foreground">Filtrar por classe</label>
      <select
        id="filtro-classe"
        value={classeFiltro}
        onChange={(event) => setClasseFiltro(event.target.value as ClasseRessuprimento | "TODAS")}
        className="mt-1 min-h-11 w-full rounded-control border border-border bg-surface px-3 py-2 text-sm"
      >
        {classes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select>
    </div>

    <section aria-labelledby="grafico-cobertura" className="mb-6 overflow-x-auto rounded-card bg-surface p-4 shadow-card sm:p-5">
      <h2 id="grafico-cobertura" className="mb-3 text-lg font-semibold text-foreground">Dias de cobertura</h2>
      {filtradas.length === 0
        ? <p className="text-sm text-text-secondary">Nenhum item corresponde ao filtro.</p>
        : <svg
          role="img"
          aria-label="Gráfico de barras de cobertura por item; cobertura infinita é exibida no limite da escala"
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="h-auto min-w-[560px] w-full"
        >
          <title>Estimativa de dias de cobertura dos itens</title>
          {filtradas.map((item, index) => {
            const y = index * 34 + 4;
            const cobertura = item.diasCobertura;
            const largura = cobertura === null
              ? 0
              : Number.isFinite(cobertura)
                ? Math.max(2, Math.min(300, (cobertura / maxCobertura) * 300))
                : 300;
            return <g key={item.id}>
              <text x="0" y={y + 18} fontSize="12" fill="var(--foreground)">{item.nome.slice(0, 28)}</text>
              <rect x="245" y={y + 4} width={largura} height="18" rx="3" fill={classeCor[item.classe]} />
              <text x="555" y={y + 18} fontSize="12" fill="var(--foreground)">{coberturaTexto(cobertura)}</text>
            </g>;
          })}
        </svg>}
    </section>

    {filtradas.length === 0 ? (
      <EmptyState
        title={sugestoes.length === 0 ? "Nenhum item precisa de ressuprimento" : "Nenhum item corresponde ao filtro"}
        message="Não há sugestões para exibir com os critérios selecionados."
      />
    ) : (
      <>
        <div className="hidden overflow-x-auto rounded-card bg-surface shadow-card md:block">
          <table className="w-full min-w-[900px] border-collapse text-left text-sm">
            <caption className="sr-only">Ressuprimento sugerido por item, ordenado pelo maior déficit em relação ao ponto atual</caption>
            <thead className="sticky top-0 bg-background text-xs uppercase text-text-secondary">
              <tr>{["Item", "Estoque livre", "Consumo/dia", "Cobertura", "Ponto atual", "Quantidade sugerida", "Classe", "Prévia"].map((heading) =>
                <th key={heading} scope="col" className="border-b border-border-subtle px-4 py-3 font-semibold">{heading}</th>)}</tr>
            </thead>
            <tbody>
              {filtradas.map((item) => <tr key={item.id} className="border-b border-border-subtle last:border-0 hover:bg-background">
                <th scope="row" className="px-4 py-3 font-medium text-foreground">{item.nome}<span className="mt-1 block font-normal text-text-secondary">{item.categoria?.trim() || "—"}</span></th>
                <td className="px-4 py-3">{item.estoque}</td>
                <td className="px-4 py-3">{item.consumoDiario === null ? "Sem dados" : item.consumoDiario.toFixed(2)}</td>
                <td className="px-4 py-3">{coberturaTexto(item.diasCobertura)}</td>
                <td className="px-4 py-3"><PontoAtualEditor item={item} /></td>
                <td className="px-4 py-3">{item.quantidadeSugerida ?? "Não definido"}</td>
                <td className="px-4 py-3"><StatusBadge label={classeTexto[item.classe]} tone={classeTom[item.classe]} /></td>
                <td className="px-4 py-3">
                  <button type="button" onClick={() => setPrevisualizando(item.id)} className="min-h-11 whitespace-nowrap rounded-control border border-brand px-3 text-sm font-semibold text-brand hover:bg-priority-surface">
                    Aceitar sugestão (prévia)
                  </button>
                  {previsualizando === item.id && <p className="mt-2 max-w-52 text-xs text-text-secondary">
                    Prévia: o alerta passaria a usar {item.pontoSugerido ?? "um valor ainda indisponível"}. Nada foi gravado.
                  </p>}
                </td>
              </tr>)}
            </tbody>
          </table>
        </div>
        <div className="grid gap-3 md:hidden">
          {filtradas.map((item) => <article key={item.id} className="rounded-card bg-surface p-4 shadow-card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h2 className="font-semibold text-foreground">{item.nome}</h2><p className="mt-1 text-sm text-text-secondary">{item.categoria?.trim() || "—"}</p></div>
              <StatusBadge label={classeTexto[item.classe]} tone={classeTom[item.classe]} />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border-subtle pt-4 text-sm">
              <div><dt className="text-text-secondary">Estoque livre</dt><dd className="font-semibold text-foreground">{item.estoque}</dd></div>
              <div><dt className="text-text-secondary">Consumo/dia</dt><dd className="font-semibold text-foreground">{item.consumoDiario === null ? "Sem dados" : item.consumoDiario.toFixed(2)}</dd></div>
              <div><dt className="text-text-secondary">Cobertura</dt><dd className="font-semibold text-foreground">{coberturaTexto(item.diasCobertura)}</dd></div>
              <div className="col-span-2 sm:col-span-1"><dt className="mb-1 text-text-secondary">Ponto atual</dt><dd><PontoAtualEditor item={item} /></dd></div>
              <div><dt className="text-text-secondary">Quantidade sugerida</dt><dd className="font-semibold text-foreground">{item.quantidadeSugerida ?? "Não definido"}</dd></div>
            </dl>
            <button type="button" onClick={() => setPrevisualizando(item.id)} className="mt-4 min-h-11 w-full rounded-control border border-brand px-3 text-sm font-semibold text-brand hover:bg-priority-surface">
              Aceitar sugestão (prévia)
            </button>
            {previsualizando === item.id && <p className="mt-2 text-sm text-text-secondary">
              Prévia: o alerta passaria a usar {item.pontoSugerido ?? "um valor ainda indisponível"}. Nada foi gravado.
            </p>}
          </article>)}
        </div>
      </>
    )}
  </main>;
}
