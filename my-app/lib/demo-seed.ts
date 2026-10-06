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
  const initialCentralBalance = new Map(
    demoCatalog.map(({ codigo, central }) => [
      codigo,
      central + demoSeedRequests
        .filter(({ status }) => status === StatusRequisicao.CONCLUIDA)
        .flatMap(({ items: requestItems }) => requestItems)
        .filter(({ codigo: itemCode }) => itemCode === codigo)
        .reduce((sum, { quantidade }) => sum + quantidade, 0),
    ]),
  );
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
          quantidade: slug === "estoque" ? initialCentralBalance.get(fixture.codigo)! : quantity,
          reservada: 0,
        },
        update: initializeBalances
          ? { quantidade: slug === "estoque" ? initialCentralBalance.get(fixture.codigo)! : quantity, reservada: 0 }
          : {},
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
  if (typeof requisicao?.id !== "string" || !requisicao.id ||
    requisicao.id !== requisicaoId) {
    const codigo = request.items[0]?.codigo ?? "desconhecido";
    throw new Error(`Requisição ${request.numeroPedido}, item ${codigo}: id da requisição pai não resolvido ou divergente.`);
  }
  const requestItems: Array<SeedRequest["items"][number] & {
    itemId: string;
    requisitionItemId: string;
  }> = [];
  const itemRows: Prisma.RequisicaoItemCreateManyInput[] = [];
  for (const fixtureItem of request.items) {
    const catalogItem = items.get(fixtureItem.codigo);
    if (!catalogItem?.id || !stockLocationId) {
      throw new Error(`Requisição ${request.numeroPedido}, item ${fixtureItem.codigo}: item de catálogo ou local não resolvido.`);
    }
    const id = deterministicId(`request-item:${request.numeroPedido}:${fixtureItem.codigo}`);
    itemRows.push({
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
    });
    requestItems.push({ ...fixtureItem, itemId: catalogItem.id, requisitionItemId: id });
  }
  await tx.requisicaoItem.createMany({ data: itemRows, skipDuplicates: true });
  return { requisicaoId: requisicao.id, createdAt, solicitanteId, atendenteId, items: requestItems };
}

export type DemoSeedInvariantSnapshot = {
  stocks: Array<{
    id: string;
    itemId: string;
    codigo: string;
    localId: string;
    slug: string;
    quantidade: number;
    reservada: number;
  }>;
  movements: Array<{
    saldoEstoqueId: string;
    tipo: string;
    quantidade: number;
    saldoApos: number;
  }>;
  requests: Array<{
    numeroPedido: string;
    status: string;
    prioridade: string;
    itens: Array<{ itemId: string; localId: string; quantidade: number }>;
  }>;
};

export function assertDemoSeedInvariants(snapshot: DemoSeedInvariantSnapshot) {
  const expectedNumbers = new Set(demoSeedRequests.map(({ numeroPedido }) => numeroPedido));
  if (snapshot.requests.length !== demoSeedRequests.length ||
    snapshot.requests.some(({ numeroPedido }) => !expectedNumbers.has(numeroPedido))) {
    throw new Error("Invariante demo: contagem de requisições diferente do fixture.");
  }

  const statusCounts = snapshot.requests.reduce<Record<string, number>>((counts, request) => {
    counts[request.status] = (counts[request.status] ?? 0) + 1;
    return counts;
  }, {});
  const pendingPriority = snapshot.requests.filter((request) =>
    request.status === StatusRequisicao.PENDENTE && request.prioridade === Prioridade.PRIORITARIO,
  ).length;
  if (statusCounts[StatusRequisicao.CONCLUIDA] !== 3 ||
    statusCounts[StatusRequisicao.PENDENTE] !== 2 ||
    statusCounts[StatusRequisicao.ASSUMIDA] !== 1 || pendingPriority !== 1) {
    throw new Error("Invariante demo: contagem de status/prioridade das requisições divergente.");
  }

  const reservations = new Map<string, number>();
  for (const request of snapshot.requests) {
    if (request.itens.length === 0) {
      throw new Error(`Invariante demo: requisição ${request.numeroPedido} sem itens.`);
    }
    if (request.status === StatusRequisicao.PENDENTE || request.status === StatusRequisicao.ASSUMIDA) {
      for (const item of request.itens) {
        const key = `${item.itemId}:${item.localId}`;
        reservations.set(key, (reservations.get(key) ?? 0) + item.quantidade);
      }
    }
  }

  if (snapshot.stocks.length !== demoCatalog.length * demoLocations.length) {
    throw new Error("Invariante demo: conjunto de saldos não corresponde ao catálogo/localidades do fixture.");
  }
  const movementsByStock = new Map<string, DemoSeedInvariantSnapshot["movements"]>();
  for (const movement of snapshot.movements) {
    const list = movementsByStock.get(movement.saldoEstoqueId) ?? [];
    list.push(movement);
    movementsByStock.set(movement.saldoEstoqueId, list);
  }
  for (const stock of snapshot.stocks) {
    const movementRows = movementsByStock.get(stock.id) ?? [];
    if (movementRows.length === 0 || movementRows[0].tipo !== TipoMovimentacao.ENTRADA ||
      movementRows[0].quantidade !== movementRows[0].saldoApos) {
      throw new Error(`Invariante demo: saldo ${stock.codigo} sem movimentação inicial coerente.`);
    }
    let previous = movementRows[0].saldoApos;
    for (const movement of movementRows.slice(1)) {
      let expected = previous;
      if (movement.tipo === TipoMovimentacao.ENTRADA) expected += movement.quantidade;
      if (movement.tipo === TipoMovimentacao.SAIDA) expected -= movement.quantidade;
      if (movement.tipo === TipoMovimentacao.AJUSTE) {
        if (movement.quantidade !== Math.abs(movement.saldoApos - previous)) {
          throw new Error(`Invariante demo: ajuste incoerente para o saldo ${stock.codigo}.`);
        }
        expected = movement.saldoApos;
      }
      if (movement.saldoApos !== expected) {
        throw new Error(`Invariante demo: saldo ${stock.codigo} não reconcilia com movimentações.`);
      }
      previous = movement.saldoApos;
    }
    if (previous !== stock.quantidade) {
      throw new Error(`Invariante demo: saldo ${stock.codigo} diverge da última movimentação.`);
    }
    if (stock.reservada !== (reservations.get(`${stock.itemId}:${stock.localId}`) ?? 0)) {
      throw new Error(`Invariante demo: reserva do item ${stock.codigo} diverge das requisições ativas.`);
    }
  }
}

async function readDemoSeedInvariantSnapshot(client: PrismaClient): Promise<DemoSeedInvariantSnapshot> {
  const [items, locations, requests] = await Promise.all([
    client.item.findMany({
      where: { filial: "DEMO", codigo: { in: demoCatalog.map(({ codigo }) => codigo) } },
      select: { id: true, codigo: true },
    }),
    client.localEstoque.findMany({
      where: { slug: { in: demoLocations.map(({ slug }) => slug) } },
      select: { id: true, slug: true },
    }),
    client.requisicao.findMany({
      where: { numeroPedido: { in: demoSeedRequests.map(({ numeroPedido }) => numeroPedido) } },
      select: {
        numeroPedido: true,
        status: true,
        prioridade: true,
        itens: { select: { itemId: true, localId: true, quantidade: true } },
      },
    }),
  ]);
  const itemCodes = new Map(items.map(({ id, codigo }) => [id, codigo]));
  const locationSlugs = new Map(locations.map(({ id, slug }) => [id, slug]));
  const stocks = await client.saldoEstoque.findMany({
    where: {
      itemId: { in: items.map(({ id }) => id) },
      localId: { in: locations.map(({ id }) => id) },
    },
    select: {
      id: true,
      itemId: true,
      localId: true,
      quantidade: true,
      reservada: true,
    },
  });
  const movements = await client.movimentacao.findMany({
    where: { saldoEstoqueId: { in: stocks.map(({ id }) => id) } },
    orderBy: [{ criadoEm: "asc" }, { id: "asc" }],
    select: { saldoEstoqueId: true, tipo: true, quantidade: true, saldoApos: true },
  });
  return {
    stocks: stocks.map((stock) => ({
      ...stock,
      codigo: itemCodes.get(stock.itemId) ?? "desconhecido",
      slug: locationSlugs.get(stock.localId) ?? "desconhecido",
    })),
    movements,
    requests,
  };
}

async function createOpeningMovements(
  tx: Prisma.TransactionClient,
  locations: Map<string, string>,
  items: Map<string, { id: string; unit: string }>,
  stockBalances: Map<string, string>,
  employeeIds: Map<string, number>,
) {
  const adminId = employeeIds.get("3333");
  if (!adminId) throw new Error("Funcionário demo administrador não foi resolvido para o saldo inicial.");
  const createdAt = daysAgo(32);
  const movements: Prisma.MovimentacaoCreateManyInput[] = [];
  for (const fixture of demoCatalog) {
    for (const [slug, quantity] of [
      ["estoque", fixture.central + demoSeedRequests
        .filter(({ status }) => status === StatusRequisicao.CONCLUIDA)
        .flatMap(({ items: requestItems }) => requestItems)
        .filter(({ codigo }) => codigo === fixture.codigo)
        .reduce((sum, { quantidade: count }) => sum + count, 0)],
      ["importados", fixture.importados],
    ] as const) {
      const item = items.get(fixture.codigo);
      const localId = locations.get(slug);
      const saldoId = stockBalances.get(`${fixture.codigo}:${slug}`);
      if (!item?.id || !localId || !saldoId) {
        throw new Error(`Saldo inicial demo não resolvido para item ${fixture.codigo} no local ${slug}.`);
      }
      movements.push({
        id: deterministicId(`movement:opening:${fixture.codigo}:${slug}`),
        tipo: TipoMovimentacao.ENTRADA,
        quantidade: quantity,
        saldoApos: quantity,
        reservadaApos: 0,
        funcionarioId: adminId,
        saldoEstoqueId: saldoId,
        observacao: `Saldo inicial do fixture demo: ${fixture.codigo}`,
        criadoEm: createdAt,
      });
    }
  }
  await tx.movimentacao.createMany({ data: movements, skipDuplicates: true });
}

async function createSeedMovements(
  client: PrismaClient,
  locations: Map<string, string>,
  items: Map<string, { id: string; unit: string }>,
  stockBalances: Map<string, string>,
  employeeIds: Map<string, number>,
) {
  const centralId = locations.get("estoque");
  if (!centralId) throw new Error("Local Central não foi criado.");
  const runningBalances = new Map<string, number>();
  const reservations = new Map<string, number>();
  for (const request of demoSeedRequests.filter(({ status }) => status === StatusRequisicao.CONCLUIDA)) {
    for (const requestItem of request.items) {
      runningBalances.set(
        requestItem.codigo,
        (runningBalances.get(requestItem.codigo) ?? 0) + requestItem.quantidade,
      );
    }
  }
  for (const fixture of demoCatalog) {
    runningBalances.set(fixture.codigo, (runningBalances.get(fixture.codigo) ?? 0) + fixture.central);
  }

  for (const request of demoSeedRequests) {
    let step = "requisicao e itens";
    try {
      await client.$transaction(async (tx) => {
        const seed = await upsertSeedRequest(tx, request, employeeIds, items, centralId);
        const movements: Prisma.MovimentacaoCreateManyInput[] = [];
        const completedById = seed.atendenteId ?? employeeIds.get("2222");
        if (!completedById) {
          const codigo = request.items[0]?.codigo ?? "desconhecido";
          throw new Error(`Requisição ${request.numeroPedido}, item ${codigo}: atendente demo não resolvido.`);
        }
        for (const [itemIndex, requestItem] of seed.items.entries()) {
          const saldoId = stockBalances.get(`${requestItem.codigo}:estoque`);
          const item = items.get(requestItem.codigo);
          if (!saldoId || !item?.id) {
            throw new Error(`Requisição ${request.numeroPedido}, item ${requestItem.codigo}: saldo ou item não resolvido.`);
          }
          const before = runningBalances.get(requestItem.codigo);
          if (before === undefined) {
            throw new Error(`Requisição ${request.numeroPedido}, item ${requestItem.codigo}: saldo inicial não resolvido.`);
          }
          const reservedBefore = reservations.get(requestItem.codigo) ?? 0;
          const reservedAfter = request.status === StatusRequisicao.CONCLUIDA
            ? reservedBefore
            : reservedBefore + requestItem.quantidade;
          const reserveId = deterministicId(`movement:reserve:${request.numeroPedido}:${requestItem.codigo}`);
          movements.push({
            id: reserveId,
            tipo: TipoMovimentacao.RESERVA,
            quantidade: requestItem.quantidade,
            saldoApos: before,
            reservadaApos: request.status === StatusRequisicao.CONCLUIDA
              ? reservedBefore + requestItem.quantidade
              : reservedAfter,
            funcionarioId: seed.solicitanteId,
            saldoEstoqueId: saldoId,
            requisicaoId: seed.requisicaoId,
            requisicaoItemId: requestItem.requisitionItemId,
            observacao: `Reserva para ${request.numeroPedido}`,
            criadoEm: new Date(seed.createdAt.getTime() + itemIndex * 2),
          });
          if (request.status === StatusRequisicao.CONCLUIDA) {
            const after = before - requestItem.quantidade;
            movements.push({
              id: deterministicId(`movement:issue:${request.numeroPedido}:${requestItem.codigo}`),
              tipo: TipoMovimentacao.SAIDA,
              quantidade: requestItem.quantidade,
              saldoApos: after,
              reservadaApos: reservedBefore,
              funcionarioId: completedById,
              saldoEstoqueId: saldoId,
              requisicaoId: seed.requisicaoId,
              requisicaoItemId: requestItem.requisitionItemId,
              observacao: `Saída por separação ${request.numeroPedido}`,
              criadoEm: new Date(seed.createdAt.getTime() + itemIndex * 2 + 1),
            });
            runningBalances.set(requestItem.codigo, after);
          } else {
            reservations.set(requestItem.codigo, reservedAfter);
          }
          step = "movimentacoes e saldo reservado";
          await tx.saldoEstoque.update({
            where: { itemId_localId: { itemId: item.id, localId: centralId } },
            data: {
              quantidade: runningBalances.get(requestItem.codigo)!,
              reservada: reservedAfter,
            },
          });
        }
        await tx.movimentacao.createMany({ data: movements, skipDuplicates: true });
        step = "auditoria";
        const actorId = seed.atendenteId ?? seed.solicitanteId;
        await tx.auditoria.createMany({
          data: [{
            id: deterministicId(`audit:request:${request.numeroPedido}`),
            acao: "REQUISICAO_DEMO_SEEDED",
            alvoId: seed.solicitanteId,
            autorId: actorId,
            detalhes: `Fixture demo ${request.numeroPedido}; status ${request.status}.`,
            criadoEm: seed.createdAt,
          }],
          skipDuplicates: true,
        });
      }, {
        maxWait: 20_000,
        timeout: 60_000,
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      console.error(`[demo-seed] Falha na requisição ${request.numeroPedido}, etapa ${step}.`);
      throw error;
    }
  }
}

async function fixtureStatus(client: PrismaClient) {
  return client.requisicao.findMany({
    where: { numeroPedido: { in: demoSeedRequests.map(({ numeroPedido }) => numeroPedido) } },
    select: { numeroPedido: true },
  });
}

export async function seedDemoData(client: PrismaClient) {
  const existingRequests = await fixtureStatus(client);
  const [totalRequestCount, totalMovementCount] = await Promise.all([
    client.requisicao.count(),
    client.movimentacao.count(),
  ]);
  const demoOpeningIds = demoCatalog.flatMap(({ codigo }) =>
    demoLocations.map(({ slug }) => deterministicId(`movement:opening:${codigo}:${slug}`)),
  );
  const existingOpenings = await client.movimentacao.findMany({
    where: { id: { in: demoOpeningIds } },
    select: { id: true },
  });
  const isInitialSeed = existingRequests.length === 0 && existingOpenings.length === 0;
  if (existingRequests.length === 0 &&
    (totalRequestCount > 0 || totalMovementCount > 0)) {
    throw new Error("O banco já contém dados operacionais; execute reset:demo explicitamente para iniciar o fixture.");
  }

  const catalog = await client.$transaction(async (tx) => {
    const employeeIds = await upsertEmployees(tx);
    const stock = await upsertCatalog(tx, isInitialSeed);
    await createOpeningMovements(tx, stock.locations, stock.items, stock.balances, employeeIds);
    return { employeeIds, ...stock };
  }, {
    maxWait: 20_000,
    timeout: 60_000,
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });

  await createSeedMovements(
    client,
    catalog.locations,
    catalog.items,
    catalog.balances,
    catalog.employeeIds,
  );
  assertDemoSeedInvariants(await readDemoSeedInvariantSnapshot(client));
  return {
    initialized: existingRequests.length === 0,
    preservedExistingDemo: existingRequests.length > 0,
  };
}

export async function resetAndSeedDemoData(client: PrismaClient) {
  await client.$transaction(async (tx) => {
    await tx.movimentacao.deleteMany();
    await tx.requisicaoItem.deleteMany();
    await tx.requisicao.deleteMany();
    await tx.auditoria.deleteMany({ where: { acao: { startsWith: "REQUISICAO_" } } });
    await tx.loginAttemptBucket.deleteMany();
  }, {
    maxWait: 20_000,
    timeout: 60_000,
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });
  return seedDemoData(client);
}

export function deterministicDemoId(value: string) {
  return deterministicId(value);
}
