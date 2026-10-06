# Demonstração do Almoxarifado Marcon

Este roteiro usa somente o banco descartável de demonstração. Nunca aponte os comandos de carga/reset para o banco compartilhado. Os scripts exigem `DATABASE_URL` apontando exatamente para `DEMO_DB_NOME` terminado em `_demo`, recusam `NODE_ENV=production`, exibem host e banco sem credenciais e exigem `--yes`.

## Variáveis de ambiente

Configure os nomes abaixo sem compartilhar valores ou credenciais.

| Variável | Local (`.env.local`, ignorado pelo Git) | Vercel |
|---|---|---|
| `DATABASE_URL` | URL MySQL/TiDB do banco descartável de demo | Environment Variables do projeto, em Production e nos Preview Environments que forem ligados a um banco demo separado |
| `DEMO_DB_NOME` | Nome exato do banco descartável, terminado em `_demo` | Mesmo nome do banco indicado pela URL correspondente ao ambiente |
| `LOGIN_MODO_DEMO` | `true` para ativar o fluxo controlado de crachás demo | Definir como `true` somente no deploy que usa o banco descartável |
| `LOGIN_DEMO_CRACHAS` | Allowlist de crachás numéricos separados por vírgula | Mesmo conjunto de crachás fictícios do seed |
| `LOGIN_DEMO_TENTATIVAS_LIMITE` | Opcional; limite de falhas do login demo | Opcional |
| `LOGIN_DEMO_JANELA_MS` | Opcional; janela de tentativas em milissegundos | Opcional |
| `LOGIN_DEMO_BLOQUEIO_MS` | Opcional; duração do bloqueio em milissegundos | Opcional |
| `LOGIN_CHALLENGE_SECRET` | Segredo local com pelo menos 32 caracteres | Environment Variable; manter segredo forte e estável entre deploys |
| `TOTP_ENCRYPTION_KEY` | Chave de 32 bytes em hexadecimal ou Base64, se TOTP for usado | Environment Variable protegida |
| `FACE_EMBEDDING_ENCRYPTION_KEY` | Chave de 32 bytes em hexadecimal ou Base64, se biometria facial for usada | Environment Variable protegida |
| `FACE_SERVICE_URL` | URL do serviço facial, se habilitado | Environment Variable do serviço facial |
| `FACE_MATCH_THRESHOLD` | Opcional; limiar de comparação facial | Opcional |
| `LOGIN_FACIAL_OBRIGATORIO` | Configuração existente; não alterada por este roteiro | Configuração existente; não alterada por este roteiro |
| `NEXT_PUBLIC_APP_URL` | URL HTTPS local/de teste conforme o cenário | URL pública HTTPS da aplicação |
| `WEBAUTHN_ORIGIN` | Origem HTTPS usada para WebAuthn | Origem HTTPS exata do domínio publicado |
| `WEBAUTHN_RP_ID` | Host correspondente à origem WebAuthn | Host correspondente à origem WebAuthn |
| `WEBAUTHN_RP_NAME` | Nome apresentado pelo navegador | Opcional; nome apresentado pelo navegador |
| `NEXT_PUBLIC_VIAGEM_DEMO` | Recurso demo existente da viagem; manter configuração atual | Recurso demo existente da viagem; manter configuração atual |
| `FACE_SERVICE_TOKEN` | Token do serviço facial, se habilitado | Environment Variable protegida |
| `TRUSTED_DEVICE_LIMIT` | Opcional; limite de dispositivos confiáveis | Opcional |
| `DEV_EXTRA_ORIGINS` | Somente desenvolvimento; origens adicionais locais | Não necessário; ignorado em produção |
| `NODE_ENV` | Controlado pelo runtime local | Controlado pela Vercel |

`LOGIN_MODO_TESTE` e `LOGIN_TESTE_CRACHAS` são parte do modo de teste existente e não devem ser usados para ativar o demo em produção. O modo demo usa uma allowlist explícita; `"*"` não é suportado.

## Preparação do banco demo

1. Crie no provedor TiDB/MySQL um banco **descartável** cujo nome termine em `_demo`. Confirme pelo console do provedor que esse é o banco demo, não o banco compartilhado.
2. Configure `DATABASE_URL` e `DEMO_DB_NOME` localmente para apontarem exatamente para esse banco. Não coloque a URL com credenciais em comandos, capturas de tela ou logs.
3. Aplique as migrations pendentes e gere o cliente Prisma:

   ```bash
   npx prisma migrate deploy --config prisma7.config.ts
   npx prisma generate --config prisma7.config.ts
   ```

   `migrate deploy` é uma operação que altera o schema. Este documento apenas registra o comando solicitado; não foi executado durante esta alteração.
4. Confira o fixture planejado em `lib/demo-seed.ts` e rode o seed localmente em um terminal cujo `NODE_ENV` não seja `production`:

   ```bash
   npm run seed:demo
   ```

   Sem `--yes`, o script deve recusar a gravação. Para executá-la depois de conferir o host e o nome do banco exibidos:

   ```bash
   npm run seed:demo -- --yes
   ```

   O seed cria três funcionários fictícios (crachás `1111`, `2222`, `3333`), dez produtos, dois locais e requisições fictícias. Não roda na Vercel em produção.
   Para limpar e recriar somente os dados operacionais da demonstração, após conferir novamente o destino:

   ```bash
   npm run reset:demo -- --yes
   ```
5. Na Vercel, configure as variáveis da tabela para os ambientes que apontem exclusivamente ao banco descartável. Não reutilize a URL de produção para Preview, nem configure o banco compartilhado em nenhum ambiente de demonstração.

## Roteiro manual para jurados — 7 minutos

1. **0:00–0:40 — Acesso.** Abra o domínio HTTPS demo e entre como admin demo (`3333`). A apresentação não usa mais uma faixa global; confira os indicadores locais de dados simulados onde forem exibidos.
2. **0:40–1:20 — Visão geral.** Mostre o indicador de itens no ponto de pedido ou abaixo, além do acesso ao histórico e ressuprimento.
3. **1:20–2:20 — Solicitação.** Saia, entre como operador (`1111`), escolha produto, quantidade e setor, confira saldo livre/reservado e envie uma requisição.
4. **2:20–3:10 — Fila e responsável.** Entre como almoxarife (`2222`), localize a requisição e assuma. Mostre que a fila indica o responsável pelo atendimento.
5. **3:10–4:30 — Conferência.** Abra o checklist, confira o item e informe quantidade real. Para uma divergência, selecione um motivo suportado e mostre que a quantidade pedida e a separada ficam distintas.
6. **4:30–5:20 — Finalização.** Finalize a requisição. Mostre o resumo de baixa e as movimentações geradas; não envie a ação novamente.
7. **5:20–6:20 — Histórico.** Filtre por produto, funcionário e período; mostre o pedido versus separado e o motivo da divergência.
8. **6:20–7:00 — Segurança e recuperação.** Mostre a restrição de acesso do histórico e, se apropriado, a confirmação do botão de reset demo. Não confirme reset durante a apresentação, a menos que se queira apagar/recriar o fixture naquele momento.

Os crachás acima são credenciais demonstrativas de baixa confiança: só devem existir no banco descartável e somente a allowlist configurada pode usar o atalho de login demo.

## Limitações conhecidas

- O schema atual não possui campo de lote mínimo. O checklist permite registrar quantidade diferente, mas não calcula lote mínimo real.
- O schema atual não possui estado formal de aprovação de prioridade; a requisição prioritária do fixture está pendente, sem aprovação formal.
- A divergência `AVARIA` registra o motivo no fluxo de requisição, mas não há baixa separada para sucata nem processo próprio de descarte.
- Se o histórico real disponível não atender ao mínimo, o ressuprimento usa e identifica dados de consumo simulados; esses valores não são medição operacional.
- Funcionários, saldos, requisições, motivos e movimentações do fixture são fictícios/simulados para demonstração; não representam operação ou saldo real.
- A visão **Resumo de excedentes** agrega quantidades efetivamente entregues além do pedido por setor/produto. Isso não prova que o material voltou ao depósito; o saldo do depósito é global por produto, sem setor e sem associação às requisições.
- O seed dedicado usa somente os dez códigos descritos em `lib/demo-seed.ts` quando parte de um banco demo operacionalmente vazio. Ele não apaga itens antigos do catálogo. O reset preserva funcionários e catálogo e recria os dados operacionais do fixture.
- A facial não é solicitada ao assumir requisição. O fluxo facial existente está acoplado ao login, prova de vida, desafios de uso único, dispositivos confiáveis, serviço externo e controle de tentativas. Reutilizá-lo na ação de assumir requer desenho de um desafio transacional separado; reaproveitar o desafio de login criaria risco de replay e acoplamento entre autenticação e operação.
- O cadastro facial exige de 3 a 5 capturas guiadas e análise de consistência; uma única foto não é aceita. O login facial não virou um fluxo sem crachá: o desafio depende da identidade e do contexto de autenticação.
- A senha pode validar a credencial antes do fluxo normal de fatores do perfil. Não remove TOTP, WebAuthn ou facial; a allowlist demo continua entrando pelo caminho de código.
- A apresentação não inclui a faixa global de demonstração. O painel de reset e os rótulos locais de dados simulados permanecem identificados.

## Build na Vercel

Não existe `vercel.json` na raiz deste projeto. O `package.json` mantém `"build": "next build"` e `next.config.ts` não sobrescreve o bundler. A opção `--webpack` pode ser usada como *Build Command* override nas configurações do projeto Vercel, sem alterar o repositório:

```bash
npm run build -- --webpack
```

Esse comando seleciona explicitamente o Webpack no Next.js. A versão instalada reconhece a opção `--webpack`; isso confirma suporte do CLI, não um deploy completo na Vercel. Em uma validação anterior, a compilação chegou à coleta de rotas, mas não terminou com sucesso porque o ambiente isolado não tinha `DATABASE_URL`. Não foi alterado o script de build nem a configuração da Vercel.
