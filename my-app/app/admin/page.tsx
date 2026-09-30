import { redirect } from "next/navigation";
import { getAuthenticatedFuncionario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AdminDashboard from "./dashboard";

export default async function AdminPage() {
  const funcionario = await getAuthenticatedFuncionario();
  if (!funcionario) redirect("/login");
  if (funcionario.role !== "admin") redirect("/");
  const [estoqueTotal, requisicoesPendentes, usuariosAtivos] = await Promise.all([
    prisma.estoqueItem.count({ where: { ativo: true } }),
    prisma.requisicao.count({ where: { status: "PENDENTE" } }),
    prisma.funcionario.count({ where: { ativo: true } }),
  ]);
  return <AdminDashboard stats={{ estoqueTotal, requisicoesPendentes, usuariosAtivos }} />;
}