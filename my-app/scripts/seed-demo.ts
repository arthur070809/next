import { demoCatalog, demoLocations, seedDemoData } from "../lib/demo-seed";
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
  console.log("Funcionários Demo: 1111 OPERADOR, 2222 ALMOXARIFE, 3333 ADMIN.");

  try {
    const result = await seedDemoData(prisma);
    console.log(result.initialized
      ? "Seed de demonstração criado."
      : "Seed já existia; saldos e operação foram preservados.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("Falha no seed de demonstração:", error instanceof Error ? error.message : "erro desconhecido");
  process.exitCode = 1;
});
