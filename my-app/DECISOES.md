# Registro de Decisões Técnicas e Arquiteturais (DECISOES.md)

Este documento registra as decisões de engenharia adotadas na migração do Almoxarifado Marcon para **TiDB Cloud Starter** (MySQL 8.5 compatível, região `sa-east-1`) com **Prisma 7.10** (`@prisma/adapter-mariadb`), Next.js 16 e React 19.

---

## 1. Separação de Catálogo (`Item`) e Saldos (`SaldoEstoque`, `LocalEstoque`)

- **Decisão:** Separar as informações cadastrais e fiscais do item (tabela `itens`) da sua quantidade física disponível nos almoxarifados (tabela `saldos_estoque`), associada a um local (`locais_estoque`).
- **Alternativa descartada:** Manter tabelas separadas `estoque_itens` e `deposito_itens` ou armazenar a quantidade diretamente na linha do item.
- **Motivo:** O modelo anterior duplicava regras para "depósito" e "estoque" e impedia a expansão futura para múltiplos almoxarifados ou filiais. Com `locais_estoque` (ex.: slugs `estoque` e `deposito`), o sistema mantém compatibilidade com a UI atual (expondo `quantidade` e `quantidadeDeposito`) e suporta extensibilidade nativa sem novos esquemas.

---

## 2. Regra de Estoque: Reserva Atômica e Baixa Concorrente sem Ler-Depois-Escrever

- **Decisão:** O saldo disponível é calculado por `disponivel = quantidade - reservada`. Toda reserva ou baixa é executada diretamente no banco de dados com cláusula condicional em transação única (`prisma.$transaction`):
  ```sql
  -- Reserva na criação da requisição:
  UPDATE saldos_estoque
  SET reservada = reservada + ?
  WHERE item_id = ? AND local_id = ? AND (quantidade - reservada) >= ?;

  -- Baixa na separação do item (almoxarife):
  UPDATE saldos_estoque
  SET quantidade = quantidade - ?, reservada = GREATEST(0, reservada - ?)
  WHERE item_id = ? AND local_id = ? AND quantidade >= ? AND reservada >= ?;

  -- Liberação de reserva (anulação ou não separado):
  UPDATE saldos_estoque
  SET reservada = GREATEST(0, reservada - ?)
  WHERE item_id = ? AND local_id = ?;
  ```
- **Alternativa descartada:** Fazer `findUnique` para ler o saldo na aplicação, verificar se há estoque no JavaScript e em seguida executar `update`.
- **Motivo:** Em ambientes distribuídos e concorrentes como o TiDB Serverless, ler-depois-escrever cria janelas de race condition (TOCTOU — Time of Check to Time of Use) permitindo que duas requisições simultâneas vendam a última unidade e gerem saldo negativo. A atualização condicional atômica garante que apenas a transação que encontrar saldo suficiente terá `affectedRows > 0`.

---

## 3. Rastreabilidade Total: Movimentação Append-Only

- **Decisão:** Nenhuma linha de `saldos_estoque` é alterada sem a inserção concomitante de um registro na tabela `movimentacoes` (`ENTRADA`, `SAIDA`, `RESERVA`, `LIBERACAO_RESERVA`, `AJUSTE`), gravando os estados `saldo_apos` e `reservada_apos`, o funcionário autor e as referências à requisição e ao item. Movimentações nunca sofrem `UPDATE` nem `DELETE`.
- **Alternativa descartada:** Apenas atualizar os campos numéricos da tabela de saldos ou manter histórico solto em formato de texto.
- **Motivo:** Auditoria fiscal, rastreabilidade de perdas e conformidade industrial. Permite reconstruir o saldo a qualquer momento a partir do histórico e auditar discrepâncias de inventário.

---

## 4. Geração do Número Legível de Pedido (`REQ-000123`) sem Saltos

- **Decisão:** Utilização de uma tabela dedicada `sequencia_requisicao` (`id`, `proximo`) atualizada atomicamente via `UPDATE sequencia_requisicao SET proximo = proximo + 1 WHERE id = 1` dentro da transação de criação da requisição.
- **Alternativa descartada:** Depender de `AUTO_INCREMENT` no TiDB ou gerar números randômicos.
- **Motivo:** O TiDB aloca blocos de `AUTO_INCREMENT` em cache por nó TiDB (geralmente lotes de 30.000 IDs), gerando saltos gigantescos e fora de ordem sequencial caso haja múltiplos nós ou reinicializações. A tabela de sequência atômica assegura números estritamente sequenciais, legíveis e sem buracos arbitrários.

---

## 5. Unificação do Modelo de Pessoas (`Funcionario`) e Papéis (`PapelFuncionario`)

- **Decisão:** Unificar a antiga tabela `usuarios` (do SQL legado) com a tabela `funcionarios` em um modelo único `Funcionario` com enum fortemente tipado `PapelFuncionario`:
  - `USUARIO`: solicitante padrão (operadores que solicitam materiais);
  - `OPERADOR`: operador de chão de fábrica/produção;
  - `ALMOXARIFE`: operador de almoxarifado (atende e separa requisições, ajusta estoque);
  - `ADMIN`: administrador do sistema com acesso completo.
- **Camada de Compatibilidade:** Para preservar o contrato com o front-end existente sem quebras, a função `getAuthenticatedFuncionario()` e as rotas de API continuam expondo o campo `role` em formato string minúscula (`"admin"`, `"almoxarife"`, `"operador"`, `"user"`), ao mesmo tempo em que disponibilizam `papel` como enum.
- **Alternativa descartada:** Manter duas tabelas de autenticação paralelas (`usuarios` via `mysql2` e `funcionarios` via Prisma).
- **Motivo:** Evita inconsistências de credenciais, sessões órfãs e duplicidade de regras de autorização.

---

## 6. Tratamento de Conexão, Pool e TLS no TiDB Serverless

- **Decisão:**
  - O Prisma CLI (schema engine e migrate) utiliza a string de conexão com `sslaccept=strict` presente na `DATABASE_URL`.
  - O runtime da aplicação instancia um `mariadb.Pool` explícito com `ssl: true` (comportamento nativo seguro do driver MariaDB com certificados confiáveis), `connectionLimit: 5`, `idleTimeout: 30s` (menor que o timeout de 60s do TiDB Starter), `connectTimeout: 30000ms`, `acquireTimeout: 30000ms` e `charset: "utf8mb4"`.
  - A instância do pool é repassada ao `@prisma/adapter-mariadb` e reaproveitada em `globalThis` para evitar exaustão de conexões durante hot-reload no Next.js.
- **Alternativa descartada:** Deixar o `@prisma/adapter-mariadb` criar um pool padrão sem configurações de TLS explícitas.
- **Motivo:** O driver mariadb quando instanciado sem pool explícito falhava na negociação de TLS com o gateway do TiDB Cloud (`connection timeout`), enquanto o pool configurado com `ssl: true` conecta confiavelmente em menos de 1 segundo.

---

## 7. Estratégia de Migração: Migration Única Limpa via Diff + Deploy

- **Decisão:** As 6 migrations antigas e parciais foram arquivadas em `prisma/migrations_old/`. Foi gerada uma única migration inicial canônica (`20261002000000_initial_schema`) contendo o schema completo, charset `utf8mb4`, collation `utf8mb4_unicode_ci`, chaves estrangeiras com restrições explícitas e índices de cobertura. A migration foi testada e aplicada via `prisma migrate deploy` primeiro no banco descartável `marcon_almoxarifado_test` e em seguida no banco principal `marcon_almoxarifado`.
- **Alternativa descartada:** Rodar `prisma migrate dev` diretamente contra o TiDB Cloud.
- **Motivo:** `prisma migrate dev` requer um banco de dados de sombra ("shadow database") para calcular diffs temporários, recurso não suportado/recomendado no TiDB Cloud Starter compartilhado. O comando `prisma migrate deploy` aplica diretamente os scripts versionados de forma determinística e segura.
