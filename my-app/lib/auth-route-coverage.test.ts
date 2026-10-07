import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const appDirectory = fileURLToPath(new URL("../app/", import.meta.url));
const publicApiRoutes = new Set([
  "auth/cadastro/route.ts",
  "auth/device-pairing/complete/route.ts",
  "auth/device-pairing/options/route.ts",
  "auth/login/face/identify/route.ts",
  "auth/login/face/identify/start/route.ts",
  "auth/login/face/verify/route.ts",
  "auth/login/route.ts",
  "auth/login/totp/route.ts",
  "auth/login/webauthn/verify/route.ts",
  "auth/logout/route.ts",
  "diagnostics/build/route.ts",
]);

function routeFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return routeFiles(path);
    return entry.isFile() && entry.name === "route.ts" ? [path] : [];
  });
}

describe("central authentication coverage", () => {
  it("routes every non-public API through the central session helpers", () => {
    const apiRoot = join(appDirectory, "api");
    const routes = routeFiles(apiRoot);
    expect(routes.length).toBeGreaterThan(0);

    for (const file of routes) {
      const routePath = relative(apiRoot, file).replaceAll("\\", "/");
      const source = readFileSync(file, "utf8");
      if (publicApiRoutes.has(routePath)) continue;
      expect(source, routePath).toMatch(/\b(getAuthenticatedSession|getAuthenticatedFuncionario|requireAdmin|requireAlmoxarife)\b/);
    }
  });

  it("keeps authenticated page layouts on the central helper", () => {
    const layouts = [
      "admin/layout.tsx",
      "almoxarifado/layout.tsx",
      "deposito/layout.tsx",
      "estoque/layout.tsx",
      "historico/layout.tsx",
      "minhas-requisicoes/layout.tsx",
      "requisicao/layout.tsx",
    ];
    for (const layout of layouts) {
      const source = readFileSync(join(appDirectory, layout), "utf8");
      expect(source, layout).toMatch(/\b(getAuthenticatedFuncionario|requireAdmin|requireAlmoxarife)\b/);
    }
    const passwordPage = readFileSync(join(appDirectory, "alterar-senha/page.tsx"), "utf8");
    expect(passwordPage).toContain("<SessionHeartbeat />");
  });
});
