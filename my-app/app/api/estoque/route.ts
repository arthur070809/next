import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSameOrigin } from "@/lib/security";
import { getAuthenticatedFuncionario } from "@/lib/auth";

function respostaJson(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  return NextResponse.json(body, { ...init, headers });
}

export async function GET() {
  try {
    if (!(await getAuthenticatedFuncionario())) return respostaJson({ error: "Não autenticado." }, { status: 401 });
    const itens = await prisma.estoqueItem.findMany({
      where: { ativo: true },
      orderBy: [{ categoria: "asc" }, { nome: "asc" }],
    });

    return respostaJson({ itens });
  } catch (error) {
    console.error("Erro ao carregar estoque:", error);
    return respostaJson({ error: "Não foi possível carregar o estoque." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!(await getAuthenticatedFuncionario())) return respostaJson({ error: "Não autenticado." }, { status: 401 });
    if (!isSameOrigin(request)) return respostaJson({ error: "Origem inválida." }, { status: 403 });
    const body = await request.json();
    const nome = typeof body?.nome === "string" ? body.nome.trim() : "";
    const categoria = typeof body?.categoria === "string" ? body.categoria.trim() : "";
    const unidade = typeof body?.unidade === "string" && body.unidade.trim()
      ? body.unidade.trim()
      : "unidade";
    const quantidade = Number(body?.quantidade);
    if (
      !nome ||
      !categoria ||
      !Number.isInteger(quantidade) ||
      quantidade < 0
    ) {
      return respostaJson(
        { error: "Preencha os dados do item com valores válidos." },
        { status: 400 }
      );
    }

    const itemExistente = await prisma.estoqueItem.findFirst({
      where: { nome, categoria, ativo: true },
    });

    const item = itemExistente
      ? await prisma.estoqueItem.update({
        where: { id: itemExistente.id },
        data: { quantidade: { increment: quantidade } },
      })
      : await prisma.estoqueItem.create({
        data: { nome, categoria, unidade, quantidade },
      });

    return respostaJson({ item }, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar item de estoque:", error);
    return respostaJson(
      {
        error: "Não foi possível cadastrar o item.",
        detail: error instanceof Error ? error.message : "Erro desconhecido no banco de dados.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    if (!(await getAuthenticatedFuncionario())) return respostaJson({ error: "Não autenticado." }, { status: 401 });
    if (!isSameOrigin(request)) return respostaJson({ error: "Origem inválida." }, { status: 403 });
    const body = await request.json();
    const id = typeof body?.id === "string" ? body.id : "";
    const quantidade = Number(body?.quantidade);

    if (!id || !Number.isInteger(quantidade) || quantidade < 0) {
      return respostaJson({ error: "Item ou quantidade inválida." }, { status: 400 });
    }

    const item = await prisma.estoqueItem.update({
      where: { id },
      data: { quantidade },
    });

    return respostaJson({ item });
  } catch (error) {
    console.error("Erro ao atualizar estoque:", error);
    return respostaJson({ error: "Não foi possível atualizar a quantidade." }, { status: 500 });
  }
}