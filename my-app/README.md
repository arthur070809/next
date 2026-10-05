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
npm run seed -- --yes
```
Os comandos de seed/reset da aplicação só aceitam o banco cujo nome seja exatamente `DEMO_DB_NOME` e termine em `_demo`; recusam `NODE_ENV=production`, exibem host/banco sem credenciais e exigem `--yes`. O teste de integração é uma exceção separada: exige banco terminado em `_test`, conforme descrito abaixo. Para demonstração, prefira o fixture dedicado.

### Administrador do Sistema
Para criar ou atualizar as credenciais do administrador principal:
```bash
ADMIN_LOGIN="admin" ADMIN_PASSWORD="SuaSenhaForte123!" npm run seed:admin -- --yes
```

### Fixture da demonstração Vercel
O fixture usa somente dez materiais fictícios e as contas demo. Ele não cria lote mínimo nem um fluxo de aprovação, pois esses campos/estados não existem no schema atual.
```bash
npm run seed:demo -- --yes
npm run reset:demo -- --yes
```
O reset limpa requisições, movimentos, reservas e auditorias de requisição; preserva funcionários e catálogo. O seed e o reset recusam qualquer banco que não corresponda exatamente a `DEMO_DB_NOME` com sufixo `_demo`.

---

## 🧪 Testes Automatizados

A suíte padrão executa os testes unitários e mocks sem acessar banco:

```bash
npm test
```

O teste de integração destrutivo é separado; ele exige que `DATABASE_URL` aponte para um banco cujo nome termine em `_test`:

```bash
npm run test:integration
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


## Autenticacao por aparelho e rosto

Usuarios do almoxarifado passam por senha, aparelho confiavel/WebAuthn e, depois, desafio facial emitido pelo servidor. A sessao somente e criada por `app/api/auth/login/face/verify/route.ts`; nenhum resultado de comparacao enviado pelo navegador e aceito.

O servico facial e externo ao Next.js e deve expor `POST /v1/enroll`, recebendo `{ "captures": [data-uri, ...] }` e retornando `{ "embeddings": [[...], ...] }`, e `POST /v1/verify`, retornando somente `{ "livenessPassed": boolean, "matched": boolean }`. Use HTTPS entre os servicos, `FACE_SERVICE_TOKEN`, validacao de tipo/tamanho/dimensoes e memoria volatil para imagens.

O fornecedor deve confirmar licenca comercial do modelo e fornecer PAD/liveness adequado. Pesos do InsightFace/ArcFace nao devem ser tratados como liberados para uso comercial sem verificacao da licenca. O backend falha fechado quando `FACE_SERVICE_URL` ou a chave de embeddings nao estao configuradas.

### Migration e rollback

Antes de aplicar em producao, faca backup do MySQL e valide a migration em uma copia. A partir de `next/my-app`:

```powershell
npx prisma migrate status --config prisma7.config.ts
npx prisma migrate deploy --config prisma7.config.ts
npx prisma generate
```

A migration `20261002120000_add_auth_e_facial` cria templates criptografados, desafios e tentativas. O rollback recomendado e restaurar o backup. Em janela de manutencao, apos confirmar impacto, as tabelas podem ser removidas com `DROP TABLE face_auth_attempts, liveness_challenges, face_templates`.

### Operacao segura e LGPD

Gere `FACE_EMBEDDING_ENCRYPTION_KEY` com 32 bytes aleatorios, armazene-a em Secret Manager/KMS e nunca a versione. Para rotacionar, mantenha a chave antiga somente durante a migracao, recripte todos os templates, valide a contagem e remova a antiga. O limiar `0.42` e ponto de partida, nao garantia: FAR/FRR precisam ser medidos pelo fornecedor no ambiente real.

A finalidade e autenticar funcionarios do almoxarifado. O dado sensivel e o embedding facial; fotos nao sao armazenadas. Templates ficam cifrados no MySQL, com acesso restrito, retencao enquanto o acesso for necessario e exclusao no desligamento ou revogacao. O termo deve registrar consentimento especifico, versao, data, coletor, finalidade, prazo e direito de revogacao. Riscos principais: falsos positivos/negativos, deepfake, falha de camera e comprometimento da chave. Controles: aparelho confiavel, WebAuthn, desafio ativo, nonce, rate limit, bloqueio, auditoria sem biometria e acesso emergencial auditado. RH/juridico deve aprovar a base legal e o RIPD antes da ativacao.

### Validacao manual

1. Admin cria um aparelho, mostra o codigo de uso unico e conclui o pareamento no celular.
2. Admin coleta 3 a 5 amostras com consentimento, frente/giro/iluminacao adequada; capturas escuras, borradas, cortadas ou com varios rostos devem ser rejeitadas pelo servico.
3. Usuario entra com cracha e senha, confirma o aparelho, executa o desafio facial e chega ao Almoxarifado.
4. Repita com foto de foto, outra pessoa, nonce expirado/reutilizado e aparelho revogado; todos devem falhar com mensagem generica.
5. Admin concede acesso emergencial com justificativa e valide uso unico/expiracao.
6. Desative o usuario e confirme exclusao dos templates, desafios e sessoes; usuario comum recebe 403 nas rotas administrativas e visitante 401.

Pendencias de producao: validar PAD certificado contra deepfakes, medir FAR/FRR com dados reais, manter contingencia quando a camera falhar e manter TOTP habilitado para o admin. WebAuthn local e vinculo do aparelho, nao prova de identidade facial.
