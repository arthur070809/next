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

## Autenticacao facial local

Cadastro presencial em `/admin/biometria`, restrito a admin e aos funcionarios admin/almoxarife. A captura ao vivo e processada no navegador pelo `@vladmandic/human` 3.3.6 e pelo modelo BecauseofAI MobileFace V3 (256 dimensoes); a biblioteca e os modelos sao servidos do proprio app em `public/models/human/`, sem CDN ou servico facial externo. Na inicializacao carrega detector e malha; o MobileFace carrega em seguida, em paralelo com a camera; emocao so carrega para desafio de sorriso. Iris, antispoof, liveness, hand, body, object e segmentation ficam desativados. Os assets MobileFace estao fixados no commit `a4bcf70ece5f57a53fb45984d76a9ca143206eca`; seus SHA-256 sao `B62D89D9E1401A2572E011E8691699F2432C1A6F56CDA0DAD7DDBDECACF1BBAB` (`mobileface.json`) e `403B53D95120C93C8417951B05D816197AA1794372B47E7629801156C701BE5C` (`mobileface.bin`). Os modelos publicados tem cerca de 7,97 MB no total; detector e malha somam cerca de 2,19 MB, MobileFace 2,22 MB e emocao 0,84 MB. `public/models/human/NOTICE.txt` registra as licencas declaradas; confirme tambem os termos do modelo original e de seus dados de treinamento para o uso comercial pretendido.

O admin seleciona o funcionario; nome e cracha permanecem visiveis durante o cadastro. Nao ha galeria nem botao de captura: tocar em **Iniciar cadastro** liga a camera e envia automaticamente o melhor vetor utilizavel. Substituir template existente sempre exige confirmacao. Por padrao, as duas caixas de confirmacao nao sao exibidas durante esta fase de teste. `FACE_ENROLL_REQUIRE_CONSENT=true` restaura o aviso/checkbox e a validacao correspondente no servidor. Sem consentimento coletado, as colunas existentes recebem `consentVersion=not-collected` e a data do cadastro; nao ha mudanca de schema. **TODO LGPD: o aviso de privacidade precisa voltar e ser revisado pelo juridico antes de qualquer uso com funcionarios reais.**

`NEXT_PUBLIC_FACE_REQUIRE_BLINK=false` e o padrao de teste para cadastro e login; defina `true` para exigir o desafio de vivacidade que o cliente ja executa. Com a opcao desligada, uma foto ou video reproduzido pode passar pelas verificacoes do navegador. Isso nao remove nem reduz a decisao de identidade do servidor: nonce de uso unico, validade do desafio, limite de tentativas, validacao do vetor, chave AES-GCM, versao do modelo e `FACE_MOBILEFACE_MATCH_THRESHOLD` continuam obrigatorios. Ainda assim, a piscada no cliente nao e prova criptografica de uma camera real.

Os limites de captura estao centralizados em `lib/facial/face-quality.ts` (`FACE_QUALITY_LIMITS`):

| Medida | Valor inicial |
|---|---:|
| Confianca minima Human | 0,45 |
| Largura do rosto / quadro | 15% a 90% |
| Centro do rosto / quadro | X: 15% a 85%; Y: 10% a 90% |
| Yaw, pitch e roll | ±25° |
| Nitidez minima | 5,5 |
| Brilho medio | 30 a 235 |
| Dois rostos | aceita o maior so se a area for pelo menos 1,5× a do segundo |
| Olhos para selecionar/enviar quadro | EAR ≥ 0,22; o olho pode fechar durante a piscada exigida |
| Amostragem | a cada 150 ms (aprox. 6,7 quadros/s) |
| Rajada | 3 quadros validos ou ate 5; captura imediata se o primeiro pontuar ≥0,92 |
| Tentativas automaticas de login | 3 por sessao de camera, no minimo 2 s entre tentativas |
| Orientacao ao usuario | uma mensagem generica apos 3 s sem quadro valido |

A nitidez e a media da diferenca absoluta de luminancia entre pixels vizinhos, depois de reduzir o quadro a 96×72; e um filtro simples contra borrado severo, nao uma metrica biometrica. Calibre `minimumSharpness` usando os valores do painel de diagnostico em aparelhos reais, incluindo cenas nítidas e borradas, sem selecionar o limite com base apenas em uma camera. Se houver duvida, deixe o limite baixo e registre o efeito nos dados de calibracao; nao use esta metrica para inferir identidade. Os pesos Human sao carregados sob demanda na pagina facial e mantidos em cache para tentativas seguintes.

O carregamento usa backend WebGL e, se falhar, CPU. O backend WASM e explicitamente pulado enquanto seus binarios nao forem publicados localmente; os defaults CDN do Human nao sao usados. A interface avisa apos 15 s e encerra com erro aos 60 s. Com `FACE_DIAGNOSTICS_ENABLED=true`, `/admin/biometria` mostra etapa/backend, HTTP/bytes/tempo de cada modelo, erro original e tentativas de constraints de camera, e permite copiar um JSON sem dados pessoais ou biometria. Os modelos recebem `Cache-Control: public, max-age=31536000, immutable`; ao trocar os arquivos, publique-os sob novos nomes/versionamento para evitar cache antigo. A camera tenta 1280×720 frontal, frontal simples e depois `video: true`. O preview e testado explicitamente via `play()` e tem `autoPlay`, `muted` e `playsInline`.

Os templates anteriores, inclusive `legacy-unknown`, sao incompativeis e falham fechado; cada funcionario precisa de novo cadastro. O template novo e um vetor MobileFace de 256 componentes normalizados, cifrado AES-256-GCM com IV aleatorio. A versao exata a configurar e `FACE_EMBEDDING_MODEL_VERSION=human-3.3.6-mobileface-v3-a4bcf70`; a chave continua em `FACE_EMBEDDING_ENCRYPTION_KEY` (32 bytes hex ou Base64).

`FACE_LOGIN_ENABLED` habilita o fluxo por padrao (`true`); definir `false` esconde o botao e bloqueia as APIs de login facial, deixando o login por codigo/senha disponivel. `FACE_DIAGNOSTICS_ENABLED=true` permite que o admin autenticado veja distancias reais de uma captura contra templates compativeis na tela de cadastro. Nenhum vetor, imagem, nonce ou distancia biometrica e registrado em logs.

O valor anterior `FACE_MATCH_THRESHOLD=0.42` era do descritor anterior e nao e reutilizado. `FACE_MOBILEFACE_MATCH_THRESHOLD` nao tem default: ate ser definido a partir de testes controlados com capturas reais, o servidor recusa autenticar/fazer verificacao de duplicidade (HTTP 503). O benchmark upstream publicado para MobileFace V3 informa 95,466% de acuracia LFW, mas nao fornece FAR/FRR aplicavel a este sistema. As medidas da base de demonstração nao substituem calibracao. Nao habilite login facial em producao ate avaliar distancias de mesma pessoa e pessoas diferentes em condicoes reais e escolher o ponto operacional. O TOTP continua sendo usado somente se estiver configurado; admin sem template pode entrar com cracha e senha. Para diagnosticar o deploy, consulte `GET /api/diagnostics/build`.

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

1. Admin seleciona o funcionario, confere nome e cracha presencialmente; se houver template, confirma a substituicao antes de iniciar a camera. Ative consentimento apenas com aviso revisado pelo juridico.
2. Em aparelho com camera, inicie o cadastro e posicione o rosto com iluminacao suficiente. A captura melhor avaliada deve ser enviada e salva automaticamente. Se `NEXT_PUBLIC_FACE_REQUIRE_BLINK=true`, conclua a piscada. Verifique que o banco guarda apenas vetor cifrado e que recarregar a pagina nao exige nova captura.
3. Almoxarife entra com cracha/senha, confirma o aparelho e, se habilitado, executa o desafio facial; admin sem template continua podendo entrar com cracha/senha; operador continua sem login facial; contas demo continuam no fluxo demo.
4. Repita com outra pessoa, nonce expirado/reutilizado e aparelho revogado; todos devem falhar de forma segura.
5. Com `FACE_DIAGNOSTICS_ENABLED=true`, admin verifica distancias de mesmo/diferente usuario em conjunto controlado. Nao habilite correspondencia facial em producao antes de medir FAR/FRR e escolher o limiar operacional.
6. Admin concede acesso emergencial com justificativa e valide uso unico/expiracao. Desative um usuario e confirme exclusao de templates, desafios e sessoes; usuario comum recebe 403 nas rotas administrativas e visitante 401.

Pendencias de producao: medir FAR/FRR com dados reais, validar PAD contra deepfakes, testar a captura em aparelhos reais e escolher um limiar seguro antes de definir `FACE_MOBILEFACE_MATCH_THRESHOLD`. Qualidade mais permissiva e piscada desligada podem ampliar variacao na distribuicao de distancias e aumentar falsas recusas ou aceitacoes; os dados coletados em modo de teste precisam ser identificados com os limites e flags usados e nao devem ser misturados sem controle. Nenhum resultado em celular e afirmado sem teste fisico.
