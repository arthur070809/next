import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getDemoDatabaseTarget,
  getDemoLoginBadges,
  isDemoLoginEnabledForBadge,
  isDemoModeConfigured,
  logLoginDemoModeStartup,
  maskDemoBadge,
} from "./demo-mode";

afterEach(() => {
  vi.unstubAllEnvs();
});

function configureDemo(databaseUrl = "mysql://demo:secret@tidb.example:4000/marcon_demo") {
  vi.stubEnv("LOGIN_MODO_DEMO", "true");
  vi.stubEnv("DEMO_DB_NOME", "marcon_demo");
  vi.stubEnv("LOGIN_DEMO_CRACHAS", "1111,2222,3333");
  vi.stubEnv("DATABASE_URL", databaseUrl);
}

describe("demo login mode configuration", () => {
  it("activates only for a valid, exact _demo database target with all flags", () => {
    configureDemo();
    expect(isDemoModeConfigured()).toBe(true);
    expect(isDemoLoginEnabledForBadge("２２２２")).toBe(true);
    expect(getDemoDatabaseTarget()).toEqual({ host: "tidb.example", database: "marcon_demo" });
  });

  it("does not activate for a different database even when every flag is set", () => {
    configureDemo("mysql://demo:secret@tidb.example:4000/marcon_almoxarifado");
    expect(isDemoModeConfigured()).toBe(false);
    expect(isDemoLoginEnabledForBadge("2222")).toBe(false);
  });

  it("does not activate if any required flag is missing", () => {
    configureDemo();
    vi.stubEnv("LOGIN_DEMO_CRACHAS", "");
    expect(isDemoModeConfigured()).toBe(false);
    vi.stubEnv("LOGIN_DEMO_CRACHAS", "1111,2222");
    vi.stubEnv("LOGIN_MODO_DEMO", "");
    expect(isDemoModeConfigured()).toBe(false);
    vi.stubEnv("LOGIN_MODO_DEMO", "true");
    vi.stubEnv("DEMO_DB_NOME", "");
    expect(isDemoModeConfigured()).toBe(false);
  });

  it("requires a _demo target name and rejects wildcard or invalid badge entries", () => {
    configureDemo("mysql://demo:secret@tidb.example:4000/marcon_demo");
    vi.stubEnv("DEMO_DB_NOME", "marcon_demo2");
    expect(isDemoModeConfigured()).toBe(false);
    vi.stubEnv("DEMO_DB_NOME", "marcon_demo");
    vi.stubEnv("LOGIN_DEMO_CRACHAS", "*,abc,1111");
    expect(getDemoLoginBadges()).toEqual(new Set(["1111"]));
    expect(isDemoLoginEnabledForBadge("2222")).toBe(false);
  });

  it("does not restrict production mode when the database and all flags match", () => {
    configureDemo();
    vi.stubEnv("NODE_ENV", "production");
    expect(isDemoLoginEnabledForBadge("3333")).toBe(true);
  });

  it("masks demo badges and logs only the masked badge during login notices", () => {
    expect(maskDemoBadge("3333")).toBe("**33");
    configureDemo();
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    logLoginDemoModeStartup();
    expect(warning).toHaveBeenCalledWith(expect.stringContaining("MODO DE DEMONSTRAÇÃO ATIVO"));
    expect(warning.mock.calls.flat().join(" ")).not.toContain("secret");
  });
});
