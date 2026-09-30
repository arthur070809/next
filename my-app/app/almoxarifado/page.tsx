import { redirect } from "next/navigation";
import { getAuthenticatedFuncionario } from "@/lib/auth";

export default async function AlmoxarifadoPage() {
  const funcionario = await getAuthenticatedFuncionario();
  if (!funcionario) redirect("/login");
  if (funcionario.role !== "admin" && funcionario.mustChangePassword) redirect("/alterar-senha?next=/almoxarifado");
  redirect("/estoque");
}