import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getAuthenticatedFuncionario: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => { throw new Error(`redirect:${path}`); },
}));

import { getAuthenticatedFuncionario } from "@/lib/auth";
import AdminLayout from "./layout";

describe("admin protected layout", () => {
  beforeEach(() => vi.clearAllMocks());

  it("redirects to login when the central session helper rejects an expired session", async () => {
    vi.mocked(getAuthenticatedFuncionario).mockResolvedValue(null);
    await expect(AdminLayout({ children: "admin content" })).rejects.toThrow(
      "redirect:/login?callbackUrl=%2Fadmin",
    );
  });
});
