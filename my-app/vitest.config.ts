import path from "node:path";
import { defineConfig } from "vitest/config";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace(
    /\/marcon_almoxarifado([?]|$)/,
    "/marcon_almoxarifado_test$1"
  );
}

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname) } },
  test: {
    environment: "node",
    testTimeout: 60000,
    hookTimeout: 60000,
  },
});