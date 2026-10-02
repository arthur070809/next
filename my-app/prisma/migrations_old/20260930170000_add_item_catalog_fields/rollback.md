# Rollback

This migration is additive. To roll it back, first export any imported component metadata that must be retained. Then, during a maintenance window, remove only the fields/index introduced by this migration:

```sql
ALTER TABLE `estoque_itens`
  DROP INDEX `estoque_itens_filial_codigo_key`,
  DROP COLUMN `bloqueadoCompra`,
  DROP COLUMN `estoqueSeguranca`,
  DROP COLUMN `pontoPedido`,
  DROP COLUMN `grupoErp`,
  DROP COLUMN `filial`,
  DROP COLUMN `codigo`,
  DROP COLUMN `tipoItem`;
```

Do not run this rollback after catalog import unless the imported metadata has been backed up. It does not delete rows or modify the existing stock balance.