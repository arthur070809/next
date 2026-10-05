"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { PageHeader, StatusBadge } from "../../../components/industrial";
import type { RequisicaoAtendida } from "../../../../lib/types/requisicao";

export default function RequisicaoDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const [requisicao, setRequisicao] = useState<RequisicaoAtendida | null>(null);
  const [quantidade, setQuantidade] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const idempotencyKey = useRef<string | null>(null);
  const restante = requisicao ? requisicao.quantidade - requisicao.qtdDevolvida : 0;

  async function carregar() {
    const response = await fetch(`/api/requests/${encodeURIComponent(id)}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Não foi possível carregar a requisição.");
    setRequisicao(data.requisicao as RequisicaoAtendida);
  }

  useEffect(() => {
    let active = true;
    fetch(`/api/requests/${encodeURIComponent(id)}`, { cache: "no-store" }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Não foi possível carregar a requisição.");
      return data.requisicao as RequisicaoAtendida;
    }).then((request) => { if (active) setRequisicao(request); })
      .catch((cause) => { if (active) setErro(cause instanceof Error ? cause.message : "Não foi possível carregar a requisição."); })
      .finally(() => { if (active) setCarregando(false); });
    return () => { active = false; };
  }, [id]);

  async function registrarSobra(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!requisicao || salvando || Number(quantidade) < 1 || Number(quantidade) > restante) return;
    idempotencyKey.current ??= crypto.randomUUID();
    setSalvando(true);
    setErro("");
    setConfirmacao("");
    try {
      const response = await fetch(`/api/requests/${encodeURIComponent(requisicao.id)}/sobra`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey.current },
        body: JSON.stringify({ quantidade: Number(quantidade) }),
      });
      const data = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(data.error ?? "Não foi possível registrar a sobra.");
      setConfirmacao(data.message ?? "Sobra registrada.");
      setQuantidade("");
      idempotencyKey.current = null;
      await carregar();
    } catch (cause) {
      setErro(cause instanceof Error ? cause.message : "Não foi possível registrar a sobra.");
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) return <main className="mx-auto max-w-3xl"><p role="status" className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">Carregando requisição…</p></main>;
  if (!requisicao) return <main className="mx-auto max-w-3xl"><p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800 shadow-sm">{erro || "Requisição não encontrada."}</p><Link href="/almoxarifado" className="mt-4 inline-block font-semibold text-blue-700">Voltar às requisições</Link></main>;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow="Atendimento"
        title={`Requisição #${requisicao.numero}`}
        description={`${requisicao.quantidade} ${requisicao.unidadeMedida} retirados do ${requisicao.origem === "DEPOSITO" ? "depósito" : "estoque"}.`}
        action={
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/almoxarifado" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm">
              Voltar
            </Link>
            <Link href="/deposito?aba=historico" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm">
              Histórico do depósito
            </Link>
          </div>
        }
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Item</p>
          <p className="mt-2 font-bold text-slate-900">{requisicao.item}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Quantidade</p>
          <p className="mt-2 font-bold text-slate-900">{requisicao.quantidade} {requisicao.unidadeMedida}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Origem</p>
          <p className="mt-2 font-bold text-slate-900">{requisicao.origem === "DEPOSITO" ? "Depósito" : "Estoque"}</p>
        </div>
      </section>

      <form onSubmit={(event) => void registrarSobra(event)} className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-700">Status da requisição</p>
            <div className="mt-2">
              <StatusBadge label={requisicao.status === "RETIRADA" ? "Retirada" : requisicao.status} tone={requisicao.status === "RETIRADA" ? "success" : "warning"} />
            </div>
          </div>
          <p className="text-sm text-slate-600">Já devolvido: <strong className="text-slate-900">{requisicao.qtdDevolvida}</strong> · restante: <strong className="text-slate-900">{restante}</strong></p>
        </div>

        <label htmlFor="qtd-sobra" className="mt-5 block text-sm font-semibold text-slate-800">
          Quantas sobraram?
          <input
            id="qtd-sobra"
            type="number"
            inputMode="numeric"
            min={1}
            max={restante}
            step={1}
            value={quantidade}
            onChange={(event) => {
              setQuantidade(event.target.value);
              idempotencyKey.current = null;
            }}
            disabled={restante === 0 || requisicao.status !== "RETIRADA"}
            className="mt-2 block w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-base shadow-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-100"
          />
        </label>

        {erro && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
        {confirmacao && <p role="status" className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{confirmacao}</p>}
        {requisicao.status !== "RETIRADA" && <p className="mt-4 text-sm text-amber-800">Esta requisição não está em status de retirada.</p>}

        <button
          type="submit"
          disabled={salvando || restante === 0 || requisicao.status !== "RETIRADA" || !Number.isSafeInteger(Number(quantidade)) || Number(quantidade) < 1 || Number(quantidade) > restante}
          className="mt-5 min-h-11 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {salvando ? "Registrando…" : "Registrar sobra"}
        </button>
      </form>
    </div>
  );
}