import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { sessionCookieName } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const identificador = typeof body?.identificador === "string"
      ? body.identificador.trim()
      : typeof body?.codigoCracha === "string"
        ? body.codigoCracha.trim()
        : "";
    const senha = typeof body?.senha === "string" ? body.senha : "";

    if (!identificador || !senha) {
      return NextResponse.json(
        { error: "E-mail/crachá e senha são obrigatórios." },
        { status: 400 }
      );
    }

    const email = identificador.toLowerCase();
    const cracha = identificador.toUpperCase();
    const funcionario = await prisma.funcionario.findUnique({
      where: email.includes("@") ? { email } : { cracha },
    });

    if (!funcionario || !(await bcrypt.compare(senha, funcionario.senha))) {
      return NextResponse.json({ error: "E-mail/crachá ou senha incorretos." }, { status: 401 });
    }

    const token = randomBytes(32).toString("hex");
    await prisma.sessao.create({
      data: {
        token,
        funcionarioId: funcionario.id,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 8),
      },
    });

    const response = NextResponse.json({
      message: "Login realizado com sucesso.",
      funcionario: {
        id: funcionario.id,
        nome: funcionario.nome,
        email: funcionario.email,
        cargo: funcionario.cargo,
        cracha: funcionario.cracha,
      },
    });

    response.cookies.set(sessionCookieName, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 8,
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: "Corpo da requisição inválido." },
      { status: 400 }
    );
  }
}
