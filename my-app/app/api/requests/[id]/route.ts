import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getAuthenticatedFuncionario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  if (!(await getAuthenticatedFuncionario())) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  try {
    const requisicao = await prisma.requisicao.findUnique({
      where: { id },
      include: {
        funcionario: { select: { nome: true } },
        estoqueItem: { select: { id: true, codigo: true } },
      },
    });
    if (!requisicao) return NextResponse.json({ error: "Requisição não encontrada." }, { status: 404 });
    return NextResponse.json({ requisicao });
  } catch (error) {
    const errorId = randomUUID();
    console.error("Falha ao consultar requisição", { errorId, errorName: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ error: "Não foi possível carregar a requisição.", errorId }, { status: 500 });
  }
}