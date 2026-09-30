require("dotenv/config");
const mariadb = require("mariadb");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL não foi configurada.");

const replacements = [
  ["Abra??adeira", "Abraçadeira"],
  ["Acess??rios", "Acessórios"],
  ["Conex??o", "Conexão"],
  ["Conex??es", "Conexões"],
  ["R??pida", "Rápida"],
  ["El??trica", "Elétrica"],
  ["El??trodo", "Eletrodo"],
  ["Organiza????o", "Organização"],
  ["Prote????o", "Proteção"],
  ["Consum??veis", "Consumíveis"],
  ["Qu??mica", "Química"],
  ["Solen??ide", "Solenóide"],
  ["Pneum??tica", "Pneumática"],
  ["Hidr??ulica", "Hidráulica"],
  ["V??lvula", "Válvula"],
  ["N??o", "Não"],
];

function corrigirTexto(texto) {
  return replacements.reduce(
    (resultado, [corrompido, correto]) => resultado.replaceAll(corrompido, correto),
    texto
  );
}

function identificadorSeguro(valor) {
  return `\`${String(valor).replaceAll("`", "``")}\``;
}

async function main() {
  const url = new URL(databaseUrl);
  const connection = await mariadb.createConnection({
    host: url.hostname,
    port: Number(url.port) || 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.slice(1)),
    charset: "utf8mb4",
  });
  const colunas = await connection.query(
    `SELECT TABLE_NAME AS tabela, COLUMN_NAME AS coluna
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND DATA_TYPE IN ('char', 'varchar', 'tinytext', 'text', 'mediumtext', 'longtext')`
  );
  const correcoes = [];

  for (const { tabela, coluna } of colunas) {
    const valores = await connection.query(
      `SELECT * FROM ${identificadorSeguro(tabela)} WHERE ${identificadorSeguro(coluna)} LIKE ?`,
      ["%?%"]
    );
    for (const registro of valores) {
      const atual = registro[coluna];
      const corrigido = corrigirTexto(atual);
      if (typeof atual === "string" && atual !== corrigido) {
        correcoes.push({ tabela, coluna, id: registro.id ?? "(sem id)", atual, corrigido });
      }
    }
  }

  console.table(correcoes);

  if (correcoes.length === 0) {
    console.log("Nenhum nome conhecido com encoding corrompido foi encontrado.");
  } else if (process.argv.includes("--apply")) {
    for (const item of correcoes) {
      if (item.id === "(sem id)") {
        console.warn(`Ignorado ${item.tabela}.${item.coluna}: registro sem id estável.`);
        continue;
      }
      await connection.query(
        `UPDATE ${identificadorSeguro(item.tabela)} SET ${identificadorSeguro(item.coluna)} = ? WHERE id = ?`,
        [item.corrigido, item.id]
      );
    }
    console.log(`${correcoes.length} item(ns) corrigido(s).`);
  } else {
    console.log("Prévia concluída. Use --apply para gravar as correções listadas.");
  }

  await connection.end();
}

main().catch(async (error) => {
  console.error(error);
  process.exitCode = 1;
});
