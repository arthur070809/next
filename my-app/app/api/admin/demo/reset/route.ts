import { NextResponse } from "next/server";
import { PapelFuncionario } from "@/generated/prisma/client";
import { getAuthenticatedFuncionario } from "@/lib/auth";
import { isDemoLoginEnabledForBadge, isDemoModeConfigured } from "@/lib/demo-mode";
import { resetAndSeedDemoData } from "@/lib/demo-seed";
import { isSameOrigin } from "@/lib/security";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  }
  if (!isDemoModeConfigured()) {
    return NextResponse.json({ error: "Ação disponível somente no ambiente de demonstração." }, { status: 404 });
  }

  const funcionario = await getAuthenticatedFuncionario();
  if (
    !funcionario ||
    funcionario.papel !== PapelFuncionario.ADMIN ||
    !isDemoLoginEnabledForBadge(funcionario.cracha)
  ) {
    return NextResponse.json({ error: "Acesso negado." }, { status: funcionario ? 403 : 401 });
  }

  try {
    await resetAndSeedDemoData(prisma);
    return NextResponse.json({ message: "Demonstração resetada e repopulada." });
  } catch (error) {
    console.error("Falha ao resetar demonstração:", error instanceof Error ? error.message : "erro desconhecido");
    return NextResponse.json({ error: "Não foi possível resetar a demonstração." }, { status: 500 });
  }
}
