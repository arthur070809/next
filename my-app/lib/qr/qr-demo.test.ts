import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../../public/qr-demo.html", import.meta.url), "utf8");
const seed = readFileSync(new URL("../demo-seed.ts", import.meta.url), "utf8");
const generator = readFileSync(new URL("../../scripts/gerar-qr-demo.ts", import.meta.url), "utf8");

describe("standalone demo QR labels", () => {
  it("contains exactly the ten current demo catalog codes", () => {
    const seedCodes = [...seed.matchAll(/\{ codigo: "([0-9]+)", nome:/g)].slice(0, 10).map((match) => match[1]);
    const htmlCodes = [...html.matchAll(/<article class="label" data-code="([0-9]+)"/g)].map((match) => match[1]);
    expect(htmlCodes).toEqual(seedCodes);
    expect(new Set(htmlCodes).size).toBe(10);
    expect(htmlCodes).toContain("1794");
    expect(htmlCodes).toContain("17940");
  });

  it("embeds black-on-white SVGs without runtime network dependencies and supports print", () => {
    expect(html.match(/<svg\b/g)).toHaveLength(10);
    expect(html).toContain("color-scheme: light");
    expect(html).toContain("@media print");
    expect(html).not.toMatch(/<script[^>]+src=/i);
    expect(html).not.toMatch(/<link[^>]+href=["']https?:/i);
    expect(generator).toContain('errorCorrectionLevel: "M"');
    expect(generator).toContain("margin: 4");
    expect(generator).toContain('dark: "#000000", light: "#FFFFFF"');
  });
});
