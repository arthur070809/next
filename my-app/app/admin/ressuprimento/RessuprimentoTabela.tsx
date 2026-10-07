"use client";

import { useMemo, useState } from "react";
import type {
  ClasseRessuprimento,
  SugestaoRessuprimento,
} from "@/lib/ressuprimento/analise";
import { ordenarPorDeficitRessuprimento } from "@/lib/ressuprimento/analise";
import { isAtOrBelowReorderPoint } from "@/lib/stock-status";

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
  VERMELHO: "#b91c1c",
  AMARELO: "#a16207",
  VERDE: "#15803d",
  SEM_DADOS: "#64748b",
};

function coberturaTexto(dias: number | null): string {
  if (dias === null) return "Sem dados";
  if (!Number.isFinite(dias)) return "Sem consumo";
  return `${dias.toFixed(1)} dias`;
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
    <header className="mb-5">
      <h1 className="text-2xl font-semibold text-slate-900">Ressuprimento</h1>
      <p className="mt-1 text-sm text-slate-600">Cobertura estimada e ponto de reposição sugerido a partir das saídas recentes.</p>
      <p className="mt-3 inline-flex rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800" aria-live="polite">
        Fonte: {fonte}
      </p>
    </header>

    {fonte === "Dados simulados" && <p className="mb-4 rounded-lg border border-amber-700 bg-amber-100 p-3 text-sm font-semibold text-amber-950">
      O histórico real disponível não atende ao mínimo para análise; estes valores são simulados e não devem ser usados como medição.
    </p>}

    <section aria-labelledby="itens-ponto-pedido" className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4">
      <h2 id="itens-ponto-pedido" className="text-lg font-semibold text-amber-950">Itens no ponto de pedido ou abaixo</h2>
      {itensNoPonto.length === 0
        ? <p className="mt-2 text-sm text-amber-900">Nenhum item precisa de ressuprimento</p>
        : <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {itensNoPonto.map((item) => <li key={item.id} className="rounded-lg border border-amber-200 bg-white p-3 text-sm">
            <span className="font-semibold text-slate-900">{item.nome}</span>
            <span className="mt-1 block text-slate-600">{item.categoria?.trim() || "—"}</span>
            <span className="mt-1 block text-slate-700">Livre: {item.estoque} · ponto: {item.pontoAtual}</span>
          </li>)}
        </ul>}
    </section>

    <div className="mb-4 max-w-xs">
      <label htmlFor="filtro-classe" className="block text-sm font-medium text-slate-700">Filtrar por classe</label>
      <select
        id="filtro-classe"
        value={classeFiltro}
        onChange={(event) => setClasseFiltro(event.target.value as ClasseRessuprimento | "TODAS")}
        className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal"
      >
        {classes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select>
    </div>

    <section aria-labelledby="grafico-cobertura" className="mb-6 overflow-x-auto rounded-xl border border-slate-200 bg-white p-4">
      <h2 id="grafico-cobertura" className="mb-3 text-lg font-semibold text-slate-900">Dias de cobertura</h2>
      {filtradas.length === 0
        ? <p className="text-sm text-slate-600">Nenhum item corresponde ao filtro.</p>
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
              <text x="0" y={y + 18} fontSize="12" fill="#1e293b">{item.nome.slice(0, 28)}</text>
              <rect x="245" y={y + 4} width={largura} height="18" rx="3" fill={classeCor[item.classe]} />
              <text x="555" y={y + 18} fontSize="12" fill="#1e293b">{coberturaTexto(cobertura)}</text>
            </g>;
          })}
        </svg>}
    </section>

    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full min-w-[900px] border-collapse text-left text-sm">
        <caption className="sr-only">Ressuprimento sugerido por item, ordenado pelo maior déficit em relação ao ponto atual</caption>
        <thead className="bg-slate-50 text-xs uppercase text-slate-600">
          <tr>{["Item", "Estoque livre", "Consumo/dia", "Cobertura", "Ponto atual", "Quantidade sugerida", "Ponto sugerido", "Classe", "Confiança", "Ação"].map((heading) =>
            <th key={heading} scope="col" className="border-b border-slate-200 px-4 py-3 font-semibold">{heading}</th>)}</tr>
        </thead>
        <tbody>
          {filtradas.length === 0
            ? <tr><td colSpan={10} className="px-4 py-6 text-center text-sm text-slate-600">
              {sugestoes.length === 0 ? "Nenhum item precisa de ressuprimento" : "Nenhum item corresponde ao filtro."}
            </td></tr>
            : filtradas.map((item) => <tr key={item.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
            <th scope="row" className="px-4 py-3 font-medium text-slate-900">{item.nome}<span className="mt-1 block font-normal text-slate-600">{item.categoria?.trim() || "—"}</span></th>
            <td className="px-4 py-3">{item.estoque}</td>
            <td className="px-4 py-3">{item.consumoDiario === null ? "Sem dados" : item.consumoDiario.toFixed(2)}</td>
            <td className="px-4 py-3">{coberturaTexto(item.diasCobertura)}</td>
            <td className="px-4 py-3">{item.pontoAtual ?? "Não definido"}</td>
            <td className="px-4 py-3">{item.quantidadeSugerida ?? "Não definido"}</td>
            <td className="px-4 py-3">{item.pontoSugerido ?? "Sem dados"}</td>
            <td className="px-4 py-3">
              <span className="inline-block rounded-md border border-slate-300 px-2 py-1" style={{ borderLeftColor: classeCor[item.classe], borderLeftWidth: 4 }}>
                {classeTexto[item.classe]}
              </span>
            </td>
            <td className="px-4 py-3">{item.confianca === "BAIXA" ? "Baixa" : "Adequada"}</td>
            <td className="px-4 py-3">
              <button
                type="button"
                onClick={() => setPrevisualizando(item.id)}
                className="min-h-10 rounded-md border border-slate-300 px-3 py-2 font-semibold text-slate-800 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal"
              >
                Aceitar sugestão (prévia)
              </button>
              {previsualizando === item.id && <p className="mt-2 max-w-52 text-xs text-slate-700">
                Prévia: o alerta passaria a usar {item.pontoSugerido ?? "um valor ainda indisponível"}. Nada foi gravado.
              </p>}
            </td>
          </tr>)}
        </tbody>
      </table>
    </div>
  </main>;
}
