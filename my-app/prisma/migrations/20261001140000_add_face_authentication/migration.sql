CREATE TABLE `face_templates` (
    `id` VARCHAR(191) NOT NULL,
    `funcionarioId` INTEGER NOT NULL,
    `embeddingEncrypted` BLOB NOT NULL,
    `iv` BLOB NOT NULL,
    `tag` BLOB NOT NULL,
    `consentVersion` VARCHAR(40) NOT NULL,
    `consentAt` DATETIME(3) NOT NULL,
    `criadoPorId` INTEGER NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `revogadoEm` DATETIME(3) NULL,

    PRIMARY KEY (`id`),
    INDEX `face_templates_funcionarioId_revogadoEm_idx` (`funcionarioId`, `revogadoEm`),
    CONSTRAINT `face_templates_funcionarioId_fkey` FOREIGN KEY (`funcionarioId`) REFERENCES `funcionarios` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `face_templates_criadoPorId_fkey` FOREIGN KEY (`criadoPorId`) REFERENCES `funcionarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `liveness_challenges` (
    `id` VARCHAR(191) NOT NULL,
    `funcionarioId` INTEGER NOT NULL,
    `trustedDeviceId` VARCHAR(191) NOT NULL,
    `tipo` VARCHAR(30) NOT NULL,
    `nonceHash` VARCHAR(64) NOT NULL,
    `expiraEm` DATETIME(3) NOT NULL,
    `usadoEm` DATETIME(3) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`),
    UNIQUE INDEX `liveness_challenges_nonceHash_key` (`nonceHash`),
    INDEX `liveness_challenges_funcionarioId_expiraEm_idx` (`funcionarioId`, `expiraEm`),
    INDEX `liveness_challenges_trustedDeviceId_expiraEm_idx` (`trustedDeviceId`, `expiraEm`),
    CONSTRAINT `liveness_challenges_funcionarioId_fkey` FOREIGN KEY (`funcionarioId`) REFERENCES `funcionarios` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `liveness_challenges_trustedDeviceId_fkey` FOREIGN KEY (`trustedDeviceId`) REFERENCES `trusted_devices` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `face_auth_attempts` (
    `id` VARCHAR(191) NOT NULL,
    `funcionarioId` INTEGER NOT NULL,
    `trustedDeviceId` VARCHAR(191) NOT NULL,
    `resultado` VARCHAR(20) NOT NULL,
    `ipHash` VARCHAR(64) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`),
    INDEX `face_auth_attempts_funcionarioId_criadoEm_idx` (`funcionarioId`, `criadoEm`),
    INDEX `face_auth_attempts_trustedDeviceId_criadoEm_idx` (`trustedDeviceId`, `criadoEm`),
    CONSTRAINT `face_auth_attempts_funcionarioId_fkey` FOREIGN KEY (`funcionarioId`) REFERENCES `funcionarios` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `face_auth_attempts_trustedDeviceId_fkey` FOREIGN KEY (`trustedDeviceId`) REFERENCES `trusted_devices` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;