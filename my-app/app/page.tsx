import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthenticatedFuncionario, getRoleHomePath, requiresPasswordChange } from "@/lib/auth";

export const metadata = {
  title: "Almoxarifado Marcon | Controle de estoque",
  description: "Controle de estoque, requisições e acesso do Almoxarifado Marcon.",
};

export default async function Home() {
  const funcionario = await getAuthenticatedFuncionario();
  if (funcionario) {
    const destination = getRoleHomePath(funcionario.role);
    if (requiresPasswordChange(funcionario)) redirect(`/alterar-senha?next=${destination}`);
    redirect(destination);
  }

  return (
    <main className="min-h-screen bg-slate-100 px-5 py-8 sm:px-8 sm:py-12">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col justify-between overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60 motion-fade-in">
        <div className="grid gap-10 px-6 py-12 sm:px-12 sm:py-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:px-20">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-royal">Almoxarifado Marcon</p>
            <h1 className="mt-5 max-w-2xl text-4xl font-bold tracking-tight text-slate-950 sm:text-6xl">Controle de estoque e requisições em um só lugar.</h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">Uma operação mais simples para encontrar materiais, registrar pedidos e manter tudo sob controle.</p>
            <Link href="/login" aria-label="Entrar no Almoxarifado Marcon" className="mt-9 inline-flex min-h-14 items-center justify-center rounded-lg bg-royal px-8 text-base font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal">Entrar</Link>
          </div>
          <div className="rounded-2xl bg-slate-950 p-7 text-white sm:p-9">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-200">Mais simples. Mais rápido.</p>
            <p className="mt-4 text-2xl font-semibold leading-tight">A informação certa para cada área da operação.</p>
            <div className="mt-8 h-2 rounded-full bg-blue-950"><div className="h-2 w-2/3 rounded-full bg-blue-400" /></div>
          </div>
        </div>
        <div className="grid border-t border-slate-200 sm:grid-cols-3">
          {[['Estoque', 'Visibilidade dos materiais disponíveis.'], ['Requisições', 'Pedidos organizados em poucos passos.'], ['Controle de acesso', 'Cada pessoa na área certa.']].map(([title, text]) => <div key={title} className="border-b border-slate-200 px-6 py-6 last:border-0 sm:border-b-0 sm:border-r sm:px-8 sm:last:border-r-0"><p className="font-semibold text-slate-900">{title}</p><p className="mt-1 text-sm leading-6 text-slate-500">{text}</p></div>)}
        </div>
        <footer className="px-6 py-5 text-center text-xs text-slate-500 sm:text-left sm:px-8">© 2026 Almoxarifado Marcon</footer>
      </section>
    </main>
  );
}
