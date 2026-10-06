import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getAuthenticatedFuncionario: vi.fn() }));
vi.mock("@/lib/demo-mode", () => ({
  isDemoModeConfigured: vi.fn(),
  isDemoLoginEnabledForBadge: vi.fn(),
}));
vi.mock("@/lib/demo-seed", () => ({ resetAndSeedDemoData: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { POST } from "./route";
import { getAuthenticatedFuncionario } from "@/lib/auth";
import { isDemoLoginEnabledForBadge, isDemoModeConfigured } from "@/lib/demo-mode";
import { resetAndSeedDemoData } from "@/lib/demo-seed";
import { PapelFuncionario } from "@/generated/prisma/client";

const admin = { id: 5, cracha: "3333", papel: PapelFuncionario.ADMIN };

function request(origin = "https://demo.example") {
  return new Request("https://demo.example/api/admin/demo/reset", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: "{}",
  });
}

describe("POST /api/admin/demo/reset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isDemoModeConfigured).mockReturnValue(true);
    vi.mocked(isDemoLoginEnabledForBadge).mockReturnValue(true);
    vi.mocked(getAuthenticatedFuncionario).mockResolvedValue(admin as never);
    vi.mocked(resetAndSeedDemoData).mockResolvedValue({ initialized: true, preservedExistingDemo: false });
  });

  it("resets the fixture for an allowlisted demo admin", async () => {
    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(resetAndSeedDemoData).toHaveBeenCalledTimes(1);
  });

  it("requires same-origin requests, the active demo mode, and an allowlisted admin", async () => {
    expect((await POST(request("https://attacker.example"))).status).toBe(403);

    vi.mocked(isDemoModeConfigured).mockReturnValue(false);
    expect((await POST(request())).status).toBe(404);
    expect(resetAndSeedDemoData).not.toHaveBeenCalled();

    vi.mocked(isDemoModeConfigured).mockReturnValue(true);
    vi.mocked(isDemoLoginEnabledForBadge).mockReturnValue(false);
    expect((await POST(request())).status).toBe(403);
    expect(resetAndSeedDemoData).not.toHaveBeenCalled();
  });

  it("does not allow non-admin users to trigger a reset", async () => {
    vi.mocked(getAuthenticatedFuncionario).mockResolvedValue({
      id: 6,
      cracha: "1111",
      papel: PapelFuncionario.OPERADOR,
    } as never);

    expect((await POST(request())).status).toBe(403);
    expect(resetAndSeedDemoData).not.toHaveBeenCalled();
  });
});
