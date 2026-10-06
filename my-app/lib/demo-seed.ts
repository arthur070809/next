import { createHash, randomBytes } from "node:crypto";
import {
  PapelFuncionario,
  Prisma,
  PrismaClient,
  Prioridade,
  StatusItemRequisicao,
  StatusRequisicao,
  TipoItem,
  TipoMovimentacao,
} from "@/generated/prisma/client";
import {
  encodeIdempotencyMetadata,
  encodeItemDescription,
  type SetorRequisicao,
} from "@/lib/requisition-metadata";

export const demoLocations = [
  { slug: "estoque", nome: "Central" },
  { slug: "importados", nome: "Produtos Importados" },
] as const;

export const demoCatalog = [
  { codigo: "129", nome: "RODIZIO GLE 414 NPN-MM (4\" GIRAT.)", categoria: "Rodízio giratório", central: 34, importados: 8, pontoPedido: 10 },
  { codigo: "128", nome: "RODIZIO FLE 312 NPP (3\" FIXA) - MM", categoria: "Rodízio fixo", central: 28, importados: 6, pontoPedido: 8 },
  { codigo: "127", nome: "RODIZIO GLE 312 NPP (3\" GIRAT.) - MM", categoria: "Rodízio giratório", central: 21, importados: 5, pontoPedido: 8 },
  { codigo: "173", nome: "GARFO GGMS 3508 R (GARFO GIRATORIO)", categoria: "Garfo giratório", central: 12, importados: 4, pontoPedido: 5 },
  { codigo: "7988", nome: "GARFO GGMX 62 (PLATAFORMA ELEVADOR)", categoria: "Garfo para plataforma elevador", central: 7, importados: 1, pontoPedido: 7 },
  { codigo: "17940", nome: "GUIA DE FERRO FUNDIDO N° 06", categoria: "Guia de ferro fundido", central: 6, importados: 2, pontoPedido: 7 },
  { codigo: "1794", nome: "PNEU MACICO 8\"", categoria: "Pneu maciço", central: 30, importados: 0, pontoPedido: 10 },
  { codigo: "1796", nome: "PNEU MACICO 10\"", categoria: "Pneu maciço", central: 18, importados: 6, pontoPedido: 8 },
  { codigo: "1795", nome: "PNEU MACICO 9\"", categoria: "Pneu maciço", central: 16, importados: 4, pontoPedido: 8 },
  { codigo: "5746", nome: "RODA BORRACHA 9200 BIN 3/4 (9\")", categoria: "Roda de borracha", central: 5, importados: 1, pontoPedido: 5 },
] as const;

const demoEmployees = [
  { cracha: "1111", nome: "Demo Operador", email: "demo-operador@local.invalid", cargo: "Operador de demonstração", papel: PapelFuncionario.OPERADOR },
  { cracha: "2222", nome: "Demo Almoxarife", email: "demo-almoxarife@local.invalid", cargo: "Almoxarife de demonstração", papel: PapelFuncionario.ALMOXARIFE },
  { cracha: "3333", nome: "Demo Administrador", email: "demo-administrador@local.invalid", cargo: "Administrador de demonstração", papel: PapelFuncionario.ADMIN },
] as const;

type SeedRequest = {
  numeroPedido: string;
  daysAgo: number;
  solicitanteCracha: string;
  atendenteCracha?: string;
  status: StatusRequisicao;
  prioridade: Prioridade;
  observation?: string;
  items: Array<{
    codigo: string;
    quantidade: number;
    status: StatusItemRequisicao;
    separado: boolean | null;
    setor: SetorRequisicao;
  }>;
};

export const demoSeedRequests: SeedRequest[] = [
  {
    numeroPedido: "DEMO-000101",
    daysAgo: 24,
    solicitanteCracha: "1111",
    status: StatusRequisicao.CONCLUIDA,
    prioridade: Prioridade.PADRAO,
    items: [
      { codigo: "129", quantidade: 2, status: StatusItemRequisicao.SEPARADO, separado: true, setor: "setor1" },
      { codigo: "1794", quantidade: 1, status: StatusItemRequisicao.SEPARADO, separado: true, setor: "setor2" },
    ],
  },
  {
    numeroPedido: "DEMO-000102",
    daysAgo: 11,
    solicitanteCracha: "1111",
    status: StatusRequisicao.CONCLUIDA,
    prioridade: Prioridade.PADRAO,
    items: [
      { codigo: "173", quantidade: 2, status: StatusItemRequisicao.SEPARADO, separado: true, setor: "setor2" },
      { codigo: "1796", quantidade: 2, status: StatusItemRequisicao.SEPARADO, separado: true, setor: "setor3" },
    ],
  },
  {
    numeroPedido: "DEMO-000103",
    daysAgo: 3,
    solicitanteCracha: "1111",
    status: StatusRequisicao.CONCLUIDA,
    prioridade: Prioridade.PADRAO,
    items: [
      { codigo: "128", quantidade: 3, status: StatusItemRequisicao.SEPARADO, separado: true, setor: "setor1" },
      { codigo: "5746", quantidade: 1, status: StatusItemRequisicao.SEPARADO, separado: true, setor: "setor3" },
    ],
  },
  {
    numeroPedido: "DEMO-000104",
    daysAgo: 0,
    solicitanteCracha: "1111",
    status: StatusRequisicao.PENDENTE,
    prioridade: Prioridade.PADRAO,
    items: [
      { codigo: "129", quantidade: 2, status: StatusItemRequisicao.PENDENTE, separado: null, setor: "setor1" },
      { codigo: "128", quantidade: 1, status: StatusItemRequisicao.PENDENTE, separado: null, setor: "setor2" },
    ],
  },
  {
    numeroPedido: "DEMO-000105",
    daysAgo: 0,
    solicitanteCracha: "1111",
    status: StatusRequisicao.PENDENTE,
    prioridade: Prioridade.PRIORITARIO,
    observation: "Solicitação prioritária aguardando análise.",
    items: [
      { codigo: "127", quantidade: 1, status: StatusItemRequisicao.PENDENTE, separado: null, setor: "setor2" },
      { codigo: "1794", quantidade: 1, status: StatusItemRequisicao.PENDENTE, separado: null, setor: "setor3" },
    ],
  },
  {
    numeroPedido: "DEMO-000106",
    daysAgo: 0,
    solicitanteCracha: "1111",
    atendenteCracha: "2222",
    status: StatusRequisicao.ASSUMIDA,
    prioridade: Prioridade.PADRAO,
    items: [
      { codigo: "173", quantidade: 2, status: StatusItemRequisicao.ASSUMIDO, separado: null, setor: "setor1" },
      { codigo: "1796", quantidade: 1, status: StatusItemRequisicao.ASSUMIDO, separado: null, setor: "setor3" },
    ],
  },
];

function deterministicId(value: string): string {
  const bytes = createHash("sha256").update(`marcon-demo:${value}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function daysAgo(value: number): Date {
  return new Date(Date.now() - value * 24 * 60 * 60 * 1000);
}

function seedRequestObservation(request: SeedRequest): string {
  const keyHash = createHash("sha256").update(`demo-seed:key:${request.numeroPedido}`).digest("hex");
  const payloadHash = createHash("sha256").update(JSON.stringify(request)).digest("hex");
  return encodeIdempotencyMetadata(request.observation, keyHash, payloadHash);
}

export function getDemoSeedRequestObservation(numeroPedido: string): string {
  const request = demoSeedRequests.find((entry) => entry.numeroPedido === numeroPedido);
  if (!request) throw new Error(`Requisição demo ${numeroPedido} não existe no fixture.`);
  return seedRequestObservation(request);
}

async function generatedPasswordHash(): Promise<string> {
  const bcrypt = await import("bcryptjs");
  return bcrypt.default.hash(randomBytes(32).toString("hex"), 12);
}

async function upsertEmployees(tx: Prisma.TransactionClient) {
  const badges = demoEmployees.map(({ cracha }) => cracha);
  const emails = demoEmployees.map(({ email }) => email);
  const existing = await tx.funcionario.findMany({
    where: { OR: [{ cracha: { in: badges } }, { email: { in: emails } }] },
    select: { cracha: true, email: true, nome: true },
  });
  for (const employee of existing) {
    const expected = demoEmployees.find(({ cracha, email }) =>
      cracha === employee.cracha || email === employee.email,
    );
    if (!expected || expected.cracha !== employee.cracha || expected.email !== employee.email ||
      !employee.nome.startsWith("Demo ")) {
      throw new Error("Um crachá ou e-mail do seed já pertence a uma conta que não é Demo; nenhuma alteração foi aplicada.");
    }
  }

  const employeeIds = new Map<string, number>();
  for (const employee of demoEmployees) {
    const row = await tx.funcionario.upsert({
      where: { cracha: employee.cracha },
      create: {
        ...employee,
        senha: await generatedPasswordHash(),
        ativo: true,
        mustChangePassword: false,
      },
      update: {
        nome: employee.nome,
        email: employee.email,
        cargo: employee.cargo,
        papel: employee.papel,
        ativo: true,
        mustChangePassword: false,
      },
      select: { id: true },
    });
    employeeIds.set(employee.cracha, row.id);
  }
  return employeeIds;
}

async function upsertCatalog(tx: Prisma.TransactionClient, initializeBalances: boolean) {
  const locations = new Map<string, string>();
  const balances = new Map<string, string>();
  for (const location of demoLocations) {
    const row = await tx.localEstoque.upsert({
      where: { slug: location.slug },
      create: { ...location, ativo: true },
      update: { nome: location.nome, ativo: true },
    });
    locations.set(location.slug, row.id);
  }

  const items = new Map<string, { id: string; unit: string }>();
  for (const fixture of demoCatalog) {
    const item = await tx.item.upsert({
      where: { filial_codigo: { filial: "DEMO", codigo: fixture.codigo } },
      create: {
        nome: fixture.nome,
        categoria: fixture.categoria,
        unidade: "unidades",
        tipoUnidade: "unidade",
        quantidadePorEmbalagem: 1,
        tipoItem: TipoItem.COMPONENTE,
        codigo: fixture.codigo,
        filial: "DEMO",
        grupoErp: null,
        pontoPedido: fixture.pontoPedido,
        estoqueSeguranca: 0,
        bloqueadoCompra: false,
        ativo: true,
      },
      update: {
        nome: fixture.nome,
        categoria: fixture.categoria,
        unidade: "unidades",
        tipoUnidade: "unidade",
        quantidadePorEmbalagem: 1,
        tipoItem: TipoItem.COMPONENTE,
        pontoPedido: fixture.pontoPedido,
        estoqueSeguranca: 0,
        bloqueadoCompra: false,
        ativo: true,
      },
      select: { id: true, unidade: true },
    });
    items.set(fixture.codigo, { id: item.id, unit: item.unidade });
    for (const [slug, quantity] of [
      ["estoque", fixture.central],
      ["importados", fixture.importados],
    ] as const) {
      const localId = locations.get(slug);
      if (!localId) throw new Error(`Local de estoque ${slug} não foi criado.`);
      const balance = await tx.saldoEstoque.upsert({
        where: { itemId_localId: { itemId: item.id, localId } },
        create: {
          itemId: item.id,
          localId,
          quantidade: quantity,
          reservada: 0,
        },
        update: initializeBalances ? { quantidade: quantity, reservada: 0 } : {},
        select: { id: true },
      });
      balances.set(`${fixture.codigo}:${slug}`, balance.id);
    }
  }
  return { locations, items, balances };
}

export async function upsertSeedRequest(
  tx: Prisma.TransactionClient,
  request: SeedRequest,
  employees: Map<string, number>,
  items: Map<string, { id: string; unit: string }>,
  stockLocationId: string,
) {
  const solicitanteId = employees.get(request.solicitanteCracha);
  const atendenteId = request.atendenteCracha
    ? employees.get(request.atendenteCracha)
    : undefined;
  if (!solicitanteId || (request.atendenteCracha && !atendenteId)) {
    throw new Error(`Funcionário do fixture ${request.numeroPedido} não foi encontrado.`);
  }
  const createdAt = daysAgo(request.daysAgo);
  const requisicaoId = deterministicId(`request:${request.numeroPedido}`);
  const requisicao = await tx.requisicao.upsert({
    where: { numeroPedido: request.numeroPedido },
    create: {
      id: requisicaoId,
      numeroPedido: request.numeroPedido,
      status: request.status,
      prioridade: request.prioridade,
      observacao: seedRequestObservation(request),
      solicitanteId,
      atendenteId: atendenteId ?? null,
      criadoEm: createdAt,
      assumidaEm: request.status === StatusRequisicao.ASSUMIDA ? createdAt : null,
      concluidaEm: request.status === StatusRequisicao.CONCLUIDA ? createdAt : null,
    },
    update: {},
    select: { id: true },
  });
  const requestItems = [];
  for (const fixtureItem of request.items) {
    const catalogItem = items.get(fixtureItem.codigo);
    if (!catalogItem) throw new Error(`Item ${fixtureItem.codigo} ausente no catálogo demo.`);
    const id = deterministicId(`request-item:${request.numeroPedido}:${fixtureItem.codigo}`);
    const requisitionItem = await tx.requisicaoItem.upsert({
      where: { id },
      create: {
        id,
        requisicaoId: requisicao.id,
        itemId: catalogItem.id,
        localId: stockLocationId,
        quantidade: fixtureItem.quantidade,
        unidadeMedida: "UN",
        descricao: encodeItemDescription(undefined, fixtureItem.setor),
        status: fixtureItem.status,
        separado: fixtureItem.separado,
        resolvidoEm: request.status === StatusRequisicao.CONCLUIDA ? createdAt : null,
      },
      update: {},
      select: { id: true },
    });
    requestItems.push({ ...fixtureItem, itemId: catalogItem.id, requisitionItemId: requisitionItem.id });
  }
  return { requisicaoId: requisicao.id, createdAt, solicitanteId, atendenteId, items: requestItems };
}

async function createSeedMovements(
  tx: Prisma.TransactionClient,
  locations: Map<string, string>,
  items: Map<string, { id: string; unit: string }>,
  stockBalances: Map<string, string>,
  employeeIds: Map<string, number>,
) {
  const centralId = locations.get("estoque");
  if (!centralId) throw new Error("Local Central não foi criado.");
  const endingBalance = new Map<string, number>(
    demoCatalog.map(({ codigo, central }) => [codigo, central]),
  );
  for (const request of demoSeedRequests.filter(({ status }) => status === StatusRequisicao.CONCLUIDA)) {
    for (const requestItem of request.items) {
      endingBalance.set(
        requestItem.codigo,
        (endingBalance.get(requestItem.codigo) ?? 0) + requestItem.quantidade,
      );
    }
  }
  const balances = new Map(endingBalance);
  const reservations = new Map<string, number>();

  for (const request of demoSeedRequests) {
    const seed = await upsertSeedRequest(tx, request, employeeIds, items, centralId);
    for (const requestItem of seed.items) {
      const saldoId = stockBalances.get(`${requestItem.codigo}:estoque`);
      if (!saldoId) throw new Error(`Saldo do item ${requestItem.codigo} não foi criado.`);
      if (request.status === StatusRequisicao.CONCLUIDA) {
        const current = balances.get(requestItem.codigo)!;
        const postReservation = current;
        const postIssue = current - requestItem.quantidade;
        const reserveId = deterministicId(`movement:reserve:${request.numeroPedido}:${requestItem.codigo}`);
        const issueId = deterministicId(`movement:issue:${request.numeroPedido}:${requestItem.codigo}`);
        const reservedMovement = {
          tipo: TipoMovimentacao.RESERVA,
          quantidade: requestItem.quantidade,
          saldoApos: postReservation,
          reservadaApos: requestItem.quantidade,
          funcionarioId: seed.solicitanteId,
          saldoEstoqueId: saldoId,
          requisicaoId: seed.requisicaoId,
          requisicaoItemId: requestItem.requisitionItemId,
          observacao: `Reserva para ${request.numeroPedido}`,
          criadoEm: new Date(seed.createdAt.getTime() + 1000),
        };
        const issueMovement = {
          tipo: TipoMovimentacao.SAIDA,
          quantidade: requestItem.quantidade,
          saldoApos: postIssue,
          reservadaApos: 0,
          funcionarioId: seed.atendenteId ?? employeeIds.get("2222")!,
          saldoEstoqueId: saldoId,
          requisicaoId: seed.requisicaoId,
          requisicaoItemId: requestItem.requisitionItemId,
          observacao: `Saída por separação ${request.numeroPedido}`,
          criadoEm: new Date(seed.createdAt.getTime() + 2000),
        };
        await tx.movimentacao.upsert({
          where: { id: reserveId },
          create: { id: reserveId, ...reservedMovement },
          update: {},
        });
        await tx.movimentacao.upsert({
          where: { id: issueId },
          create: { id: issueId, ...issueMovement },
          update: {},
        });
        balances.set(requestItem.codigo, postIssue);
      } else {
        const previousReserved = reservations.get(requestItem.codigo) ?? 0;
        const currentReserved = previousReserved + requestItem.quantidade;
        reservations.set(requestItem.codigo, currentReserved);
        const reserveId = deterministicId(`movement:reserve:${request.numeroPedido}:${requestItem.codigo}`);
        await tx.movimentacao.upsert({
          where: { id: reserveId },
          create: {
            id: reserveId,
            tipo: TipoMovimentacao.RESERVA,
            quantidade: requestItem.quantidade,
            saldoApos: demoCatalog.find(({ codigo }) => codigo === requestItem.codigo)!.central,
            reservadaApos: currentReserved,
            funcionarioId: seed.solicitanteId,
            saldoEstoqueId: saldoId,
            requisicaoId: seed.requisicaoId,
            requisicaoItemId: requestItem.requisitionItemId,
            observacao: `Reserva para ${request.numeroPedido}`,
            criadoEm: seed.createdAt,
          },
          update: {},
        });
      }
    }
  }

  for (const [codigo, reservada] of reservations) {
    const item = items.get(codigo)!;
    await tx.saldoEstoque.update({
      where: { itemId_localId: { itemId: item.id, localId: centralId } },
      data: { reservada },
    });
  }
}

async function populateDemoData(tx: Prisma.TransactionClient) {
  const existingFixture = await tx.requisicao.findUnique({
    where: { numeroPedido: "DEMO-000101" },
    select: { id: true },
  });
  if (existingFixture && existingFixture.id !== deterministicId("request:DEMO-000101")) {
    throw new Error("O número de requisição reservado ao fixture já está ocupado; nenhuma alteração foi aplicada.");
  }
  if (!existingFixture) {
    const [requestCount, movementCount] = await Promise.all([
      tx.requisicao.count(),
      tx.movimentacao.count(),
    ]);
    if (requestCount > 0 || movementCount > 0) {
      throw new Error("O banco já contém dados operacionais; execute reset:demo explicitamente para iniciar o fixture.");
    }
  }

  const employeeIds = await upsertEmployees(tx);
  const { locations, items, balances } = await upsertCatalog(tx, !existingFixture);
  if (existingFixture) return { initialized: false, preservedExistingDemo: true };

  await createSeedMovements(tx, locations, items, balances, employeeIds);
  return { initialized: true, preservedExistingDemo: false };
}

export async function seedDemoData(client: PrismaClient) {
  return client.$transaction((tx) => populateDemoData(tx), { isolationLevel: "Serializable" });
}

export async function resetAndSeedDemoData(client: PrismaClient) {
  return client.$transaction(async (tx) => {
    await tx.movimentacao.deleteMany();
    await tx.requisicao.deleteMany();
    await tx.auditoria.deleteMany({ where: { acao: { startsWith: "REQUISICAO_" } } });
    await tx.saldoEstoque.updateMany({ data: { quantidade: 0, reservada: 0 } });
    await tx.loginAttemptBucket.deleteMany();
    return populateDemoData(tx);
  }, { isolationLevel: "Serializable" });
}

export function deterministicDemoId(value: string) {
  return deterministicId(value);
}
