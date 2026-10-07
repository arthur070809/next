import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth";
import { hasExactOrigin } from "@/lib/security";

function response(body: { error: string }, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function methodNotAllowed(_request: Request) {
  void _request;
  return response({ error: "Método não permitido." }, 405);
}

export async function POST(request: Request) {
  if (!hasExactOrigin(request)) return response({ error: "Origem inválida." }, 403);
  try {
    const session = await getAuthenticatedSession();
    if (!session) return response({ error: "Sessão inválida." }, 401);
    return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[auth] Falha ao validar heartbeat de sessão.", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return response({ error: "Não foi possível validar a sessão." }, 503);
  }
}

export const GET = methodNotAllowed;
export const HEAD = methodNotAllowed;
export const OPTIONS = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
