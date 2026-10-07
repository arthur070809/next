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
  return <form onSubmit={salvar} className="flex min-w-40 flex-col gap-2">
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
        className="min-h-10 w-24 rounded-md border border-slate-300 bg-white px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal"
      />
      <button
        type="submit"
        disabled={salvando}
        className="min-h-10 rounded-md bg-royal px-3 py-2 font-semibold text-white hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal"
      >
        {salvando ? "Salvando…" : "Salvar"}
      </button>
    </div>
    {mensagem && <p
      id={idMensagem}
      role={mensagem.tipo === "erro" ? "alert" : "status"}
      className={mensagem.tipo === "erro" ? "text-xs text-red-700" : "text-xs text-emerald-700"}
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
          <tr>{["Item", "Estoque livre", "Consumo/dia", "Cobertura", "Ponto atual", "Quantidade sugerida", "Classe"].map((heading) =>
            <th key={heading} scope="col" className="border-b border-slate-200 px-4 py-3 font-semibold">{heading}</th>)}</tr>
        </thead>
        <tbody>
          {filtradas.length === 0
            ? <tr><td colSpan={7} className="px-4 py-6 text-center text-sm text-slate-600">
              {sugestoes.length === 0 ? "Nenhum item precisa de ressuprimento" : "Nenhum item corresponde ao filtro."}
            </td></tr>
            : filtradas.map((item) => <tr key={item.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
            <th scope="row" className="px-4 py-3 font-medium text-slate-900">{item.nome}<span className="mt-1 block font-normal text-slate-600">{item.categoria?.trim() || "—"}</span></th>
            <td className="px-4 py-3">{item.estoque}</td>
            <td className="px-4 py-3">{item.consumoDiario === null ? "Sem dados" : item.consumoDiario.toFixed(2)}</td>
            <td className="px-4 py-3">{coberturaTexto(item.diasCobertura)}</td>
            <td className="px-4 py-3"><PontoAtualEditor key={`${item.id}-${item.pontoAtual ?? "unset"}`} item={item} /></td>
            <td className="px-4 py-3">{item.quantidadeSugerida ?? "Não definido"}</td>
            <td className="px-4 py-3">
              <span className="inline-block rounded-md border border-slate-300 px-2 py-1" style={{ borderLeftColor: classeCor[item.classe], borderLeftWidth: 4 }}>
                {classeTexto[item.classe]}
              </span>
            </td>
          </tr>)}
        </tbody>
      </table>
    </div>
  </main>;
}
