"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type FormData = {
  nome: string;
  email: string;
  senha: string;
  confirmarSenha: string;
  codigoCracha: string;
};

type FormErrors = Partial<Record<keyof FormData, string>>;

const initialForm: FormData = {
  nome: "",
  email: "",
  senha: "",
  confirmarSenha: "",
  codigoCracha: "",
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateForm(form: FormData): FormErrors {
  const errors: FormErrors = {};

  if (!form.nome.trim()) errors.nome = "Informe seu nome completo.";
  if (!form.email.trim()) {
    errors.email = "Informe seu email.";
  } else if (!emailPattern.test(form.email)) {
    errors.email = "Informe um email válido.";
  }
  if (!form.senha) {
    errors.senha = "Informe uma senha.";
  } else if (form.senha.length < 8) {
    errors.senha = "A senha deve ter no mínimo 8 caracteres.";
  }
  if (!form.confirmarSenha) {
    errors.confirmarSenha = "Confirme sua senha.";
  } else if (form.confirmarSenha !== form.senha) {
    errors.confirmarSenha = "As senhas não coincidem.";
  }
  if (!form.codigoCracha) errors.codigoCracha = "Informe o código do crachá.";

  return errors;
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  return hidden ? (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A10.8 10.8 0 0 1 12 5c5.2 0 8.6 4.4 9.7 6.1a1.5 1.5 0 0 1 0 1.8 17 17 0 0 1-3.1 3.2M6.1 6.1A17 17 0 0 0 2.3 11a1.5 1.5 0 0 0 0 2C3.5 14.8 6.9 19 12 19c1.1 0 2.1-.2 3-.5" />
    </svg>
  ) : (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M2.3 12S5.7 5 12 5s9.7 7 9.7 7-3.4 7-9.7 7-9.7-7-9.7-7Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

export default function CadastroPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormData>(initialForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const updateField = (field: keyof FormData, value: string) => {
    const nextForm = { ...form, [field]: value } as FormData;
    setForm(nextForm);
    setErrors(validateForm(nextForm));
  };

  const isValid = Object.keys(validateForm(form)).length === 0;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateForm(form);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) return;

    const userData = {
      nome: form.nome.trim(),
      email: form.email.trim(),
      senha: form.senha,
      codigoCracha: form.codigoCracha,
    };

    // Conectar userData à API/MongoDB quando a rota de cadastro estiver disponível.
    void userData;
    router.push("/login");
  };

  const inputClass = (field: keyof FormData) =>
    `mt-2 block w-full rounded-lg border bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-royal focus:ring-2 focus:ring-royal/20 ${
      errors[field] ? "border-red-500" : "border-slate-300"
    }`;

  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-slate-50 px-5 py-10 sm:px-8">
      <section className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white px-6 py-8 shadow-sm sm:px-10 sm:py-10">
        <header className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-royal">Almoxarifado Marcon</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">Criar sua conta</h1>
          <p className="mt-2 text-slate-600">Cadastre-se para fazer requisições ao almoxarifado.</p>
        </header>

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <div>
            <label htmlFor="nome" className="text-sm font-semibold text-slate-800">Nome completo</label>
            <input id="nome" name="nome" type="text" autoComplete="name" value={form.nome} onChange={(event) => updateField("nome", event.target.value)} className={inputClass("nome")} aria-invalid={Boolean(errors.nome)} aria-describedby={errors.nome ? "nome-error" : undefined} />
            {errors.nome && <p id="nome-error" className="mt-1 text-sm text-red-600">{errors.nome}</p>}
          </div>

          <div>
            <label htmlFor="email" className="text-sm font-semibold text-slate-800">Email</label>
            <input id="email" name="email" type="email" autoComplete="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} className={inputClass("email")} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "email-error" : undefined} />
            {errors.email && <p id="email-error" className="mt-1 text-sm text-red-600">{errors.email}</p>}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="senha" className="text-sm font-semibold text-slate-800">Senha</label>
              <div className="relative">
                <input id="senha" name="senha" type={showPassword ? "text" : "password"} autoComplete="new-password" value={form.senha} onChange={(event) => updateField("senha", event.target.value)} className={`${inputClass("senha")} pr-12`} aria-invalid={Boolean(errors.senha)} aria-describedby={errors.senha ? "senha-error" : undefined} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-royal focus-visible:outline-2 focus-visible:outline-royal" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}><EyeIcon hidden={!showPassword} /></button>
              </div>
              {errors.senha && <p id="senha-error" className="mt-1 text-sm text-red-600">{errors.senha}</p>}
            </div>

            <div>
              <label htmlFor="confirmarSenha" className="text-sm font-semibold text-slate-800">Confirmar senha</label>
              <div className="relative">
                <input id="confirmarSenha" name="confirmarSenha" type={showConfirmation ? "text" : "password"} autoComplete="new-password" value={form.confirmarSenha} onChange={(event) => updateField("confirmarSenha", event.target.value)} className={`${inputClass("confirmarSenha")} pr-12`} aria-invalid={Boolean(errors.confirmarSenha)} aria-describedby={errors.confirmarSenha ? "confirmar-senha-error" : undefined} />
                <button type="button" onClick={() => setShowConfirmation(!showConfirmation)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-royal focus-visible:outline-2 focus-visible:outline-royal" aria-label={showConfirmation ? "Ocultar confirmação de senha" : "Mostrar confirmação de senha"}><EyeIcon hidden={!showConfirmation} /></button>
              </div>
              {errors.confirmarSenha && <p id="confirmar-senha-error" className="mt-1 text-sm text-red-600">{errors.confirmarSenha}</p>}
            </div>
          </div>

          <div>
            <div>
              <label htmlFor="codigoCracha" className="text-sm font-semibold text-slate-800">Código do crachá</label>
              <input id="codigoCracha" name="codigoCracha" type="text" inputMode="numeric" pattern="[0-9]*" value={form.codigoCracha} onChange={(event) => updateField("codigoCracha", event.target.value.replace(/\D/g, ""))} className={inputClass("codigoCracha")} aria-invalid={Boolean(errors.codigoCracha)} aria-describedby={errors.codigoCracha ? "cracha-error" : undefined} />
              {errors.codigoCracha && <p id="cracha-error" className="mt-1 text-sm text-red-600">{errors.codigoCracha}</p>}
            </div>
          </div>

          <button type="submit" disabled={!isValid} className="min-h-12 w-full rounded-lg bg-royal px-5 text-base font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal disabled:cursor-not-allowed disabled:bg-slate-300">Criar conta</button>
        </form>

        <p className="mt-7 text-center text-sm text-slate-600">
          Já tem uma conta? <Link href="/login" className="font-semibold text-royal hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-royal">Fazer login</Link>
        </p>
      </section>
    </main>
  );
}