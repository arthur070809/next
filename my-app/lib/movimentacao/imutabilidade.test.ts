import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const extensoesCodigo = new Set([".cjs", ".js", ".jsx", ".mjs", ".ts", ".tsx"]);
const diretoriosIgnorados = new Set([
  ".git",
  ".next",
  "__tests__",
  "generated",
  "node_modules",
  "tests",
]);
const escritaProibida =
  /\bmovimentoContaEstoque\s*\.\s*(?:update|upsert|delete|deleteMany)\s*\(/g;

function listarArquivosProducao(diretorio: string): string[] {
  return readdirSync(diretorio, { withFileTypes: true }).flatMap((entrada) => {
    if (entrada.isDirectory()) {
      if (diretoriosIgnorados.has(entrada.name)) {
        return [];
      }
      return listarArquivosProducao(path.join(diretorio, entrada.name));
    }

    const extensao = path.extname(entrada.name);
    if (
      !extensoesCodigo.has(extensao) ||
      /\.(?:test|spec)\.[^.]+$/.test(entrada.name)
    ) {
      return [];
    }
    return [path.join(diretorio, entrada.name)];
  });
}

describe("imutabilidade de MovimentoContaEstoque", () => {
  it("não permite update, upsert, delete ou deleteMany no código de produção", () => {
    const projeto = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../..",
    );
    const violacoes = listarArquivosProducao(projeto).flatMap((arquivo) => {
      const conteudo = readFileSync(arquivo, "utf8");
      const proibidas = [...conteudo.matchAll(escritaProibida)].map(
        (match) => match[0],
      );
      return proibidas.map((chamada) => `${path.relative(projeto, arquivo)}: ${chamada}`);
    });

    expect(violacoes).toEqual([]);
  });
});
