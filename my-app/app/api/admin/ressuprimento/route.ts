import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getAuthenticatedFuncionario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOrigin } from "@/lib/security";
import { MAX_STOCK_INPUT } from "@/lib/stock-units";

function resposta(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export async function PATCH(request: Request) {
  const funcionario = await getAuthenticatedFuncionario();
  if (!funcionario) return resposta({ error: "Não autenticado." }, 401);
  if (funcionario.role !== "admin") return resposta({ error: "Acesso permitido apenas ao admin." }, 403);
  if (!isSameOrigin(request)) return resposta({ error: "Origem inválida." }, 403);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return resposta({ error: "Envie os dados em um formato válido." }, 400);
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  const pontoAtual = body.pontoAtual;
  if (!id || typeof pontoAtual !== "number" || !Number.isInteger(pontoAtual) || pontoAtual < 0 || pontoAtual > MAX_STOCK_INPUT) {
    return resposta({ error: `Informe um item e um ponto atual inteiro entre 0 e ${MAX_STOCK_INPUT.toLocaleString("pt-BR")}.` }, 400);
  }

  try {
    const item = await prisma.item.update({
      where: { id },
      data: { pontoPedido: pontoAtual },
      select: { id: true, pontoPedido: true },
    });
    return resposta({ item });
  } catch (error) {
    const errorRecord = typeof error === "object" && error !== null ? error : null;
    const prismaCode = errorRecord && "code" in errorRecord && typeof errorRecord.code === "string"
      ? errorRecord.code
      : undefined;
    if (prismaCode === "P2025") return resposta({ error: "Item não encontrado." }, 404);

    const errorId = randomUUID();
    const errorName = error instanceof Error ? error.name : "UnknownError";
    console.error("Falha ao atualizar ponto de pedido do item.", { errorId, errorName, prismaCode });
    return resposta({ error: "Não foi possível salvar o ponto atual. Tente novamente.", errorId }, 500);
  }
}
