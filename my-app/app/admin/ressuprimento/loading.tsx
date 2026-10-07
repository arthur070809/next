export default function RessuprimentoLoading() {
  return <main className="mx-auto min-h-dvh max-w-7xl p-4 sm:p-6" aria-busy="true">
    <header className="mb-5 rounded-xl border border-border-subtle bg-surface p-4">
      <h1 className="text-2xl font-semibold text-foreground">Ressuprimento</h1>
      <p className="mt-2 text-sm text-text-secondary">Carregando análise de ressuprimento…</p>
    </header>
    <section className="rounded-xl border border-border-subtle bg-surface p-4" aria-label="Carregando itens">
      <div className="h-5 w-48 animate-pulse rounded bg-border-subtle" />
      <div className="mt-4 h-24 animate-pulse rounded bg-background" />
    </section>
  </main>;
}
