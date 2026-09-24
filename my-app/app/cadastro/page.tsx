"use client";

import { useState } from "react";

export default function CadastroPage() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [cargo, setCargo] = useState("operador");
  const [cracha, setCracha] = useState("");

  // Estados para alternar a visibilidade das senhas
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirmarSenha, setMostrarConfirmarSenha] = useState(false);

  const [loading, setLoading] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: "erro" | "sucesso"; texto: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensagem(null);

    if (senha !== confirmarSenha) {
      setMensagem({ tipo: "erro", texto: "As senhas não coincidem!" });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/cadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, email, senha, cargo, cracha }),
      });

      const responseText = await response.text();
      let data: { error?: string } = {};

      try {
        data = JSON.parse(responseText) as { error?: string };
      } catch {
        throw new Error(
          "O servidor respondeu uma página inválida. Reinicie o Next.js na pasta next\\my-app."
        );
      }

      if (!response.ok) {
        throw new Error(data.error || "Erro ao realizar cadastro.");
      }

      setMensagem({ tipo: "sucesso", texto: "Conta criada com sucesso!" });
      // Limpa os campos após o sucesso
      setNome("");
      setEmail("");
      setSenha("");
      setConfirmarSenha("");
      setCracha("");
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Erro inesperado ao conectar com o servidor.";
      setMensagem({ tipo: "erro", texto: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm border border-gray-100">
        <span className="text-xs font-semibold tracking-wider text-blue-600 uppercase">
          Almoxarifado Marcon
        </span>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Criar sua conta</h1>
        <p className="mt-1 text-sm text-gray-500">
          Cadastre-se para fazer requisições ao almoxarifado.
        </p>

        {mensagem && (
          <div
            className={`mt-4 p-3 text-sm rounded-lg ${
              mensagem.tipo === "erro"
                ? "bg-red-50 text-red-600 border border-red-100"
                : "bg-green-50 text-green-600 border border-green-100"
            }`}
          >
            {mensagem.texto}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700">
              Nome completo
            </label>
            <input
              type="text"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: João Silva"
              className="mt-1 w-full rounded-lg border border-gray-200 p-2.5 text-sm focus:outline-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="joao@marcon.com"
              className="mt-1 w-full rounded-lg border border-gray-200 p-2.5 text-sm focus:outline-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700">Senha</label>
              <div className="relative mt-1">
                <input
                  type={mostrarSenha ? "text" : "password"}
                  required
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 p-2.5 pr-9 text-sm focus:outline-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha(!mostrarSenha)}
                  className="absolute right-2.5 top-3 text-gray-400 hover:text-gray-600"
                >
                  {mostrarSenha ? (
                    // Ícone Olho Fechado (SVG)
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908a8.962 8.962 0 013.682-.763c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m-0.469 0.469A8.96 8.96 0 0112 15c-1.657 0-3-1.343-3-3 0-.372.068-.728.192-1.056m4.864 4.864L3 3l18 18" />
                    </svg>
                  ) : (
                    // Ícone Olho Aberto (SVG)
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700">
                Confirmar senha
              </label>
              <div className="relative mt-1">
                <input
                  type={mostrarConfirmarSenha ? "text" : "password"}
                  required
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 p-2.5 pr-9 text-sm focus:outline-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setMostrarConfirmarSenha(!mostrarConfirmarSenha)}
                  className="absolute right-2.5 top-3 text-gray-400 hover:text-gray-600"
                >
                  {mostrarConfirmarSenha ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908a8.962 8.962 0 013.682-.763c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m-0.469 0.469A8.96 8.96 0 0112 15c-1.657 0-3-1.343-3-3 0-.372.068-.728.192-1.056m4.864 4.864L3 3l18 18" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700">Cargo</label>
            <select
              value={cargo}
              onChange={(e) => setCargo(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 p-2.5 text-sm focus:outline-blue-500 bg-white"
            >
              <option value="operador">Operador</option>
              <option value="almoxarife">Almoxarife</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700">
              Código do crachá
            </label>
            <input
              type="text"
              required
              value={cracha}
              onChange={(e) => setCracha(e.target.value)}
              placeholder="Ex: MAR011"
              className="mt-1 w-full rounded-lg border border-gray-200 p-2.5 text-sm focus:outline-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 p-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
          >
            {loading ? "A cadastrar..." : "Criar conta"}
          </button>
        </form>
      </div>
    </div>
  );
}