"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import ProductEtiquetaScanner from "../../../components/ProductEtiquetaScanner";
import PriorityBadge from "../../../components/PriorityBadge";
import ItemDescription from "../../../components/ItemDescription";
import ProductCode from "../../../components/ProductCode";
import { ErrorState, LoadingState } from "../../../components/ui";
import { normalizarCodigoEtiqueta, parseEtiqueta } from "../../../../lib/qr/parseEtiqueta";
import { shouldCloseCamera, type ScannerReadKind, type ScannerReadResult } from "../../../../lib/qr/camera-utils";

type ChecklistItem = {
  id: string;
  itemId: string;
  nome: string;
  categoria?: string;
  descricao: string;
  codigo: string | null;
  unidadeMedida: string;
  quantidadeSolicitada: number;
  status: string;
  conferido: boolean;
};

type ChecklistRequest = {
  numeroPedido: string;
  status: string;
  prioridade: string;
  criadoEm: string;
  solicitante: string;
  atendente: string | null;
  podeFinalizar: boolean;
  itens: ChecklistItem[];
};

type MotivoDivergencia = "FALTOU" | "EXCEDEU_LOTE_MINIMO" | "AVARIA";
type CheckResponse = {
  error?: string;
  message?: string;
  itemId?: string;
  jaConferido?: boolean;
  produto?: { codigo: string | null; nome: string };
};
type FinalizeResponse = {
  error?: string;
  resumo?: {
    numeroPedido: string;
    itens: Array<{
      id: string;
      nome: string;
      quantidadePedida: number;
      quantidadeSeparada: number;
      unidadeMedida: string;
      motivo: MotivoDivergencia | null;
    }>;
    movimentacoes: Array<{ id: string; tipo: string; quantidade: number; unidadeMedida: string }>;
  };
};

export default function ChecklistRequisicaoPage() {
  const { numeroPedido } = useParams<{ numeroPedido: string }>();
  const [requisicao, setRequisicao] = useState<ChecklistRequest | null>(null);
  const [quantidadesReais, setQuantidadesReais] = useState<Record<string, string>>({});
  const [motivosDivergencia, setMotivosDivergencia] = useState<Record<string, MotivoDivergencia | "">>({});
  const [codigoManual, setCodigoManual] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [mensagemKind, setMensagemKind] = useState<ScannerReadKind | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [cameraAberta, setCameraAberta] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [finalizando, setFinalizando] = useState(false);
  const [finalizado, setFinalizado] = useState<NonNullable<FinalizeResponse["resumo"]> | null>(null);
  const quantidadeRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const requisicaoRef = useRef<ChecklistRequest | null>(requisicao);
  const ultimoCodigoRef = useRef<{ codigo: string; quando: number; kind: ScannerReadKind; message: string } | null>(null);
  const finalizationInFlight = useRef(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/almoxarifado/requisicoes/${encodeURIComponent(numeroPedido)}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Não foi possível carregar o checklist.");
        return data.requisicao as ChecklistRequest;
      })
      .then((data) => {
        if (active) {
          requisicaoRef.current = data;
          setRequisicao(data);
        }
      })
      .catch((cause) => {
        if (active) setErro(cause instanceof Error ? cause.message : "Não foi possível carregar o checklist.");
      })
      .finally(() => { if (active) setCarregando(false); });
    return () => { active = false; };
  }, [numeroPedido, retryCount]);

  const totalConferidos = useMemo(
    () => requisicao?.itens.filter((item) => item.conferido).length ?? 0,
    [requisicao],
  );
  const requisicaoAtiva = requisicao?.status === "ASSUMIDA";
  const outcomesValidos = useMemo(() => {
    if (!requisicao?.itens.length) return false;
    return requisicao.itens.every((item) => {
      if (!item.conferido) return false;
      const raw = quantidadesReais[item.id];
      if (raw === undefined || raw.trim() === "") return false;
      const quantity = Number(raw);
      if (!Number.isSafeInteger(quantity) || quantity < 0 || quantity > 2_147_483_647) return false;
      if (quantity === item.quantidadeSolicitada) return true;
      const motive = motivosDivergencia[item.id];
      return quantity > item.quantidadeSolicitada
        ? motive === "EXCEDEU_LOTE_MINIMO"
        : motive === "FALTOU" || motive === "AVARIA";
    });
  }, [requisicao, quantidadesReais, motivosDivergencia]);

  const conferirCodigo = useCallback(async (raw: string, origem: "QR" | "digitacao") => {
    setErro("");
    setMensagem("");
    setMensagemKind(null);
    const parsed = parseEtiqueta(raw);
    if (!parsed.ok) {
      const feedback = `Etiqueta inválida: ${parsed.motivo}`;
      setErro(feedback);
      return { message: feedback, kind: "invalid-format" as const };
    }
    const currentRequest = requisicaoRef.current;
    const matchingItems = currentRequest?.itens.filter((item) =>
      item.codigo !== null &&
      normalizarCodigoEtiqueta(item.codigo) === normalizarCodigoEtiqueta(parsed.codigo),
    ) ?? [];
    if (matchingItems.length === 1 && matchingItems[0].conferido) {
      const feedback = "Esse item já foi conferido";
      ultimoCodigoRef.current = { codigo: parsed.codigo, quando: Date.now(), kind: "already-confirmed", message: feedback };
      setErro("");
      setMensagem(feedback);
      setMensagemKind("already-confirmed");
      return { message: feedback, kind: "already-confirmed" as const };
    }
    const now = Date.now();
    if (
      ultimoCodigoRef.current?.codigo === parsed.codigo &&
      now - ultimoCodigoRef.current.quando < 2000
    ) {
      return {
        message: ultimoCodigoRef.current.kind === "confirmed" || ultimoCodigoRef.current.kind === "already-confirmed"
          ? ultimoCodigoRef.current.message
          : `Leitura repetida ignorada (${parsed.codigo}).`,
        kind: ultimoCodigoRef.current.kind,
      };
    }
    const scan = { codigo: parsed.codigo, quando: now, kind: "error" as ScannerReadKind, message: "" };
    ultimoCodigoRef.current = scan;

    try {
      const response = await fetch(`/api/almoxarifado/requisicoes/${encodeURIComponent(numeroPedido)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "conferir-item", codigoEtiqueta: parsed.codigo, origem }),
      });
      const data = await response.json() as CheckResponse;
      if (!response.ok) {
        const feedback = data.produto
          ? `Este item não está nesta requisição: ${data.produto.codigo ?? parsed.codigo} · ${data.produto.nome}.`
          : data.error ?? "Não foi possível conferir este código.";
        const kind = data.produto ? "wrong-item" as const : "error" as const;
        scan.kind = kind;
        scan.message = feedback;
        setErro(feedback);
        return { message: feedback, kind };
      }
      if (data.itemId) {
        const update = (current: ChecklistRequest | null) => current ? ({
          ...current,
          itens: current.itens.map((item) =>
            item.id === data.itemId ? { ...item, conferido: true } : item,
          ),
        }) : current;
        requisicaoRef.current = update(requisicaoRef.current);
        setRequisicao(update);
        if (!data.jaConferido) {
          window.requestAnimationFrame(() => quantidadeRefs.current[data.itemId!]?.focus());
        }
      }
      const kind = data.jaConferido ? "already-confirmed" as const : "confirmed" as const;
      const feedback = data.jaConferido ? "Esse item já foi conferido" : data.message ?? "Item conferido.";
      setErro("");
      setMensagem(feedback);
      scan.kind = kind;
      scan.message = feedback;
      setMensagemKind(kind);
      return { message: feedback, kind };
    } catch {
      const feedback = "Falha de comunicação. Verifique a conexão e tente novamente.";
      setErro(feedback);
      scan.kind = "error";
      scan.message = feedback;
      return { message: feedback, kind: "error" as const };
    }
  }, [numeroPedido]);

  const handleCameraRead = useCallback(async (raw: string): Promise<ScannerReadResult> => {
    const parsed = parseEtiqueta(raw);
    if (!parsed.ok) {
      const feedback = `QR lido, mas formato não reconhecido: “${raw.slice(0, 80)}”. ${parsed.motivo}`;
      setErro(feedback);
      return { message: feedback, kind: "invalid-format" };
    }
    return conferirCodigo(raw, "QR");
  }, [conferirCodigo]);

  async function submitManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!codigoManual.trim() || !requisicaoAtiva) return;
    const result = await conferirCodigo(codigoManual, "digitacao");
    if (cameraAberta && shouldCloseCamera(result.kind)) setCameraAberta(false);
    setCodigoManual("");
  }

  async function finalizarRequisicao() {
    if (
      finalizationInFlight.current ||
      !requisicao ||
      !requisicaoAtiva ||
      !requisicao.podeFinalizar ||
      !outcomesValidos
    ) return;

    const confirmada = window.confirm(`Confirma finalizar a requisição ${requisicao.numeroPedido}? O estoque será atualizado.`);
    if (!confirmada) return;

    finalizationInFlight.current = true;
    setFinalizando(true);
    setErro("");
    try {
      const response = await fetch(`/api/almoxarifado/requisicoes/${encodeURIComponent(numeroPedido)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "finalizar",
          itens: requisicao.itens.map((item) => ({
            id: item.id,
            quantidadeSeparada: Number(quantidadesReais[item.id]),
            ...(motivosDivergencia[item.id] ? { motivo: motivosDivergencia[item.id] } : {}),
          })),
        }),
      });
      const data = await response.json() as FinalizeResponse;
      if (!response.ok) throw new Error(data.error ?? "Não foi possível finalizar a requisição.");
      if (!data.resumo) throw new Error("A requisição foi finalizada, mas o resumo não foi retornado.");
      setFinalizado(data.resumo);
    } catch (cause) {
      setErro(cause instanceof Error ? cause.message : "Não foi possível finalizar a requisição.");
    } finally {
      finalizationInFlight.current = false;
      setFinalizando(false);
    }
  }

  if (carregando) {
    return <main className="min-w-0"><LoadingState label="Carregando checklist…" rows={4} /></main>;
  }
  if (!requisicao) {
    return <main className="grid min-w-0 gap-4"><ErrorState message={erro || "Requisição não encontrada."} onRetry={() => {
      setErro("");
      setCarregando(true);
      setRetryCount((current) => current + 1);
    }} /><Link href="/almoxarifado/requisicoes" className="inline-flex min-h-11 items-center font-semibold text-brand">Voltar à fila</Link></main>;
  }

  if (finalizado) {
    const itensSeparados = finalizado.itens.filter((item) => item.quantidadeSeparada > 0).length;
    return <main className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
      <section role="status" className="rounded-xl border border-success/30 bg-success-surface p-6">
        <h1 className="text-2xl font-bold text-success">Requisição finalizada</h1>
        <p className="mt-2 text-sm text-success">Pedido {finalizado.numeroPedido} · {itensSeparados} itens com separação · {finalizado.movimentacoes.length} movimentações registradas.</p>
      </section>
      <section className="rounded-xl border border-border-subtle bg-white p-5">
        <h2 className="font-semibold text-foreground">Resumo por item</h2>
        <ul className="mt-3 divide-y divide-border-subtle">
          {finalizado.itens.map((item) => <li key={item.id} className="py-3 text-sm">
            <span className="font-medium">{item.nome}</span>: pedido {item.quantidadePedida} {item.unidadeMedida}, separado {item.quantidadeSeparada} {item.unidadeMedida}
            {item.motivo && <span className="text-text-secondary"> · {item.motivo.replaceAll("_", " ").toLowerCase()}</span>}
          </li>)}
        </ul>
      </section>
      <section className="rounded-xl border border-border-subtle bg-white p-5">
        <h2 className="font-semibold text-foreground">Movimentações geradas</h2>
        <ul className="mt-2 space-y-1 text-sm text-foreground">
          {finalizado.movimentacoes.map((movement) => <li key={movement.id}>{movement.tipo === "SAIDA" ? "Saída" : "Liberação de reserva"} · {movement.quantidade} {movement.unidadeMedida}</li>)}
        </ul>
      </section>
      <div className="flex flex-wrap gap-3">
        <Link href="/almoxarifado/requisicoes" className="rounded-lg bg-brand px-4 py-2 font-semibold text-white">Voltar à fila</Link>
        <Link href="/historico" className="rounded-lg border border-border px-4 py-2 font-semibold text-foreground">Ver histórico</Link>
      </div>
    </main>;
  }

  return (
    <main className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/almoxarifado/requisicoes" className="text-sm font-semibold text-brand hover:underline">← Voltar à fila</Link>
        <span className="rounded-full bg-priority-surface px-3 py-1 text-sm font-semibold text-brand">{totalConferidos} de {requisicao.itens.length} conferidos</span>
      </div>
      <header className="rounded-xl border border-border-subtle bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand">{requisicao.numeroPedido}</p>
        <h1 className="mt-1 text-2xl font-bold text-foreground">Checklist de separação</h1>
        <p className="mt-2 text-sm text-text-secondary">Solicitante: {requisicao.solicitante} · Atendimento: {requisicao.atendente ?? "—"}</p>
        <div className="mt-3"><PriorityBadge priority={requisicao.prioridade === "PRIORITARIO" ? "prioridade" : "padrao"} /></div>
        {!requisicaoAtiva && <p role="status" className="mt-3 rounded-lg bg-warning-surface p-3 text-sm text-warning">Esta requisição não está em atendimento. A conferência só pode ser registrada enquanto estiver assumida.</p>}
      </header>

      <section aria-labelledby="etiqueta-heading" className="rounded-xl border border-border-subtle bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="etiqueta-heading" className="text-lg font-bold text-foreground">Conferir por etiqueta</h2>
            <p className="mt-1 text-sm text-text-secondary">Leia o QR do código ERP/TOTVS ou digite o número impresso.</p>
          </div>
          <button type="button" onClick={() => setCameraAberta(true)} disabled={!requisicaoAtiva} className="min-h-11 rounded-lg bg-brand px-5 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Ler etiqueta</button>
        </div>
        <form onSubmit={(event) => void submitManual(event)} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <label htmlFor="codigo-etiqueta" className="sr-only">Número impresso na etiqueta</label>
          <input
            id="codigo-etiqueta"
            type="text"
            inputMode="numeric"
            pattern="[0-9]{1,8}"
            maxLength={8}
            value={codigoManual}
            onChange={(event) => setCodigoManual(event.target.value)}
            placeholder="Digite ou leia o código (ex.: 6687)"
            disabled={!requisicaoAtiva}
            className="min-h-11 flex-1 rounded-lg border border-border px-3 py-2 disabled:bg-background"
          />
          <button type="submit" disabled={!codigoManual.trim() || !requisicaoAtiva} className="min-h-11 rounded-lg border border-border px-5 py-2 font-semibold text-foreground disabled:opacity-50">Confirmar código</button>
        </form>
        {erro && <p role="alert" aria-live="assertive" className="mt-4 rounded-lg bg-error-surface p-3 text-sm text-error">{erro}</p>}
        {mensagem && <p role="status" aria-live="polite" className={`mt-4 rounded-lg p-3 text-sm ${mensagemKind === "already-confirmed" ? "bg-priority-surface text-brand" : "bg-success-surface text-success"}`}>
          {mensagemKind === "already-confirmed" ? <><span aria-hidden="true">ℹ </span><span>Informação: </span></> : null}{mensagem}
        </p>}
      </section>

      <section aria-label="Itens da requisição" className="space-y-3">
        {requisicao.itens.map((item) => {
          const quantidadeReal = quantidadesReais[item.id] ?? "";
          const diverge = quantidadeReal !== "" && Number(quantidadeReal) !== item.quantidadeSolicitada;
          return (
            <article key={item.id} className={`rounded-xl border bg-white p-4 ${item.conferido ? "border-success/30" : "border-border-subtle"}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold text-foreground">{item.nome}</h2>
                  <ProductCode code={item.codigo} />
                  <ItemDescription className="mt-1 text-sm text-text-secondary" categoria={item.categoria} descricao={item.descricao} />
                  <p className="mt-1 text-sm text-text-secondary">Pedido: {item.quantidadeSolicitada} {item.unidadeMedida}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.conferido ? "bg-success-surface text-success" : "bg-background text-foreground"}`}>{item.conferido ? "Conferido" : "Pendente"}</span>
              </div>
              <label htmlFor={`qtd-real-${item.id}`} className="mt-4 block text-sm font-semibold text-foreground">Quantidade real conferida
                <input
                  id={`qtd-real-${item.id}`}
                  ref={(element) => { quantidadeRefs.current[item.id] = element; }}
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  value={quantidadeReal}
                  onChange={(event) => setQuantidadesReais((current) => ({ ...current, [item.id]: event.target.value }))}
                  placeholder="Preencha após contar"
                  disabled={!item.conferido}
                  className="mt-1 block min-h-11 w-full rounded-lg border border-border px-3 py-2 disabled:bg-background sm:max-w-xs"
                />
              </label>
              {diverge && <p role="status" className="mt-2 text-sm font-semibold text-warning">Divergência: {Number(quantidadeReal) - item.quantidadeSolicitada} {item.unidadeMedida} em relação ao pedido. O valor ainda não é persistido.</p>}
              {diverge && <label className="mt-3 block text-sm font-medium text-foreground">Motivo da divergência
                <select
                  value={motivosDivergencia[item.id] ?? ""}
                  onChange={(event) => setMotivosDivergencia((current) => ({
                    ...current,
                    [item.id]: event.target.value as MotivoDivergencia | "",
                  }))}
                  className="mt-1 block min-h-11 w-full rounded-lg border border-border px-3 py-2 sm:max-w-sm"
                >
                  <option value="">Selecione o motivo</option>
                  {Number(quantidadeReal) > item.quantidadeSolicitada
                    ? <option value="EXCEDEU_LOTE_MINIMO">Excedeu / lote mínimo</option>
                    : <>
                      <option value="FALTOU">Faltou material</option>
                      <option value="AVARIA">Avaria</option>
                    </>}
                </select>
              </label>}
            </article>
          );
        })}
      </section>
      {requisicao.podeFinalizar && <section className="rounded-xl border border-border-subtle bg-white p-5">
        <p className="text-sm text-text-secondary">A quantidade real e os motivos serão gravados ao finalizar. As divergências serão baixadas pela quantidade efetivamente separada.</p>
        {erro && <p role="alert" className="mt-3 rounded-lg bg-error-surface p-3 text-sm text-error">{erro}</p>}
        <button
          type="button"
          onClick={() => void finalizarRequisicao()}
          disabled={!requisicaoAtiva || !outcomesValidos || finalizando}
          className="mt-4 min-h-11 rounded-lg bg-brand px-5 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {finalizando ? "Finalizando…" : "Finalizar requisição"}
        </button>
        {!outcomesValidos && <p className="mt-2 text-sm text-text-secondary">Confira cada item e informe uma quantidade válida; selecione o motivo quando houver divergência.</p>}
      </section>}
      {cameraAberta && <ProductEtiquetaScanner onRead={handleCameraRead} onClose={() => setCameraAberta(false)} />}
    </main>
  );
}
