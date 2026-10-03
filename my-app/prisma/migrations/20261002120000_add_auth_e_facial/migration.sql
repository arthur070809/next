-- AlterTable
ALTER TABLE `sessoes` ADD COLUMN `trusted_device_id` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `trusted_devices` (
    `id` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(80) NOT NULL,
    `tokenHash` VARCHAR(64) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `pareadoEm` DATETIME(3) NULL,
    `ultimoAcessoEm` DATETIME(3) NULL,
    `revogadoEm` DATETIME(3) NULL,

    UNIQUE INDEX `trusted_devices_tokenHash_key`(`tokenHash`),
    INDEX `trusted_devices_revogadoEm_idx`(`revogadoEm`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `device_pairings` (
    `id` VARCHAR(191) NOT NULL,
    `codeHash` VARCHAR(64) NOT NULL,
    `trustedDeviceId` VARCHAR(191) NOT NULL,
    `funcionarioId` INTEGER NOT NULL,
    `criadoPorId` INTEGER NOT NULL,
    `expiraEm` DATETIME(3) NOT NULL,
    `challenge` VARCHAR(191) NULL,
    `challengeExpiraEm` DATETIME(3) NULL,
    `usadoEm` DATETIME(3) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `device_pairings_codeHash_key`(`codeHash`),
    INDEX `device_pairings_trustedDeviceId_expiraEm_idx`(`trustedDeviceId`, `expiraEm`),
    INDEX `device_pairings_funcionarioId_expiraEm_idx`(`funcionarioId`, `expiraEm`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `webauthn_credentials` (
    `id` VARCHAR(191) NOT NULL,
    `credentialId` VARCHAR(512) NOT NULL,
    `publicKey` LONGBLOB NOT NULL,
    `counter` BIGINT NOT NULL DEFAULT 0,
    `transports` VARCHAR(200) NULL,
    `funcionarioId` INTEGER NOT NULL,
    `trustedDeviceId` VARCHAR(191) NOT NULL,
    `consentVersion` VARCHAR(40) NOT NULL,
    `consentAt` DATETIME(3) NOT NULL,
    `createdById` INTEGER NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `ultimoUsoEm` DATETIME(3) NULL,
    `revogadoEm` DATETIME(3) NULL,

    UNIQUE INDEX `webauthn_credentials_credentialId_key`(`credentialId`),
    INDEX `webauthn_credentials_funcionarioId_trustedDeviceId_revogadoE_idx`(`funcionarioId`, `trustedDeviceId`, `revogadoEm`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `auth_challenges` (
    `id` VARCHAR(191) NOT NULL,
    `tipo` VARCHAR(30) NOT NULL,
    `challenge` VARCHAR(191) NULL,
    `preAuthTokenHash` VARCHAR(64) NULL,
    `funcionarioId` INTEGER NOT NULL,
    `trustedDeviceId` VARCHAR(191) NULL,
    `ipHash` VARCHAR(64) NULL,
    `expiraEm` DATETIME(3) NOT NULL,
    `usadoEm` DATETIME(3) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `auth_challenges_preAuthTokenHash_key`(`preAuthTokenHash`),
    INDEX `auth_challenges_funcionarioId_tipo_expiraEm_idx`(`funcionarioId`, `tipo`, `expiraEm`),
    INDEX `auth_challenges_trustedDeviceId_tipo_expiraEm_idx`(`trustedDeviceId`, `tipo`, `expiraEm`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin_totp_credentials` (
    `id` VARCHAR(191) NOT NULL,
    `funcionarioId` INTEGER NOT NULL,
    `secretCiphertext` LONGBLOB NOT NULL,
    `secretIv` LONGBLOB NOT NULL,
    `secretTag` LONGBLOB NOT NULL,
    `enabledAt` DATETIME(3) NULL,
    `lastVerifiedStep` BIGINT NOT NULL DEFAULT 0,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    UNIQUE INDEX `admin_totp_credentials_funcionarioId_key`(`funcionarioId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `emergency_access_grants` (
    `id` VARCHAR(191) NOT NULL,
    `funcionarioId` INTEGER NOT NULL,
    `trustedDeviceId` VARCHAR(191) NOT NULL,
    `criadoPorId` INTEGER NOT NULL,
    `justificativa` VARCHAR(200) NOT NULL,
    `expiraEm` DATETIME(3) NOT NULL,
    `usadoEm` DATETIME(3) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `emergency_access_grants_funcionarioId_trustedDeviceId_expira_idx`(`funcionarioId`, `trustedDeviceId`, `expiraEm`, `usadoEm`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `face_templates` (
    `id` VARCHAR(191) NOT NULL,
    `funcionarioId` INTEGER NOT NULL,
    `embeddingEncrypted` LONGBLOB NOT NULL,
    `iv` LONGBLOB NOT NULL,
    `tag` LONGBLOB NOT NULL,
    `consentVersion` VARCHAR(40) NOT NULL,
    `consentAt` DATETIME(3) NOT NULL,
    `criadoPorId` INTEGER NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `revogadoEm` DATETIME(3) NULL,

    INDEX `face_templates_funcionarioId_revogadoEm_idx`(`funcionarioId`, `revogadoEm`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `liveness_challenges` (
    `id` VARCHAR(191) NOT NULL,
    `funcionarioId` INTEGER NOT NULL,
    `trustedDeviceId` VARCHAR(191) NOT NULL,
    `tipo` VARCHAR(30) NOT NULL,
    `nonceHash` VARCHAR(64) NOT NULL,
    `expiraEm` DATETIME(3) NOT NULL,
    `usadoEm` DATETIME(3) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `liveness_challenges_nonceHash_key`(`nonceHash`),
    INDEX `liveness_challenges_funcionarioId_expiraEm_idx`(`funcionarioId`, `expiraEm`),
    INDEX `liveness_challenges_trustedDeviceId_expiraEm_idx`(`trustedDeviceId`, `expiraEm`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `face_auth_attempts` (
    `id` VARCHAR(191) NOT NULL,
    `funcionarioId` INTEGER NOT NULL,
    `trustedDeviceId` VARCHAR(191) NOT NULL,
    `resultado` VARCHAR(20) NOT NULL,
    `ipHash` VARCHAR(64) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `face_auth_attempts_funcionarioId_criadoEm_idx`(`funcionarioId`, `criadoEm`),
    INDEX `face_auth_attempts_trustedDeviceId_criadoEm_idx`(`trustedDeviceId`, `criadoEm`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `face_enrollment_sessions` (
    `id` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(64) NOT NULL,
    `adminId` INTEGER NOT NULL,
    `funcionarioId` INTEGER NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `ultimaAtividade` DATETIME(3) NOT NULL,
    `expiraEm` DATETIME(3) NOT NULL,
    `tetoEm` DATETIME(3) NOT NULL,
    `usadoEm` DATETIME(3) NULL,

    UNIQUE INDEX `face_enrollment_sessions_tokenHash_key`(`tokenHash`),
    INDEX `face_enrollment_sessions_adminId_funcionarioId_expiraEm_idx`(`adminId`, `funcionarioId`, `expiraEm`),
    INDEX `face_enrollment_sessions_expiraEm_idx`(`expiraEm`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `face_enrollment_attempts` (
    `id` VARCHAR(191) NOT NULL,
    `adminId` INTEGER NOT NULL,
    `funcionarioId` INTEGER NOT NULL,
    `resultado` VARCHAR(20) NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `face_enrollment_attempts_adminId_funcionarioId_criadoEm_idx`(`adminId`, `funcionarioId`, `criadoEm`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `security_audit_events` (
    `id` VARCHAR(191) NOT NULL,
    `acao` VARCHAR(50) NOT NULL,
    `resultado` VARCHAR(20) NOT NULL,
    `funcionarioId` INTEGER NULL,
    `atorId` INTEGER NULL,
    `trustedDeviceId` VARCHAR(191) NULL,
    `ipHash` VARCHAR(64) NULL,
    `detalhe` VARCHAR(200) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `security_audit_events_acao_criadoEm_idx`(`acao`, `criadoEm`),
    INDEX `security_audit_events_funcionarioId_criadoEm_idx`(`funcionarioId`, `criadoEm`),
    INDEX `security_audit_events_trustedDeviceId_criadoEm_idx`(`trustedDeviceId`, `criadoEm`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `sessoes_trusted_device_id_idx` ON `sessoes`(`trusted_device_id`);

-- AddForeignKey
ALTER TABLE `sessoes` ADD CONSTRAINT `sessoes_trusted_device_id_fkey` FOREIGN KEY (`trusted_device_id`) REFERENCES `trusted_devices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `device_pairings` ADD CONSTRAINT `device_pairings_trustedDeviceId_fkey` FOREIGN KEY (`trustedDeviceId`) REFERENCES `trusted_devices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `device_pairings` ADD CONSTRAINT `device_pairings_funcionarioId_fkey` FOREIGN KEY (`funcionarioId`) REFERENCES `funcionarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `device_pairings` ADD CONSTRAINT `device_pairings_criadoPorId_fkey` FOREIGN KEY (`criadoPorId`) REFERENCES `funcionarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `webauthn_credentials` ADD CONSTRAINT `webauthn_credentials_funcionarioId_fkey` FOREIGN KEY (`funcionarioId`) REFERENCES `funcionarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `webauthn_credentials` ADD CONSTRAINT `webauthn_credentials_trustedDeviceId_fkey` FOREIGN KEY (`trustedDeviceId`) REFERENCES `trusted_devices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `webauthn_credentials` ADD CONSTRAINT `webauthn_credentials_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `funcionarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `auth_challenges` ADD CONSTRAINT `auth_challenges_funcionarioId_fkey` FOREIGN KEY (`funcionarioId`) REFERENCES `funcionarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `auth_challenges` ADD CONSTRAINT `auth_challenges_trustedDeviceId_fkey` FOREIGN KEY (`trustedDeviceId`) REFERENCES `trusted_devices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admin_totp_credentials` ADD CONSTRAINT `admin_totp_credentials_funcionarioId_fkey` FOREIGN KEY (`funcionarioId`) REFERENCES `funcionarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `emergency_access_grants` ADD CONSTRAINT `emergency_access_grants_funcionarioId_fkey` FOREIGN KEY (`funcionarioId`) REFERENCES `funcionarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `emergency_access_grants` ADD CONSTRAINT `emergency_access_grants_trustedDeviceId_fkey` FOREIGN KEY (`trustedDeviceId`) REFERENCES `trusted_devices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `emergency_access_grants` ADD CONSTRAINT `emergency_access_grants_criadoPorId_fkey` FOREIGN KEY (`criadoPorId`) REFERENCES `funcionarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `face_templates` ADD CONSTRAINT `face_templates_funcionarioId_fkey` FOREIGN KEY (`funcionarioId`) REFERENCES `funcionarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `face_templates` ADD CONSTRAINT `face_templates_criadoPorId_fkey` FOREIGN KEY (`criadoPorId`) REFERENCES `funcionarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `liveness_challenges` ADD CONSTRAINT `liveness_challenges_funcionarioId_fkey` FOREIGN KEY (`funcionarioId`) REFERENCES `funcionarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `liveness_challenges` ADD CONSTRAINT `liveness_challenges_trustedDeviceId_fkey` FOREIGN KEY (`trustedDeviceId`) REFERENCES `trusted_devices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `face_auth_attempts` ADD CONSTRAINT `face_auth_attempts_funcionarioId_fkey` FOREIGN KEY (`funcionarioId`) REFERENCES `funcionarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `face_auth_attempts` ADD CONSTRAINT `face_auth_attempts_trustedDeviceId_fkey` FOREIGN KEY (`trustedDeviceId`) REFERENCES `trusted_devices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `face_enrollment_sessions` ADD CONSTRAINT `face_enrollment_sessions_adminId_fkey` FOREIGN KEY (`adminId`) REFERENCES `funcionarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `face_enrollment_sessions` ADD CONSTRAINT `face_enrollment_sessions_funcionarioId_fkey` FOREIGN KEY (`funcionarioId`) REFERENCES `funcionarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `face_enrollment_attempts` ADD CONSTRAINT `face_enrollment_attempts_adminId_fkey` FOREIGN KEY (`adminId`) REFERENCES `funcionarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `face_enrollment_attempts` ADD CONSTRAINT `face_enrollment_attempts_funcionarioId_fkey` FOREIGN KEY (`funcionarioId`) REFERENCES `funcionarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `security_audit_events` ADD CONSTRAINT `security_audit_events_funcionarioId_fkey` FOREIGN KEY (`funcionarioId`) REFERENCES `funcionarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `security_audit_events` ADD CONSTRAINT `security_audit_events_atorId_fkey` FOREIGN KEY (`atorId`) REFERENCES `funcionarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `security_audit_events` ADD CONSTRAINT `security_audit_events_trustedDeviceId_fkey` FOREIGN KEY (`trustedDeviceId`) REFERENCES `trusted_devices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
