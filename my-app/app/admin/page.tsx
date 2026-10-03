import { redirect } from "next/navigation";
import { getAuthenticatedFuncionario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AdminDashboard from "./dashboard";

export default async function AdminPage() {
  const funcionario = await getAuthenticatedFuncionario();
  if (!funcionario) redirect("/login");
  if (funcionario.role !== "admin") redirect("/");
  const hoje = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const inicioHoje = new Date(`${hoje}T03:00:00.000Z`);
  const amanha = new Date(inicioHoje);
  amanha.setUTCDate(amanha.getUTCDate() + 1);
  const [estoqueTotal, requisicoesPendentes, usuariosAtivos, itensNoDeposito, sobrasHoje] = await Promise.all([
    prisma.item.count({ where: { ativo: true } }),
    prisma.requisicao.count({ where: { status: "PENDENTE" } }),
    prisma.funcionario.count({ where: { ativo: true } }),
    prisma.saldoEstoque.count({
      where: { quantidade: { gt: 0 }, local: { slug: "deposito" } },
    }),
    prisma.movimentacao.aggregate({
      where: {
        tipo: "ENTRADA",
        saldoEstoque: { local: { slug: "deposito" } },
        criadoEm: { gte: inicioHoje, lt: amanha },
      },
      _sum: { quantidade: true },
    }),
  ]);
  return (
    <AdminDashboard
      stats={{
        estoqueTotal,
        requisicoesPendentes,
        usuariosAtivos,
        itensNoDeposito,
        sobrasHoje: sobrasHoje._sum.quantidade ?? 0,
      }}
    />
  );
}
