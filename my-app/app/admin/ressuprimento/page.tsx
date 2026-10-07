import { redirect } from "next/navigation";
import RessuprimentoTabela from "./RessuprimentoTabela";
import { getAuthenticatedFuncionario } from "@/lib/auth";
import { autorizarRessuprimento } from "@/lib/ressuprimento/access";
import { carregarDadosRessuprimento } from "@/lib/ressuprimento/carregar-dados";
import { RefreshErrorState } from "@/app/components/RefreshErrorState";

export default async function RessuprimentoPage() {
  const funcionario = await getAuthenticatedFuncionario();
  const acesso = autorizarRessuprimento(funcionario);
  if (!acesso.allowed) {
    redirect(acesso.status === 401
      ? "/login?callbackUrl=%2Fadmin%2Fressuprimento"
      : "/admin");
  }

  const resultado = await carregarDadosRessuprimento(new Date());
  if (!resultado.ok) {
    return <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-2xl font-semibold text-foreground">Ressuprimento indisponível</h1>
      <RefreshErrorState message={`Não foi possível carregar os dados agora. Código de referência: ${resultado.errorId}`} />
    </main>;
  }
  return <RessuprimentoTabela sugestoes={resultado.sugestoes} fonte={resultado.fonte} />;
}
