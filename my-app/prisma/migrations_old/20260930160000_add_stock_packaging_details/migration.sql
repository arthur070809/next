ALTER TABLE `estoque_itens`
  ADD COLUMN `tipoUnidade` VARCHAR(20) NOT NULL DEFAULT 'unidade',
  ADD COLUMN `quantidadePorEmbalagem` INT NOT NULL DEFAULT 1,
  ADD COLUMN `ultimaEntradaEmbalagens` INT NULL;
