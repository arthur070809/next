CREATE TABLE `face_enrollment_sessions` (
  `id` VARCHAR(191) NOT NULL,
  `tokenHash` VARCHAR(64) NOT NULL,
  `adminId` INT NOT NULL,
  `funcionarioId` INT NOT NULL,
  `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `ultimaAtividade` DATETIME(3) NOT NULL,
  `expiraEm` DATETIME(3) NOT NULL,
  `tetoEm` DATETIME(3) NOT NULL,
  `usadoEm` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `face_enrollment_sessions_tokenHash_key` (`tokenHash`),
  INDEX `face_enrollment_sessions_adminId_funcionarioId_expiraEm_idx` (`adminId`, `funcionarioId`, `expiraEm`),
  INDEX `face_enrollment_sessions_expiraEm_idx` (`expiraEm`),
  CONSTRAINT `face_enrollment_sessions_adminId_fkey` FOREIGN KEY (`adminId`) REFERENCES `funcionarios` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `face_enrollment_sessions_funcionarioId_fkey` FOREIGN KEY (`funcionarioId`) REFERENCES `funcionarios` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `face_enrollment_attempts` (
  `id` VARCHAR(191) NOT NULL,
  `adminId` INT NOT NULL,
  `funcionarioId` INT NOT NULL,
  `resultado` VARCHAR(20) NOT NULL,
  `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `face_enrollment_attempts_adminId_funcionarioId_criadoEm_idx` (`adminId`, `funcionarioId`, `criadoEm`),
  CONSTRAINT `face_enrollment_attempts_adminId_fkey` FOREIGN KEY (`adminId`) REFERENCES `funcionarios` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `face_enrollment_attempts_funcionarioId_fkey` FOREIGN KEY (`funcionarioId`) REFERENCES `funcionarios` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;