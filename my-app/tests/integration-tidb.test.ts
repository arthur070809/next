import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  PapelFuncionario,
  StatusRequisicao,
  StatusItemRequisicao,
  TipoMovimentacao,
} from "@/generated/prisma/client";
import {
  criarRequisicao,
  separarItem,
  naoSepararItem,
  liberarReserva,
} from "@/lib/requisicoes-db";

describe("TiDB Integration Tests — marcon_almoxarifado_test", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  // Limpeza controlada antes de cada teste
  beforeEach(async () => {
    await prisma.movimentacao.deleteMany();
    await prisma.auditoria.deleteMany();
    await prisma.requisicaoItem.deleteMany();
    await prisma.requisicao.deleteMany();
    await prisma.saldoEstoque.deleteMany();
    await prisma.item.deleteMany();
    await prisma.sessao.deleteMany();
    await prisma.funcionario.deleteMany();
    await prisma.localEstoque.deleteMany();
  });

  async function setupBaseData() {
    const local = await prisma.localEstoque.create({
      data: { slug: "estoque", nome: "Estoque Central", ativo: true },
    });

    const solicitante = await prisma.funcionario.create({
      data: {
        nome: "Operador Teste",
        email: "op.teste@marcon.com.br",
        cracha: "OP01",
        cargo: "Operador",
        papel: PapelFuncionario.OPERADOR,
        senha: "hash",
      },
    });

    const almoxarife = await prisma.funcionario.create({
      data: {
        nome: "Almoxarife Teste",
        email: "al.teste@marcon.com.br",
        cracha: "AL01",
        cargo: "Almoxarife",
        papel: PapelFuncionario.ALMOXARIFE,
        senha: "hash",
      },
    });

    const usuarioComum = await prisma.funcionario.create({
      data: {
        nome: "Usuario Comum",
        email: "user.teste@marcon.com.br",
        cracha: "US01",
        cargo: "Usuario",
        papel: PapelFuncionario.USUARIO,
        senha: "hash",
      },
    });

    return { local, solicitante, almoxarife, usuarioComum };
  }

  it("1. Criação com reserva: reserva a quantidade e grava Movimentacao do tipo RESERVA", async () => {
    const { local, solicitante } = await setupBaseData();

    const item = await prisma.item.create({
      data: { nome: "Broca de Aço Rápido 6mm", categoria: "Ferramentas", unidade: "unidades" },
    });

    await prisma.saldoEstoque.create({
      data: { itemId: item.id, localId: local.id, quantidade: 10, reservada: 0 },
    });

    const requisicao = await criarRequisicao({
      solicitanteId: solicitante.id,
      itens: [{ itemId: item.id, localId: local.id, quantidade: 4 }],
    });

    expect(requisicao.numeroPedido).toMatch(/^REQ-\d{6}$/);

    const saldo = await prisma.saldoEstoque.findUnique({
      where: { itemId_localId: { itemId: item.id, localId: local.id } },
    });
    expect(saldo?.quantidade).toBe(10);
    expect(saldo?.reservada).toBe(4);

    const mov = await prisma.movimentacao.findFirst({
      where: { requisicaoId: requisicao.id, tipo: TipoMovimentacao.RESERVA },
    });
    expect(mov).not.toBeNull();
    expect(mov?.quantidade).toBe(4);
    expect(mov?.saldoApos).toBe(10);
    expect(mov?.reservadaApos).toBe(4);
  });

  it("2. Estoque insuficiente: rejeita com erro (409) e rollback total sem criar nada", async () => {
    const { local, solicitante } = await setupBaseData();

    const item = await prisma.item.create({
      data: { nome: "Cabo de Aço 3/8", categoria: "Cabos", unidade: "metros" },
    });

    await prisma.saldoEstoque.create({
      data: { itemId: item.id, localId: local.id, quantidade: 5, reservada: 2 },
    });

    // Saldo disponível = 5 - 2 = 3. Tentamos pedir 4.
    await expect(
      criarRequisicao({
        solicitanteId: solicitante.id,
        itens: [{ itemId: item.id, localId: local.id, quantidade: 4 }],
      })
    ).rejects.toThrow(/Saldo insuficiente/i);

    // Garante rollback total: nada foi alterado
    const saldo = await prisma.saldoEstoque.findUnique({
      where: { itemId_localId: { itemId: item.id, localId: local.id } },
    });
    expect(saldo?.quantidade).toBe(5);
    expect(saldo?.reservada).toBe(2);

    const totalRequisicoes = await prisma.requisicao.count();
    expect(totalRequisicoes).toBe(0);

    const totalMovs = await prisma.movimentacao.count();
    expect(totalMovs).toBe(0);
  });

  it("3. Concorrência: N requisições paralelas pelo último item, exatamente uma vence", async () => {
    const { local, solicitante } = await setupBaseData();

    const item = await prisma.item.create({
      data: { nome: "Último Rolamento Raro 6204", categoria: "Rolamentos", unidade: "unidades" },
    });

    await prisma.saldoEstoque.create({
      data: { itemId: item.id, localId: local.id, quantidade: 1, reservada: 0 },
    });

    // 5 requisições paralelas disputando a única unidade
    const promises = Array.from({ length: 5 }).map(() =>
      criarRequisicao({
        solicitanteId: solicitante.id,
        itens: [{ itemId: item.id, localId: local.id, quantidade: 1 }],
      })
    );

    const results = await Promise.allSettled(promises);
    const sucessos = results.filter((r) => r.status === "fulfilled");
    const falhas = results.filter((r) => r.status === "rejected");

    expect(sucessos.length).toBe(1);
    expect(falhas.length).toBe(4);

    const saldo = await prisma.saldoEstoque.findUnique({
      where: { itemId_localId: { itemId: item.id, localId: local.id } },
    });
    expect(saldo?.quantidade).toBe(1);
    expect(saldo?.reservada).toBe(1);
  });

  it("4. Separação de item: baixa real (quantidade -= q, reservada -= q) e Movimentacao SAIDA", async () => {
    const { local, solicitante, almoxarife } = await setupBaseData();

    const item = await prisma.item.create({
      data: { nome: "Chave Fixa 10x11mm", categoria: "Ferramentas", unidade: "unidades" },
    });

    await prisma.saldoEstoque.create({
      data: { itemId: item.id, localId: local.id, quantidade: 20, reservada: 0 },
    });

    const requisicao = await criarRequisicao({
      solicitanteId: solicitante.id,
      itens: [{ itemId: item.id, localId: local.id, quantidade: 5 }],
    });

    const reqItemId = requisicao.itens[0].id;

    await prisma.$transaction(async (tx) => {
      const res = await separarItem({
        requisicaoItemId: reqItemId,
        funcionarioId: almoxarife.id,
        tx,
      });
      expect(res).toBe("ok");
    });

    const saldo = await prisma.saldoEstoque.findUnique({
      where: { itemId_localId: { itemId: item.id, localId: local.id } },
    });
    // Baixa real: 20 - 5 = 15; reservada: 5 - 5 = 0
    expect(saldo?.quantidade).toBe(15);
    expect(saldo?.reservada).toBe(0);

    const movSaida = await prisma.movimentacao.findFirst({
      where: {
        requisicaoItemId: reqItemId,
        tipo: TipoMovimentacao.SAIDA,
      },
    });
    expect(movSaida).not.toBeNull();
    expect(movSaida?.quantidade).toBe(5);
    expect(movSaida?.saldoApos).toBe(15);
    expect(movSaida?.reservadaApos).toBe(0);

    const itemDb = await prisma.requisicaoItem.findUnique({ where: { id: reqItemId } });
    expect(itemDb?.status).toBe(StatusItemRequisicao.SEPARADO);
    expect(itemDb?.separado).toBe(true);
  });

  it("5. Duplo clique em separar (idempotência): segunda chamada não baixa duas vezes", async () => {
    const { local, solicitante, almoxarife } = await setupBaseData();

    const item = await prisma.item.create({
      data: { nome: "Fita Isolante 3M", categoria: "Elétrica", unidade: "rolos" },
    });

    await prisma.saldoEstoque.create({
      data: { itemId: item.id, localId: local.id, quantidade: 10, reservada: 0 },
    });

    const req = await criarRequisicao({
      solicitanteId: solicitante.id,
      itens: [{ itemId: item.id, localId: local.id, quantidade: 2 }],
    });

    const reqItemId = req.itens[0].id;

    // Primeiro clique
    const r1 = await prisma.$transaction(async (tx) => {
      return separarItem({ requisicaoItemId: reqItemId, funcionarioId: almoxarife.id, tx });
    });
    expect(r1).toBe("ok");

    // Segundo clique (duplo clique / retry)
    const r2 = await prisma.$transaction(async (tx) => {
      return separarItem({ requisicaoItemId: reqItemId, funcionarioId: almoxarife.id, tx });
    });
    expect(r2).toBe("already_done");

    // O saldo deve ter sido baixado apenas uma vez: 10 - 2 = 8
    const saldo = await prisma.saldoEstoque.findUnique({
      where: { itemId_localId: { itemId: item.id, localId: local.id } },
    });
    expect(saldo?.quantidade).toBe(8);
    expect(saldo?.reservada).toBe(0);

    const saidas = await prisma.movimentacao.count({
      where: { requisicaoItemId: reqItemId, tipo: TipoMovimentacao.SAIDA },
    });
    expect(saidas).toBe(1);
  });

  it("6. Item não separado libera reserva e registra LIBERACAO_RESERVA com motivo", async () => {
    const { local, solicitante, almoxarife } = await setupBaseData();

    const item = await prisma.item.create({
      data: { nome: "Óleo Lubrificante ISO 68", categoria: "Lubrificantes", unidade: "litros" },
    });

    await prisma.saldoEstoque.create({
      data: { itemId: item.id, localId: local.id, quantidade: 30, reservada: 0 },
    });

    const req = await criarRequisicao({
      solicitanteId: solicitante.id,
      itens: [{ itemId: item.id, localId: local.id, quantidade: 6 }],
    });

    const reqItemId = req.itens[0].id;

    await prisma.$transaction(async (tx) => {
      await naoSepararItem({
        requisicaoItemId: reqItemId,
        motivo: "Embalagem danificada no transporte interno",
        funcionarioId: almoxarife.id,
        tx,
      });
    });

    const saldo = await prisma.saldoEstoque.findUnique({
      where: { itemId_localId: { itemId: item.id, localId: local.id } },
    });
    // Quantidade intacta (30), reserva liberada (0)
    expect(saldo?.quantidade).toBe(30);
    expect(saldo?.reservada).toBe(0);

    const movLib = await prisma.movimentacao.findFirst({
      where: { requisicaoItemId: reqItemId, tipo: TipoMovimentacao.LIBERACAO_RESERVA },
    });
    expect(movLib?.quantidade).toBe(6);
    expect(movLib?.observacao).toContain("Embalagem danificada");

    const itemDb = await prisma.requisicaoItem.findUnique({ where: { id: reqItemId } });
    expect(itemDb?.status).toBe(StatusItemRequisicao.NAO_SEPARADO);
    expect(itemDb?.motivoNaoAtendido).toBe("Embalagem danificada no transporte interno");
  });

  it("7. Anulação de requisição: libera a reserva de todos os itens", async () => {
    const { local, solicitante, almoxarife } = await setupBaseData();

    const itemA = await prisma.item.create({
      data: { nome: "Item Teste A", categoria: "Geral", unidade: "unidades" },
    });
    const itemB = await prisma.item.create({
      data: { nome: "Item Teste B", categoria: "Geral", unidade: "unidades" },
    });

    await prisma.saldoEstoque.create({
      data: { itemId: itemA.id, localId: local.id, quantidade: 10, reservada: 0 },
    });
    await prisma.saldoEstoque.create({
      data: { itemId: itemB.id, localId: local.id, quantidade: 10, reservada: 0 },
    });

    const req = await criarRequisicao({
      solicitanteId: solicitante.id,
      itens: [
        { itemId: itemA.id, localId: local.id, quantidade: 3 },
        { itemId: itemB.id, localId: local.id, quantidade: 4 },
      ],
    });

    await prisma.$transaction(async (tx) => {
      await liberarReserva({
        requisicaoId: req.id,
        funcionarioId: almoxarife.id,
        tx,
      });
      await tx.requisicao.update({
        where: { id: req.id },
        data: { status: StatusRequisicao.ANULADA },
      });
    });

    const saldoA = await prisma.saldoEstoque.findUnique({
      where: { itemId_localId: { itemId: itemA.id, localId: local.id } },
    });
    const saldoB = await prisma.saldoEstoque.findUnique({
      where: { itemId_localId: { itemId: itemB.id, localId: local.id } },
    });

    expect(saldoA?.reservada).toBe(0);
    expect(saldoB?.reservada).toBe(0);

    const movs = await prisma.movimentacao.findMany({
      where: { requisicaoId: req.id, tipo: TipoMovimentacao.LIBERACAO_RESERVA },
    });
    expect(movs.length).toBe(2);
  });

  it("8. Invariantes de consistência: saldo nunca negativo e reservada <= quantidade", async () => {
    const { local, solicitante, almoxarife } = await setupBaseData();

    const item = await prisma.item.create({
      data: { nome: "Válvula de Retenção 1/2", categoria: "Hidráulica", unidade: "unidades" },
    });

    await prisma.saldoEstoque.create({
      data: { itemId: item.id, localId: local.id, quantidade: 5, reservada: 0 },
    });

    // Cria e atende parcialmente
    const req = await criarRequisicao({
      solicitanteId: solicitante.id,
      itens: [{ itemId: item.id, localId: local.id, quantidade: 5 }],
    });

    await prisma.$transaction(async (tx) => {
      await separarItem({
        requisicaoItemId: req.itens[0].id,
        funcionarioId: almoxarife.id,
        tx,
      });
    });

    // Todas as linhas de SaldoEstoque devem respeitar as invariantes
    const todosSaldos = await prisma.saldoEstoque.findMany();
    for (const s of todosSaldos) {
      expect(s.quantidade).toBeGreaterThanOrEqual(0);
      expect(s.reservada).toBeGreaterThanOrEqual(0);
      expect(s.reservada).toBeLessThanOrEqual(s.quantidade);
    }

    // Todas as movimentações devem estar associadas a funcionário e saldo existente
    const todasMovs = await prisma.movimentacao.findMany();
    expect(todasMovs.length).toBeGreaterThan(0);
    for (const m of todasMovs) {
      expect(m.funcionarioId).toBeGreaterThan(0);
      expect(m.saldoEstoqueId).toBeDefined();
      expect(m.quantidade).toBeGreaterThan(0);
    }
  });
});
