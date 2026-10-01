ALTER TABLE `requisicao`
  ADD COLUMN `numero` INTEGER NOT NULL AUTO_INCREMENT,
  ADD COLUMN `estoqueItemId` VARCHAR(191) NULL,
  ADD COLUMN `qtdDevolvida` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `origem_retirada` ENUM('DEPOSITO', 'ESTOQUE') NULL,
  ADD COLUMN `idempotencyKey` VARCHAR(191) NULL,
  ADD COLUMN `grupoIdempotencia` VARCHAR(191) NULL,
  ADD UNIQUE INDEX `Requisicao_numero_key` (`numero`),
  ADD UNIQUE INDEX `Requisicao_idempotencyKey_key` (`idempotencyKey`),
  ADD INDEX `Requisicao_grupoIdempotencia_idx` (`grupoIdempotencia`),
  ADD CONSTRAINT `Requisicao_estoqueItemId_fkey`
    FOREIGN KEY (`estoqueItemId`) REFERENCES `estoque_itens` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `Requisicao_qtdDevolvida_check`
    CHECK (`qtdDevolvida` >= 0 AND `qtdDevolvida` <= `quantidade`);

ALTER TABLE `deposito_itens`
  ADD CONSTRAINT `deposito_itens_quantidade_check` CHECK (`quantidade` >= 0);

CREATE TABLE `movimentacoes_deposito` (
  `id` VARCHAR(191) NOT NULL,
  `itemId` VARCHAR(191) NOT NULL,
  `tipo` ENUM('SAIDA_REQUISICAO', 'ENTRADA_SOBRA', 'ENTRADA_MANUAL', 'AJUSTE') NOT NULL,
  `quantidade` INTEGER NOT NULL,
  `saldoAntes` INTEGER NOT NULL,
  `saldoDepois` INTEGER NOT NULL,
  `requisicaoId` VARCHAR(191) NULL,
  `usuarioId` INTEGER NOT NULL,
  `motivo` VARCHAR(200) NULL,
  `idempotencyKey` VARCHAR(191) NULL,
  `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `movimentacoes_deposito_idempotencyKey_key` (`idempotencyKey`),
  INDEX `movimentacoes_deposito_itemId_criadoEm_idx` (`itemId`, `criadoEm`),
  INDEX `movimentacoes_deposito_tipo_criadoEm_idx` (`tipo`, `criadoEm`),
  INDEX `movimentacoes_deposito_usuarioId_criadoEm_idx` (`usuarioId`, `criadoEm`),
  INDEX `movimentacoes_deposito_requisicaoId_idx` (`requisicaoId`),
  CONSTRAINT `movimentacoes_deposito_quantidade_check` CHECK (`quantidade` > 0),
  CONSTRAINT `movimentacoes_deposito_saldos_check` CHECK (`saldoAntes` >= 0 AND `saldoDepois` >= 0),
  CONSTRAINT `movimentacoes_deposito_itemId_fkey`
    FOREIGN KEY (`itemId`) REFERENCES `estoque_itens` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `movimentacoes_deposito_requisicaoId_fkey`
    FOREIGN KEY (`requisicaoId`) REFERENCES `requisicao` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `movimentacoes_deposito_usuarioId_fkey`
    FOREIGN KEY (`usuarioId`) REFERENCES `funcionarios` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;