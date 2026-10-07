import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getAuthenticatedFuncionario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripIdempotencyMetadata } from "@/lib/requisition-metadata";
import { resolveRequisitionItemMetadata } from "@/lib/requisition-description";
import { PapelFuncionario } from "@/generated/prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const funcionario = await getAuthenticatedFuncionario();
  if (!funcionario) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const isOperator = funcionario.papel === PapelFuncionario.OPERADOR;
  if (
    !isOperator
    && funcionario.papel !== PapelFuncionario.ADMIN
    && funcionario.papel !== PapelFuncionario.ALMOXARIFE
  ) {
    return NextResponse.json({ error: "Acesso não autorizado." }, { status: 403 });
  }
  const { id } = await params;
  try {
    const requisicao = await prisma.requisicao.findUnique({
      where: isOperator ? { id, solicitanteId: funcionario.id } : { id },
      include: {
        solicitante: { select: { nome: true, cracha: true } },
        atendente: { select: { nome: true, cracha: true } },
        itens: {
          include: {
            item: { select: { id: true, nome: true, codigo: true } },
            local: { select: { slug: true } },
          },
        },
      },
    });
    if (!requisicao) return NextResponse.json({ error: "Requisição não encontrada." }, { status: 404 });
    return NextResponse.json({
      requisicao: {
        ...requisicao,
        observacao: stripIdempotencyMetadata(requisicao.observacao),
        itens: requisicao.itens.map((item, index) => {
          const metadata = resolveRequisitionItemMetadata(
            item.descricao,
            requisicao.observacao,
            index === 0,
          );
          return {
            ...item,
            descricao: metadata.descricao,
            setor: metadata.setor,
          };
        }),
      },
    });
  } catch (error) {
    const errorId = randomUUID();
    console.error("Falha ao consultar requisição", { errorId, errorName: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ error: "Não foi possível carregar a requisição.", errorId }, { status: 500 });
  }
}