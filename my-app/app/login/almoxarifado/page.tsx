import { redirect } from "next/navigation";
import { getAuthenticatedFuncionario } from "@/lib/auth";
import LoginForm from "../LoginForm";

export default async function WarehouseLoginPage() {
  const funcionario = await getAuthenticatedFuncionario();
  if (funcionario) redirect(funcionario.role === "admin" ? "/admin" : "/almoxarifado");
  return <LoginForm portal="almoxarifado" />;
}