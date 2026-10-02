ALTER TABLE `funcionarios`
  ADD COLUMN `login` VARCHAR(50) NULL,
  ADD UNIQUE INDEX `login` (`login`);

ALTER TABLE `Sessao`
  ADD COLUMN `accessArea` VARCHAR(30) NULL;

UPDATE `funcionarios`
SET `mustChangePassword` = 0
WHERE `role` = 'admin';
