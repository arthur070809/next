require("dotenv/config");

const { randomUUID } = require("node:crypto");
const mariadb = require("mariadb");

const exemplos = [
  {
    nome: "Parafuso Sextavado (Aço Carbono / Inox)",
    categoria: "Parafusos",
    unidade: "unidade",
    quantidade: 50,
  },
  {
    nome: "Abraçadeira Rosca Sem Fim",
    categoria: "Abraçadeiras e Conexões",
    unidade: "unidade",
    quantidade: 24,
  },
  {
    nome: "Trava Química Anaeróbica (Fixador de Rosca)",
    categoria: "Química e Lubrificantes Industriais",
    unidade: "frasco",
    quantidade: 12,
  },
  {
    nome: "Eletrodo Revestido (AWS E6013 / E7018)",
    categoria: "Insumos de Solda",
    unidade: "caixa",
    quantidade: 8,
  },
];

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL não foi configurada.");

  const databaseUrlWithCharset = databaseUrl.includes("?")
    ? `${databaseUrl}&charset=utf8mb4`
    : `${databaseUrl}?charset=utf8mb4`;
  const url = new URL(databaseUrlWithCharset);
  const connection = await mariadb.createConnection({
    host: url.hostname,
    port: Number(url.port) || 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.slice(1)),
    charset: "utf8mb4",
  });
  let criados = 0;

  try {
    for (const exemplo of exemplos) {
      const existentes = await connection.query(
        "SELECT id FROM estoque_itens WHERE nome = ? AND categoria = ? LIMIT 1",
        [exemplo.nome, exemplo.categoria]
      );

      if (existentes.length > 0) continue;
      const agora = new Date();
      await connection.query(
        "INSERT INTO estoque_itens (id, nome, categoria, unidade, quantidade, ativo, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, 1, ?, ?)",
        [randomUUID(), exemplo.nome, exemplo.categoria, exemplo.unidade, exemplo.quantidade, agora, agora]
      );
      criados += 1;
    }
  } finally {
    await connection.end();
  }

  console.log(`Seed concluído: ${criados} item(ns) novo(s), ${exemplos.length - criados} já existente(s).`);
}

main().catch((error) => {
  console.error("Erro ao executar seed:", error);
  process.exitCode = 1;
});
