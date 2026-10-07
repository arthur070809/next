ALTER TABLE `face_templates`
  ADD COLUMN `model_version` VARCHAR(80) NOT NULL DEFAULT 'legacy-unknown',
  ADD COLUMN `atualizado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);
