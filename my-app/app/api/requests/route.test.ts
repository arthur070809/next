import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getAuthenticatedFuncionario: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { requisicao: { findMany: vi.fn() }, item: { findUnique: vi.fn(), findFirst: vi.fn() }, localEstoque: { upsert: vi.fn() } } }));
vi.mock("@/lib/security", () => ({ isSameOrigin: vi.fn(() => true) }));
vi.mock("@/lib/requisicoes-db", () => ({ criarRequisicao: vi.fn(async () => ({ numeroPedido: "REQ-0001" })), toRequisicaoMock: vi.fn((value) => value) }));

import { GET, POST } from "./route";
import { getAuthenticatedFuncionario } from "@/lib/auth";

describe("requests route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires authentication on list requests", async () => {
    vi.mocked(getAuthenticatedFuncionario).mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("rejects invalid request creation payloads", async () => {
    vi.mocked(getAuthenticatedFuncionario).mockResolvedValue({ id: 1, role: "operador", nome: "Operador", criadoEm: new Date(), login: "op", email: "op@local", senha: "hashed", cargo: "operador", cracha: "2000", papel: "OPERADOR", mustChangePassword: false, ativo: true, atualizadoEm: new Date() } as never);
    const response = await POST(new Request("http://localhost/api/requests", { method: "POST", headers: { "content-type": "application/json", origin: "http://localhost" }, body: JSON.stringify({}) }));
    expect(response.status).toBe(400);
  });
});
