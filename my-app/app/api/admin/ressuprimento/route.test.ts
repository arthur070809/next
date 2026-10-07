import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  getAuthenticatedFuncionario: vi.fn(async () => ({ role: "admin" })),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { item: { update: vi.fn() } },
}));

vi.mock("@/lib/security", () => ({
  isSameOrigin: vi.fn(() => true),
}));

import { PATCH } from "./route";
import { getAuthenticatedFuncionario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOrigin } from "@/lib/security";

function request(body: unknown) {
  return new Request("http://localhost/api/admin/ressuprimento", {
    method: "PATCH",
    headers: { "content-type": "application/json", origin: "http://localhost" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/admin/ressuprimento", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAuthenticatedFuncionario).mockResolvedValue({ role: "admin" } as never);
    vi.mocked(isSameOrigin).mockReturnValue(true);
  });

  it("saves an integer reorder point on the item", async () => {
    vi.mocked(prisma.item.update).mockResolvedValue({ id: "item-1", pontoPedido: 12 } as never);

    const response = await PATCH(request({ id: "item-1", pontoAtual: 12 }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.item).toEqual({ id: "item-1", pontoPedido: 12 });
    expect(prisma.item.update).toHaveBeenCalledWith({
      where: { id: "item-1" },
      data: { pontoPedido: 12 },
      select: { id: true, pontoPedido: true },
    });
  });

  it.each([-1, 1.5, 1_000_001, "12"])("rejects an invalid reorder point: %s", async (pontoAtual) => {
    const response = await PATCH(request({ id: "item-1", pontoAtual }));

    expect(response.status).toBe(400);
    expect(prisma.item.update).not.toHaveBeenCalled();
  });

  it("rejects requests from a different origin", async () => {
    vi.mocked(isSameOrigin).mockReturnValue(false);

    const response = await PATCH(request({ id: "item-1", pontoAtual: 12 }));

    expect(response.status).toBe(403);
    expect(prisma.item.update).not.toHaveBeenCalled();
  });

  it("restricts updates to administrators", async () => {
    vi.mocked(getAuthenticatedFuncionario).mockResolvedValue({ role: "almoxarife" } as never);

    const response = await PATCH(request({ id: "item-1", pontoAtual: 12 }));

    expect(response.status).toBe(403);
    expect(prisma.item.update).not.toHaveBeenCalled();
  });
});
