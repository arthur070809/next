import Link from "next/link";

export const metadata = {
  title: "NexStock | Controle de estoque",
  description: "Controle de estoque e requisições do Almoxarifado Marcon.",
};

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="fixed inset-x-0 top-0 z-10 border-b border-slate-200/70 bg-white/85 backdrop-blur-md">
        <nav aria-label="Navegação principal" className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-12">
          <Link href="/" className="text-xl font-bold tracking-tight text-slate-950" aria-label="NexStock, página inicial">
            Nex<span className="text-royal">Stock</span>
          </Link>
          <Link href="/login" className="inline-flex min-h-10 items-center justify-center rounded-lg bg-royal px-5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal">
            Entrar
          </Link>
        </nav>
      </header>

      <section aria-labelledby="hero-title" className="mx-auto grid min-h-screen max-w-7xl items-center gap-12 px-5 pb-12 pt-24 sm:px-8 sm:py-28 lg:grid-cols-[1.08fr_0.92fr] lg:gap-16 lg:px-12">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-royal">Almoxarifado Marcon</p>
          <h1 id="hero-title" className="mt-5 text-4xl font-bold leading-[1.08] tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
            Controle de estoque e requisições.
            <span className="mt-2 block text-royal">Tudo em um só lugar.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
            Uma forma simples e rápida de organizar materiais, acompanhar requisições e manter o almoxarifado sob controle.
          </p>
          <Link href="/login" className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-royal px-6 text-base font-semibold text-white shadow-lg shadow-blue-900/15 transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal">
            Acessar o NexStock <span aria-hidden="true">→</span>
          </Link>
        </div>

        <div className="relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-8 text-white shadow-2xl shadow-slate-900/20 sm:p-10 lg:min-h-[22rem] lg:p-12">
          <svg aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 h-full w-full opacity-25" viewBox="0 0 600 420" fill="none" preserveAspectRatio="xMidYMid slice">
            <circle cx="470" cy="80" r="145" stroke="#93C5FD" strokeOpacity=".28" />
            <circle cx="470" cy="80" r="105" stroke="#93C5FD" strokeOpacity=".2" />
            <path d="M300 0V420M380 0V420M460 0V420M540 0V420M300 100H600M300 180H600M300 260H600M300 340H600" stroke="#BFDBFE" strokeOpacity=".12" />
            <path d="M0 350L220 130M65 420L350 135" stroke="#60A5FA" strokeOpacity=".2" />
          </svg>
          <div className="relative z-10 flex min-h-64 flex-col justify-end sm:min-h-72">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-200 sm:text-sm">Mais simples. Mais rápido.</p>
            <p className="mt-4 max-w-md text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
              A informação certa para cada área da operação.
            </p>
            <div aria-hidden="true" className="mt-8 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-300/80" />
              <span className="h-px w-12 bg-blue-200/40" />
              <span className="h-1.5 w-1.5 rounded-full bg-blue-300/50" />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
