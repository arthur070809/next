import { PapelFuncionario } from "@/generated/prisma/client";
import { getAuthenticatedFuncionario } from "@/lib/auth";
import { redirect } from "next/navigation";
import SobrasClient from "./SobrasClient";

export default async function SobrasPage() {
  const funcionario = await getAuthenticatedFuncionario();
  if (!funcionario) redirect("/login?callbackUrl=%2Fdeposito%2Fsobras");
  if (
    funcionario.papel !== PapelFuncionario.ADMIN &&
    funcionario.papel !== PapelFuncionario.ALMOXARIFE
  ) {
    redirect("/requisicao");
  }
  return <SobrasClient />;
}
