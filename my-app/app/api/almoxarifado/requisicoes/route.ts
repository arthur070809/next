import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { PapelFuncionario } from "@/generated/prisma/client";
import { getAuthenticatedFuncionario } from "@/lib/auth";
import { listOpenRequisitions } from "@/lib/requisicoes-db";

export async function GET() {
  const funcionario = await getAuthenticatedFuncionario();
  if (!funcionario) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (
    funcionario.papel !== PapelFuncionario.ADMIN &&
    funcionario.papel !== PapelFuncionario.ALMOXARIFE
  ) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  try {
    const requisicoes = await listOpenRequisitions();
    return NextResponse.json({ requisicoes });
  } catch (error) {
    const errorId = randomUUID();
    const errorName = error instanceof Error ? error.name : "UnknownError";
    console.error("Falha ao consultar fila de requisições.", { errorId, errorName });
    return NextResponse.json({ error: "Não foi possível carregar as requisições." }, { status: 500 });
  }
}
