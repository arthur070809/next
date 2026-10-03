// Prisma 7 config — carrega .env.local antes de .env para suportar Next.js
// npm install --save-dev prisma dotenv
import { config } from "dotenv";
// Carrega .env.local primeiro (Next.js convention), depois .env como fallback
config({ path: ".env.local" });
config({ path: ".env" });

import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
