# Progresso

Atualizado durante a revisão funcional do almoxarifado, QR e cadastro facial. Nenhum banco foi acessado.

| Frente | Estado | Evidência principal |
|---|---|---|
| Descrição de itens em requisição | Feita sem mudança de schema: categoria do catálogo e descrição da requisição são renderizadas separadamente; metadados internos são removidos. | `lib/requisition-metadata.ts`, `app/components/ItemDescription.tsx` |
| Prioridade | Feita: selo acessível e ordenação estável, sem reordenar itens dentro dos grupos prioritário/padrão. | `app/components/PriorityBadge.tsx`, `app/almoxarifado/utils.ts` |
| Histórico | Feita: saída de metadados internos evitada nas respostas e valores vazios apresentados com fallback explícito. | `app/api/historico/route.ts`, `app/historico/page.tsx` |
| Ressuprimento | Feita: consulta isolada fora da página de rota; alerta considera saldo livre e ponto de pedido, com falha explícita em vez de lista vazia. | `lib/ressuprimento/carregar-dados.ts`, `app/admin/ressuprimento/RessuprimentoTabela.tsx` |
| Visão de excedentes | Feita como leitura derivada e identificada como inferência; agregados por setor e produto e autorização server-side. | `app/api/deposito/sobras/route.ts`, `app/deposito/sobras/page.tsx` |
| QR | Feito: fallback do detector nativo para `jsqr`, ciclo de vida de câmera por montagem, teste de etiquetas offline e headers de câmera para rotas que a usam. | `lib/qr/decoder.ts`, `lib/qr/camera-utils.ts`, `public/qr-demo.html` |
| Facial | Feito parcialmente: comparação local à mediana, validação e configuração centralizada dos limites locais, detecção exatamente de um rosto e diagnóstico de origem da rejeição. Login e limiar do serviço não foram alterados. | `lib/face.ts`, `lib/facial/config.ts`, `lib/facial/face-count.ts` |
| Cadastro facial por uma foto | Não implementado: o contrato atual de persistência exige amostras e serviço externo; não se criou um caminho alternativo que envie uma imagem ou enfraqueça as verificações. | `docs/RELATORIO_ALMOXARIFADO.md` |
| Revisão e riscos | Disponíveis nos relatórios dedicados; viewport e câmera física seguem não verificados. | `docs/STATUS_ALMOXARIFADO.md`, `docs/RISCOS_ALMOXARIFADO.md`, `docs/DIAGNOSTICO_QR_FACIAL.md` |

## Validação desta revisão

TypeScript, lint e a suíte padrão passaram; o build isolado compilou e verificou TypeScript, mas não concluiu coleta de rotas sem `DATABASE_URL`. O resultado está em `docs/RELATORIO_ALMOXARIFADO.md`. `tests/integration-tidb.test.ts` foi excluído pelo script padrão e não foi executado.
