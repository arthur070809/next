import path from "node:path";
import { configDefaults, defineConfig } from "vitest/config";
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
    exclude: [...configDefaults.exclude, "tests/integration-tidb.test.ts"],
    testTimeout: 60000,
    hookTimeout: 60000,
  },
});