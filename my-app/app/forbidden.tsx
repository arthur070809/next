import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <section className="max-w-md rounded-card border border-border-subtle bg-surface p-8 text-center shadow-card">
        <p className="text-sm font-semibold uppercase tracking-wide text-text-secondary">403 · Acesso negado</p>
        <h1 className="mt-2 text-xl font-bold text-foreground">Você não tem permissão para acessar esta área.</h1>
        <Link href="/" className="mt-5 inline-flex min-h-11 items-center justify-center rounded-control border border-brand px-4 py-2 font-semibold text-brand hover:bg-priority-surface">
          Voltar ao início
        </Link>
      </section>
    </main>
  );
}
