import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const estoqueItemId = typeof body?.estoqueItemId === "string" ? body.estoqueItemId : "";
    const quantidade = Number(body?.quantidade);

    if (!estoqueItemId || !Number.isInteger(quantidade) || quantidade < 0) {
      return NextResponse.json({ error: "Item ou quantidade do depósito inválida." }, { status: 400 });
    }

    const deposito = await prisma.depositoItem.upsert({
      where: { estoqueItemId },
      create: { estoqueItemId, quantidade },
      update: { quantidade },
    });

    return NextResponse.json({ deposito });
  } catch (error) {
    console.error("Erro ao atualizar depósito:", error);
    return NextResponse.json({ error: "Não foi possível atualizar o depósito." }, { status: 500 });
  }
}