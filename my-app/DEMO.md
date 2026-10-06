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
| `LOGIN_TENTATIVAS_LIMITE` | Opcional; limite normal de tentativas de login | Opcional |
| `LOGIN_JANELA_MS` | Opcional; janela normal de tentativas | Opcional |
| `LOGIN_BLOQUEIO_MS` | Opcional; bloqueio normal de login | Opcional |
| `LOGIN_MODO_TESTE` | Somente ambiente local de teste; não usar em produção | Não habilitar |
| `LOGIN_TESTE_CRACHAS` | Somente allowlist local de teste | Não habilitar |
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
| `ADMIN_NAME` | Somente script administrativo específico | Não necessário para a aplicação |
| `CONFIRM_ADMIN_RESET` | Somente script administrativo específico | Não necessário para a aplicação |
| `SEED_DEFAULT_PASSWORD` | Somente script de seed específico | Não necessário para a aplicação |

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

Preparação recomendada: antes da sessão, crie no demo um usuário não allowlisted com senha válida para mostrar o login por senha. Os três crachás seed (`1111`, `2222`, `3333`) entram pelo atalho demo por código e não validam a senha; a hash gerada pelo seed é aleatória. O botão facial depende de template facial ativo para o crachá.

1. **0:00–0:35 — Login e ambiente.** Abra HTTPS, entre como admin demo (`3333`) e confirme que não há faixa global amarela. Os rótulos locais "Dados simulados" continuam informando quando valores não são reais.
2. **0:35–1:05 — Senha.** Saia, informe crachá e senha do usuário de apresentação não allowlisted e entre; mostre mostrar/ocultar. Em seguida, demonstre o botão de reconhecimento facial somente se o usuário tiver template ativo.
3. **1:05–1:45 — Dashboard.** Mostre itens no ponto de pedido ou abaixo e ressuprimento, incluindo a indicação de dados simulados quando aplicável.
4. **1:45–2:35 — Operador e prioridade.** Entre como operador, escolha setor/produto, veja saldo livre/reservado, escreva justificativa e envie uma requisição prioritária. Abra **Minhas Requisições** para confirmar o estado e os itens.
5. **2:35–3:25 — Fila e QR.** Entre como almoxarife, assuma o pedido e abra o checklist. Use o QR para localizar item existente (ou digite um código novo e preencha produto/categoria para testar o cadastro).
6. **3:25–4:25 — Checklist/finalização.** Registre quantidade real e motivo de divergência, finalize uma vez e confira pedido x separado e movimentações geradas.
7. **4:25–5:20 — Histórico e sobras.** Filtre por produto/funcionário/período; abra o resumo de excedentes, confira total por setor e explique que excedente entregue não é retorno físico ao depósito.
8. **5:20–7:00 — Estoque/limitações.** Em 360 px, mostre formulário acima da lista rolável, escaneie uma etiqueta e consulte o alerta de ponto de pedido. Não confirme reset durante a apresentação.

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
- O schema contém `Funcionario.senha` e o fluxo normal espera um hash bcrypt. O seed cria hash aleatória, não uma senha inicial igual ao crachá. Os crachás allowlisted do demo continuam ignorando senha conforme o contrato do modo demo.
- A tela de cadastro facial não oferece uma única foto de galeria/câmera. O endpoint e o serviço de enrollment existentes exigem 3–5 capturas consistentes; imagens são enviadas ao servidor/serviço para gerar embeddings. Aceitar uma imagem sem alterar esse contrato e sem enviar a imagem exigiria novo pipeline local/servidor e revalidação de segurança. Não foi simulado o cumprimento de consistência duplicando uma imagem.
- No perfil operador, o cookie de sessão é não persistente; ao retornar de segundo plano após 60 segundos a aplicação tenta encerrar a sessão, e `pagehide` tenta logout com `sendBeacon`. Navegadores móveis podem suspender/encerrar o processo sem emitir `visibilitychange` ou `pagehide`, e `sendBeacon` pode falhar; o timeout de inatividade do servidor continua sendo a proteção efetiva. O scanner QR e o diálogo de permissão da câmera suprimem o logout por troca de foco enquanto ativos.
- Entrada de estoque por QR usa a rota/transação existente, mas ela não persiste uma chave de idempotência. Se uma requisição de entrada sofrer timeout após ser aplicada, confirme estoque/histórico antes de repetir; deduplicação persistente exige suporte server-side e alteração transacional/schema, que não foi feita.

## Build na Vercel

Não existe `vercel.json` na raiz deste projeto. O `package.json` mantém `"build": "next build"` e `next.config.ts` não sobrescreve o bundler. A opção `--webpack` pode ser usada como *Build Command* override nas configurações do projeto Vercel, sem alterar o repositório:

```bash
npm run build -- --webpack
```

Esse comando seleciona explicitamente o Webpack no Next.js. A versão instalada reconhece a opção `--webpack`; isso confirma suporte do CLI, não um deploy completo na Vercel. Em uma validação anterior, a compilação chegou à coleta de rotas, mas não terminou com sucesso porque o ambiente isolado não tinha `DATABASE_URL`. Não foi alterado o script de build nem a configuração da Vercel.
