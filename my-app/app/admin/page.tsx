import { redirect } from "next/navigation";
import { getAuthenticatedFuncionario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAtOrBelowReorderPoint } from "@/lib/stock-status";
import { isDemoLoginEnabledForBadge, isDemoModeConfigured } from "@/lib/demo-mode";
import AdminDashboard from "./dashboard";

export default async function AdminPage() {
  const funcionario = await getAuthenticatedFuncionario();
  if (!funcionario) redirect("/login?callbackUrl=%2Fadmin");
  if (funcionario.role !== "admin") redirect("/login?callbackUrl=%2Fadmin");
  const hoje = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const inicioHoje = new Date(`${hoje}T03:00:00.000Z`);
  const amanha = new Date(inicioHoje);
  amanha.setUTCDate(amanha.getUTCDate() + 1);
  const [estoqueTotal, requisicoesPendentes, usuariosAtivos, itensNoDeposito, sobrasHoje, saldosParaRepor] = await Promise.all([
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
    prisma.saldoEstoque.findMany({
      where: {
        local: { slug: "estoque" },
        item: { ativo: true },
      },
      select: {
        quantidade: true,
        item: { select: { nome: true, codigo: true, pontoPedido: true } },
      },
    }),
  ]);
  const itensParaRepor = saldosParaRepor
    .filter(({ quantidade, item }) => isAtOrBelowReorderPoint(quantidade, item.pontoPedido))
    .map(({ item }) => ({ nome: item.nome, codigo: item.codigo }));
  return (
    <AdminDashboard
      stats={{
        estoqueTotal,
        requisicoesPendentes,
        usuariosAtivos,
        itensNoDeposito,
        sobrasHoje: sobrasHoje._sum.quantidade ?? 0,
        itensParaRepor,
      }}
      canResetDemo={isDemoModeConfigured() && isDemoLoginEnabledForBadge(funcionario.cracha)}
    />
  );
}
