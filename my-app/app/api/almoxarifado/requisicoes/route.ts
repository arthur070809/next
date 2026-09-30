import { NextResponse } from "next/server"
import { getAuthenticatedFuncionario } from "../../../../lib/auth"
import { listOpenRequisitions } from "../../../../lib/requisicoes-db"

export async function GET() {
  if (!(await getAuthenticatedFuncionario())) return NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  try {
    const requisicoes = await listOpenRequisitions()
    return NextResponse.json({ requisicoes })
  } catch (error) {
    console.error("Falha ao consultar fila do MySQL:", error)
    return NextResponse.json({ error: "Não foi possível carregar as requisições do MySQL." }, { status: 500 })
  }
}
