import { describe, expect, it } from "vitest";
import nextConfig from "./next.config";

describe("camera permissions policy", () => {
  it("serves the pinned local face model files with a long immutable cache policy", async () => {
    const rules = await nextConfig.headers?.();
    expect(rules?.find((rule) => rule.source === "/models/human/:path*")?.headers).toContainEqual({
      key: "Cache-Control",
      value: "public, max-age=31536000, immutable",
    });
  });

  it("grants camera access only to the inventory, checklist, and enrollment routes that use it", async () => {
    const rules = await nextConfig.headers?.();
    const cameraRules = rules?.filter((rule) =>
      rule.headers.some((header) => header.key === "Permissions-Policy" && header.value === "camera=(self)"),
    ) ?? [];

    expect(cameraRules.map((rule) => rule.source)).toEqual([
      "/almoxarifado/requisicoes/:path*",
      "/estoque/:path*",
      "/admin/estoque/:path*",
      "/almoxarifado/estoque/:path*",
      "/admin/biometria/:path*",
    ]);
    expect(rules?.every((rule) =>
      rule.headers.every((header) => header.key !== "Content-Security-Policy"),
    )).toBe(true);
  });
});
