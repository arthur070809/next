import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedSession } from "@/lib/auth";
import { hasExactOrigin } from "@/lib/security";

function methodNotAllowed(_request: Request) {
  void _request;
  return NextResponse.json({ error: "Método não permitido." }, {
    status: 405,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  if (!hasExactOrigin(request)) {
    return NextResponse.json({ error: "Origem inválida." }, {
      status: 403,
      headers: { "Cache-Control": "no-store" },
    });
  }
  try {
    const session = await getAuthenticatedSession({ touch: false });
    if (session) {
      await prisma.sessao.updateMany({
        where: {
          id: session.id,
          token: session.token,
          ultimoSinalEm: session.ultimoSinalEm,
          saidaEm: session.saidaEm,
          revogadaEm: null,
        },
        data: { saidaEm: new Date() },
      });
    }
    return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[auth] Falha ao registrar saída da sessão.", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json({ error: "Não foi possível registrar a saída." }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}

export const GET = methodNotAllowed;
export const HEAD = methodNotAllowed;
export const OPTIONS = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
