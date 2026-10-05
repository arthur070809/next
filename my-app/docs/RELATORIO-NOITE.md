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
- Decisão conservadora: o catálogo de demo contém os quatro locais solicitados, mas as requisições usam três origens. Como o planejador cria uma viagem por local, ativar os quatro produziria no mínimo quatro viagens e contrariaria a métrica requerida de duas ou três. A fixture efetivamente fixa 12 idas sem agrupamento, 3 viagens e economia de 9.
- Validação:
  - `npx tsc --noEmit`: passou.
  - `npm run lint`: 0 erros; permanecem os 3 avisos preexistentes em `FaceEnrollmentManager.tsx` e `TotpManager.tsx`.
  - `npm test -- --exclude tests/integration-tidb.test.ts`: 25 arquivos e 145 testes passaram.
  - Build isolado com Webpack: compilação de produção passou, mas a validação Next falhou em um erro preexistente não relacionado desta fase: `.next/types/app/historico/page.ts` rejeita o export nomeado `FiltrosHistorico` de `app/historico/page.ts`. `tsc --noEmit` independente passou. Não alterei esse arquivo não relacionado.
- Não validado em banco nem em ambiente móvel/produção. Nenhuma chamada ao banco foi feita. A fila normal continua atualizando os pedidos reais; o modo demo não consulta o endpoint de viagens e não invoca nenhuma ação de assumir para dados simulados. A regra do build foi definida com `NEXT_PUBLIC_VIAGEM_DEMO === "true"` em produção.
  - Conflito de instruções: a fase pediu registrar `NEXT_PUBLIC_VIAGEM_DEMO` em `.env.example`, mas a regra absoluta também proibiu commitar qualquer `.env*`. Optei por não manter a alteração no arquivo de ambiente; o nome e a regra são documentados neste relatório. O histórico contém um commit que adicionou apenas essa linha e outro que a removeu. O estado final da branch não difere da base em `.env.example`; nenhum segredo ou valor foi adicionado.

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

## FASE 3 - INVENTÁRIO INVISÍVEL, NÚCLEO PURO
- Branch: `feat/inventario-invisivel`, criada a partir de `feat/ressuprimento-vivo`.
- Commits:
  - `8f0bd35 feat(inventario): score and select blind counts`
  - `2870a8a feat(inventario): evaluate blind counts`
  - `836323c docs(inventario): define future integration points`
  - `be1ed40 fix(inventario): validate selection limit`
- Arquivos:
  - `my-app/lib/inventario/risco.ts` e `risco.test.ts`: pesos exportados, risco de 0 a 100, seleção top-N cega, limite padrão três, desempate por código e deduplicação por id.
  - `my-app/lib/inventario/contagem.ts` e `contagem.test.ts`: resultado BATEU/DENTRO_TOLERANCIA/DIVERGENTE, diferença, percentual seguro e acurácia por local.
  - `my-app/docs/INVENTARIO-INTEGRACAO.md`: integração futura do checklist, registro rastreável de ajuste e dependências aditivas propostas.
- `npx tsc --noEmit`: passou após corrigir a validação do limite da seleção.
- `npm run lint`: 0 erros; somente os 3 avisos preexistentes em `FaceEnrollmentManager.tsx` e `TotpManager.tsx`.
- `npm test -- --exclude tests/integration-tidb.test.ts`: suíte consolidada final com 30 arquivos e 170 testes passou.
- Build isolado com Webpack: compilação de produção passou; etapa de tipos do Next continua bloqueada pelo export nomeado preexistente `FiltrosHistorico` em `app/historico/page.ts`. Build completo não validado.
- Não validado em banco nem conectado ao checklist. Nenhuma tela, rota, fluxo QR, schema ou migration foi alterado nesta fase.

## RESUMO CONSOLIDADO
1. Pré-flight registrado na branch inicial e commitado como `b4ec0c0`.
2. Fase 1 entregue em `feat/viagem-unica-demo`: fixture local, modo demo, métricas transparentes e assunção sequencial com uma validação de crachá por requisição.
3. Fase 2 entregue em `feat/ressuprimento-vivo`: análise pura, fonte simulada determinística, dashboard ADMIN somente leitura e prévia sem persistência.
4. Fase 3 entregue em `feat/inventario-invisivel`: seleção cega por risco, avaliação de contagem, acurácia e documentação de integração.
5. Nenhuma migration ou alteração de schema foi criada ou aplicada.
6. Nenhuma conexão ao TiDB foi feita; os testes de integração destrutiva foram excluídos.
7. TypeScript passou; lint passou com os 3 avisos preexistentes; 170 testes passaram.
8. O build compilou os assets, mas não completou a validação Next por erro já existente em `app/historico/page.ts` (`FiltrosHistorico` exportado junto com a página).
9. O estado final mantém as alterações preexistentes em `generated/prisma` sem incluí-las nos commits.
10. Nenhuma tela real foi testada em celular, produção ou contra o banco compartilhado.

## DECISÕES SEM HUMANO
| Decisão | Alternativa descartada | Motivo |
|---|---|---|
| Fixture de viagem cataloga quatro locais, mas usa três como origens efetivas | Usar os quatro locais nas requisições | O planejador agrega por local; quatro origens produziriam quatro viagens, incompatíveis com a métrica pedida de duas ou três. |
| Histórico real suficiente = pelo menos cinco saídas válidas e alcance de sete dias, dentro de 30 dias | Mostrar amostra real curta como se fosse representativa | Evita apresentar pouco histórico como medição confiável; insuficiente troca para dados simulados e a fonte fica visível. |
| Cobertura usa saldo livre, somando `max(0, quantidade - reservada)` por local | Usar quantidade bruta incluindo compromissos | Reservas já comprometidas não devem aparentar cobertura disponível para nova demanda. |
| Divergência acima da tolerância recomenda RECONTAR; ajuste não é automático | Abrir ajuste diretamente após primeira leitura | Reduz risco de corrigir estoque com erro de leitura; ajuste exige recontagem e autorização futura. |
| Esperado zero e contado positivo retorna percentual nulo | Dividir por zero ou inventar percentual | O percentual não é matematicamente definido; a diferença absoluta e a ação continuam disponíveis. |
| O limite padrão do inventário é três itens por viagem | Selecionar todos os itens por risco | Atende ao limite operacional solicitado para não atrasar o almoxarife. |
| A configuração `NEXT_PUBLIC_VIAGEM_DEMO` foi descrita neste relatório, não mantida em `.env.example` | Alterar/commitar `.env.example` | Conflito entre a solicitação de editar o exemplo e a regra absoluta de não commitar `.env*`; prevaleceu a regra absoluta. Um commit transitório adicionou somente o nome sem valor e o commit `53a6d9f` o removeu. O estado final não muda `.env.example`. |
| O erro de build em `app/historico/page.ts` foi deixado sem correção | Alterar export não relacionado | A compilação da fase conclui, `tsc --noEmit` passa e o erro é independente; não foi autorizado escopo para corrigir histórico. |

## PENDÊNCIAS QUE EXIGEM HUMANO
- Aprovar com Arthur, backup e validação do TiDB antes de qualquer aplicação das migrations pendentes de conta do operador e divergência; consultar tipos/collation reais no TiDB.
- Decidir e aprovar a coluna aditiva `prazoReposicao` por produto, bem como persistência real de alertas e sugestões.
- Decidir persistência do indicador “quem está indo” para um local e eventual endereço de prateleira.
- Disponibilizar e testar credenciais reais apropriadas para login de almoxarife e administrador na banca.
- Ensaiar câmera em celular sob HTTPS/contexto seguro e validar permissões físicas do dispositivo.
- Confirmar códigos numéricos reais das etiquetas apenas no ambiente de teste apropriado; nenhum código real foi incluído.
- Aprovar o modelo aditivo `ContagemInventario`, com executor, item/local, esperado oculto, contado, tolerância, resultado, recontagem e vínculo ao movimento `AJUSTE`.
- Definir integração e sincronização com TOTVS e rotas de ressuprimento após validação com Arthur.
- Configurar `NEXT_PUBLIC_VIAGEM_DEMO=true` no ambiente de demonstração por mecanismo seguro de configuração, se a demo usar build de produção; não foi gravado em arquivo `.env*`.

## CONFERÊNCIA NA MANHÃ (Git Bash)
1. Na raiz do repositório: `git status --short` e `git branch --list "feat/viagem-unica-demo" "feat/ressuprimento-vivo" "feat/inventario-invisivel"`; confirme que apenas `generated/prisma` aparece modificado e não o adicione.
2. Confira cada histórico sem alterar a branch ativa:
   - `git log --oneline feat/viagem-unica-demo -8`
   - `git log --oneline feat/ressuprimento-vivo -8`
   - `git log --oneline feat/inventario-invisivel -8`
3. Em `my-app`, confira código puro sem acesso ao banco: `npm test -- --exclude tests/integration-tidb.test.ts`, `npx tsc --noEmit` e `npm run lint`.
4. Se for testar a interface localmente, inicie com `npm run dev` e valide a autenticação ADMIN antes de abrir `/admin/ressuprimento`; para viagens use `/almoxarifado/requisicoes` e ative o alternador de demonstração. Esses passos podem consultar o ambiente configurado pelo desenvolvedor; não foram executados nesta missão.
5. Não rode seeds, migrations, `db push`, Studio nem a integração TiDB durante a conferência.

## AUDITORIA FINAL DOS COMMITS
- `git log --stat feat/viagem-unica..HEAD` foi revisado: nenhum commit da missão contém `generated/prisma` nem os arquivos proibidos (login/facial/TOTP/WebAuthn, QR/parser, regra de assumir no backend, `lib/movimentacao`, `lib/security.ts` ou `next.config.ts`).
- O diff líquido contra a base não altera `.env.example`; a trilha transitória de adição/remoção está registrada na decisão acima. Nenhum valor, segredo ou `.env.local` foi incluído.
- As rotas novas não ampliam acesso: viagens usa o endpoint ADMIN/ALMOXARIFE existente; ressuprimento é ADMIN somente no servidor. A assunção em lote chama a mesma rota PATCH de assumir, em série e com crachá repetido em cada chamada.
- Nenhuma conexão ao banco, instalação de dependência, push, merge, rebase, reset, stash ou aplicação de migration foi realizada.
