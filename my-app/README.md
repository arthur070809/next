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

> Nota: ao rodar `npx tsc --noEmit` antes de qualquer `next build` ou `next dev`, o TypeScript pode reportar um falso positivo de `LayoutProps` em `app/layout.tsx` porque os tipos gerados pelo Next ainda não existem em `.next/types/`. Rodar `npx next typegen` (ou abrir o app com `next dev` uma vez) antes da checagem resolve o problema sem afetar a aplicação.

## Autenticacao por aparelho e rosto

Usuarios do almoxarifado passam por senha, aparelho confiavel/WebAuthn e, depois, desafio facial emitido pelo servidor. A sessao somente e criada por `app/api/auth/login/face/verify/route.ts`; nenhum resultado de comparacao enviado pelo navegador e aceito.

O servico facial e externo ao Next.js e deve expor `POST /v1/enroll`, recebendo `{ "captures": [data-uri, ...] }` e retornando `{ "embeddings": [[...], ...] }`, e `POST /v1/verify`, retornando somente `{ "livenessPassed": boolean, "matched": boolean }`. Use HTTPS entre os servicos, `FACE_SERVICE_TOKEN`, validacao de tipo/tamanho/dimensoes e memoria volatil para imagens.

O cadastro e presencial em `/admin/biometria`, somente para admin e para funcionarios admin/almoxarife. O admin escolhe o funcionario antes de abrir a camera; substituir um cadastro existente exige confirmacao explicita. Nao ha captura manual nem galeria: ao detectar continuamente por pelo menos 1 s um rosto unico, frontal, centralizado, no tamanho correto, nitido, iluminado e com olhos visiveis, a tela orienta uma piscada e coleta automaticamente cinco quadros ao vivo. Os quadros sao limitados a 350 KB cada para manter a requisicao abaixo dos limites serverless usuais.

Os cinco quadros sao enviados temporariamente a `FACE_SERVICE_URL/v1/enroll` com o nonce da sessao persistida. O servico deve aceitar uma rajada frontal com piscada e devolver um embedding por quadro. O backend descarta no maximo um discrepante pela distancia a mediana, calcula a media dos restantes, normaliza e armazena somente um vetor por funcionario. Nenhuma foto nem quadro e persistido; eles transitam pelo servico de reconhecimento e ficam apenas na memoria durante o processamento. O vetor e cifrado com AES-256-GCM em `FaceTemplate` no TiDB, com IV aleatorio por registro, tag, versao do modelo, consentimento, autor e timestamps.

Configure `FACE_EMBEDDING_MODEL_VERSION` com a versao exata usada por `/v1/enroll` e `/v1/verify`; template versionado diferente falha fechado. Registros anteriores a esta coluna recebem `legacy-unknown` e continuam elegiveis ao fluxo legado, sem afirmar compatibilidade medida. Novos cadastros exigem tambem `FACE_EMBEDDING_ENCRYPTION_KEY` (32 bytes hexadecimais ou Base64) e `FACE_SERVICE_URL`. Com `FACE_DIAGNOSTICS_ENABLED=true`, somente a tela administrativa e os logs de cadastro mostram metricas sem imagens, vetores ou dados pessoais.

O fornecedor deve confirmar licenca comercial do modelo e fornecer PAD/liveness adequado. Pesos do InsightFace/ArcFace nao devem ser tratados como liberados para uso comercial sem verificacao da licenca. O backend falha fechado quando `FACE_SERVICE_URL` ou a chave de embeddings nao estao configuradas.

Uma indisponibilidade, resposta invalida ou threshold `FACE_MATCH_THRESHOLD` vazio/negativo/nao finito e reportada como indisponibilidade tecnica (HTTP 503), sem consumir uma tentativa de identidade. O threshold predefinido permanece `0.42`; nao o ajuste sem medicao FAR/FRR do fornecedor. Para diagnosticar qual deploy esta servindo as telas de camera, consulte `GET /api/diagnostics/build` (retorna apenas os primeiros oito caracteres hexadecimais do commit da Vercel ou `local`).

### Migration e rollback

Antes de aplicar em producao, faca backup do MySQL e valide a migration em uma copia. A partir de `next/my-app`:

```powershell
npx prisma migrate status --config prisma7.config.ts
npx prisma migrate deploy --config prisma7.config.ts
npx prisma generate
```

A migration `20261002120000_add_auth_e_facial` cria templates criptografados, desafios e tentativas. Esta alteracao adiciona `20261007150000_face_template_version`, que cria `model_version` e `atualizado_em`; o SQL para aplicacao manual esta em `prisma/manual_sql/face_template_version.sql` e a migration Prisma correspondente em `prisma/migrations/20261007150000_face_template_version/migration.sql`. Aplique o SQL manualmente no banco `marcon_demo` pelo DBeaver, depois de backup e antes de publicar o codigo que seleciona essas colunas. Nao use `migrate dev`, `migrate reset` nem `db push`. O rollback recomendado e restaurar o backup; nao remova colunas/tabelas biometricas sem avaliar os templates existentes.

### Operacao segura e LGPD

Gere `FACE_EMBEDDING_ENCRYPTION_KEY` com 32 bytes aleatorios, armazene-a em Secret Manager/KMS e nunca a versione. Para rotacionar, mantenha a chave antiga somente durante a migracao, recripte todos os templates, valide a contagem e remova a antiga. O limiar `0.42` de login e mantido sem alteracao e e ponto de partida, nao garantia: FAR/FRR precisam ser medidos pelo fornecedor no ambiente real.

A finalidade e autenticar funcionarios do almoxarifado. O dado sensivel e o embedding facial; fotos nao sao armazenadas. Templates ficam cifrados no MySQL, com acesso restrito, retencao enquanto o acesso for necessario e exclusao no desligamento ou revogacao. O termo deve registrar consentimento especifico, versao, data, coletor, finalidade, prazo e direito de revogacao. Riscos principais: falsos positivos/negativos, deepfake, falha de camera e comprometimento da chave. Controles: aparelho confiavel, WebAuthn, desafio ativo, nonce, rate limit, bloqueio, auditoria sem biometria e acesso emergencial auditado. RH/juridico deve aprovar a base legal e o RIPD antes da ativacao.

### Validacao manual

1. Admin seleciona um almoxarife, confirma a identidade presencialmente e o consentimento; se houver template, confirma a substituicao antes de ligar a camera.
2. Em aparelho com camera, posicione um rosto na oval, olhe de frente e pisque; a captura dos cinco quadros e o salvamento devem acontecer automaticamente. Verifique que o banco guarda apenas um vetor cifrado e que recarregar a pagina nao exige nova captura.
3. Usuario almoxarife entra com cracha/senha, confirma o aparelho, executa o desafio facial e chega ao Almoxarifado. Admin sem template segue pelo TOTP; operador continua sem login facial; contas demo continuam no fluxo demo.
4. Repita com outra pessoa, nonce expirado/reutilizado e aparelho revogado; todos devem falhar de forma segura.
5. Admin concede acesso emergencial com justificativa e valide uso unico/expiracao.
6. Desative o usuario e confirme exclusao dos templates, desafios e sessoes; usuario comum recebe 403 nas rotas administrativas e visitante 401.

Pendencias de producao: confirmar com o fornecedor que `/v1/enroll` aceita cinco quadros frontais com piscada (sem poses laterais), validar PAD certificado contra deepfakes, medir FAR/FRR com dados reais, confirmar compatibilidade dos vetores `legacy-unknown`, testar a captura em aparelhos reais e manter TOTP habilitado para o admin. WebAuthn local e vinculo do aparelho, nao prova de identidade facial.
