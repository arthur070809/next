import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import QRCode from "qrcode";

const products = [
  { codigo: "129", nome: 'RODIZIO GLE 414 NPN-MM (4" GIRAT.)' },
  { codigo: "128", nome: 'RODIZIO FLE 312 NPP (3" FIXA) - MM' },
  { codigo: "127", nome: 'RODIZIO GLE 312 NPP (3" GIRAT.) - MM' },
  { codigo: "173", nome: "GARFO GGMS 3508 R (GARFO GIRATORIO)" },
  { codigo: "7988", nome: "GARFO GGMX 62 (PLATAFORMA ELEVADOR)" },
  { codigo: "17940", nome: "GUIA DE FERRO FUNDIDO N° 06" },
  { codigo: "1794", nome: 'PNEU MACICO 8"' },
  { codigo: "1796", nome: 'PNEU MACICO 10"' },
  { codigo: "1795", nome: 'PNEU MACICO 9"' },
  { codigo: "5746", nome: 'RODA BORRACHA 9200 BIN 3/4 (9")' },
];

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

async function main() {
  const labels = await Promise.all(products.map(async (product) => {
    const svg = await QRCode.toString(product.codigo, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 4,
      width: 640,
      color: { dark: "#000000", light: "#FFFFFF" },
    });
    return `<article class="label" data-code="${product.codigo}">
      <div class="qr">${svg}</div>
      <p class="code">${product.codigo}</p>
      <h2>${escapeHtml(product.nome)}</h2>
    </article>`;
  }));

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>Etiquetas QR de demonstração · Marcon</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    html, body { margin: 0; background: #fff; color: #111; font: 16px Arial, sans-serif; }
    body { padding: 8px; }
    header { max-width: 900px; margin: 0 auto 20px; }
    h1 { font-size: 1.5rem; }
    label { display: block; font-weight: 700; }
    select { margin-top: 8px; width: 100%; max-width: 500px; min-height: 44px; padding: 8px; background: #fff; color: #111; font-size: 1rem; }
    .labels { display: grid; grid-template-columns: repeat(auto-fit, minmax(336px, 1fr)); gap: 16px; max-width: 1200px; margin: 0 auto; }
    .label { min-width: 336px; break-inside: avoid; border: 2px solid #222; padding: 8px; text-align: center; background: #fff; color: #111; }
    .qr { width: 320px; height: 320px; max-width: 100%; margin: auto; }
    .qr svg { display: block; width: 100%; height: 100%; }
    .code { margin: 8px 0 4px; font-size: 1.5rem; font-weight: 700; }
    h2 { margin: 0; font-size: 1rem; }
    @media print {
      body { padding: 0; }
      header { display: none; }
      .labels { display: block; }
      .label { min-height: 100vh; border: 0; display: flex; flex-direction: column; justify-content: center; page-break-after: always; }
      .qr { width: min(80vw, 170mm); }
      .label[hidden] { display: none !important; }
    }
  </style>
</head>
<body>
  <header>
    <h1>Etiquetas QR de demonstração</h1>
    <p>Conteúdo codificado: código puro. Para leitura no checklist, abra a câmera e enquadre um QR.</p>
    <label for="product">Exibir um produto por vez (ou todos)
      <select id="product"><option value="all">Todos os produtos</option>${products.map((product) => `<option value="${product.codigo}">${product.codigo} · ${escapeHtml(product.nome)}</option>`).join("")}</select>
    </label>
  </header>
  <main class="labels">${labels.join("\n")}</main>
  <script>
    const selector = document.getElementById("product");
    selector.addEventListener("change", () => {
      document.querySelectorAll(".label").forEach((label) => {
        label.hidden = selector.value !== "all" && label.dataset.code !== selector.value;
      });
    });
  </script>
</body>
</html>`;
  const output = path.resolve(process.cwd(), "public", "qr-demo.html");
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, html, "utf8");
  console.log(`Página offline de QR gerada: ${output}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Falha ao gerar etiquetas QR.");
  process.exitCode = 1;
});
