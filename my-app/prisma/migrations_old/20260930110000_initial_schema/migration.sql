CREATE TABLE `funcionarios` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `nome` VARCHAR(100) NOT NULL,
  `email` VARCHAR(100) NOT NULL,
  `senha` VARCHAR(255) NOT NULL,
  `cargo` VARCHAR(50) NOT NULL,
  `cracha` VARCHAR(20) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `email` (`email`),
  UNIQUE INDEX `cracha` (`cracha`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Sessao` (
  `id` VARCHAR(191) NOT NULL,
  `token` VARCHAR(191) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `funcionarioId` INT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `Sessao_token_key` (`token`),
  INDEX `Sessao_funcionarioId_idx` (`funcionarioId`),
  INDEX `Sessao_expiresAt_idx` (`expiresAt`),
  CONSTRAINT `Sessao_funcionarioId_fkey` FOREIGN KEY (`funcionarioId`) REFERENCES `funcionarios` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `requisicao` (
  `id` VARCHAR(191) NOT NULL,
  `item` VARCHAR(191) NOT NULL,
  `quantidade` INT NOT NULL,
  `observacao` TEXT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'PENDENTE',
  `origem` VARCHAR(191) NOT NULL DEFAULT 'ESTOQUE',
  `funcionarioId` INT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `Requisicao_funcionarioId_idx` (`funcionarioId`),
  INDEX `Requisicao_status_idx` (`status`),
  CONSTRAINT `Requisicao_funcionarioId_fkey` FOREIGN KEY (`funcionarioId`) REFERENCES `funcionarios` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `estoque_itens` (
  `id` VARCHAR(191) NOT NULL,
  `nome` VARCHAR(120) NOT NULL,
  `categoria` VARCHAR(80) NOT NULL,
  `unidade` VARCHAR(30) NOT NULL DEFAULT 'unidade',
  `quantidade` INT NOT NULL DEFAULT 0,
  `ativo` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `estoque_itens_categoria_idx` (`categoria`),
  INDEX `estoque_itens_ativo_idx` (`ativo`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `deposito_itens` (
  `id` VARCHAR(191) NOT NULL,
  `estoqueItemId` VARCHAR(191) NOT NULL,
  `quantidade` INT NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `deposito_itens_estoqueItemId_key` (`estoqueItemId`),
  INDEX `deposito_itens_quantidade_idx` (`quantidade`),
  CONSTRAINT `deposito_itens_estoqueItemId_fkey` FOREIGN KEY (`estoqueItemId`) REFERENCES `estoque_itens` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;