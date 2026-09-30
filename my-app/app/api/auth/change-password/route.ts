import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getAuthenticatedFuncionario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword, isSameOrigin, validatePassword } from "@/lib/security";

export async function POST(request: Request) {
  const funcionario = await getAuthenticatedFuncionario();
  if (!funcionario) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  try {
    const body = await request.json();
    const senhaAtual = typeof body?.senhaAtual === "string" ? body.senhaAtual : "";
    const novaSenha = typeof body?.novaSenha === "string" ? body.novaSenha : "";
    if (!(await bcrypt.compare(senhaAtual, funcionario.senha)) || !validatePassword(novaSenha)) {
      return NextResponse.json({ error: "Senha atual ou nova senha inválida." }, { status: 400 });
    }
    await prisma.funcionario.update({ where: { id: funcionario.id }, data: { senha: await hashPassword(novaSenha), mustChangePassword: false } });
    return NextResponse.json({ message: "Senha alterada com sucesso." });
  } catch {
    return NextResponse.json({ error: "Não foi possível alterar a senha." }, { status: 400 });
  }
}