import { describe, expect, it } from "vitest";
import { assertTestDatabaseUrl } from "./test-database-guard";

describe("integration database safety guard", () => {
  it("allows only database names ending in _test", () => {
    expect(() => assertTestDatabaseUrl("mysql://user:secret@host:4000/marcon_almoxarifado_test")).not.toThrow();
    expect(() => assertTestDatabaseUrl("mysql://user:secret@host:4000/marcon_demo")).toThrow(/must end in _test/);
    expect(() => assertTestDatabaseUrl("mysql://user:secret@host:4000/marcon_almoxarifado")).toThrow(/must end in _test/);
    expect(() => assertTestDatabaseUrl("http://host/marcon_almoxarifado_test")).toThrow(/MySQL DATABASE_URL/);
  });
});
