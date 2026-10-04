-- AlterTable
ALTER TABLE `requisicoes` ADD COLUMN `regra_estoque` VARCHAR(24) NULL;

-- CreateTable
CREATE TABLE `saldos_operador_item` (
    `id` VARCHAR(36) NOT NULL,
    `funcionario_id` INTEGER NOT NULL,
    `item_id` VARCHAR(36) NOT NULL,
    `local_id` VARCHAR(36) NOT NULL,
    `quantidade_a_separar` INTEGER NOT NULL DEFAULT 0,
    `quantidade_em_posse` INTEGER NOT NULL DEFAULT 0,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `saldos_operador_item_item_id_local_id_idx`(`item_id`, `local_id`),
    INDEX `saldos_operador_item_local_id_idx`(`local_id`),
    UNIQUE INDEX `uq_saldo_operador_item_local`(`funcionario_id`, `item_id`, `local_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `movimentos_conta_estoque` (
    `id` VARCHAR(36) NOT NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `tipo` VARCHAR(32) NOT NULL,
    `item_id` VARCHAR(36) NOT NULL,
    `local_id` VARCHAR(36) NOT NULL,
    `quantidade` INTEGER NOT NULL DEFAULT 0,
    `fisico_antes` INTEGER NOT NULL DEFAULT 0,
    `fisico_depois` INTEGER NOT NULL DEFAULT 0,
    `quantidade_a_separar_antes` INTEGER NOT NULL DEFAULT 0,
    `quantidade_a_separar_depois` INTEGER NOT NULL DEFAULT 0,
    `quantidade_em_posse_antes` INTEGER NOT NULL DEFAULT 0,
    `quantidade_em_posse_depois` INTEGER NOT NULL DEFAULT 0,
    `requisicao_id` VARCHAR(36) NULL,
    `requisicao_item_id` VARCHAR(36) NULL,
    `funcionario_origem_id` INTEGER NOT NULL,
    `funcionario_executor_id` INTEGER NOT NULL,
    `origem` VARCHAR(16) NOT NULL DEFAULT 'SISTEMA',
    `motivo` VARCHAR(500) NULL,
    `correlation_id` VARCHAR(36) NOT NULL,
    `idempotency_key` VARCHAR(160) NOT NULL,

    UNIQUE INDEX `uq_mov_conta_idempotency_key`(`idempotency_key`),
    INDEX `idx_mov_conta_item_criado`(`item_id`, `criado_em`),
    INDEX `idx_mov_conta_local`(`local_id`),
    INDEX `idx_mov_conta_origem_criado`(`funcionario_origem_id`, `criado_em`),
    INDEX `idx_mov_conta_requisicao`(`requisicao_id`),
    INDEX `idx_mov_conta_requisicao_item`(`requisicao_item_id`),
    INDEX `idx_mov_conta_tipo_criado`(`tipo`, `criado_em`),
    INDEX `idx_mov_conta_executor`(`funcionario_executor_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `saldos_operador_item` ADD CONSTRAINT `saldos_operador_item_funcionario_id_fkey` FOREIGN KEY (`funcionario_id`) REFERENCES `funcionarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `saldos_operador_item` ADD CONSTRAINT `saldos_operador_item_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `itens`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `saldos_operador_item` ADD CONSTRAINT `saldos_operador_item_local_id_fkey` FOREIGN KEY (`local_id`) REFERENCES `locais_estoque`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `movimentos_conta_estoque` ADD CONSTRAINT `movimentos_conta_estoque_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `itens`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `movimentos_conta_estoque` ADD CONSTRAINT `movimentos_conta_estoque_local_id_fkey` FOREIGN KEY (`local_id`) REFERENCES `locais_estoque`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `movimentos_conta_estoque` ADD CONSTRAINT `movimentos_conta_estoque_requisicao_id_fkey` FOREIGN KEY (`requisicao_id`) REFERENCES `requisicoes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `movimentos_conta_estoque` ADD CONSTRAINT `movimentos_conta_estoque_requisicao_item_id_fkey` FOREIGN KEY (`requisicao_item_id`) REFERENCES `requisicao_itens`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `movimentos_conta_estoque` ADD CONSTRAINT `movimentos_conta_estoque_funcionario_origem_id_fkey` FOREIGN KEY (`funcionario_origem_id`) REFERENCES `funcionarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `movimentos_conta_estoque` ADD CONSTRAINT `movimentos_conta_estoque_funcionario_executor_id_fkey` FOREIGN KEY (`funcionario_executor_id`) REFERENCES `funcionarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

