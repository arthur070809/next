import { describe, expect, it, vi } from "vitest";
import { assertSafeDemoScript } from "./demo-script-safety";

describe("demo script safety", () => {
  it("accepts only the exact configured _demo database and requires --yes", () => {
    const environment = {
      NODE_ENV: "development",
      DEMO_DB_NOME: "marcon_demo",
      DATABASE_URL: "mysql://user:secret@tidb.example:4000/marcon_demo",
    };
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    expect(assertSafeDemoScript(["--yes"], environment)).toEqual({
      host: "tidb.example",
      database: "marcon_demo",
    });
    expect(log).toHaveBeenCalledWith("Destino: host=tidb.example; banco=marcon_demo");
    expect(log.mock.calls.flat().join(" ")).not.toContain("secret");
    expect(() => assertSafeDemoScript([], environment)).toThrow(/--yes/);
    expect(() => assertSafeDemoScript(["--yes", "--force"], environment)).toThrow(/--yes/);
    expect(() => assertSafeDemoScript(["--yes", "--remove"], environment)).toThrow(/--yes/);
    log.mockRestore();
  });

  it("refuses production and any database other than the configured _demo database", () => {
    const base = {
      NODE_ENV: "development",
      DEMO_DB_NOME: "marcon_demo",
      DATABASE_URL: "mysql://user:secret@host/marcon_demo",
    };
    expect(() => assertSafeDemoScript(["--yes"], { ...base, NODE_ENV: "production" })).toThrow(/NODE_ENV=production/);
    expect(() => assertSafeDemoScript(["--yes"], {
      ...base,
      DATABASE_URL: "mysql://user:secret@host/marcon_almoxarifado",
    })).toThrow(/terminado em _demo/);
    expect(() => assertSafeDemoScript(["--yes"], { ...base, DEMO_DB_NOME: "other_demo" }))
      .toThrow(/exatamente para DEMO_DB_NOME/);
  });
});
