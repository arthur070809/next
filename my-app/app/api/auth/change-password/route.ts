import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getAuthenticatedFuncionario, sessionCookieName } from "@/lib/auth";
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
    const passwordHash = await hashPassword(novaSenha);
    await prisma.$transaction(async (transaction) => {
      await transaction.funcionario.update({ where: { id: funcionario.id }, data: { senha: passwordHash, mustChangePassword: false } });
      await transaction.sessao.deleteMany({ where: { funcionarioId: funcionario.id } });
    });
    const response = NextResponse.json({ message: "Senha alterada. Entre novamente com sua nova senha." });
    response.cookies.set(sessionCookieName, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
    return response;
  } catch {
    return NextResponse.json({ error: "Não foi possível alterar a senha." }, { status: 400 });
  }
}