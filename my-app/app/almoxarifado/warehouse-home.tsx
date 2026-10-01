"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./home.module.css";

type Resumo = {
  materiaisAtivos: number;
  materiaisSemEstoque: number;
  requisicoesPendentes: number;
  itensComSobras: number;
  sobrasHoje: number;
};

const cards: Array<{ key: keyof Resumo; label: string; detail: string }> = [
  { key: "materiaisAtivos", label: "Materiais ativos", detail: "Itens cadastrados no estoque" },
  { key: "materiaisSemEstoque", label: "Sem estoque", detail: "Materiais ativos com saldo zero" },
  { key: "requisicoesPendentes", label: "Requisições pendentes", detail: "Pedidos enviados por você" },
  { key: "itensComSobras", label: "Itens no depósito", detail: "Materiais com saldo disponível" },
  { key: "sobrasHoje", label: "Sobras registradas hoje", detail: "Unidades devolvidas ao depósito" },
];

export default function WarehouseHome({ userName, badge }: { userName: string; badge: string }) {
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
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
      .catch(() => {
        if (ativo) setErro("Não foi possível carregar o resumo. Tente novamente.");
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => { ativo = false; };
  }, []);

  return (
    <main className={`${styles.home} mx-auto max-w-7xl px-4 py-8 sm:px-8`}>
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-royal">Visão geral</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Olá, {primeiroNome}</h1>
        <p className="mt-2 text-slate-600">Acompanhe o estoque e acesse suas áreas de trabalho.</p>
      </header>

      {!carregando && !erro && resumo?.materiaisAtivos === 0 && <p role="status" className="mt-6 rounded-lg border border-dashed border-slate-300 bg-white px-4 py-5 text-sm text-slate-600">O estoque está vazio no momento.</p>}

      <section aria-label="Resumo do almoxarifado" aria-live="polite" className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {carregando ? cards.map((card) => <div key={card.key} aria-hidden="true" className="h-32 motion-safe:animate-pulse rounded-xl border border-slate-200 bg-white p-5"><div className="h-4 w-2/3 rounded bg-slate-200" /><div className="mt-5 h-8 w-1/3 rounded bg-slate-200" /></div>)
          : erro ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 sm:col-span-2 xl:col-span-4">{erro}</p>
            : cards.map((card) => <article key={card.key} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-medium text-slate-600">{card.label}</h2>
              <p className="mt-3 text-3xl font-bold text-slate-950">{resumo?.[card.key] ?? 0}</p>
              <p className="mt-1 text-sm text-slate-500">{card.detail}</p>
            </article>)}
      </section>

      <section className="mt-8" aria-labelledby="warehouse-shortcuts">
        <h2 id="warehouse-shortcuts" className="text-lg font-bold text-slate-950">Ações rápidas</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Link href="/almoxarifado/estoque" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-royal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal">
            <span aria-hidden="true" className="text-xl text-royal">▦</span><p className="mt-3 font-semibold text-slate-900">Estoque</p><p className="mt-1 text-sm text-slate-500">Consulte os materiais e seus saldos.</p>
          </Link>
          <Link href="/almoxarifado/estoque#novo-item" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-royal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal">
            <span aria-hidden="true" className="text-xl text-royal">＋</span><p className="mt-3 font-semibold text-slate-900">Cadastrar item</p><p className="mt-1 text-sm text-slate-500">Registre uma entrada no estoque.</p>
          </Link>
          <Link href="/almoxarifado/deposito" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-royal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal">
            <span aria-hidden="true" className="text-xl text-royal">◇</span><p className="mt-3 font-semibold text-slate-900">Depósito de sobras</p><p className="mt-1 text-sm text-slate-500">Acompanhe itens avulsos devolvidos.</p>
          </Link>
        </div>
      </section>
    </main>
  );
}