const mariadb = require("mariadb");

async function main() {
  const pool = mariadb.createPool({
    host: "localhost",
    port: 3307,
    user: "root",
    password: "root",
    database: "marcon_almox",
    charset: "utf8mb4",
    connectionLimit: 1,
  });
  const connection = await pool.getConnection();
  const rows = await connection.query("SELECT COUNT(*) AS total FROM estoque_itens WHERE ativo = 1");
  console.log(`Itens ativos no banco: ${rows[0].total}`);
  connection.release();
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
