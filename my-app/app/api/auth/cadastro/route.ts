import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const nome = typeof body?.nome === "string" ? body.nome.trim() : "";
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const senha = typeof body?.senha === "string" ? body.senha : "";
    const cargo = typeof body?.cargo === "string" ? body.cargo.trim() : "operador";
    const cracha = typeof body?.cracha === "string" ? body.cracha.trim().toUpperCase() : "";

    if (!nome || !email || !senha || !cracha) {
      return NextResponse.json(
        { error: "Todos os campos são obrigatórios." },
        { status: 400 }
      );
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400 });
    }

    if (senha.length < 8) {
      return NextResponse.json(
        { error: "A senha deve ter pelo menos 8 caracteres." },
        { status: 400 }
      );
    }

    const funcionarioExistente = await prisma.funcionario.findFirst({
      where: {
        OR: [{ email }, { cracha }],
      },
    });

    if (funcionarioExistente) {
      return NextResponse.json(
        { error: "E-mail ou crachá já cadastrado." },
        { status: 400 }
      );
    }

    const novoFuncionario = await prisma.funcionario.create({
      data: {
        nome,
        email,
        senha: await bcrypt.hash(senha, 12),
        cargo,
        cracha,
      },
    });

    return NextResponse.json(
      { message: "Funcionário cadastrado com sucesso!", id: novoFuncionario.id },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("ERRO NO BACKEND:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "E-mail ou crachá já cadastrado." },
        { status: 409 }
      );
    }

    const errorMessage =
      error instanceof Error ? error.message : "Erro interno ao salvar.";

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}