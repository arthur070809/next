import { describe, expect, it } from "vitest";

import { POST } from "./route";

describe("public registration route", () => {
  it("blocks public enrollment requests", async () => {
    const response = await POST();
    expect(response.status).toBe(404);
  });
});
