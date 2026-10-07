import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { sessionCookieName } from "@/lib/auth";
import { isSameOrigin } from "@/lib/security";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;

  let failedToRevoke = false;
  if (token) {
    try {
      await prisma.sessao.updateMany({
        where: { token, revogadaEm: null },
        data: { revogadaEm: new Date() },
      });
    } catch (error) {
      failedToRevoke = true;
      console.error("[auth] Falha ao revogar sessão durante logout.", {
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
    }
  }

  const response = NextResponse.json(
    { error: failedToRevoke ? "Não foi possível revogar a sessão no servidor." : undefined, message: "Sessão encerrada." },
    { status: failedToRevoke ? 503 : 200, headers: { "Cache-Control": "no-store" } },
  );
  response.cookies.set(sessionCookieName, "", {
    httpOnly: true,
    expires: new Date(0),
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  return response;
}