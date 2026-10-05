import { config } from "dotenv";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client";
import { assertSafeDemoScript } from "./demo-script-safety.cjs";

config({ path: ".env.local" });
config({ path: ".env" });

export function createDemoScriptClient(args: string[]) {
  const target = assertSafeDemoScript(args);
  const url = new URL(process.env.DATABASE_URL!);
  const adapter = new PrismaMariaDb({
    host: target.host,
    port: Number(url.port) || 4000,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: target.database,
    ssl: true,
    connectTimeout: 30000,
    connectionLimit: 2,
    charset: "utf8mb4",
  });
  return { prisma: new PrismaClient({ adapter }) };
}
