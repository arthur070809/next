import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "Almoxarifado Marcon",
  description: "Controle de estoque e requisições do Almoxarifado Marcon.",
};

export default function Home() {
  return (
    <main className="min-h-dvh bg-background text-foreground">
      <header className="bg-brand">
        <nav aria-label="Navegação principal" className="mx-auto flex min-h-20 max-w-7xl items-center justify-between gap-4 px-4 sm:px-8 lg:px-12">
          <Link href="/" className="inline-flex rounded-control bg-surface p-2.5" aria-label="Marcon Metalúrgicos, página inicial">
            <Image src="/marcon-logo.svg" width={159} height={31} alt="Marcon Metalúrgicos" priority />
          </Link>
          <Link href="/login" className="inline-flex min-h-11 items-center justify-center rounded-control bg-surface px-5 text-sm font-semibold text-brand transition-colors hover:bg-priority-surface">
            Entrar
          </Link>
        </nav>
      </header>

      <section aria-labelledby="hero-title" className="mx-auto grid min-h-[calc(100dvh-5rem)] max-w-7xl items-center gap-8 px-4 py-10 sm:px-8 sm:py-14 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12 lg:px-12">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand">Almoxarifado Marcon</p>
          <h1 id="hero-title" className="mt-4 text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl">
            Controle de estoque e requisições.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-text-secondary sm:text-lg">
            Organize materiais, acompanhe solicitações e mantenha as equipes conectadas ao almoxarifado.
          </p>
          <Link href="/login" className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-control bg-brand px-6 text-base font-semibold text-surface shadow-card transition-colors hover:bg-brand-hover active:bg-brand-pressed">
            Acessar o sistema <span aria-hidden="true">→</span>
          </Link>
        </div>

        <section aria-label="Recursos do sistema" className="rounded-panel bg-surface p-5 shadow-card sm:p-8">
          <h2 className="text-xl font-bold text-foreground">Operação em um só lugar</h2>
          <ul className="mt-5 divide-y divide-border-subtle">
            <li className="flex gap-3 py-4">
              <span aria-hidden="true" className="mt-1 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-priority-surface text-sm font-bold text-brand">1</span>
              <span><strong className="block text-foreground">Solicitações claras</strong><span className="mt-1 block text-sm text-text-secondary">Acompanhe pedidos do envio ao atendimento.</span></span>
            </li>
            <li className="flex gap-3 py-4">
              <span aria-hidden="true" className="mt-1 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-priority-surface text-sm font-bold text-brand">2</span>
              <span><strong className="block text-foreground">Estoque atualizado</strong><span className="mt-1 block text-sm text-text-secondary">Consulte materiais e movimentações do almoxarifado.</span></span>
            </li>
            <li className="flex gap-3 py-4">
              <span aria-hidden="true" className="mt-1 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-priority-surface text-sm font-bold text-brand">3</span>
              <span><strong className="block text-foreground">Acesso por perfil</strong><span className="mt-1 block text-sm text-text-secondary">Ferramentas adequadas para cada equipe.</span></span>
            </li>
          </ul>
        </section>
      </section>
    </main>
  );
}
