import { NextResponse } from "next/server";

export function POST() {
  return NextResponse.json({ error: "Cadastro público desativado." }, { status: 404 });
}