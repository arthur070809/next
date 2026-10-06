# Auditoria — operador, estoque e ressuprimento

Auditoria da branch local `ajustes-finais`; nenhum `.env*` foi aberto e nenhum banco foi acessado. “OK” exige teste automatizado cobrindo o critério indicado.

| Item | Estado | Evidência | Critério de aceite não atendido / prova |
|---|---|---|---|
| O1 — descrição em prioridade | OK | `app/api/requests/route.ts:145-153,170-175`; `app/api/requests/route.test.ts:134-173` | A API valida no servidor antes de criar. Testes cobrem pedido comum vazio, prioridade vazia/só com espaços e prioridade preenchida; os casos inválidos confirmam nenhuma chamada de criação. |
| O2 — minhas requisições | Corrigido | `app/api/minhas-requisicoes/route.ts`; `app/minhas-requisicoes/page.tsx`; `app/api/requests/[id]/route.ts` | Testes confirmam ownership, 404 indistinguível para pedido alheio, paginação 20+1, ordenação determinística e rótulos exaustivos. |
| O3 — encerramento ao sair do app | Parcial | `lib/login-flow.ts:123-190`; `app/components/PortalShell.tsx:68-93`; `lib/session-policy.ts` | Cookie do operador já é de sessão e há expiração por inatividade, mas não há `visibilitychange`, `pagehide`, carência ao retornar ou logout best-effort; não há exceção da troca de foco durante câmera. |
| E1 — layout de estoque | Parcial | `app/estoque/page.tsx:360-365,421-443`; `app/estoque/stock-list.module.css:24-72` | Grid tem `items-start`, busca cabeçalho fixo no desktop, scroll interno, sticky e limite `60dvh`/`100dvh`. Não há captura de browser/dispositivo disponível; larguras 360/768/1440 não podem ser declaradas verificadas visualmente. |
| E2 — entrada por QR | Parcial | `app/estoque/page.tsx:79,105-145,250-290,458`; `app/api/estoque/route.ts:82-112,118-210`; `lib/qr/localizarEstoqueItem.ts`; `app/api/estoque/route.test.ts` | Scanner, correspondência exata e validação de perfil no servidor já existem. A chamada que registra entrada não carrega chave de idempotência; retry após timeout pode registrar saldo/movimento duplicado. Cobrir fluxo conhecido/desconhecido, 1794/17940, autorização e retry. |
| R1 — ressuprimento | Parcial | `lib/ressuprimento/carregar-dados.ts:24-84`; `app/admin/ressuprimento/RessuprimentoTabela.tsx:77-90`; `app/admin/dashboard/page.tsx:21-49`; `app/estoque/page.tsx:446-449` | Página tem estado de erro e tela de alertas/vazio e restringe acesso a admin. Porém dashboard/lista usam saldo bruto (sem descontar reservado) enquanto ressuprimento usa saldo livre; os três alertas podem discordar. O seed define 7988, 17940 e 5746 no ponto/abaixo considerando saldo central; testar códigos/critério e produto sem ponto. |

## Pré-condições revisadas

- Branch ativa: `ajustes-finais`; sem alterações pendentes antes desta rodada.
- `StatusRequisicao` tem quatro valores no schema: `PENDENTE`, `ASSUMIDA`, `CONCLUIDA`, `ANULADA`.
- O cliente já sanitiza metadados de setor/idempotência via `decodeItemDescription`; a API de detalhe sanitiza setor e observação, mas precisa primeiro restringir ownership.
- Cadastro/entrada de estoque existente autentica almoxarife/admin no servidor; não será substituída a transação.
