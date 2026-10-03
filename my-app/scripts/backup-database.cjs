const fs = require("node:fs");
const path = require("node:path");
const mariadb = require("mariadb");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

function sqlValue(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  if (typeof value === "boolean") return value ? "1" : "0";
  if (Buffer.isBuffer(value)) return `X'${value.toString("hex")}'`;
  if (value instanceof Date) return `'${value.toISOString().replace("T", " ").replace("Z", "")}'`;
  if (typeof value === "object") value = JSON.stringify(value);
  return `'${String(value).replace(/\\/g, "\\\\").replace(/\0/g, "\\0").replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/'/g, "''").replace(/\x1a/g, "\\Z")}'`;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
  const databaseUrl = new URL(process.env.DATABASE_URL);
  const connection = await mariadb.createConnection({
    host: databaseUrl.hostname,
    port: Number(databaseUrl.port || 3306),
    user: decodeURIComponent(databaseUrl.username),
    password: decodeURIComponent(databaseUrl.password),
    database: decodeURIComponent(databaseUrl.pathname.replace(/^\//, "")),
    timezone: "Z",
    connectTimeout: 10000,
  });

  const outputDirectory = path.resolve(__dirname, "../../../backups");
  fs.mkdirSync(outputDirectory, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const outputPath = path.join(outputDirectory, `before-deposito-${timestamp}.sql`);
  const output = fs.createWriteStream(outputPath, { encoding: "utf8" });
  const write = (text) => new Promise((resolve, reject) => output.write(text, (error) => error ? reject(error) : resolve()));

  try {
    await connection.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
    await connection.query("START TRANSACTION WITH CONSISTENT SNAPSHOT");
    const tables = await connection.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
    const tableKey = Object.keys(tables[0] ?? {}).find((key) => key.startsWith("Tables_in_"));
    const tableNames = tables.map((row) => row[tableKey]);
    const summary = {};
    await write(`-- Database snapshot generated ${new Date().toISOString()}\nSET FOREIGN_KEY_CHECKS=0;\n\n`);

    for (const tableName of tableNames) {
      const escapedTable = `\`${String(tableName).replace(/`/g, "``")}\``;
      const definitions = await connection.query(`SHOW CREATE TABLE ${escapedTable}`);
      const createSql = definitions[0]["Create Table"];
      await write(`-- Table ${tableName}\n${createSql};\n\n`);
      const rows = await connection.query(`SELECT * FROM ${escapedTable}`);
      const columns = Object.keys(rows[0] ?? {});
      const sumQuantity = rows.length > 0 && columns.includes("quantidade")
        ? rows.reduce((sum, row) => sum + BigInt(row.quantidade ?? 0), 0n).toString()
        : null;
      summary[tableName] = { rows: rows.length, sumQuantidade: sumQuantity };
      if (columns.length === 0 || rows.length === 0) continue;
      const columnSql = columns.map((column) => `\`${column.replace(/`/g, "``")}\``).join(", ");
      for (const row of rows) {
        const values = columns.map((column) => sqlValue(row[column])).join(", ");
        await write(`INSERT INTO ${escapedTable} (${columnSql}) VALUES (${values});\n`);
      }
      await write("\n");
    }

    await write("SET FOREIGN_KEY_CHECKS=1;\n");
    await connection.commit();
    await new Promise((resolve, reject) => output.end((error) => error ? reject(error) : resolve()));
    const stat = fs.statSync(outputPath);
    console.log(JSON.stringify({ outputPath, tables: tableNames.length, bytes: stat.size, summary }));
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    output.destroy();
    fs.rmSync(outputPath, { force: true });
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error("Database backup failed:", error instanceof Error ? error.message : "Unknown error");
  process.exitCode = 1;
});