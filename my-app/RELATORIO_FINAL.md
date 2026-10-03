# Relatório Final de Migração: TiDB Cloud Starter & Prisma 7

**Projeto:** Sistema de Almoxarifado Marcon (`my-app/`)  
**Data:** 02 de Outubro de 2026  
**Branch de trabalho:** `migracao-tidb-prisma`  
**Banco de Dados Alvo:** TiDB Cloud Starter v8.5.x (MySQL compatível, região AWS `sa-east-1`, banco `marcon_almoxarifado`)  
**Frameworks & Drivers:** Next.js 16 (App Router), React 19, Prisma 7.10 com `@prisma/adapter-mariadb` e `mariadb: ^3.5.4`, Vitest 3.

---

## 1. Sumário Executivo

A migração foi concluída com sucesso de ponta a ponta sem qualquer necessidade de intervenção externa. O banco local legado e suas dependências obsoletas (`mysql2`, variáveis `DB_*`, tabelas fragmentadas) foram completamente descontinuados e removidos.

O sistema agora opera integralmente sob o TiDB Cloud com:
1. Schema relacional unificado e normalizado com collation `utf8mb4_unicode_ci`.
2. Controle de concorrência e reserva atômica de estoque em transações distribuídas (sem race condition e sem possibilidade de saldo negativo).
3. Rastreabilidade total com tabela de movimentações append-only (`movimentacoes`).
4. Autenticação unificada na entidade `Funcionario` com enum `PapelFuncionario` (`ADMIN`, `ALMOXARIFE`, `OPERADOR`, `USUARIO`).
5. Suíte de testes automatizados com 100% de aprovação (47 testes passando), incluindo 8 testes de integração executados diretamente contra a instância real do TiDB Cloud (`marcon_almoxarifado_test`).
6. Build de produção do Next.js 16 compilado com sucesso com TypeScript e Turbopack.

---

## 2. O Que Mudou

### 2.1. Arquitetura de Dados
- **Eliminação do banco legado:** O antigo driver `mysql2` e o arquivo `lib/mysql.ts` foram removidos.
- **Normalização de Catálogo e Estoque:**
  - Substituição de `EstoqueItem` e `DepositoItem` por `Item` (catálogo geral, unidades, códigos fiscais, ponto de pedido) e `SaldoEstoque` associado a `LocalEstoque` (ex.: locais `estoque` e `deposito`).
- **Sequenciador Concorrente:**
  - Criação da tabela `sequencia_requisicao` que gera números legíveis (ex.: `REQ-000001`, `REQ-000002`) de forma atômica e sequencial no TiDB, contornando a alocação em blocos do `AUTO_INCREMENT`.
- **Rastreabilidade e Auditoria:**
  - `Movimentacao`: registro imutável de qualquer alteração física (`ENTRADA`, `SAIDA`, `RESERVA`, `LIBERACAO_RESERVA`, `AJUSTE`) com snapshot de saldos após o evento.
  - `Auditoria`: registro de eventos de segurança e alterações administrativas.

### 2.2. Camada de API e Rotas Reescritas
Todas as rotas em `app/api/**` foram migradas para o Prisma Client com validações server-side rigorosas, autorização por papel e transações atômicas:
- `/api/auth/login`: login unificado por portal (Admin com login e Almoxarifado com crachá).
- `/api/auth/me`: expõe os dados do funcionário com retrocompatibilidade de `role`.
- `/api/auth/change-password`: troca segura de senhas com bcrypt (custo 12).
- `/api/admin/users`: gestão de usuários com RBAC no servidor, auditoria e bloqueio de autodesativação do administrador.
- `/api/estoque`: cadastro de itens, conversão de embalagens em unidades base, incremento atômico via `Serializable` isolation e registro de movimentação de entrada/ajuste.
- `/api/deposito`: gestão de sobras no local depósito com movimentação auditada.
- `/api/itens`: catálogo consolidado com cálculo dinâmico de saldo disponível (`quantidade - reservada`).
- `/api/requests`: criação de requisições individuais ou multi-item com reserva atômica condicional; retorno de HTTP 409 em caso de estoque insuficiente com rollback total.
- `/api/almoxarifado/requisicoes`: listagem da fila de requisições ativas.
- `/api/almoxarifado/requisicoes/[numeroPedido]`: ciclo completo da requisição (`assumir`, `devolver`, `anular`, `finalizar`) com baixa real na separação e liberação de reserva na anulação ou item não atendido.
- `/api/almoxarifado/resumo`: agregações em tempo real de materiais ativos, itens sem saldo, requisições pendentes e sobras.
- `/api/historico`: histórico auditável em tempo real consumido pelo painel web.

### 2.3. Limpeza de Dependências e Configurações
- `lib/mysql.ts`: deletado.
- `lib/requisicoes-db.ts`: reescrito integralmente para Prisma com consultas otimizadas.
- Variáveis `DB_*`: removidas de todos os arquivos. `.env.example` atualizado apenas com `DATABASE_URL` (placeholder seguro) e variáveis de seed.
- `.gitignore`: atualizado para cobrir `.seed-credentials.local` e `.env*`.
- Scripts legados (`check-stock-direct.cjs` com hosts hardcoded): deletados.

---

## 3. Regra de Negócio de Estoque Implementada

1. **Criação de Requisição:**
   - Para cada item solicitado, a aplicação executa um `UPDATE saldos_estoque SET reservada = reservada + q WHERE (quantidade - reservada) >= q`.
   - Se o número de linhas afetadas for zero, a transação aborta imediatamente com erro HTTP 409 (`code: "SALDO_INSUFICIENTE"`), informando o saldo disponível e sem criar nenhuma requisição no banco.
   - Em caso de sucesso, registra `Movimentacao` de tipo `RESERVA`.

2. **Separação de Item (Baixa Real):**
   - Ao confirmar a separação, executa baixa real atômica: `quantidade -= q` e `reservada -= q`.
   - Registra `Movimentacao` de tipo `SAIDA`.
   - **Idempotência (duplo clique):** Se o item já estiver com status `SEPARADO`, a operação reconhece a resolução prévia e não executa baixa duplicada.

3. **Item Não Separado (com motivo) ou Requisição Anulada:**
   - A reserva é imediatamente liberada: `reservada = GREATEST(0, reservada - q)` mantendo `quantidade` intacta.
   - Registra `Movimentacao` de tipo `LIBERACAO_RESERVA` com o motivo informado.

4. **Invariantes do Banco:**
   - Saldo físico nunca fica negativo (`quantidade >= 0`).
   - Quantidade reservada nunca excede a quantidade física (`0 <= reservada <= quantidade`).
   - Nenhuma mutação de estoque ocorre sem uma linha correspondente em `movimentacoes`.

---

## 4. Resultados dos Testes e Validações

### 4.1. Suíte Vitest (47 testes — 100% Passing)
```
 ✓ lib/stock-status.test.ts (2 tests)
 ✓ app/api/almoxarifado/resumo/route.test.ts (3 tests)
 ✓ app/api/auth/login/route.test.ts (3 tests)
 ✓ app/api/estoque/route.test.ts (24 tests)
 ✓ app/api/admin/users/route.test.ts (7 tests)
 ✓ tests/integration-tidb.test.ts (8 tests contra TiDB Cloud real)

Test Files  6 passed (6)
     Tests  47 passed (47)
  Duration  12.45s
```

### 4.2. Testes de Integração Executados contra TiDB Cloud Starter (`marcon_almoxarifado_test`):
- `1. Criação com reserva`: reservou quantidade solicitada e gravou `Movimentacao` de `RESERVA`.
- `2. Estoque insuficiente`: rejeitou com HTTP 409 e realizou rollback total (zero requisições/movimentações criadas).
- `3. Concorrência`: 5 requisições paralelas simultâneas disputando 1 única unidade — exatamente 1 venceu, 4 falharam de forma segura.
- `4. Separação de item`: efetuou baixa real física e registrou `Movimentacao` de `SAIDA`.
- `5. Duplo clique (idempotência)`: segundo clique retornou `already_done` sem baixar o saldo duas vezes.
- `6. Item não separado`: liberou a reserva e registrou `LIBERACAO_RESERVA` com a justificativa do operador.
- `7. Anulação de requisição`: liberou a reserva de todos os itens multi-item associados.
- `8. Invariantes de consistência`: validou que todos os saldos no banco mantêm `quantidade >= 0` e `reservada <= quantidade`.

### 4.3. ESLint e Build
- `npm run lint`: **0 erros, 0 avisos**.
- `npm run build`: **Compilação bem-sucedida** de todas as 33 rotas estáticas e dinâmicas com Next.js 16 e Turbopack.

### 4.4. Seeds e Idempotência
- `npm run seed`: cria 22 itens realistas de catálogo com saldos nos locais `estoque` e `deposito`, e 6 funcionários fictícios para cada papel. Testado rodando 2 vezes consecutivas com garantia de zero duplicatas.
- `npm run seed:admin`: cria ou atualiza o administrador do sistema de forma idempotente com senha forte e hash bcrypt.

---

## 5. Riscos Conhecidos e Mitigações

1. **Latência de Rede para TiDB Cloud Starter (`sa-east-1`):**
   - *Risco:* Conexões abertas individualmente por requisição HTTP podem gerar overhead.
   - *Mitigação:* O pool de conexões MariaDB foi dimensionado com `connectionLimit: 5`, reutilizado globalmente via `globalThis` e com `idleTimeout: 30s` (abaixo dos 60s de timeout do TiDB Starter).
2. **Ambiente com Múltiplos Nós TiDB:**
   - *Risco:* Falhas de atomicidade se dependesse de variáveis de sessão ou locks de aplicação.
   - *Mitigação:* Uso estrito de transações ACID do TiDB e comandos SQL condicionais com `WHERE` no próprio motor de storage.
3. **Segurança de Credenciais:**
   - *Risco:* Exposição de senhas de teste.
   - *Mitigação:* As senhas geradas aleatoriamente no seed são salvas exclusivamente em `.seed-credentials.local`, arquivo explicitamente ignorado no `.gitignore`. Nenhuma senha é exposta nos logs ou no console.

---

## 6. Procedimento de Rollback (Como Reverter)

Caso seja necessário reverter a base para o estado pré-migração:

1. **Retornar para a branch principal:**
   ```bash
   git checkout main
   ```
2. **Restaurar as migrations antigas:**
   ```bash
   # Mover os arquivos de prisma/migrations_old/ de volta para prisma/migrations/
   # E restaurar o schema.prisma original do commit da branch main
   git checkout main -- prisma/
   ```
3. **Reinstalar dependências originais se necessário:**
   ```bash
   npm install
   ```
4. **Reverter o banco TiDB (se aplicável):**
   - Como o banco `marcon_almoxarifado` original estava vazio antes do início deste trabalho, ele pode ser dropado ou resetado sem perda de dados históricos de produção.
