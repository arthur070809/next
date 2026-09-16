import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-slate-50 px-5 py-10 sm:px-8">
      <section className="w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:grid sm:grid-cols-[1.1fr_0.9fr]">
        <div className="flex flex-col justify-center px-6 py-12 sm:px-12 sm:py-16 lg:px-16">
          <p className="mb-8 text-sm font-semibold uppercase tracking-[0.2em] text-royal">
            Almoxarifado Marcon
          </p>
          <div className="max-w-xl">
            <h1 className="text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
              Marcon
            </h1>
            <p className="mt-5 text-lg leading-8 text-slate-600 sm:text-xl">
              Gestão digital de requisições de almoxarifado.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login"
                className="inline-flex min-h-14 items-center justify-center rounded-lg bg-royal px-7 text-base font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal"
              >
                Entrar
              </Link>
              <Link
                href="/cadastro"
                className="inline-flex min-h-14 items-center justify-center rounded-lg border-2 border-royal px-7 text-base font-semibold text-royal transition-colors hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal"
              >
                Criar conta
              </Link>
            </div>
          </div>
        </div>
        <div className="hidden bg-royal p-10 text-white sm:flex sm:flex-col sm:justify-end lg:p-12">
          <div className="max-w-xs border-l border-white/40 pl-5">
            <p className="text-sm font-medium uppercase tracking-[0.16em] text-blue-100">
              Mais simples. Mais rápido.
            </p>
            <p className="mt-3 text-2xl font-semibold leading-tight">
              Seus pedidos de material em um só lugar.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
