# Almoxarifado Marcon

Sistema de gestão de almoxarifado industrial desenvolvido com **Next.js 16 (App Router)**, **React 19**, **TypeScript**, **Prisma 7.10** com `@prisma/adapter-mariadb` e banco de dados **TiDB Cloud Starter** (MySQL 8.5 compatível, região AWS `sa-east-1`).

---

## 🚀 Arquitetura & Tecnologias

- **Next.js 16 (App Router) & React 19:** Server Components, Server Actions e rotas de API com validação estrita.
- **Prisma 7.10 & @prisma/adapter-mariadb:** Modelagem relacional tipada com pool de conexões otimizado para TiDB Serverless.
- **TiDB Cloud Starter v8.5.x:** Banco distribuído MySQL-compatível com charset `utf8mb4` e collation `utf8mb4_unicode_ci`.
- **Vitest 3:** Testes unitários de rotas e testes de integração de concorrência com o banco real.

---

## ⚙️ Variáveis de Ambiente

Crie o arquivo `.env.local` na raiz do projeto (`my-app/`):

```bash
# Conexão com TiDB Cloud Starter
# Nota: sslaccept=strict é utilizado pelo CLI do Prisma (schema engine e migrations)
DATABASE_URL="mysql://<USUARIO>:<SENHA>@<GATEWAY_TIDB>:4000/marcon_almoxarifado?sslaccept=strict"

# Opcional: Variáveis para criação do Administrador via seed
# ADMIN_LOGIN="admin"
# ADMIN_PASSWORD="sua-senha-segura"
# ADMIN_NAME="Administrador do Sistema"

# Opcional: Senha padrão para os funcionários fictícios de teste
# SEED_DEFAULT_PASSWORD="senha-para-desenvolvimento"
```

> **Atenção:** Nunca comite `.env*` ou `.seed-credentials.local`. O repositório está configurado no `.gitignore` para bloquear o versionamento de credenciais locais.

---

## 📦 Configuração do Banco de Dados & Migrations

O projeto utiliza a estratégia **Prisma Migrate Deploy** (com `prisma7.config.ts`), dispensando o shadow database incompatível com ambientes serverless compartilhados.

### 1. Aplicar a Migration Canônica
```bash
npx prisma migrate deploy --config prisma7.config.ts
```

### 2. Gerar o Prisma Client
```bash
npx prisma generate --config prisma7.config.ts
```

---

## 🗄️ Carga de Dados Inicial (Seeds Idempotentes)

Os scripts de seed foram desenvolvidos para serem 100% idempotentes (podem ser executados múltiplas vezes sem duplicar itens ou usuários):

### Catálogo de Materiais e Funcionários Fictícios
Popula ~22 itens industriais com saldos iniciais em `estoque` (Central) e `deposito`, registrando movimentações de `ENTRADA`, além de funcionários para cada papel (`ADMIN`, `ALMOXARIFE`, `OPERADOR`, `USUARIO`).
```bash
npm run seed
```
*Se `SEED_DEFAULT_PASSWORD` não for informada, senhas fortes e aleatórias serão geradas e salvas em `.seed-credentials.local`.*

### Administrador do Sistema
Para criar ou atualizar as credenciais do administrador principal:
```bash
ADMIN_LOGIN="admin" ADMIN_PASSWORD="SuaSenhaForte123!" npm run seed:admin
```

---

## 🧪 Testes Automatizados

A suíte de testes combina testes unitários rápidos e testes de integração com transações concorrentes reais no TiDB (`marcon_almoxarifado_test`):

```bash
npm test
```

### O que os testes cobrem:
1. **Criação com Reserva:** Reserva saldo de estoque e grava evento `RESERVA`.
2. **Estoque Insuficiente:** Rejeição com HTTP 409 e rollback total (zero registros criados).
3. **Concorrência Atômica:** $N$ requisições paralelas simultâneas disputando o último item (exatamente 1 vence, as demais falham de forma segura).
4. **Separação de Itens (Baixa Real):** Desconto simultâneo de quantidade física e reservada com evento `SAIDA`.
5. **Idempotência (Duplo Clique):** Múltiplos envios de separação não descontam saldo duas vezes.
6. **Cancelamento & Não Atendimento:** Liberação imediata da reserva com evento `LIBERACAO_RESERVA`.
7. **RBAC & Permissões:** Validação de acesso por papel no servidor.
8. **Invariantes do Banco:** Garantia de que `quantidade >= 0` e `reservada <= quantidade` em todo o ciclo de vida.

---

## 📦 Regras de Negócio de Estoque

```
[Requisição Criada] ──> Saldo: reservada += q (Condicional atômico)
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
      [Item Separado]            [Item Não Separado]
             │                     ou [Cancelada]
             ▼                           ▼
Saldo: quantidade -= q             Saldo: reservada -= q
       reservada -= q              (Libera reserva para outros)
   (Movimentação SAÍDA)             (Movimentação LIBERAÇÃO)
```

- **Disponível:** $\text{disponível} = \text{quantidade} - \text{reservada}$.
- **Sem Ler-Depois-Escrever:** Todas as atualizações utilizam `WHERE` condicional no SQL para garantir atomicidade no storage engine.
- **Append-Only:** O saldo é uma projeção; toda mutação gera uma linha permanente em `movimentacoes`.

---

## 💻 Desenvolvimento Local & Build

```bash
# Rodar linter
npm run lint

# Rodar servidor de desenvolvimento
npm run dev

# Compilar build de produção
npm run build
```
