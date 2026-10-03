import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthenticatedFuncionario } from "@/lib/auth";
import WarehouseHome from "./warehouse-home";

export const metadata: Metadata = {
  title: "Início | Almoxarifado Marcon",
};

export default async function AlmoxarifadoHomePage() {
  const funcionario = await getAuthenticatedFuncionario();
  if (!funcionario) redirect("/login");

  return <WarehouseHome userName={funcionario.nome} badge={funcionario.cracha} />;
}
