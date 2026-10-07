import { describe, expect, it } from "vitest";
import { validateDemoPasswordSeed } from "./demo-password-seed";

const valid = {
  args: ["--demo"],
  nodeEnv: "development",
  vercelEnv: "preview",
  databaseUrl: "mysql://demo:secret@localhost:4000/marcon_demo",
  demoDatabaseName: "marcon_demo",
  allowlistedBadges: "1111,2222,3333",
};

describe("demo password seed safety", () => {
  it("requires the explicit demo flag, a non-production environment, demo database, and all badges allowlisted", () => {
    expect(validateDemoPasswordSeed(valid)).toEqual({ host: "localhost", database: "marcon_demo" });
    expect(() => validateDemoPasswordSeed({ ...valid, args: [] })).toThrow("--demo");
    expect(() => validateDemoPasswordSeed({ ...valid, nodeEnv: "production" })).toThrow("produção");
    expect(() => validateDemoPasswordSeed({ ...valid, vercelEnv: "production" })).toThrow("produção");
    expect(() => validateDemoPasswordSeed({ ...valid, demoDatabaseName: "marcon_live" })).toThrow("_demo");
    expect(() => validateDemoPasswordSeed({ ...valid, allowlistedBadges: "1111,2222" })).toThrow("LOGIN_DEMO_CRACHAS");
  });

  it("does not accept wildcard or malformed badge entries", () => {
    expect(() => validateDemoPasswordSeed({ ...valid, allowlistedBadges: "*,1111,2222" })).toThrow("LOGIN_DEMO_CRACHAS");
  });
});
