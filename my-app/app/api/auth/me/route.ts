import { NextResponse } from "next/server";
import { getAuthenticatedFuncionario } from "@/lib/auth";

export async function GET() {
  const funcionario = await getAuthenticatedFuncionario();

  if (!funcionario) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  return NextResponse.json({
    funcionario: {
      id: funcionario.id,
      nome: funcionario.nome,
      email: funcionario.email,
      cargo: funcionario.cargo,
      cracha: funcionario.cracha,
    },
  });
}