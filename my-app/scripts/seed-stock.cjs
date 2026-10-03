/**
 * Seed idempotente de catálogo, estoque e funcionários fictícios.
 * Executar com: npm run seed (ou node scripts/seed-stock.cjs)
 */
const { config } = require("dotenv");
config({ path: ".env.local" });
config({ path: ".env" });

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("../generated/prisma/client");
const { PrismaMariaDb } = require("@prisma/adapter-mariadb");

const mariadb = require("mariadb");

function getPrismaClient() {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) throw new Error("DATABASE_URL não configurada.");
  const u = new URL(rawUrl);
  const pool = mariadb.createPool({
    host: u.hostname,
    port: Number(u.port) || 4000,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: decodeURIComponent(u.pathname.slice(1)),
    ssl: true,
    connectTimeout: 30000,
    connectionLimit: 4,
    charset: "utf8mb4",
  });
  const adapter = new PrismaMariaDb(pool);
  return { prisma: new PrismaClient({ adapter }), pool };
}

const CATALOGO_ITENS = [
  { nome: "Parafuso Sextavado M8x25mm (Aço Carbono)", categoria: "Fixadores", unidade: "unidades", tipoUnidade: "unidade", quantidadePorEmbalagem: 1, tipoItem: "COMPONENTE", codigo: "PAR-M8-25", quantidadeEstoque: 150, quantidadeDeposito: 200 },
  { nome: "Parafuso Allen Cab. Cilíndrica M6x20mm", categoria: "Fixadores", unidade: "unidades", tipoUnidade: "unidade", quantidadePorEmbalagem: 1, tipoItem: "COMPONENTE", codigo: "PAR-M6-20", quantidadeEstoque: 80, quantidadeDeposito: 120 },
  { nome: "Porca Sextavada Auto-Travante M8", categoria: "Fixadores", unidade: "unidades", tipoUnidade: "unidade", quantidadePorEmbalagem: 1, tipoItem: "COMPONENTE", codigo: "POR-M8-AT", quantidadeEstoque: 200, quantidadeDeposito: 300 },
  { nome: "Arruela Lisa M8 Aço Inox", categoria: "Fixadores", unidade: "unidades", tipoUnidade: "unidade", quantidadePorEmbalagem: 1, tipoItem: "COMPONENTE", codigo: "ARR-M8-IN", quantidadeEstoque: 300, quantidadeDeposito: 500 },
  { nome: "Abraçadeira Rosca Sem Fim 1/2 a 3/4", categoria: "Fixadores", unidade: "unidades", tipoUnidade: "unidade", quantidadePorEmbalagem: 1, tipoItem: "COMPONENTE", codigo: "ABR-12-34", quantidadeEstoque: 65, quantidadeDeposito: 40 },
  { nome: "Eletrodo Revestido AWS E6013 2.50mm", categoria: "Soldagem", unidade: "caixas", tipoUnidade: "caixa", quantidadePorEmbalagem: 5, tipoItem: "CONSUMIVEL", codigo: "ELE-6013-25", quantidadeEstoque: 15, quantidadeDeposito: 30 },
  { nome: "Eletrodo Revestido AWS E7018 3.25mm", categoria: "Soldagem", unidade: "caixas", tipoUnidade: "caixa", quantidadePorEmbalagem: 5, tipoItem: "CONSUMIVEL", codigo: "ELE-7018-32", quantidadeEstoque: 10, quantidadeDeposito: 25 },
  { nome: "Arame para Solda MIG ER70S-6 1.0mm", categoria: "Soldagem", unidade: "rolos", tipoUnidade: "rolo", quantidadePorEmbalagem: 15, tipoItem: "CONSUMIVEL", codigo: "MIG-70S6-10", quantidadeEstoque: 8, quantidadeDeposito: 12 },
  { nome: "Disco de Corte Inox 4.1/2 x 1.0mm", categoria: "Abrasivos", unidade: "unidades", tipoUnidade: "unidade", quantidadePorEmbalagem: 1, tipoItem: "CONSUMIVEL", codigo: "DIS-CRT-45", quantidadeEstoque: 120, quantidadeDeposito: 250 },
  { nome: "Disco de Desbaste 7 x 1/4 x 7/8", categoria: "Abrasivos", unidade: "unidades", tipoUnidade: "unidade", quantidadePorEmbalagem: 1, tipoItem: "CONSUMIVEL", codigo: "DIS-DSB-70", quantidadeEstoque: 45, quantidadeDeposito: 60 },
  { nome: "Lixa Ferro Grão 80", categoria: "Abrasivos", unidade: "folhas", tipoUnidade: "folha", quantidadePorEmbalagem: 1, tipoItem: "CONSUMIVEL", codigo: "LIX-FER-80", quantidadeEstoque: 90, quantidadeDeposito: 150 },
  { nome: "Trava Química Anaeróbica Torque Alto 50g", categoria: "Químicos", unidade: "frascos", tipoUnidade: "frasco", quantidadePorEmbalagem: 1, tipoItem: "CONSUMIVEL", codigo: "TRV-QMC-50", quantidadeEstoque: 18, quantidadeDeposito: 10 },
  { nome: "Desengripante Spray Industrial 300ml", categoria: "Químicos", unidade: "latas", tipoUnidade: "lata", quantidadePorEmbalagem: 1, tipoItem: "CONSUMIVEL", codigo: "DES-SPR-300", quantidadeEstoque: 35, quantidadeDeposito: 48 },
  { nome: "Graxa de Lítio NLGI 2 Cartucho 400g", categoria: "Químicos", unidade: "cartuchos", tipoUnidade: "cartucho", quantidadePorEmbalagem: 1, tipoItem: "CONSUMIVEL", codigo: "GRX-LIT-400", quantidadeEstoque: 22, quantidadeDeposito: 36 },
  { nome: "Válvula Solenóide Direcional 5/2 Vias 24VDC", categoria: "Pneumática", unidade: "unidades", tipoUnidade: "unidade", quantidadePorEmbalagem: 1, tipoItem: "COMPONENTE", codigo: "VAL-SOL-52", quantidadeEstoque: 14, quantidadeDeposito: 8 },
  { nome: "Conexão Reta Tubo 8mm x Rosca 1/4", categoria: "Pneumática", unidade: "unidades", tipoUnidade: "unidade", quantidadePorEmbalagem: 1, tipoItem: "COMPONENTE", codigo: "CON-RET-8M", quantidadeEstoque: 75, quantidadeDeposito: 100 },
  { nome: "Tubo Poliuretano Azul 8mm (Metro)", categoria: "Pneumática", unidade: "metros", tipoUnidade: "metro", quantidadePorEmbalagem: 100, tipoItem: "MATERIA_PRIMA", codigo: "TUB-PU-8AZ", quantidadeEstoque: 250, quantidadeDeposito: 400 },
  { nome: "Luva de Proteção Vaqueta Cano Curto", categoria: "EPI", unidade: "pares", tipoUnidade: "par", quantidadePorEmbalagem: 1, tipoItem: "CONSUMIVEL", codigo: "EPI-LUV-VAQ", quantidadeEstoque: 40, quantidadeDeposito: 80 },
  { nome: "Óculos de Proteção Incolor Anti-Risco", categoria: "EPI", unidade: "unidades", tipoUnidade: "unidade", quantidadePorEmbalagem: 1, tipoItem: "CONSUMIVEL", codigo: "EPI-OCU-INC", quantidadeEstoque: 55, quantidadeDeposito: 90 },
  { nome: "Protetor Auricular Tipo Plug Silicone", categoria: "EPI", unidade: "pares", tipoUnidade: "par", quantidadePorEmbalagem: 1, tipoItem: "CONSUMIVEL", codigo: "EPI-PLU-SIL", quantidadeEstoque: 100, quantidadeDeposito: 200 },
  { nome: "Chapa de Aço Carbono 1020 3mm x 1200x3000mm", categoria: "Matéria-Prima", unidade: "chapas", tipoUnidade: "chapa", quantidadePorEmbalagem: 1, tipoItem: "MATERIA_PRIMA", codigo: "CHP-1020-3M", quantidadeEstoque: 12, quantidadeDeposito: 15 },
  { nome: "Caixa de Papelão Onda Dupla 40x30x25cm", categoria: "Embalagens", unidade: "unidades", tipoUnidade: "unidade", quantidadePorEmbalagem: 25, tipoItem: "EMBALAGEM", codigo: "EMB-CX-4030", quantidadeEstoque: 80, quantidadeDeposito: 150 },
];

const FUNCIONARIOS_FICTICIOS = [
  { nome: "João Operador", cracha: "1001", email: "joao.operador@marcon.com.br", cargo: "Operador de Máquinas", papel: "OPERADOR" },
  { nome: "Maria Montadora", cracha: "1002", email: "maria.montadora@marcon.com.br", cargo: "Operadora de Montagem", papel: "OPERADOR" },
  { nome: "Carlos Almoxarife", cracha: "2001", email: "carlos.almoxarife@marcon.com.br", cargo: "Almoxarife Pleno", papel: "ALMOXARIFE" },
  { nome: "Ana Almoxarife", cracha: "2002", email: "ana.almoxarife@marcon.com.br", cargo: "Almoxarife Júnior", papel: "ALMOXARIFE" },
  { nome: "Paulo Solicitante", cracha: "3001", email: "paulo.solicitante@marcon.com.br", cargo: "Técnico de Manutenção", papel: "USUARIO" },
  { nome: "Admin Fictício", cracha: "9001", email: "admin.seed@marcon.com.br", login: "admin_ficticio", cargo: "Administrador de Teste", papel: "ADMIN" },
];

async function main() {
  console.log("Iniciando seed de dados no TiDB...");
  const { prisma, pool } = getPrismaClient();

  try {
    // 1. Locais de Estoque
    const localEstoque = await prisma.localEstoque.upsert({
      where: { slug: "estoque" },
      create: { slug: "estoque", nome: "Estoque Central", descricao: "Almoxarifado Principal de Manutenção e Produção", ativo: true },
      update: { nome: "Estoque Central" },
    });

    const localDeposito = await prisma.localEstoque.upsert({
      where: { slug: "deposito" },
      create: { slug: "deposito", nome: "Depósito Geral", descricao: "Depósito de Pulmão e Sobras", ativo: true },
      update: { nome: "Depósito Geral" },
    });

    // 2. Senhas e Credenciais de Funcionários Fictícios
    const envPassword = process.env.SEED_DEFAULT_PASSWORD;
    const generatedCreds = [];

    let defaultPassword = envPassword;
    if (!defaultPassword) {
      defaultPassword = crypto.randomBytes(8).toString("hex") + "A1!";
    }

    const defaultHash = await bcrypt.hash(defaultPassword, 10);

    const funcionariosDb = [];
    for (const func of FUNCIONARIOS_FICTICIOS) {
      const funcionario = await prisma.funcionario.upsert({
        where: { cracha: func.cracha },
        create: {
          nome: func.nome,
          cracha: func.cracha,
          email: func.email,
          login: func.login ?? null,
          cargo: func.cargo,
          papel: func.papel,
          senha: defaultHash,
          mustChangePassword: func.papel !== "ADMIN",
          ativo: true,
        },
        update: {
          nome: func.nome,
          cargo: func.cargo,
          papel: func.papel,
          ativo: true,
        },
      });
      funcionariosDb.push(funcionario);
      generatedCreds.push({
        nome: func.nome,
        cracha: func.cracha,
        login: func.login ?? "(por crachá)",
        papel: func.papel,
        senha: defaultPassword,
      });
    }

    // Se gerou senha automaticamente, salva em .seed-credentials.local
    if (!envPassword) {
      const credsPath = path.join(__dirname, "..", ".seed-credentials.local");
      const credsContent = `# Credenciais de teste geradas em ${new Date().toISOString()}\n` +
        generatedCreds.map(c => `CRACHA=${c.cracha} LOGIN=${c.login} PAPEL=${c.papel} SENHA=${c.senha} NOME="${c.nome}"`).join("\n") + "\n";
      fs.writeFileSync(credsPath, credsContent, { encoding: "utf8" });
      console.log("Credenciais fictícias geradas salvas em .seed-credentials.local (ignorado pelo git).");
    }

    // Funcionário usado para registrar as movimentações de seed
    const funcAdmin = funcionariosDb.find(f => f.papel === "ADMIN") || funcionariosDb[0];

    // 3. Catálogo de Itens e Saldos Iniciais com Movimentação
    for (const itemData of CATALOGO_ITENS) {
      const item = await prisma.item.upsert({
        where: {
          filial_codigo: {
            filial: "MARCON-SP",
            codigo: itemData.codigo,
          },
        },
        create: {
          nome: itemData.nome,
          categoria: itemData.categoria,
          unidade: itemData.unidade,
          tipoUnidade: itemData.tipoUnidade,
          quantidadePorEmbalagem: itemData.quantidadePorEmbalagem,
          tipoItem: itemData.tipoItem,
          codigo: itemData.codigo,
          filial: "MARCON-SP",
          grupoErp: itemData.categoria.toUpperCase(),
          pontoPedido: 10,
          estoqueSeguranca: 5,
          bloqueadoCompra: false,
          ativo: true,
        },
        update: {
          nome: itemData.nome,
          categoria: itemData.categoria,
          unidade: itemData.unidade,
          tipoUnidade: itemData.tipoUnidade,
          quantidadePorEmbalagem: itemData.quantidadePorEmbalagem,
          tipoItem: itemData.tipoItem,
          ativo: true,
        },
      });

      // Saldo no Estoque Central
      const saldoEstoque = await prisma.saldoEstoque.upsert({
        where: {
          itemId_localId: {
            itemId: item.id,
            localId: localEstoque.id,
          },
        },
        create: {
          itemId: item.id,
          localId: localEstoque.id,
          quantidade: itemData.quantidadeEstoque,
          reservada: 0,
        },
        update: {},
      });

      // Saldo no Depósito
      await prisma.saldoEstoque.upsert({
        where: {
          itemId_localId: {
            itemId: item.id,
            localId: localDeposito.id,
          },
        },
        create: {
          itemId: item.id,
          localId: localDeposito.id,
          quantidade: itemData.quantidadeDeposito,
          reservada: 0,
        },
        update: {},
      });

      // Movimentação inicial se ainda não registrada
      const movExistente = await prisma.movimentacao.findFirst({
        where: { saldoEstoqueId: saldoEstoque.id },
      });

      if (!movExistente) {
        await prisma.movimentacao.create({
          data: {
            tipo: "ENTRADA",
            quantidade: itemData.quantidadeEstoque,
            saldoApos: itemData.quantidadeEstoque,
            reservadaApos: 0,
            funcionarioId: funcAdmin.id,
            saldoEstoqueId: saldoEstoque.id,
            observacao: "Carga de estoque inicial (seed)",
          },
        });
      }
    }

    console.log(`Seed concluído com sucesso: ${CATALOGO_ITENS.length} itens e ${FUNCIONARIOS_FICTICIOS.length} funcionários.`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Erro no seed:", error.message);
  process.exitCode = 1;
});
