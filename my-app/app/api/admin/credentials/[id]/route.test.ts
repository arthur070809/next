import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  $transaction: vi.fn(async (cb) => cb({
    webAuthnCredential: { delete: vi.fn() },
    sessao: { deleteMany: vi.fn() },
    securityAuditEvent: { create: vi.fn() },
  })),
  webAuthnCredential: { findUnique: vi.fn() },
  securityAuditEvent: { create: vi.fn() },
} }));
vi.mock("@/lib/security", () => ({ isSameOrigin: vi.fn(() => true) }));

import { DELETE } from "./route";
import { requireAdmin } from "@/lib/auth";

describe("admin credentials detail route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects unauthenticated deletes", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ funcionario: null, status: 401 });
    const response = await DELETE(new Request("http://localhost/api/admin/credentials/1", { method: "DELETE", headers: { origin: "http://localhost" } }), { params: Promise.resolve({ id: "1" }) });
    expect(response.status).toBe(401);
  });
});
