-- ============================================================
-- Migration inicial — Marcon Almoxarifado
-- Banco: TiDB Cloud Starter (MySQL 8.5 compatível)
-- Charset: utf8mb4 | Collation: utf8mb4_unicode_ci
-- Gerado em: 2026-10-02
-- ============================================================

-- CreateTable
CREATE TABLE `funcionarios` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(100) NOT NULL,
    `login` VARCHAR(50) NULL,
    `email` VARCHAR(100) NOT NULL,
    `senha` VARCHAR(255) NOT NULL,
    `cargo` VARCHAR(50) NOT NULL,
    `cracha` VARCHAR(20) NOT NULL,
    `papel` ENUM('USUARIO', 'OPERADOR', 'ALMOXARIFE', 'ADMIN') NOT NULL DEFAULT 'USUARIO',
    `must_change_password` BOOLEAN NOT NULL DEFAULT false,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uq_funcionarios_login`(`login`),
    UNIQUE INDEX `uq_funcionarios_email`(`email`),
    UNIQUE INDEX `uq_funcionarios_cracha`(`cracha`),
    INDEX `funcionarios_papel_idx`(`papel`),
    INDEX `funcionarios_ativo_idx`(`ativo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sessoes` (
    `id` VARCHAR(36) NOT NULL,
    `token` VARCHAR(64) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `access_area` VARCHAR(30) NULL,
    `funcionario_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `sessoes_token_key`(`token`),
    INDEX `sessoes_funcionario_id_idx`(`funcionario_id`),
    INDEX `sessoes_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itens` (
    `id` VARCHAR(36) NOT NULL,
    `nome` VARCHAR(120) NOT NULL,
    `categoria` VARCHAR(80) NOT NULL,
    `unidade` VARCHAR(30) NOT NULL DEFAULT 'unidades',
    `tipo_unidade` VARCHAR(20) NOT NULL DEFAULT 'unidade',
    `quantidade_por_embalagem` INTEGER NOT NULL DEFAULT 1,
    `tipo_item` ENUM('COMPONENTE', 'CONSUMIVEL', 'MATERIA_PRIMA', 'EMBALAGEM') NOT NULL DEFAULT 'CONSUMIVEL',
    `codigo` VARCHAR(50) NULL,
    `filial` VARCHAR(20) NULL,
    `grupo_erp` VARCHAR(80) NULL,
    `ponto_pedido` INTEGER NOT NULL DEFAULT 0,
    `estoque_seguranca` INTEGER NOT NULL DEFAULT 0,
    `bloqueado_compra` BOOLEAN NOT NULL DEFAULT false,
    `ultima_entrada_embalagens` INTEGER NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `itens_categoria_idx`(`categoria`),
    INDEX `itens_ativo_idx`(`ativo`),
    INDEX `itens_codigo_idx`(`codigo`),
    UNIQUE INDEX `uq_itens_filial_codigo`(`filial`, `codigo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `locais_estoque` (
    `id` VARCHAR(36) NOT NULL,
    `nome` VARCHAR(80) NOT NULL,
    `slug` VARCHAR(40) NOT NULL,
    `descricao` VARCHAR(255) NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `uq_locais_estoque_slug`(`slug`),
    INDEX `locais_estoque_ativo_idx`(`ativo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `saldos_estoque` (
    `id` VARCHAR(36) NOT NULL,
    `item_id` VARCHAR(36) NOT NULL,
    `local_id` VARCHAR(36) NOT NULL,
    `quantidade` INTEGER NOT NULL DEFAULT 0,
    `reservada` INTEGER NOT NULL DEFAULT 0,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `saldos_estoque_item_id_idx`(`item_id`),
    INDEX `saldos_estoque_local_id_idx`(`local_id`),
    UNIQUE INDEX `uq_saldo_item_local`(`item_id`, `local_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: sequência para número de requisição (evita saltos do AUTO_INCREMENT no TiDB)
CREATE TABLE `sequencia_requisicao` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `proximo` INTEGER NOT NULL DEFAULT 1,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Seed do contador de sequência (valor inicial)
INSERT INTO `sequencia_requisicao` (`id`, `proximo`) VALUES (1, 1);

-- CreateTable
CREATE TABLE `requisicoes` (
    `id` VARCHAR(36) NOT NULL,
    `numero_pedido` VARCHAR(20) NOT NULL,
    `status` ENUM('PENDENTE', 'ASSUMIDA', 'CONCLUIDA', 'ANULADA') NOT NULL DEFAULT 'PENDENTE',
    `prioridade` ENUM('PADRAO', 'PRIORITARIO') NOT NULL DEFAULT 'PADRAO',
    `observacao` TEXT NULL,
    `solicitante_id` INTEGER NOT NULL,
    `atendente_id` INTEGER NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `assumida_em` DATETIME(3) NULL,
    `concluida_em` DATETIME(3) NULL,
    `anulada_em` DATETIME(3) NULL,
    `atualizado_em` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uq_requisicoes_numero_pedido`(`numero_pedido`),
    INDEX `requisicoes_solicitante_id_idx`(`solicitante_id`),
    INDEX `requisicoes_atendente_id_idx`(`atendente_id`),
    INDEX `requisicoes_status_idx`(`status`),
    INDEX `requisicoes_prioridade_idx`(`prioridade`),
    INDEX `requisicoes_criado_em_idx`(`criado_em`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `requisicao_itens` (
    `id` VARCHAR(36) NOT NULL,
    `requisicao_id` VARCHAR(36) NOT NULL,
    `item_id` VARCHAR(36) NOT NULL,
    `local_id` VARCHAR(36) NOT NULL,
    `quantidade` INTEGER NOT NULL,
    `unidade_medida` VARCHAR(10) NOT NULL DEFAULT 'UN',
    `descricao` VARCHAR(500) NULL,
    `status` ENUM('PENDENTE', 'ASSUMIDO', 'SEPARADO', 'NAO_SEPARADO', 'ANULADO') NOT NULL DEFAULT 'PENDENTE',
    `separado` BOOLEAN NULL,
    `motivo_nao_atendido` VARCHAR(500) NULL,
    `resolvido_em` DATETIME(3) NULL,

    INDEX `requisicao_itens_requisicao_id_idx`(`requisicao_id`),
    INDEX `requisicao_itens_item_id_idx`(`item_id`),
    INDEX `requisicao_itens_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `movimentacoes` (
    `id` VARCHAR(36) NOT NULL,
    `tipo` ENUM('ENTRADA', 'SAIDA', 'RESERVA', 'LIBERACAO_RESERVA', 'AJUSTE') NOT NULL,
    `quantidade` INTEGER NOT NULL,
    `saldo_apos` INTEGER NOT NULL,
    `reservada_apos` INTEGER NOT NULL,
    `funcionario_id` INTEGER NOT NULL,
    `saldo_estoque_id` VARCHAR(36) NOT NULL,
    `requisicao_id` VARCHAR(36) NULL,
    `requisicao_item_id` VARCHAR(36) NULL,
    `observacao` VARCHAR(500) NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `movimentacoes_saldo_estoque_id_idx`(`saldo_estoque_id`),
    INDEX `movimentacoes_requisicao_id_idx`(`requisicao_id`),
    INDEX `movimentacoes_funcionario_id_idx`(`funcionario_id`),
    INDEX `movimentacoes_tipo_idx`(`tipo`),
    INDEX `movimentacoes_criado_em_idx`(`criado_em`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `auditorias` (
    `id` VARCHAR(36) NOT NULL,
    `acao` VARCHAR(50) NOT NULL,
    `alvo_id` INTEGER NOT NULL,
    `autor_id` INTEGER NOT NULL,
    `detalhes` VARCHAR(500) NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `auditorias_alvo_id_idx`(`alvo_id`),
    INDEX `auditorias_autor_id_idx`(`autor_id`),
    INDEX `auditorias_criado_em_idx`(`criado_em`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `sessoes` ADD CONSTRAINT `sessoes_funcionario_id_fkey` FOREIGN KEY (`funcionario_id`) REFERENCES `funcionarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `saldos_estoque` ADD CONSTRAINT `saldos_estoque_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `itens`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `saldos_estoque` ADD CONSTRAINT `saldos_estoque_local_id_fkey` FOREIGN KEY (`local_id`) REFERENCES `locais_estoque`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `requisicoes` ADD CONSTRAINT `requisicoes_solicitante_id_fkey` FOREIGN KEY (`solicitante_id`) REFERENCES `funcionarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `requisicoes` ADD CONSTRAINT `requisicoes_atendente_id_fkey` FOREIGN KEY (`atendente_id`) REFERENCES `funcionarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `requisicao_itens` ADD CONSTRAINT `requisicao_itens_requisicao_id_fkey` FOREIGN KEY (`requisicao_id`) REFERENCES `requisicoes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `requisicao_itens` ADD CONSTRAINT `requisicao_itens_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `itens`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `requisicao_itens` ADD CONSTRAINT `requisicao_itens_local_id_fkey` FOREIGN KEY (`local_id`) REFERENCES `locais_estoque`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `movimentacoes` ADD CONSTRAINT `movimentacoes_funcionario_id_fkey` FOREIGN KEY (`funcionario_id`) REFERENCES `funcionarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `movimentacoes` ADD CONSTRAINT `movimentacoes_saldo_estoque_id_fkey` FOREIGN KEY (`saldo_estoque_id`) REFERENCES `saldos_estoque`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `movimentacoes` ADD CONSTRAINT `movimentacoes_requisicao_id_fkey` FOREIGN KEY (`requisicao_id`) REFERENCES `requisicoes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `movimentacoes` ADD CONSTRAINT `movimentacoes_requisicao_item_id_fkey` FOREIGN KEY (`requisicao_item_id`) REFERENCES `requisicao_itens`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `auditorias` ADD CONSTRAINT `auditorias_autor_id_fkey` FOREIGN KEY (`autor_id`) REFERENCES `funcionarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
