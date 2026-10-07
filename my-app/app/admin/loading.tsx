import { LoadingState } from "@/app/components/ui";

export default function AdminLoading() {
  return <main className="min-h-[calc(100vh-4rem)] px-4 py-8 sm:px-8"><div className="mx-auto max-w-7xl"><LoadingState label="Carregando painel..." rows={5} /></div></main>;
}