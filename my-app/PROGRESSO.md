# Progresso da Migração — TiDB Cloud Starter & Prisma 7

## Checklist de Etapas

| Etapa | Status | Detalhes |
|---|---|---|
| Investigação inicial do codebase | ✅ Concluído | Mapeamento completo de schemas, dependências e rotas |
| Criação da branch de trabalho (`migracao-tidb-prisma`) | ✅ Concluído | Branch isolada sem tocar na `main` |
| Backup das migrations antigas (`prisma/migrations_old/`) | ✅ Concluído | 6 migrations antigas arquivadas |
| Modelagem completa do schema (`prisma/schema.prisma`) | ✅ Concluído | Item, LocalEstoque, SaldoEstoque, Funcionario, Sessao, Sequencia, Requisicao, RequisicaoItem, Movimentacao, Auditoria |
| Geração e revisão da migration canônica (`20261002000000_initial_schema`) | ✅ Concluído | Collation utf8mb4_unicode_ci, FKs explícitas, índices compostos |
| Criação e teste do banco de teste (`marcon_almoxarifado_test`) | ✅ Concluído | Criado no TiDB via script TLS |
| Aplicação da migration no banco de produção (`marcon_almoxarifado`) | ✅ Concluído | `prisma migrate deploy` executado com sucesso |
| Geração do Prisma Client (`generated/prisma`) | ✅ Concluído | Prisma Client 7.10.0 gerado com `@prisma/adapter-mariadb` |
| Configuração de conexão e pool no TiDB (`lib/prisma.ts`) | ✅ Concluído | `mariadb.Pool` com `ssl: true`, connectionLimit: 5, idleTimeout: 30s |
| Reescrita da autenticação e RBAC (`lib/auth.ts`, `/api/auth/*`) | ✅ Concluído | Enum `PapelFuncionario` e compatibilidade com UI |
| Reescrita das rotas de estoque (`/api/estoque`, `/api/deposito`, `/api/itens`) | ✅ Concluído | Modelos Item e SaldoEstoque com transações e movimentações |
| Reescrita das requisições e regras de negócio (`/api/requests`, `/api/almoxarifado/requisicoes/**`) | ✅ Concluído | Reserva atômica, baixa real, liberação e tratamento de concorrência |
| Reescrita do histórico e resumo (`/api/historico`, `/api/almoxarifado/resumo`) | ✅ Concluído | Rastreabilidade append-only de movimentações |
| Limpeza de código legado (`lib/mysql.ts`, variáveis `DB_*`, scripts antigos) | ✅ Concluído | Zero dependências obsoletas; `lib/mysql.ts` deletado |
| Scripts de seed idempotentes (`seed-stock.cjs`, `seed-admin.cjs`) | ✅ Concluído | 22 itens, 6 funcionários, senhas seguras em `.seed-credentials.local` |
| Testes unitários atualizados | ✅ Concluído | 39 testes unitários passando |
| Testes de integração concorrentes no TiDB real (`tests/integration-tidb.test.ts`) | ✅ Concluído | 8 testes passando contra `marcon_almoxarifado_test` (47 testes no total) |
| Verificação de lint (`npm run lint`) | ✅ Concluído | 0 erros, 0 avisos |
| Compilação de build (`npm run build`) | ✅ Concluído | Next.js 16 compilado com sucesso (33 rotas geradas) |
| Documentação (`DECISOES.md`, `RELATORIO_FINAL.md`, `README.md`) | ✅ Concluído | Documentação técnica completa e detalhada |

---

## Métricas Finais

- **Testes Vitest:** 47/47 passando (100%)
- **ESLint:** 0 erros, 0 warnings
- **Next.js Build:** Sucesso em todas as 33 páginas/rotas
- **Grep por `mysql2` e `DB_*`:** 0 ocorrências no código-fonte
- **Segurança:** 0 credenciais expostas no repositório; `.seed-credentials.local` e `.env*` cobertos no `.gitignore`.
