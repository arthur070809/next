import { demoCatalog, demoLocations, resetAndSeedDemoData } from "../lib/demo-seed";
import { createDemoScriptClient } from "./demo-script-runtime";

async function main() {
  const { prisma } = createDemoScriptClient(process.argv.slice(2));
  console.table(demoCatalog.map((item) => ({
    código: item.codigo,
    nome: item.nome,
    descriçãoCategoria: item.categoria,
    unidade: "unidades",
    central: item.central,
    importados: item.importados,
    pontoDePedidoAgregado: item.pontoPedido,
  })));
  console.log("Locais:", demoLocations.map(({ nome }) => nome).join(", "));
  console.log("O reset removerá requisições, movimentos, reservas e auditorias de requisição, mas manterá funcionários e catálogo.");

  try {
    await resetAndSeedDemoData(prisma);
    console.log("Demonstração resetada e repopulada.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("Falha no reset de demonstração:", error instanceof Error ? error.message : "erro desconhecido");
  process.exitCode = 1;
});
