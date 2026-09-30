import { redirect } from "next/navigation";
import { getAuthenticatedFuncionario } from "@/lib/auth";
import AdminUsersClient from "./users-client";

export default async function AdminUsersPage() {
  const funcionario = await getAuthenticatedFuncionario();
  if (!funcionario) redirect("/login");
  if (funcionario.role !== "admin") redirect("/");
  return <AdminUsersClient />;
}