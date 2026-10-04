# PREFLIGHT - VIAGEM ÚNICA

## 1) Status do repositório e branch
- Branch atual: `feat/viagem-unica`
- `git status --short` mostra apenas alterações esperadas em `my-app/generated/prisma/*`:
  - `M my-app/generated/prisma/browser.ts`
  - `M my-app/generated/prisma/client.ts`
  - `M my-app/generated/prisma/internal/class.ts`
  - `M my-app/generated/prisma/internal/prismaNamespace.ts`
  - `M my-app/generated/prisma/internal/prismaNamespaceBrowser.ts`
  - `M my-app/generated/prisma/models.ts`
  - `M my-app/generated/prisma/models/Funcionario.ts`
  - `M my-app/generated/prisma/models/Item.ts`
  - `M my-app/generated/prisma/models/LocalEstoque.ts`
  - `M my-app/generated/prisma/models/Requisicao.ts`
  - `M my-app/generated/prisma/models/RequisicaoItem.ts`
  - `?? my-app/generated/prisma/models/MovimentoContaEstoque.ts`
  - `?? my-app/generated/prisma/models/SaldoOperadorItem.ts`
- Histórico recente (`git log --oneline -8`):
  1. `aef29f5 feat(viagem): show grouped trips in warehouse queue`
  2. `49533c4 feat(viagem): add authenticated trip endpoint`
  3. `460c8db feat(viagem): add pure trip planner`
  4. `356dfa7 feat(scripts): add safe demo request seed`
  5. `0e87aa5 test(almoxarifado): cover request claim access and races`
  6. `40c2c48 feat(almoxarifado): refresh request queue while visible`
  7. `cf6f015 fix(almoxarifado): claim requests atomically`
  8. `852f1e9 feat(almoxarifado): add claim action to request queue`

## 2) Estrutura do projeto relevante
### `app/api`
- `admin/`
- `almoxarifado/`
- `auth/`
- `deposito/`
- `estoque/`
- `historico/`
- `itens/`
- `requests/`

### `app/almoxarifado`
- `deposito/`
- `estoque/`
- `requisicao/`
- `requisicoes/`
- `home.module.css`
- `layout.tsx`
- `page.tsx`
- `queue.tsx`
- `utils.ts`
- `warehouse-home.tsx`

### `app/admin`
- `biometria/`
- `deposito/`
- `estoque/`
- `requisicao/`
- `seguranca/`
- `usuarios/`
- `dashboard.tsx`
- `forbidden.tsx`
- `layout.tsx`
- `loading.tsx`
- `page.tsx`

### `lib`
- `movimentacao/`
- `qr/`
- `types/`
- `viagem/`
- `auth.ts`
- `deposito-constants.ts`
- `face-consent.ts`
- `face-enrollment-attempts.ts`
- `face-enrollment-attempts.test.ts`
- `face-enrollment-session.ts`
- `face.ts`
- `login-attempts.ts`
- `login-flow.ts`
- `login-test-mode.ts`
- `normalize-login-code.ts`
- `passwords.ts`
- `prisma.ts`
- `request-claim.ts`
- `requisicoes-db.ts`
- `security.ts`
- `stock-status.ts`
- `stock-units.ts`
- `totp.ts`
- `visibility-polling.ts`
- `webauthn.ts`

## 3) Como a fila e a viagem estão organizadas
- A fila do almoxarife está em `app/almoxarifado/queue.tsx`.
- O botão `Montar viagem` alterna o painel de viagens e usa fetch para `GET /api/almoxarifado/viagens`.
- O endpoint autenticado está em `app/api/almoxarifado/viagens/route.ts`.
- A lógica pura de agrupamento está em `lib/viagem/planejar-viagens.ts`.
- O padrão de polling visível/reaproveitável é `lib/visibility-polling.ts`, que pausa quando a página fica oculta e dispara novamente quando fica visível.

## 4) Scripts/package.json e build isolado
- Scripts principais em `my-app/package.json`:
  - `npm run dev` → `next dev`
  - `npm run build` → `next build`
  - `npm run start` → `next start`
  - `npm run seed` / `seed:admin` / `seed:teste` / `seed:requisicao`
  - `npm run test` → `vitest run`
  - `npm run lint` → `eslint`
- Comando de build do projeto: `npm run build` (`next build`).
- Para build isolado em ambiente separado, a convenção segura é rodar `next build` em uma cópia/ambiente isolado sem tocar no `.next` do dev principal; neste pré-flight não alteramos a app nem o diretório de desenvolvimento.

## 5) Observações de segurança/conservação
- Não foi feita conexão ao banco nem alteração de schema.
- Não foi alterado código de login, QR, facial, claim de requisição, lib/movimentacao ou next.config.
- Os arquivos gerados em `generated/prisma` continuam sendo o único estado local visível e devem ser ignorados em commits, como já estava documentado.
- A intenção da fase atual é reaproveitar a lógica existente de exibição e polling, sem criar persistência ou entidades novas de viagem.
