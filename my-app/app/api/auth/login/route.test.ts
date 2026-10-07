import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {
  funcionario: { findFirst: vi.fn() },
  sessao: { create: vi.fn() },
  $transaction: vi.fn(),
  adminTotpCredential: { findUnique: vi.fn() },
  trustedDevice: { findUnique: vi.fn() },
  webAuthnCredential: { findMany: vi.fn() },
  emergencyAccessGrant: { findFirst: vi.fn() },
  authChallenge: { create: vi.fn() },
  faceTemplate: { count: vi.fn() },
  securityAuditEvent: { create: vi.fn() },
  loginAttemptBucket: { findFirst: vi.fn(), deleteMany: vi.fn() },
  $executeRaw: vi.fn(),
} }));
vi.mock("bcryptjs", () => ({ default: { compare: vi.fn(async (): Promise<boolean> => false) } }));
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ get: vi.fn(() => undefined) })) }));

import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { PapelFuncionario } from "@/generated/prisma/client";
import { getLoginClientIpHash } from "@/lib/login-attempts";
import { recordTestLoginFailure } from "@/lib/login-test-mode";

const passwordHash = `$2b$12$${"a".repeat(53)}`;
const admin = {
  id: 1,
  nome: "Admin",
  email: "admin@local.invalid",
  cracha: "1000",
  papel: PapelFuncionario.ADMIN,
  senha: passwordHash,
  ativo: true,
  cargo: "admin",
  mustChangePassword: false,
};

const operator = {
  id: 2,
  nome: "Operador",
  email: "operator@local.invalid",
  cracha: "2000",
  papel: PapelFuncionario.OPERADOR,
  senha: passwordHash,
  ativo: true,
  cargo: "operador",
  mustChangePassword: false,
};

const testAdmin = { ...admin, cracha: "3333" };
const demoAdmin = { ...admin, cracha: "3333", nome: "Demo Administrador" };

const stockkeeper = {
  id: 3,
  nome: "Almoxarife",
  email: "stockkeeper@local.invalid",
  cracha: "2222",
  papel: PapelFuncionario.ALMOXARIFE,
  senha: passwordHash,
  ativo: true,
  cargo: "almoxarife",
  mustChangePassword: false,
};

function request(codigoCracha: string, ip = "192.0.2.10") {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost", "x-real-ip": ip },
    body: JSON.stringify({ codigoCracha, credential: "password", password: "ValidPassword123" }),
  });
}

describe("login by badge code", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("NODE_ENV", "test");
    delete process.env.LOGIN_MODO_TESTE;
    delete process.env.LOGIN_TESTE_CRACHAS;
    delete process.env.LOGIN_MODO_DEMO;
    delete process.env.DEMO_DB_NOME;
    delete process.env.LOGIN_DEMO_CRACHAS;
    delete process.env.LOGIN_DEMO_TENTATIVAS_LIMITE;
    delete process.env.LOGIN_DEMO_JANELA_MS;
    delete process.env.LOGIN_DEMO_BLOQUEIO_MS;
    process.env.DATABASE_URL = "mysql://unused:unused@localhost:4000/marcon_almoxarifado";
    process.env.LOGIN_FACIAL_OBRIGATORIO = "false";
    process.env.LOGIN_CHALLENGE_SECRET = "test-login-secret-that-is-at-least-32-characters";
    vi.mocked(prisma.sessao.create).mockResolvedValue({} as never);
    vi.mocked(prisma.$transaction).mockImplementation(((callback: (transaction: typeof prisma) => Promise<unknown>) => callback(prisma)) as never);
    vi.mocked(prisma.funcionario.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.adminTotpCredential.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.webAuthnCredential.findMany).mockResolvedValue([]);
    vi.mocked(prisma.emergencyAccessGrant.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.loginAttemptBucket.findFirst).mockResolvedValue(null);
    vi.mocked(bcrypt.compare).mockImplementation(() => Promise.resolve(true));
    vi.mocked(prisma.faceTemplate.count).mockResolvedValue(1);
    vi.mocked(prisma.$executeRaw).mockResolvedValue(1);
    vi.mocked(prisma.authChallenge.create).mockResolvedValue({ id: "face-challenge" } as never);
    vi.mocked(prisma.loginAttemptBucket.deleteMany).mockResolvedValue({ count: 0 } as never);
  });

  it("finds the employee by badge, discovers the role, and creates an admin session", async () => {
    vi.mocked(prisma.funcionario.findFirst).mockResolvedValue(admin as never);

    const response = await POST(request("1000"));

    expect(response.status).toBe(200);
    expect(prisma.funcionario.findFirst).toHaveBeenCalledWith({ where: { cracha: "1000" } });
    expect(prisma.sessao.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ funcionarioId: admin.id, accessArea: "admin" }) }),
    );
  });

  it("authenticates operators without a facial challenge", async () => {
    process.env.LOGIN_FACIAL_OBRIGATORIO = "true";
    vi.mocked(prisma.funcionario.findFirst).mockResolvedValue(operator as never);

    const response = await POST(request("2000"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.funcionario.role).toBe("operador");
  });

  it("accepts a valid password while preserving the configured profile checks", async () => {
    const passwordHash = `$2b$12$${"a".repeat(53)}`;
    vi.mocked(prisma.funcionario.findFirst).mockResolvedValue({ ...operator, senha: passwordHash } as never);
    vi.mocked(bcrypt.compare).mockImplementation(() => Promise.resolve(true));

    const response = await POST(new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost" },
      body: JSON.stringify({ codigoCracha: "2000", credential: "password", password: "ValidPassword123" }),
    }));

    expect(response.status).toBe(200);
    expect(bcrypt.compare).toHaveBeenCalledWith("ValidPassword123", passwordHash);
    expect(prisma.sessao.create).toHaveBeenCalled();
    expect(prisma.sessao.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ funcionarioId: operator.id, accessArea: "operador" }) }),
    );
    expect(prisma.authChallenge.create).not.toHaveBeenCalled();
  });

  it("returns the generic invalid-code response for an incorrect password", async () => {
    const passwordHash = `$2b$12$${"a".repeat(53)}`;
    vi.mocked(prisma.funcionario.findFirst).mockResolvedValue({ ...operator, senha: passwordHash } as never);
    vi.mocked(bcrypt.compare).mockImplementation(() => Promise.resolve(false));

    const response = await POST(new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost" },
      body: JSON.stringify({ codigoCracha: "2000", credential: "password", password: "wrong" }),
    }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Código inválido." });
    expect(prisma.sessao.create).not.toHaveBeenCalled();
  });

  it("requires password in the ordinary login path", async () => {
    vi.mocked(prisma.funcionario.findFirst).mockResolvedValue(operator as never);

    const response = await POST(new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost" },
      body: JSON.stringify({ codigoCracha: "2000" }),
    }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Código inválido." });
    expect(prisma.sessao.create).not.toHaveBeenCalled();
  });

  it("keeps the admin second factor after password verification", async () => {
    vi.mocked(prisma.funcionario.findFirst).mockResolvedValue({ ...admin, senha: passwordHash } as never);
    vi.mocked(prisma.adminTotpCredential.findUnique).mockResolvedValue({ enabledAt: new Date() } as never);
    vi.mocked(bcrypt.compare).mockImplementation(() => Promise.resolve(true));

    const response = await POST(new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost" },
      body: JSON.stringify({ codigoCracha: "1000", credential: "password", password: "ValidPassword123" }),
    }));

    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({ step: "totp" });
    expect(prisma.sessao.create).not.toHaveBeenCalled();
  });

  it("rejects facial authentication for operators even if a template exists", async () => {
    vi.mocked(prisma.funcionario.findFirst).mockResolvedValue(operator as never);
    vi.mocked(prisma.faceTemplate.count).mockResolvedValue(1);

    const response = await POST(new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost" },
      body: JSON.stringify({ codigoCracha: "2000", credential: "face" }),
    }));

    expect(response.status).toBe(401);
    expect(prisma.faceTemplate.count).not.toHaveBeenCalled();
    expect(prisma.sessao.create).not.toHaveBeenCalled();
  });

  it("explains when the selected badge has no active face template", async () => {
    vi.mocked(prisma.funcionario.findFirst).mockResolvedValue(admin as never);
    vi.mocked(prisma.faceTemplate.count).mockResolvedValue(0);

    const response = await POST(new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost" },
      body: JSON.stringify({ codigoCracha: "1000", credential: "face" }),
    }));

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: "Não há cadastro facial ativo para este funcionário. Procure o administrador.",
    });
    expect(prisma.sessao.create).not.toHaveBeenCalled();
  });

  it("allows an explicitly allowlisted development test badge through the normal session path", async () => {
    process.env.LOGIN_MODO_TESTE = "true";
    process.env.LOGIN_TESTE_CRACHAS = "1111,2222,3333";
    process.env.LOGIN_FACIAL_OBRIGATORIO = "true";
    vi.mocked(prisma.funcionario.findFirst)
      .mockResolvedValueOnce(testAdmin as never)
      .mockResolvedValueOnce(testAdmin as never);
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const response = await POST(new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost" },
      body: JSON.stringify({ codigoCracha: "3333" }),
    }));

    expect(response.status).toBe(200);
    expect(prisma.sessao.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ funcionarioId: testAdmin.id, accessArea: "admin" }) }),
    );
    expect(prisma.authChallenge.create).not.toHaveBeenCalled();
    expect(prisma.adminTotpCredential.findUnique).not.toHaveBeenCalled();
    expect(prisma.funcionario.findFirst).toHaveBeenCalledTimes(2);
    expect(bcrypt.compare).not.toHaveBeenCalled();
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")?.toLowerCase()).not.toContain("max-age");
    expect(response.headers.get("set-cookie")?.toLowerCase()).not.toContain("expires=");
    expect(warning).toHaveBeenCalledWith(expect.stringContaining("crachá **33"));
    expect(warning.mock.calls.flat().join(" ")).not.toContain("3333");
    warning.mockRestore();
  });

  it("does not allow the test bypass in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.LOGIN_MODO_TESTE = "true";
    process.env.LOGIN_TESTE_CRACHAS = "3333";
    process.env.LOGIN_FACIAL_OBRIGATORIO = "true";
    vi.mocked(prisma.funcionario.findFirst).mockResolvedValue(testAdmin as never);

    const response = await POST(request("3333"));
    const data = await response.json();

    expect(response.status).toBe(202);
    expect(data.step).toBe("face");
    expect(prisma.sessao.create).not.toHaveBeenCalled();
  });

  it("does not allow a badge outside the development test allowlist to bypass normal checks", async () => {
    process.env.LOGIN_MODO_TESTE = "true";
    process.env.LOGIN_TESTE_CRACHAS = "1111,3333";
    vi.mocked(prisma.funcionario.findFirst).mockResolvedValue(stockkeeper as never);

    const response = await POST(request("2222"));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Código inválido." });
    expect(prisma.sessao.create).not.toHaveBeenCalled();
    expect(prisma.trustedDevice.findUnique).not.toHaveBeenCalled();
  });

  it("allows an allowlisted demo admin in production without TOTP, face or a trusted device", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.LOGIN_MODO_DEMO = "true";
    process.env.DEMO_DB_NOME = "marcon_demo";
    process.env.LOGIN_DEMO_CRACHAS = "1111,2222,3333";
    process.env.DATABASE_URL = "mysql://unused:unused@tidb.example:4000/marcon_demo";
    process.env.LOGIN_FACIAL_OBRIGATORIO = "true";
    vi.mocked(prisma.funcionario.findFirst)
      .mockResolvedValueOnce(demoAdmin as never)
      .mockResolvedValueOnce(demoAdmin as never);
    vi.mocked(prisma.adminTotpCredential.findUnique).mockResolvedValue({ enabledAt: new Date() } as never);

    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const response = await POST(new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost" },
      body: JSON.stringify({ codigoCracha: "3333", credential: "password", password: "ignored-in-demo" }),
    }));

    expect(response.status).toBe(200);
    expect(prisma.sessao.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ funcionarioId: demoAdmin.id, accessArea: "admin", trustedDeviceId: null }),
    }));
    expect(prisma.adminTotpCredential.findUnique).not.toHaveBeenCalled();
    expect(prisma.faceTemplate.count).not.toHaveBeenCalled();
    expect(prisma.trustedDevice.findUnique).not.toHaveBeenCalled();
    expect(prisma.webAuthnCredential.findMany).not.toHaveBeenCalled();
    expect(prisma.funcionario.findFirst).toHaveBeenCalledTimes(2);
    expect(bcrypt.compare).not.toHaveBeenCalled();
    expect(warning.mock.calls.flat().join(" ")).toContain("**33");
    expect(warning.mock.calls.flat().join(" ")).not.toContain("3333");
    warning.mockRestore();
  });

  it("does not enable demo login against any database other than the named demo target", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.LOGIN_MODO_DEMO = "true";
    process.env.DEMO_DB_NOME = "marcon_demo";
    process.env.LOGIN_DEMO_CRACHAS = "3333";
    process.env.DATABASE_URL = "mysql://unused:unused@tidb.example:4000/marcon_almoxarifado";
    process.env.LOGIN_FACIAL_OBRIGATORIO = "true";
    vi.mocked(prisma.funcionario.findFirst).mockResolvedValue(demoAdmin as never);

    const response = await POST(request("3333"));
    const data = await response.json();

    expect(response.status).toBe(202);
    expect(data.step).toBe("face");
    expect(prisma.sessao.create).not.toHaveBeenCalled();
    expect(prisma.authChallenge.create).toHaveBeenCalled();
  });

  it("does not enable demo login when any required flag is missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.LOGIN_MODO_DEMO = "true";
    process.env.DEMO_DB_NOME = "marcon_demo";
    process.env.LOGIN_DEMO_CRACHAS = "";
    process.env.DATABASE_URL = "mysql://unused:unused@tidb.example:4000/marcon_demo";
    process.env.LOGIN_FACIAL_OBRIGATORIO = "true";
    vi.mocked(prisma.funcionario.findFirst).mockResolvedValue(demoAdmin as never);

    const response = await POST(request("3333"));
    const data = await response.json();

    expect(response.status).toBe(202);
    expect(data.step).toBe("face");
    expect(prisma.sessao.create).not.toHaveBeenCalled();
  });

  it("keeps non-allowlisted badges on their normal login path", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.LOGIN_MODO_DEMO = "true";
    process.env.DEMO_DB_NOME = "marcon_demo";
    process.env.LOGIN_DEMO_CRACHAS = "1111,2222,3333";
    process.env.DATABASE_URL = "mysql://unused:unused@tidb.example:4000/marcon_demo";
    process.env.LOGIN_FACIAL_OBRIGATORIO = "true";
    vi.mocked(prisma.funcionario.findFirst).mockResolvedValue(admin as never);
    vi.mocked(prisma.adminTotpCredential.findUnique).mockResolvedValue({ enabledAt: new Date() } as never);

    const response = await POST(request("1000"));
    const data = await response.json();

    expect(response.status).toBe(202);
    expect(data.step).toBe("totp");
    expect(prisma.sessao.create).not.toHaveBeenCalled();
  });

  it("requires the signed one-use facial challenge for admins by default", async () => {
    process.env.LOGIN_FACIAL_OBRIGATORIO = "true";
    vi.mocked(prisma.funcionario.findFirst).mockResolvedValue(admin as never);

    const response = await POST(request("1000"));
    const data = await response.json();

    expect(response.status).toBe(202);
    expect(data.step).toBe("face");
    expect(typeof data.loginToken).toBe("string");
    expect(prisma.sessao.create).not.toHaveBeenCalled();
  });

  it("fails closed for an admin without a face template or TOTP", async () => {
    process.env.LOGIN_FACIAL_OBRIGATORIO = "true";
    vi.mocked(prisma.funcionario.findFirst).mockResolvedValue(admin as never);
    vi.mocked(prisma.faceTemplate.count).mockResolvedValue(0);

    const response = await POST(request("1000"));

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: expect.stringContaining("habilitar o TOTP"),
    });
    expect(prisma.sessao.create).not.toHaveBeenCalled();
    expect(prisma.authChallenge.create).not.toHaveBeenCalled();
  });

  it("routes an admin without a face template to configured TOTP", async () => {
    process.env.LOGIN_FACIAL_OBRIGATORIO = "true";
    vi.mocked(prisma.funcionario.findFirst).mockResolvedValue(admin as never);
    vi.mocked(prisma.adminTotpCredential.findUnique).mockResolvedValue({ enabledAt: new Date() } as never);
    vi.mocked(prisma.faceTemplate.count).mockResolvedValue(0);

    const response = await POST(request("1000"));
    const data = await response.json();

    expect(response.status).toBe(202);
    expect(data.step).toBe("totp");
    expect(prisma.sessao.create).not.toHaveBeenCalled();
  });

  it("returns one generic invalid-code response for malformed and unknown codes", async () => {
    vi.mocked(prisma.funcionario.findFirst).mockResolvedValue(null);

    const response = await POST(request("12 x"));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Código inválido." });
    expect(prisma.funcionario.findFirst).toHaveBeenCalledWith({ where: { cracha: "__INVALID_BADGE__" } });
    expect(prisma.sessao.create).not.toHaveBeenCalled();
  });

  it("does not authenticate inactive employees", async () => {
    vi.mocked(prisma.funcionario.findFirst).mockResolvedValue({ ...admin, ativo: false } as never);

    const response = await POST(request("1000"));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Código inválido." });
    expect(prisma.sessao.create).not.toHaveBeenCalled();
  });

  it("keeps the persistent attempt lock active even for allowlisted test badges", async () => {
    process.env.LOGIN_MODO_TESTE = "true";
    process.env.LOGIN_TESTE_CRACHAS = "2000";
    vi.mocked(prisma.loginAttemptBucket.findFirst).mockResolvedValue({ blockedUntil: new Date(Date.now() + 60_000) } as never);

    const response = await POST(request("1000"));

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBeTruthy();
    expect(prisma.funcionario.findFirst).not.toHaveBeenCalled();
  });

  it("enforces a local per-badge and per-IP lock for allowlisted test logins without the migration table", async () => {
    process.env.LOGIN_MODO_TESTE = "true";
    process.env.LOGIN_TESTE_CRACHAS = "2000";
    const blockedRequest = request("2000", "192.0.2.55");
    const ipHash = getLoginClientIpHash(blockedRequest);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      recordTestLoginFailure("2000", ipHash);
    }

    const response = await POST(blockedRequest);

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("900");
    expect(prisma.loginAttemptBucket.findFirst).not.toHaveBeenCalled();
    expect(prisma.funcionario.findFirst).not.toHaveBeenCalled();
  });

  it("normalizes full-width badge digits before both lookup and failure accounting", async () => {
    vi.mocked(prisma.funcionario.findFirst).mockResolvedValue(null);

    const response = await POST(request(" １２３４ "));

    expect(response.status).toBe(401);
    expect(prisma.funcionario.findFirst).toHaveBeenCalledWith({ where: { cracha: "1234" } });
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);
  });

  it("fails closed with a controlled 503 when the required throttling table is absent", async () => {
    vi.mocked(prisma.loginAttemptBucket.findFirst).mockRejectedValue({ code: "P2021" });

    const response = await POST(request("1234"));

    expect(response.status).toBe(503);
    expect((await response.json()).error).toContain("temporariamente indisponível");
    expect(prisma.funcionario.findFirst).not.toHaveBeenCalled();
  });

  it("does not create a session if the employee becomes inactive during login", async () => {
    vi.mocked(prisma.funcionario.findFirst)
      .mockResolvedValueOnce(operator as never)
      .mockResolvedValueOnce(null);

    const response = await POST(request("2000"));

    expect(response.status).toBe(401);
    expect(prisma.sessao.create).not.toHaveBeenCalled();
  });
});
