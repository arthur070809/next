import { NextResponse } from "next/server";
import { getAuthenticatedFuncionario } from "@/lib/auth";
import { listOpenRequisitions } from "@/lib/requisicoes-db";

export async function GET() {
  const funcionario = await getAuthenticatedFuncionario();
  if (!funcionario) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  try {
    const requisicoes = await listOpenRequisitions();
    return NextResponse.json({ requisicoes });
  } catch (error) {
    console.error("Falha ao consultar fila de requisições:", error instanceof Error ? error.message : "erro");
    return NextResponse.json({ error: "Não foi possível carregar as requisições." }, { status: 500 });
  }
}
