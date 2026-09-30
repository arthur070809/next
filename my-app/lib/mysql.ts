import mysql, { type Pool } from "mysql2/promise"

const globalForMySQL = globalThis as unknown as { mysqlPool?: Pool }

export const db = globalForMySQL.mysqlPool ?? mysql.createPool({
  host: process.env.DB_HOST ?? "127.0.0.1",
  port: Number(process.env.DB_PORT ?? 3307),
  user: process.env.DB_USER ?? "root",
  password: process.env.DB_PASSWORD ?? "",
  database: process.env.DB_NAME ?? "marcon_almoxarifado",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: "utf8mb4",
  timezone: "Z",
  decimalNumbers: true,
})

if (process.env.NODE_ENV !== "production") globalForMySQL.mysqlPool = db
