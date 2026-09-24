import { NextResponse } from "next/server";
import { getAuthenticatedFuncionario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const funcionario = await getAuthenticatedFuncionario();

  if (!funcionario) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const requisicoes = await prisma.requisicao.findMany({
    where: { funcionarioId: funcionario.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ requisicoes });
}

export async function POST(request: Request) {
  try {
    const funcionario = await getAuthenticatedFuncionario();

    if (!funcionario) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const body = await request.json();
    const item = typeof body?.item === "string" ? body.item.trim() : "";
    const quantidade = Number(body?.quantidade);
    const observacao = typeof body?.observacao === "string" ? body.observacao.trim() : null;

    if (!item || !Number.isInteger(quantidade) || quantidade < 1) {
      return NextResponse.json(
        { error: "Informe um item e uma quantidade inteira maior que zero." },
        { status: 400 }
      );
    }

    const requisicao = await prisma.requisicao.create({
      data: {
        item,
        quantidade,
        observacao: observacao || null,
        funcionarioId: funcionario.id,
      },
    });

    return NextResponse.json({ requisicao }, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar requisição:", error);
    return NextResponse.json({ error: "Não foi possível criar a requisição." }, { status: 500 });
  }
}
