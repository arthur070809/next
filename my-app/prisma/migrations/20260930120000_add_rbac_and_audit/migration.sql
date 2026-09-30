ALTER TABLE `funcionarios`
  ADD COLUMN `role` VARCHAR(20) NOT NULL DEFAULT 'user',
  ADD COLUMN `mustChangePassword` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `ativo` BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE `auditorias` (
  `id` VARCHAR(191) NOT NULL,
  `acao` VARCHAR(50) NOT NULL,
  `alvoId` INT NOT NULL,
  `autorId` INT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `auditorias_alvoId_idx` (`alvoId`),
  INDEX `auditorias_autorId_idx` (`autorId`),
  INDEX `auditorias_createdAt_idx` (`createdAt`),
  CONSTRAINT `auditorias_autorId_fkey` FOREIGN KEY (`autorId`) REFERENCES `funcionarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
