import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { sessionCookieName, papelParaRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { clearLoginFailures, isLoginBlocked, isRateLimited, isSameOrigin, recordLoginFailure } from "@/lib/security";
import { BADGE_PATTERN } from "@/lib/security";
import { PapelFuncionario } from "@/generated/prisma/client";

function debugLoginFailure(portal: string, reason: string) {
  if (process.env.NODE_ENV !== "production") console.debug("[auth] login failed", { portal, reason });
}

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
    const body = await request.json();
    const identificador = typeof body?.identificador === "string"
      ? body.identificador.trim()
      : typeof body?.codigoCracha === "string"
        ? body.codigoCracha.trim()
        : "";
    const senha = typeof body?.senha === "string" ? body.senha : "";
    const portal = body?.portal === "admin" || body?.portal === "almoxarifado" ? body.portal : "";

    const clientKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (isLoginBlocked(`login:${clientKey}`)) {
      debugLoginFailure(portal || "unknown", "blocked");
      return NextResponse.json({ error: "Muitas tentativas. Tente novamente mais tarde." }, { status: 429 });
    }
    if (isRateLimited(`login:${clientKey}`, 10, 15 * 60 * 1000)) {
      return NextResponse.json({ error: "Muitas tentativas. Tente novamente mais tarde." }, { status: 429 });
    }

    if (!portal || !identificador || !senha) {
      return NextResponse.json(
        { error: "E-mail/crachá e senha são obrigatórios." },
        { status: 400 }
      );
    }

    const email = identificador.toLowerCase();
    const cracha = identificador.toUpperCase();

    // Portal admin: login por login (email) com papel ADMIN
    // Portal almoxarifado: login por crachá com papel ALMOXARIFE ou ADMIN
    const funcionario = portal === "admin"
      ? await prisma.funcionario.findFirst({
          where: { login: email, papel: PapelFuncionario.ADMIN },
        })
      : BADGE_PATTERN.test(cracha)
        ? await prisma.funcionario.findFirst({
            where: {
              cracha,
              papel: { in: [PapelFuncionario.ALMOXARIFE, PapelFuncionario.ADMIN] },
            },
          })
        : null;

    if (!funcionario || !funcionario.ativo || !(await bcrypt.compare(senha, funcionario.senha))) {
      debugLoginFailure(portal, !funcionario ? "not_found_or_wrong_role" : !funcionario.ativo ? "inactive" : "password_mismatch");
      recordLoginFailure(`login:${clientKey}`);
      return NextResponse.json({ error: "Credenciais inválidas." }, { status: 401 });
    }

    clearLoginFailures(`login:${clientKey}`);

    const token = randomBytes(32).toString("hex");
    await prisma.sessao.create({
      data: {
        token,
        funcionarioId: funcionario.id,
        accessArea: portal,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 8),
      },
    });

    // Mapeia papel para role string para compatibilidade com o front-end
    const roleCompat = papelParaRole(funcionario.papel);

    const response = NextResponse.json({
      message: "Login realizado com sucesso.",
      funcionario: {
        id: funcionario.id,
        nome: funcionario.nome,
        email: funcionario.email,
        cargo: funcionario.cargo,
        cracha: funcionario.cracha,
        // "role" mantido para compatibilidade com o front (até migrar front)
        role: roleCompat,
        papel: funcionario.papel,
        mustChangePassword: funcionario.mustChangePassword,
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
