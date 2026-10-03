import { writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "dotenv";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import QRCode from "qrcode";
import { PrismaClient } from "../generated/prisma/client";

config({ path: ".env.local" });
config({ path: ".env" });

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("A geração de etiqueta de teste não pode rodar em produção.");
  }
  const args = process.argv.slice(2);
  const codigoArgument = args.find((arg) => arg.startsWith("--codigo="))?.slice("--codigo=".length);
  const filial = args.find((arg) => arg.startsWith("--filial="))?.slice("--filial=".length);
  if (!codigoArgument || !/^[0-9]{1,8}$/.test(codigoArgument) || args.some((arg) => !arg.startsWith("--codigo=") && !arg.startsWith("--filial="))) {
    throw new Error("Uso: npm run qr:etiqueta -- --codigo=6687 [--filial=CODIGO].");
  }

  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) throw new Error("DATABASE_URL não foi configurada.");
  const url = new URL(rawUrl);
  const prisma = new PrismaClient({
    adapter: new PrismaMariaDb({
      host: url.hostname,
      port: Number(url.port) || 4000,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: decodeURIComponent(url.pathname.slice(1)),
      ssl: true,
      connectTimeout: 30000,
      connectionLimit: 1,
      charset: "utf8mb4",
    }),
  });

  try {
    const products = await prisma.item.findMany({
      where: {
        codigo: codigoArgument,
        ativo: true,
        ...(filial ? { filial } : {}),
      },
      select: { codigo: true, nome: true, unidade: true, filial: true },
      take: 2,
    });
    if (products.length === 0) throw new Error("Nenhum produto ativo foi encontrado com esse código.");
    if (products.length > 1) throw new Error("Código duplicado por filial. Informe --filial para escolher o produto correto.");
    const product = products[0];
    if (!product.codigo) throw new Error("O produto não possui código ERP.");

    const qrSvg = await QRCode.toString(product.codigo, {
      type: "svg",
      errorCorrectionLevel: "H",
      margin: 4,
      width: 700,
    });
    const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Etiqueta ${escapeHtml(product.codigo)} - Almoxarifado Marcon</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font: 18px Arial, sans-serif; color: #111; }
    .label { width: 100mm; min-height: 100mm; padding: 8mm; display: grid; grid-template-columns: 55mm 1fr; gap: 5mm; align-items: center; border: 1px solid #bbb; }
    .qr { width: 55mm; height: 55mm; }
    .code { font-size: 34pt; font-weight: 700; }
    .name { margin-top: 4mm; font-size: 16pt; overflow-wrap: anywhere; }
    .caption { margin-top: 3mm; font-size: 10pt; color: #444; }
    @media print { @page { size: 100mm 100mm; margin: 0; } .label { border: 0; } }
  </style>
</head>
<body>
  <main class="label">
    <div class="qr">${qrSvg}</div>
    <div><div class="code">${escapeHtml(product.codigo)}</div><div class="name">${escapeHtml(product.nome)}</div><div class="caption">Código ERP/TOTVS · ${escapeHtml(product.unidade)}</div></div>
  </main>
  <script>window.addEventListener("load", () => window.print());</script>
</body>
</html>`;
    const output = path.resolve(process.cwd(), `etiqueta-qr-${product.codigo}.html`);
    await writeFile(output, html, "utf8");
    console.log(`Etiqueta gerada para ${product.codigo} — ${product.nome}.`);
    console.log(`Abra ${output} no navegador para imprimir em tamanho grande.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Não foi possível gerar a etiqueta.");
  process.exitCode = 1;
});
