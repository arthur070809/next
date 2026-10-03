"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
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

  if (carregando) return <main className="mx-auto max-w-3xl p-4"><p role="status" className="rounded-xl bg-white p-8 text-center text-slate-500">Carregando requisição…</p></main>;
  if (!requisicao) return <main className="mx-auto max-w-3xl p-4"><p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800">{erro || "Requisição não encontrada."}</p><Link href="/almoxarifado" className="mt-4 inline-block font-semibold text-royal">Voltar às requisições</Link></main>;

  return <main className="mx-auto max-w-3xl p-4 sm:p-6">
    <div className="mb-4 flex items-center justify-between"><Link href="/almoxarifado" className="text-sm font-semibold text-royal hover:underline">Voltar às requisições</Link><Link href="/deposito?aba=historico" className="text-sm font-semibold text-slate-600 hover:text-royal">Histórico do depósito</Link></div>
    <header className="border-b border-slate-200 pb-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-royal">Requisição #{requisicao.numero}</p><h1 className="mt-1 text-2xl font-bold text-slate-950">{requisicao.item}</h1><p className="mt-1 text-sm text-slate-600">{requisicao.quantidade} {requisicao.unidadeMedida} retirados do {requisicao.origem === "DEPOSITO" ? "depósito" : "estoque"}</p></header>
    <section className="mt-5 grid gap-3 sm:grid-cols-3">
      <div className="rounded-lg border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Requisição</p><p className="mt-1 font-semibold text-slate-900">#{requisicao.numero}</p></div>
      <div className="rounded-lg border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Item e retirada</p><p className="mt-1 font-semibold text-slate-900">{requisicao.item} · {requisicao.quantidade}</p></div>
      <div className="rounded-lg border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Origem</p><p className="mt-1 font-semibold text-slate-900">{requisicao.origem === "DEPOSITO" ? "Depósito" : "Estoque"}</p></div>
    </section>
    <form onSubmit={(event) => void registrarSobra(event)} className="mt-5 rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-700">Já devolvido: <strong>{requisicao.qtdDevolvida}</strong> · pode devolver até: <strong>{restante}</strong></p>
      <label htmlFor="qtd-sobra" className="mt-4 block text-sm font-semibold text-slate-800">Quantas sobraram?<input id="qtd-sobra" type="number" inputMode="numeric" min={1} max={restante} step={1} value={quantidade} onChange={(event) => { setQuantidade(event.target.value); idempotencyKey.current = null; }} disabled={restante === 0 || requisicao.status !== "RETIRADA"} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 disabled:bg-slate-100" /></label>
      {erro && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
      {confirmacao && <p role="status" className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{confirmacao}</p>}
      {requisicao.status !== "RETIRADA" && <p className="mt-3 text-sm text-amber-800">Esta requisição não está em status de retirada.</p>}
      <button type="submit" disabled={salvando || restante === 0 || requisicao.status !== "RETIRADA" || !Number.isSafeInteger(Number(quantidade)) || Number(quantidade) < 1 || Number(quantidade) > restante} className="mt-4 min-h-11 rounded-lg bg-royal px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{salvando ? "Registrando…" : "Registrar sobra"}</button>
    </form>
  </main>;
}