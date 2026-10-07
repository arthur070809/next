# Progresso

Atualizado durante a revisão funcional do almoxarifado, QR e cadastro facial. Nenhum banco foi acessado.

| Frente | Estado | Evidência principal |
|---|---|---|
| Descrição de itens em requisição | Feita sem mudança de schema: categoria do catálogo e descrição da requisição são renderizadas separadamente; metadados internos são removidos. | `lib/requisition-metadata.ts`, `app/components/ItemDescription.tsx` |
| Prioridade | Feita: selo acessível e ordenação estável, sem reordenar itens dentro dos grupos prioritário/padrão. | `app/components/PriorityBadge.tsx`, `app/almoxarifado/utils.ts` |
| Histórico | Feita: saída de metadados internos evitada nas respostas e valores vazios apresentados com fallback explícito. | `app/api/historico/route.ts`, `app/historico/page.tsx` |
| Ressuprimento | Feita: consulta isolada fora da página de rota; alerta considera saldo livre e ponto de pedido, com falha explícita em vez de lista vazia. | `lib/ressuprimento/carregar-dados.ts`, `app/admin/ressuprimento/RessuprimentoTabela.tsx` |
| Visão de excedentes | O endpoint permanece como leitura derivada identificada como inferência; a página foi removida da interface. | `app/api/deposito/sobras/route.ts` |
| QR | Feito: fallback do detector nativo para `jsqr`, ciclo de vida de câmera por montagem, teste de etiquetas offline e headers de câmera para rotas que a usam. | `lib/qr/decoder.ts`, `lib/qr/camera-utils.ts`, `public/qr-demo.html` |
| Facial | Feito parcialmente: comparação local à mediana, validação e configuração centralizada dos limites locais, detecção exatamente de um rosto e diagnóstico de origem da rejeição. Login e limiar do serviço não foram alterados. | `lib/face.ts`, `lib/facial/config.ts`, `lib/facial/face-count.ts` |
| Cadastro facial por uma foto | Não implementado: o contrato atual de persistência exige amostras e serviço externo; não se criou um caminho alternativo que envie uma imagem ou enfraqueça as verificações. | `docs/RELATORIO_ALMOXARIFADO.md` |
| Revisão e riscos | Disponíveis nos relatórios dedicados; viewport e câmera física seguem não verificados. | `docs/STATUS_ALMOXARIFADO.md`, `docs/RISCOS_ALMOXARIFADO.md`, `docs/DIAGNOSTICO_QR_FACIAL.md` |
| O1 — descrição obrigatória para prioridade | Feita e testada: API rejeita prioridade vazia/com espaços antes da criação; pedido normal segue aceito sem descrição. | `app/api/requests/route.test.ts` |
| O2 — minhas requisições | Feita e testada: corrigidos IDOR no detalhe e corte silencioso em 100; lista paginada, ordem determinística e labels de status centralizadas/exaustivas. Suíte final: 83 arquivos/377 testes, tsc/lint verdes. | `app/api/minhas-requisicoes/route.ts`, `app/api/requests/[id]/route.ts`, `lib/requisition-status.ts` |
| R1 — ressuprimento | Corrigido: dashboard, lista e ressuprimento agora usam saldo livre e o mesmo critério inclusivo. Ponto zero/nulo não é considerado configurado. | `lib/stock-status.ts`, `lib/ressuprimento/carregar-dados.ts` |
| E1 — layout de estoque | Contrato do CSS/regressão passou; viewport/captura não disponível, portanto 360/768/1440 não verificado em dispositivo. | `app/estoque/stock-layout.test.ts`, `app/estoque/stock-list.module.css` |
| E2 — QR no estoque | Parcial: scanner existente, conhecido/desconhecido, match exato 1794/17940 e auth de API cobertos. Retry idempotente bloqueado: rota não aceita idempotency key; mudar transação/schema está proibido. | `app/estoque/page.tsx`, `app/api/estoque/route.ts`, `lib/qr/localizarEstoqueItem.test.ts` |
| O3 — fechamento/retorno do operador | Implementado best-effort: cookie de sessão existente, carência 60 s, logout de pagehide sem ignorar uma transição recente, retorno da aba e suspensão durante scanner. Testes cobrem limites, papéis e scanner. Limitação móvel documentada. | `app/components/PortalShell.tsx`, `lib/operator-session-lifecycle.test.ts` |

## Validação desta revisão

TypeScript e lint passaram; a suíte padrão passou com 83 arquivos/377 testes. O build isolado compilou e verificou TypeScript, mas não concluiu a coleta de rotas sem `DATABASE_URL`; nenhuma conexão foi feita. `tests/integration-tidb.test.ts` foi excluído pelo script padrão e não foi executado.

## Fechamento operador/estoque/ressuprimento

O relatório detalhado está em `docs/RELATORIO_OPERADOR_ESTOQUE.md`. Estado final: O1/O2/R1 testados e corrigidos; O3 best-effort; E1 estruturalmente testado, não verificado visualmente; E2 parcial por falta de idempotência persistente permitida no escopo. Validação final deste trabalho: 83 arquivos e 377 testes passaram; tsc/lint passaram; build isolado compilou, mas foi bloqueado por falta de `DATABASE_URL` na coleta das rotas.
