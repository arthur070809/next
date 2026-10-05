import { NextResponse } from "next/server";
import { Prisma, PapelFuncionario } from "@/generated/prisma/client";
import { requireAdmin, papelParaRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BADGE_PATTERN, hashPassword, isRateLimited, isSameOrigin, passwordError, validatePassword } from "@/lib/security";

function authError(status: 401 | 403) {
  return NextResponse.json({ error: status === 401 ? "Não autenticado." : "Acesso negado." }, { status });
}

/** Formata um funcionário para a resposta da API, incluindo role compat */
function formatFuncionario(f: {
  id: number;
  nome: string;
  cracha: string;
  cargo: string;
  papel: PapelFuncionario;
  ativo: boolean;
  mustChangePassword: boolean;
}) {
  return {
    ...f,
    role: papelParaRole(f.papel), // backward compat com front-end
  };
}

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.funcionario) return authError(auth.status);
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const status = url.searchParams.get("status");
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get("pageSize") ?? "20") || 20));
  const where: Prisma.FuncionarioWhereInput = {
    ...(query ? { OR: [{ nome: { contains: query } }, { cracha: { contains: query } }] } : {}),
    ...(status === "ativo" ? { ativo: true } : status === "inativo" ? { ativo: false } : {}),
  };
  const [funcionariosRaw, total] = await Promise.all([
    prisma.funcionario.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: { id: true, nome: true, cracha: true, cargo: true, papel: true, ativo: true, mustChangePassword: true },
      orderBy: { nome: "asc" },
    }),
    prisma.funcionario.count({ where }),
  ]);
  const funcionarios = funcionariosRaw.map(formatFuncionario);
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
    // papel: aceita "USUARIO", "OPERADOR", "ALMOXARIFE" ou fallback para USUARIO
    const papelInput = typeof body?.papel === "string" ? body.papel.toUpperCase() : "USUARIO";
    const papel = Object.values(PapelFuncionario).includes(papelInput as PapelFuncionario)
      ? (papelInput as PapelFuncionario)
      : PapelFuncionario.USUARIO;

    if (!nome || nome.length > 100 || !BADGE_PATTERN.test(cracha)) {
      return NextResponse.json({ error: "Informe nome e um crachá numérico de 4 a 10 dígitos." }, { status: 400 });
    }
    if (!validatePassword(senha)) return NextResponse.json({ error: passwordError() }, { status: 400 });
    if (papel === PapelFuncionario.ADMIN) {
      return NextResponse.json({ error: "Admin deve ser criado via seed:admin." }, { status: 400 });
    }

    const funcionarioRaw = await prisma.funcionario.create({
      data: {
        nome,
        cracha,
        email: `${cracha}@local.invalid`,
        cargo: papel.toLowerCase(),
        papel,
        senha: await hashPassword(senha),
        mustChangePassword: true,
        ativo: true,
      },
      select: { id: true, nome: true, cracha: true, cargo: true, papel: true, ativo: true, mustChangePassword: true },
    });
    await prisma.auditoria.create({ data: { acao: "USUARIO_CRIADO", alvoId: funcionarioRaw.id, autorId: auth.funcionario.id } });
    return NextResponse.json({ funcionario: formatFuncionario(funcionarioRaw) }, { status: 201 });
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
    if (!Number.isInteger(userId) || !["reset-password", "set-active", "set-papel"].includes(action)) {
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
      await prisma.$transaction(async (transaction) => {
        await transaction.funcionario.update({ where: { id: userId }, data: { senha: await hashPassword(senha), mustChangePassword: true } });
        await transaction.sessao.deleteMany({ where: { funcionarioId: userId } });
        await transaction.auditoria.create({ data: { acao: "SENHA_REDEFINIDA", alvoId: userId, autorId: auth.funcionario!.id } });
      });
      return NextResponse.json({ message: "Senha redefinida. A troca será exigida no próximo acesso." });
    }

    if (action === "set-papel") {
      const papelInput = typeof body?.papel === "string" ? body.papel.toUpperCase() : "";
      if (!Object.values(PapelFuncionario).includes(papelInput as PapelFuncionario)) {
        return NextResponse.json({ error: "Papel inválido." }, { status: 400 });
      }
      if (papelInput === PapelFuncionario.ADMIN) {
        return NextResponse.json({ error: "Admin deve ser criado via seed:admin." }, { status: 400 });
      }
      await prisma.funcionario.update({ where: { id: userId }, data: { papel: papelInput as PapelFuncionario } });
      await prisma.auditoria.create({ data: { acao: "PAPEL_ALTERADO", alvoId: userId, autorId: auth.funcionario.id, detalhes: papelInput } });
      return NextResponse.json({ message: "Papel atualizado." });
    }

    const ativo = body?.ativo === true;
    await prisma.$transaction(async (transaction) => {
      await transaction.funcionario.update({ where: { id: userId }, data: { ativo } });
      if (!ativo) {
        await transaction.webAuthnCredential.deleteMany({ where: { funcionarioId: userId } });
        await transaction.faceTemplate.deleteMany({ where: { funcionarioId: userId } });
        await transaction.livenessChallenge.deleteMany({ where: { funcionarioId: userId } });
        await transaction.sessao.deleteMany({ where: { funcionarioId: userId } });
        await transaction.devicePairing.deleteMany({ where: { funcionarioId: userId } });
        await transaction.authChallenge.deleteMany({ where: { funcionarioId: userId } });
        await transaction.emergencyAccessGrant.deleteMany({ where: { funcionarioId: userId } });
        await transaction.adminTotpCredential.deleteMany({ where: { funcionarioId: userId } });
      }
      await transaction.auditoria.create({ data: { acao: ativo ? "USUARIO_ATIVADO" : "USUARIO_DESATIVADO", alvoId: userId, autorId: auth.funcionario!.id } });
      await transaction.securityAuditEvent.create({ data: { acao: ativo ? "USER_REACTIVATED" : "USER_DEACTIVATED", resultado: "success", funcionarioId: userId, atorId: auth.funcionario!.id } });
    });
    return NextResponse.json({ message: ativo ? "Usuário reativado." : "Usuário desativado." });
  } catch (error) {
    console.error("Erro ao alterar usuário administrativo:", error instanceof Error ? error.message : "erro desconhecido");
    return NextResponse.json({ error: "Não foi possível alterar o usuário." }, { status: 500 });
  }
}