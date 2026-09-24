import { NextResponse } from "next/server";
import { connectToDatabase } from "../../../../lib/mongodb";
import User from "../../../../lib/models/users";

export async function POST(request: Request) {
  try {
    const { name, email, password } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Todos os campos são obrigatórios." },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json(
        { error: "Este email já está registado." },
        { status: 400 }
      );
    }

    const newUser = await User.create({ name, email, password });

    return NextResponse.json(
      { message: "Usuário criado com sucesso!", userId: newUser._id },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("ERRO COMPLETO DO MONGODB/BACKEND:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Erro interno no servidor ao conectar ou salvar.";

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}