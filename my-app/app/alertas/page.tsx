"use client";

import { useMemo, useState } from "react";

export type Almoxarifado = "central" | "embalagens" | "materia-prima" | "importados";
export type FiltroAlmoxarifado = "todos" | Almoxarifado;
export type Perfil = "Almoxarife" | "Admin";
export type StatusAlerta = "ativo" | "em_providencia";

export type Alerta = {
  id: string;
  itemNome: string;
  codigoProduto: string;
  almoxarifado: Almoxarifado;
  estoqueAtual: number;
  pontoReposicao: number;
  status: StatusAlerta;
  criadoEm: string;
  marcadoProvidenciaPor: string | null;
  marcadoProvidenciaEm: string | null;
};

type HistoricoEvento = {
  id: string;
  alertaId: string;
  itemNome: string;
  codigoProduto: string;
  evento: "marcado_em_providencia";
  usuario: string;
  timestamp: string;
};

type NivelUrgencia = {
  nivel: "Crítico" | "Atenção" | "Baixo";
  percentual: number;
  score: number;
};

const labelsAlmoxarifado: Record<Almoxarifado, string> = {
  central: "Central",
  embalagens: "Embalagens",
  "materia-prima": "Matéria-prima",
  importados: "Produtos importados",
};

const filtroOptions: Array<{ value: FiltroAlmoxarifado; label: string }> = [
  { value: "todos", label: "Todos" },
  { value: "embalagens", label: "Embalagens" },
  { value: "materia-prima", label: "Matéria-prima" },
  { value: "importados", label: "Produtos importados" },
];

const alertasMock: Alerta[] = [
  { id: "A-001", itemNome: "Item 1", codigoProduto: "PROD-001", almoxarifado: "central", estoqueAtual: 3, pontoReposicao: 10, status: "ativo", criadoEm: "2026-09-28T08:10:00.000Z", marcadoProvidenciaPor: null, marcadoProvidenciaEm: null },
  { id: "A-002", itemNome: "Item 2", codigoProduto: "PROD-002", almoxarifado: "materia-prima", estoqueAtual: 5, pontoReposicao: 12, status: "ativo", criadoEm: "2026-09-29T14:25:00.000Z", marcadoProvidenciaPor: null, marcadoProvidenciaEm: null },
  { id: "A-003", itemNome: "Item 3", codigoProduto: "PROD-003", almoxarifado: "embalagens", estoqueAtual: 8, pontoReposicao: 20, status: "ativo", criadoEm: "2026-09-30T09:40:00.000Z", marcadoProvidenciaPor: null, marcadoProvidenciaEm: null },
  { id: "A-004", itemNome: "Item 4", codigoProduto: "PROD-004", almoxarifado: "importados", estoqueAtual: 1, pontoReposicao: 8, status: "ativo", criadoEm: "2026-09-30T12:00:00.000Z", marcadoProvidenciaPor: null, marcadoProvidenciaEm: null },
  { id: "A-005", itemNome: "Item 5", codigoProduto: "PROD-005", almoxarifado: "central", estoqueAtual: 7, pontoReposicao: 15, status: "em_providencia", criadoEm: "2026-09-30T14:30:00.000Z", marcadoProvidenciaPor: "ADM-2044 · Alessandra", marcadoProvidenciaEm: "2026-09-30T15:10:00.000Z" },
  { id: "A-006", itemNome: "Item 6", codigoProduto: "PROD-006", almoxarifado: "embalagens", estoqueAtual: 4, pontoReposicao: 9, status: "ativo", criadoEm: "2026-10-01T07:55:00.000Z", marcadoProvidenciaPor: null, marcadoProvidenciaEm: null },
  { id: "A-007", itemNome: "Item 7", codigoProduto: "PROD-007", almoxarifado: "materia-prima", estoqueAtual: 2, pontoReposicao: 7, status: "ativo", criadoEm: "2026-10-01T08:05:00.000Z", marcadoProvidenciaPor: null, marcadoProvidenciaEm: null },
  { id: "A-008", itemNome: "Item 8", codigoProduto: "PROD-008", almoxarifado: "importados", estoqueAtual: 10, pontoReposicao: 25, status: "em_providencia", criadoEm: "2026-10-01T09:18:00.000Z", marcadoProvidenciaPor: "ADM-118 · Rafael", marcadoProvidenciaEm: "2026-10-01T09:40:00.000Z" },
  { id: "A-009", itemNome: "Item 9", codigoProduto: "PROD-009", almoxarifado: "central", estoqueAtual: 11, pontoReposicao: 20, status: "ativo", criadoEm: "2026-10-01T10:00:00.000Z", marcadoProvidenciaPor: null, marcadoProvidenciaEm: null },
  { id: "A-010", itemNome: "Item 10", codigoProduto: "PROD-010", almoxarifado: "materia-prima", estoqueAtual: 17, pontoReposicao: 25, status: "ativo", criadoEm: "2026-10-01T11:12:00.000Z", marcadoProvidenciaPor: null, marcadoProvidenciaEm: null },
  { id: "A-011", itemNome: "Item 11", codigoProduto: "PROD-011", almoxarifado: "embalagens", estoqueAtual: 2, pontoReposicao: 6, status: "ativo", criadoEm: "2026-10-01T11:38:00.000Z", marcadoProvidenciaPor: null, marcadoProvidenciaEm: null },
  { id: "A-012", itemNome: "Item 12", codigoProduto: "PROD-012", almoxarifado: "central", estoqueAtual: 4, pontoReposicao: 11, status: "ativo", criadoEm: "2026-10-01T13:51:00.000Z", marcadoProvidenciaPor: null, marcadoProvidenciaEm: null },
  { id: "A-013", itemNome: "Item 13", codigoProduto: "PROD-013", almoxarifado: "importados", estoqueAtual: 6, pontoReposicao: 9, status: "ativo", criadoEm: "2026-10-01T15:05:00.000Z", marcadoProvidenciaPor: null, marcadoProvidenciaEm: null },
  { id: "A-014", itemNome: "Item 14", codigoProduto: "PROD-014", almoxarifado: "embalagens", estoqueAtual: 14, pontoReposicao: 18, status: "em_providencia", criadoEm: "2026-10-02T08:00:00.000Z", marcadoProvidenciaPor: "ADM-205 · Aline", marcadoProvidenciaEm: "2026-10-02T08:20:00.000Z" },
  { id: "A-015", itemNome: "Item 15", codigoProduto: "PROD-015", almoxarifado: "materia-prima", estoqueAtual: 9, pontoReposicao: 9, status: "ativo", criadoEm: "2026-10-02T09:20:00.000Z", marcadoProvidenciaPor: null, marcadoProvidenciaEm: null },
  { id: "A-016", itemNome: "Item 16", codigoProduto: "PROD-016", almoxarifado: "central", estoqueAtual: 15, pontoReposicao: 12, status: "ativo", criadoEm: "2026-10-02T09:48:00.000Z", marcadoProvidenciaPor: null, marcadoProvidenciaEm: null },
];

export function calcularNivelUrgencia({ estoqueAtual, pontoReposicao }: { estoqueAtual: number; pontoReposicao: number }): NivelUrgencia {
  if (pontoReposicao <= 0) {
    return { nivel: "Baixo", percentual: 0, score: 0 };
  }

  const percentualAbaixo = Math.max(0, ((pontoReposicao - estoqueAtual) / pontoReposicao) * 100);

  if (percentualAbaixo >= 60 || estoqueAtual <= pontoReposicao * 0.3) {
    return { nivel: "Crítico", percentual: percentualAbaixo, score: 3 };
  }

  if (estoqueAtual <= pontoReposicao || percentualAbaixo >= 20) {
    return { nivel: "Atenção", percentual: percentualAbaixo, score: 2 };
  }

  return { nivel: "Baixo", percentual: percentualAbaixo, score: 1 };
}

export function filtrarAlertasVisiveis(alertas: Alerta[], filtro: FiltroAlmoxarifado): Alerta[] {
  const visiveis = alertas.filter((alerta) => {
    const valido = alerta.estoqueAtual <= alerta.pontoReposicao && (alerta.status === "ativo" || alerta.status === "em_providencia");
    const filtroAplica = filtro === "todos" || alerta.almoxarifado === filtro;
    return valido && filtroAplica;
  });

  return visiveis.sort((a, b) => {
    const urgenciaA = calcularNivelUrgencia({ estoqueAtual: a.estoqueAtual, pontoReposicao: a.pontoReposicao }).score;
    const urgenciaB = calcularNivelUrgencia({ estoqueAtual: b.estoqueAtual, pontoReposicao: b.pontoReposicao }).score;
    const diffUrgencia = urgenciaB - urgenciaA;
    if (diffUrgencia !== 0) return diffUrgencia;
    return new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime();
  });
}

function formatarData(data: string | null): string {
  if (!data) return "—";
  return new Date(data).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function formatarFuncionario(valor: string | null): string {
  if (!valor) return "—";
  if (valor.includes("·")) {
    const [cracha, nome] = valor.split("·").map((parte) => parte.trim());
    return nome ? `${nome} (${cracha})` : valor;
  }
  return valor;
}

function SeletorPerfil({ perfil, onChange }: { perfil: Perfil; onChange: (nextPerfil: Perfil) => void }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <label htmlFor="perfil-simulado" className="text-sm font-medium text-slate-700">Visualizando como:</label>
      <select
        id="perfil-simulado"
        value={perfil}
        onChange={(event) => onChange(event.target.value as Perfil)}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none focus:border-royal focus:ring-2 focus:ring-blue-100"
      >
        <option value="Almoxarife">Almoxarife</option>
        <option value="Admin">Admin</option>
      </select>
    </div>
  );
}

function FiltroAlmoxarifado({ filtro, onChange }: { filtro: FiltroAlmoxarifado; onChange: (value: FiltroAlmoxarifado) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {filtroOptions.map((option) => {
        const active = filtro === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
              active
                ? "border-transparent bg-royal text-white shadow-sm"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function ListaAlertas({
  alertas,
  perfil,
  onMarcarProvidencia,
}: {
  alertas: Alerta[];
  perfil: Perfil;
  onMarcarProvidencia: (alertaId: string) => void;
}) {
  if (!alertas.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
        Nenhum alerta ativo para este filtro no momento.
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[960px] text-left">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            <tr>
              <th className="px-5 py-3">Item</th>
              <th className="px-5 py-3">Almoxarifado</th>
              <th className="px-5 py-3">Estoque</th>
              <th className="px-5 py-3">Ponto</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Criação</th>
              <th className="px-5 py-3 text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {alertas.map((alerta) => {
              const urgencia = calcularNivelUrgencia({ estoqueAtual: alerta.estoqueAtual, pontoReposicao: alerta.pontoReposicao });
              const urgente = urgencia.nivel === "Crítico";
              const atencao = urgencia.nivel === "Atenção";

              return (
                <tr key={alerta.id} className="border-t border-slate-100 align-top hover:bg-slate-50">
                  <td className="px-5 py-4">
                    <div className="font-semibold text-slate-900">{alerta.itemNome} — {alerta.codigoProduto}</div>
                    {alerta.status === "em_providencia" && alerta.marcadoProvidenciaPor && (
                      <div className="mt-2 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-royal">
                        Em providência por {formatarFuncionario(alerta.marcadoProvidenciaPor)}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-700">{labelsAlmoxarifado[alerta.almoxarifado]}</td>
                  <td className="px-5 py-4 text-sm font-semibold text-slate-900">{alerta.estoqueAtual}</td>
                  <td className="px-5 py-4 text-sm text-slate-700">{alerta.pontoReposicao}</td>
                  <td className="px-5 py-4">
                    <div className="flex flex-col gap-2">
                      <span
                        className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${
                          urgencia.nivel === "Crítico"
                            ? "bg-red-50 text-red-700"
                            : urgencia.nivel === "Atenção"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {urgencia.nivel}
                      </span>
                      {alerta.status === "em_providencia" ? (
                        <span className="inline-flex w-fit rounded-full bg-royal/10 px-2.5 py-1 text-xs font-semibold text-royal">
                          Em providência
                        </span>
                      ) : (
                        <span className="inline-flex w-fit rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                          Ativo
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-600">{formatarData(alerta.criadoEm)}</td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end">
                      {perfil === "Admin" && alerta.status === "ativo" ? (
                        <button
                          type="button"
                          onClick={() => onMarcarProvidencia(alerta.id)}
                          className="rounded-lg bg-royal px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                        >
                          Marcar em providência
                        </button>
                      ) : (
                        <span className="text-sm text-slate-400">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 p-3 md:hidden">
        {alertas.map((alerta) => {
          const urgencia = calcularNivelUrgencia({ estoqueAtual: alerta.estoqueAtual, pontoReposicao: alerta.pontoReposicao });
          return (
            <article key={alerta.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{alerta.itemNome} — {alerta.codigoProduto}</p>
                  <p className="mt-1 text-sm text-slate-600">{labelsAlmoxarifado[alerta.almoxarifado]}</p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    urgencia.nivel === "Crítico"
                      ? "bg-red-50 text-red-700"
                      : urgencia.nivel === "Atenção"
                        ? "bg-amber-50 text-amber-700"
                        : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {urgencia.nivel}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-600">
                <div>
                  <span className="block text-xs uppercase tracking-wide text-slate-400">Estoque</span>
                  <strong className="text-slate-900">{alerta.estoqueAtual}</strong>
                </div>
                <div>
                  <span className="block text-xs uppercase tracking-wide text-slate-400">Ponto</span>
                  <strong className="text-slate-900">{alerta.pontoReposicao}</strong>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3">
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${alerta.status === "em_providencia" ? "bg-royal/10 text-royal" : "bg-slate-100 text-slate-600"}`}>
                  {alerta.status === "em_providencia" ? "Em providência" : "Ativo"}
                </span>
                {perfil === "Admin" && alerta.status === "ativo" ? (
                  <button
                    type="button"
                    onClick={() => onMarcarProvidencia(alerta.id)}
                    className="rounded-lg bg-royal px-3 py-2 text-xs font-semibold text-white"
                  >
                    Marcar em providência
                  </button>
                ) : null}
              </div>

              <p className="mt-3 text-xs text-slate-500">Criado em {formatarData(alerta.criadoEm)}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ModalConfirmarProvidencia({
  aberto,
  onClose,
  onConfirm,
}: {
  aberto: boolean;
  onClose: () => void;
  onConfirm: (senha: string) => void;
}) {
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState("");

  if (!aberto) return null;

  const confirmar = () => {
    if (!senha.trim()) {
      setErro("Informe a senha do administrador para confirmar.");
      return;
    }

    setErro("");
    onConfirm(senha);
    setSenha("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-royal">Confirmação</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">Marcar em providência</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800">✕</button>
        </div>

        <p className="mt-4 text-sm leading-6 text-slate-600">
          Esta ação registra que o alerta já está sendo tratado pelo responsável administrativo.
        </p>

        <label htmlFor="senha-admin" className="mt-5 block text-sm font-semibold text-slate-700">
          Senha do admin
        </label>
        <div className="relative mt-2">
          <input
            id="senha-admin"
            type={mostrarSenha ? "text" : "password"}
            value={senha}
            onChange={(event) => {
              setSenha(event.target.value);
              if (erro) setErro("");
            }}
            className={`w-full rounded-lg border bg-white px-3 py-3 pr-10 text-slate-900 outline-none focus:ring-2 focus:ring-blue-100 ${
              erro ? "border-red-400 focus:border-red-500" : "border-slate-300 focus:border-royal"
            }`}
            placeholder="Digite a senha"
            aria-invalid={Boolean(erro)}
          />
          <button
            type="button"
            onClick={() => setMostrarSenha((valor) => !valor)}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-sm font-medium text-slate-600"
          >
            {mostrarSenha ? "Ocultar" : "Mostrar"}
          </button>
        </div>

        {erro ? <p className="mt-2 text-sm text-red-600">{erro}</p> : null}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Cancelar
          </button>
          <button type="button" onClick={confirmar} className="rounded-lg bg-royal px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AlertasPage() {
  const [perfil, setPerfil] = useState<Perfil>("Almoxarife");
  const [filtro, setFiltro] = useState<FiltroAlmoxarifado>("todos");
  const [alertas, setAlertas] = useState<Alerta[]>(alertasMock);
  const [alertaSelecionado, setAlertaSelecionado] = useState<string | null>(null);
  const [historicoAlertas, setHistoricoAlertas] = useState<HistoricoEvento[]>([
    { id: "H-001", alertaId: "A-005", itemNome: "Item 5", codigoProduto: "PROD-005", evento: "marcado_em_providencia", usuario: "Alessandra (ADM-2044)", timestamp: "2026-09-30T15:10:00.000Z" },
    { id: "H-002", alertaId: "A-008", itemNome: "Item 8", codigoProduto: "PROD-008", evento: "marcado_em_providencia", usuario: "Rafael (ADM-118)", timestamp: "2026-10-01T09:40:00.000Z" },
  ]);

  const alertasVisiveis = useMemo(
    () => filtrarAlertasVisiveis(alertas, filtro),
    [alertas, filtro],
  );

  const handleMarcarProvidencia = (alertaId: string) => {
    setAlertaSelecionado(alertaId);
  };

  const confirmarProvidencia = (senha: string) => {
    if (!senha.trim()) {
      return;
    }

    if (!alertaSelecionado) {
      return;
    }

    const nomeAdmin = "ADM-2044 · Alessandra";
    const agora = new Date().toISOString();
    const alertaAtual = alertas.find((alerta) => alerta.id === alertaSelecionado);

    setAlertas((atual) =>
      atual.map((alerta) =>
        alerta.id === alertaSelecionado
          ? {
              ...alerta,
              status: "em_providencia",
              marcadoProvidenciaPor: nomeAdmin,
              marcadoProvidenciaEm: agora,
            }
          : alerta,
      ),
    );

    setHistoricoAlertas((atual) => [
      ...atual,
      {
        id: `H-${Date.now()}`,
        alertaId: alertaSelecionado,
        itemNome: alertaAtual?.itemNome ?? "Item",
        codigoProduto: alertaAtual?.codigoProduto ?? "PROD-000",
        evento: "marcado_em_providencia",
        usuario: formatarFuncionario(nomeAdmin),
        timestamp: agora,
      },
    ]);

    setAlertaSelecionado(null);
  };

  return (
    <main className="min-h-screen bg-[#f6f8fc] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-royal">Marcon · Gestão</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Central de alertas</h1>
            <p className="mt-1 text-sm text-slate-500">Itens que entraram em ponto de reposição e exigem atenção do almoxarifado.</p>
          </div>
          <SeletorPerfil perfil={perfil} onChange={setPerfil} />
        </header>

        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">Filtros</h2>
              <span className="text-sm text-slate-500">{alertasVisiveis.length} alertas visíveis</span>
            </div>
            <FiltroAlmoxarifado filtro={filtro} onChange={setFiltro} />
          </div>
        </div>

        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">Histórico local</h2>
          <div className="mt-3 space-y-2">
            {historicoAlertas.length ? (
              historicoAlertas.slice(-3).reverse().map((evento) => (
                <div key={evento.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  <span className="font-semibold text-slate-800">{evento.itemNome}</span> · Código: <span className="font-medium text-slate-700">{evento.codigoProduto}</span> · {evento.usuario} · {formatarData(evento.timestamp)}
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">Nenhum evento registrado até o momento.</p>
            )}
          </div>
        </div>

        <ListaAlertas alertas={alertasVisiveis} perfil={perfil} onMarcarProvidencia={handleMarcarProvidencia} />
      </div>

      <ModalConfirmarProvidencia
        aberto={Boolean(alertaSelecionado)}
        onClose={() => setAlertaSelecionado(null)}
        onConfirm={confirmarProvidencia}
      />
    </main>
  );
}
