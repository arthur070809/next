export default function AdminForbiddenPage() {
  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-6">
      <section className="max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-bold text-slate-950">Acesso negado</h1>
        <p className="mt-2 text-sm text-slate-600">Você não tem permissão para acessar esta área.</p>
      </section>
    </main>
  );
}