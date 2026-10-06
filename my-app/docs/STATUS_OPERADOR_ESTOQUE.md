# Auditoria — operador, estoque e ressuprimento

Auditoria da branch local `ajustes-finais`; nenhum `.env*` foi aberto e nenhum banco foi acessado. “OK” exige teste automatizado cobrindo o critério indicado.

| Item | Estado | Evidência | Critério de aceite não atendido / prova |
|---|---|---|---|
| O1 — descrição em prioridade | OK | `app/api/requests/route.ts:145-153,170-175`; `app/api/requests/route.test.ts:134-173` | A API valida no servidor antes de criar. Testes cobrem pedido comum vazio, prioridade vazia/só com espaços e prioridade preenchida; os casos inválidos confirmam nenhuma chamada de criação. |
| O2 — minhas requisições | Corrigido | `app/api/minhas-requisicoes/route.ts`; `app/minhas-requisicoes/page.tsx`; `app/api/requests/[id]/route.ts` | Testes confirmam ownership, 404 indistinguível para pedido alheio, paginação 20+1, ordenação determinística e rótulos exaustivos. |
| O3 — encerramento ao sair do app | Parcial, implementado com limite de plataforma | `lib/login-flow.ts:123-190`; `app/components/PortalShell.tsx`; `lib/operator-session-lifecycle.ts` | Cookie do operador permanece não persistente. Idle timer, retorno após 60 s, página encerrada via `sendBeacon` e exclusão quando scanner/permissão está ativa foram cobertos por testes puros; o navegador pode não emitir eventos ao fechar e `sendBeacon` não é garantido. |
| E1 — layout de estoque | OK por leitura estática; dispositivo pendente | `app/estoque/page.tsx:360-365,421-443`; `app/estoque/stock-list.module.css:24-72` | Grid `items-start`, busca fora do scroll dos produtos, painel sticky e limites `60dvh`/`calc(100dvh - 6rem)`. Captura não compartilhada: viewports 360/768/1440 ficam explicitamente não verificados em dispositivo. |
| E2 — entrada por QR | Parcial | `app/estoque/page.tsx`; `app/api/estoque/route.ts:109-250`; `lib/qr/localizarEstoqueItem.ts`; `app/api/estoque/route.test.ts` | Scanner/reuso da rota, tela de produto conhecido/desconhecido, código digitável, exact match `1794`/`17940` e bloqueio de operador estão testados/confirmados. O endpoint não tem chave/idempotência persistente para entrada: corrigir retry exige tocar a transação/modelagem, proibido neste escopo; não será mascarado com cache em memória ou guarda apenas client-side. |
| R1 — ressuprimento | Corrigido | `lib/stock-status.ts`; `lib/ressuprimento/carregar-dados.ts`; `app/admin/page.tsx`; `app/estoque/page.tsx`; `app/admin/ressuprimento/RessuprimentoTabela.tsx` | Causa: dashboard/estoque comparavam quantidade bruta, ressuprimento descontava reservas; zero/nulo também eram inconsistentes. Saldo livre e `<= ponto > 0` agora compartilham helpers. Testes cobrem baixo/igual/acima/zero/sem ponto e fixture 7988, 17940, 5746. |

## Pré-condições revisadas

- Branch ativa: `ajustes-finais`; sem alterações pendentes antes desta rodada.
- `StatusRequisicao` tem quatro valores no schema: `PENDENTE`, `ASSUMIDA`, `CONCLUIDA`, `ANULADA`.
- O cliente já sanitiza metadados de setor/idempotência via `decodeItemDescription`; a API de detalhe sanitiza setor e observação, mas precisa primeiro restringir ownership.
- Cadastro/entrada de estoque existente autentica almoxarife/admin no servidor; não será substituída a transação.
