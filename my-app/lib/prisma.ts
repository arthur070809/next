/**
 * Cliente Prisma com adapter mariadb para TiDB Cloud Starter
 *
 * Conexão e TLS:
 *   - O PrismaMariaDb recebe uma instância de mariadb.Pool com ssl: true
 *   - Pool configurado para TiDB Serverless:
 *     - connectionLimit: 5
 *     - idleTimeout: 30s (menor que o idle timeout de 60s do TiDB Starter)
 *     - connectTimeout: 30s
 *     - acquireTimeout: 30s
 *     - charset: utf8mb4
 */
import mariadb, { type Pool } from "mariadb";
import { config } from "dotenv";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/generated/prisma/client";

if (!process.env.DATABASE_URL) {
  config({ path: ".env.local" });
  config({ path: ".env" });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: Pool | undefined;
};

const rawUrl = process.env.DATABASE_URL;

if (!rawUrl) {
  throw new Error("DATABASE_URL não foi configurada.");
}

const url = new URL(rawUrl);

const pool =
  globalForPrisma.pool ??
  mariadb.createPool({
    host: url.hostname,
    port: Number(url.port) || 4000,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.slice(1)),
    ssl: true,
    connectionLimit: 5,
    idleTimeout: 30, // segundos
    connectTimeout: 30000, // ms
    acquireTimeout: 30000, // ms
    charset: "utf8mb4",
  });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adapter = new PrismaMariaDb(pool as any);

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.pool = pool;
}