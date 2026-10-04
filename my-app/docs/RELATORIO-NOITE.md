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

## FASE 1 - VIAGEM ÚNICA, DEMONSTRAÇÃO E ASSUNÇÃO EM LOTE
- Branch: `feat/viagem-unica-demo`, criada a partir de `feat/viagem-unica`.
- Commits:
  - `63f2d17 feat(viagem): add deterministic demo fixture`
  - `ea3f687 feat(viagem): add local demo mode`
  - `23875a0 feat(viagem): claim grouped requests sequentially`
  - `2062569 fix(viagem): isolate simulated panel data`
- Arquivos:
  - `my-app/lib/viagem/demo-data.ts` e `demo-data.test.ts`: fixture fixa de 6 pedidos; usa o planejador de viagens real.
  - `my-app/lib/viagem/demo-mode.ts` e `demo-mode.test.ts`: regra de ambiente e seleção local dos dados simulados, com teste de zero chamadas à fonte real no modo demo.
  - `my-app/lib/viagem/assumir-lote.ts` e `assumir-lote.test.ts`: processamento sequencial, resultados individuais, envio repetido do crachá e bloqueio concorrente.
  - `my-app/app/almoxarifado/queue.tsx`: alternador/faixa, métrica explícita, idade da requisição mais antiga por cartão, ação em lote e links para checklists assumidos.
  - `my-app/app/components/ModalAcaoRequisicao.tsx`: configuração opcional de título/descrição para reaproveitar o modal e a coleta atual de crachá.
  - `my-app/.env.example`: documenta `NEXT_PUBLIC_VIAGEM_DEMO` sem atribuir valor.
- Decisão conservadora: o catálogo de demo contém os quatro locais solicitados, mas as requisições usam três origens. Como o planejador cria uma viagem por local, ativar os quatro produziria no mínimo quatro viagens e contrariaria a métrica requerida de duas ou três. A fixture efetivamente fixa 12 idas sem agrupamento, 3 viagens e economia de 9.
- Validação:
  - `npx tsc --noEmit`: passou.
  - `npm run lint`: 0 erros; permanecem os 3 avisos preexistentes em `FaceEnrollmentManager.tsx` e `TotpManager.tsx`.
  - `npm test -- --exclude tests/integration-tidb.test.ts`: 25 arquivos e 145 testes passaram.
  - Build isolado com Webpack: compilação de produção passou, mas a validação Next falhou em um erro preexistente não relacionado desta fase: `.next/types/app/historico/page.ts` rejeita o export nomeado `FiltrosHistorico` de `app/historico/page.ts`. `tsc --noEmit` independente passou. Não alterei esse arquivo não relacionado.
- Não validado em banco nem em ambiente móvel/produção. Nenhuma chamada ao banco foi feita. A fila normal continua atualizando os pedidos reais; o modo demo não consulta o endpoint de viagens e não invoca nenhuma ação de assumir para dados simulados. A regra do build foi definida com `NEXT_PUBLIC_VIAGEM_DEMO === "true"` em produção.

## FASE 2 - RESSUPRIMENTO VIVO
### Diagnóstico de dados existentes
- `Item.pontoPedido` (`ponto_pedido`) é o ponto de reposição configurável existente; `estoqueSeguranca` também existe. Não há campo de prazo de reposição por item.
- `SaldoEstoque` registra `itemId`, `localId`, `quantidade` e `reservada`, com unicidade por `(itemId, localId)`. A API de estoque atual expõe `quantidade` e `reservada` separadas e calcula disponível como `quantidade - reservada`.
- `Movimentacao` registra `tipo`, `quantidade`, `criadoEm`, `saldoApos`, `reservadaApos`, `saldoEstoqueId`, funcionário e vínculos opcionais com requisição/linha.
- `SAIDA` é gravada quando o almoxarife separa uma linha em `lib/requisicoes-db.ts` (`separarItem`), com timestamp/quantidade e vínculo ao saldo/item. Entradas são gravadas no cadastro/entrada da API de estoque e ajustes como `AJUSTE`; reservas e liberações são tipos distintos e foram excluídas do consumo.
- Decisão conservadora para cobertura: usar saldo livre, somando `max(0, quantidade - reservada)` em todos os locais do item, para não tratar unidades já comprometidas como cobertura disponível.
- Fonte real é escolhida apenas se, na janela de 30 dias, houver pelo menos 5 saídas válidas e o movimento mais antigo fornecer 7 dias ou mais de alcance até hoje. Caso contrário, todos os itens usam a fixture determinística. A origem é sempre mostrada na tela.
- Pendência de produto: adicionar `prazoReposicao` por item, coluna aditiva proposta, após decisão com Arthur e migration aprovada. Até lá `PRAZO_REPOSICAO_PADRAO_DIAS = 7` e `MARGEM_SEGURANCA_DIAS = 2`.

### Implementação e validação
- Branch: `feat/ressuprimento-vivo`, criada a partir de `feat/viagem-unica-demo`.
- Commits:
  - `6807c01 feat(ressuprimento): add pure coverage analysis`
  - `d7f20ae feat(ressuprimento): add deterministic sample history`
  - `95399fa feat(ressuprimento): add admin coverage dashboard`
  - `143ef15 test(ressuprimento): enforce admin-only access`
- Arquivos:
  - `my-app/lib/ressuprimento/analise.ts`, `analise.test.ts`: consumo diário, cobertura, ponto sugerido, classe, confiança e suficiência do histórico.
  - `my-app/lib/ressuprimento/simulado.ts`, `simulado.test.ts`: geração reproduzível por hash/LCG, com pico semanal.
  - `my-app/app/admin/ressuprimento/page.tsx`: leitura server-side de item/saldo/movimentação; sem rota de escrita.
  - `my-app/app/admin/ressuprimento/RessuprimentoTabela.tsx`: filtro, ordenação, tabela acessível, gráfico SVG e prévia sem persistência.
  - `my-app/lib/ressuprimento/access.ts`, `access.test.ts`: decisão de autorização exclusiva para `admin`.
- `npx tsc --noEmit`: passou.
- `npm run lint`: 0 erros; permanecem somente os 3 avisos preexistentes em `FaceEnrollmentManager.tsx` e `TotpManager.tsx`.
- `npm test -- --exclude tests/integration-tidb.test.ts`: 28 arquivos e 157 testes passaram.
- Build isolado com Webpack: compilação de produção passou; validação Next falhou no mesmo erro preexistente de export nomeado `FiltrosHistorico` em `app/historico/page.ts` reportado na Fase 1. Nenhum arquivo dessa página foi alterado. O build completo não foi validado.
- Não validado em banco: as consultas da página são somente leitura por construção, mas nenhuma execução da página contra TiDB foi feita. Sem confirmação dos dados, a regra real/simulada também não foi observada em produção.
