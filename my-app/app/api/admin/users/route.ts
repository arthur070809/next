import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BADGE_PATTERN, hashPassword, isRateLimited, isSameOrigin, passwordError, validatePassword } from "@/lib/security";

function authError(status: 401 | 403) {
  return NextResponse.json({ error: status === 401 ? "Não autenticado." : "Acesso negado." }, { status });
}

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.funcionario) return authError(auth.status);
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const status = url.searchParams.get("status");
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get("pageSize") ?? "20") || 20));
  const where = {
    ...(query ? { OR: [{ nome: { contains: query } }, { cracha: { contains: query } }] } : {}),
    ...(status === "ativo" ? { ativo: true } : status === "inativo" ? { ativo: false } : {}),
  };
  const [funcionarios, total] = await Promise.all([
    prisma.funcionario.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
    select: { id: true, nome: true, cracha: true, cargo: true, role: true, ativo: true, mustChangePassword: true },
    orderBy: { nome: "asc" },
    }),
    prisma.funcionario.count({ where }),
  ]);
  return NextResponse.json({ funcionarios, pagination: { page, pageSize, total } });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.funcionario) return authError(auth.status);
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  const clientKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(`admin-create:${auth.funcionario.id}:${clientKey}`, 20, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "Muitas tentativas. Tente novamente mais tarde." }, { status: 429 });
  }

  try {
    const body = await request.json();
    const cracha = typeof body?.cracha === "string" ? body.cracha.trim() : "";
    const nome = typeof body?.nome === "string" ? body.nome.trim() : "";
    const senha = typeof body?.senha === "string" ? body.senha : "";
    if (!nome || nome.length > 100 || !BADGE_PATTERN.test(cracha)) {
      return NextResponse.json({ error: "Informe nome e um crachá numérico de 4 a 10 dígitos." }, { status: 400 });
    }
    if (!validatePassword(senha)) return NextResponse.json({ error: passwordError() }, { status: 400 });

    const funcionario = await prisma.funcionario.create({
      data: { nome, cracha, email: `${cracha}@local.invalid`, cargo: "operador", senha: await hashPassword(senha), mustChangePassword: true, ativo: true },
      select: { id: true, nome: true, cracha: true, cargo: true, role: true, ativo: true, mustChangePassword: true },
    });
    await prisma.auditoria.create({ data: { acao: "USUARIO_CRIADO", alvoId: funcionario.id, autorId: auth.funcionario.id } });
    return NextResponse.json({ funcionario }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Este código de crachá já está cadastrado." }, { status: 409 });
    }
    console.error("Erro ao criar usuário administrativo:", error instanceof Error ? error.message : "erro desconhecido");
    return NextResponse.json({ error: "Não foi possível criar o usuário." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (!auth.funcionario) return authError(auth.status);
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });

  try {
    const body = await request.json();
    const userId = Number(body?.userId);
    const action = body?.action;
    if (!Number.isInteger(userId) || !["reset-password", "set-active"].includes(action)) {
      return NextResponse.json({ error: "Ação administrativa inválida." }, { status: 400 });
    }
    if (action === "set-active" && userId === auth.funcionario.id && body?.ativo === false) {
      return NextResponse.json({ error: "O admin não pode desativar a própria conta." }, { status: 400 });
    }

    const alvo = await prisma.funcionario.findUnique({ where: { id: userId }, select: { id: true } });
    if (!alvo) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });

    if (action === "reset-password") {
      const senha = typeof body?.senha === "string" ? body.senha : "";
      if (!validatePassword(senha)) return NextResponse.json({ error: passwordError() }, { status: 400 });
      await prisma.funcionario.update({ where: { id: userId }, data: { senha: await hashPassword(senha), mustChangePassword: true } });
      await prisma.auditoria.create({ data: { acao: "SENHA_REDEFINIDA", alvoId: userId, autorId: auth.funcionario.id } });
      return NextResponse.json({ message: "Senha redefinida. A troca será exigida no próximo acesso." });
    }

    const ativo = body?.ativo === true;
    await prisma.funcionario.update({ where: { id: userId }, data: { ativo } });
    await prisma.auditoria.create({ data: { acao: ativo ? "USUARIO_ATIVADO" : "USUARIO_DESATIVADO", alvoId: userId, autorId: auth.funcionario.id } });
    return NextResponse.json({ message: ativo ? "Usuário reativado." : "Usuário desativado." });
  } catch (error) {
    console.error("Erro ao alterar usuário administrativo:", error instanceof Error ? error.message : "erro desconhecido");
    return NextResponse.json({ error: "Não foi possível alterar o usuário." }, { status: 500 });
  }
}