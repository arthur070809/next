# Relatório — revisão funcional do almoxarifado, QR e facial

## Resumo

O trabalho reforçou a apresentação segura de descrições, a prioridade na fila, os agregados de excedentes, o alerta de ponto de pedido, o ciclo de vida do scanner QR e a análise de consistência facial. O schema, login, allowlist demo e transações de negócio não foram modificados nesta etapa.

## Mudanças e evidências principais

| Frente | Mudança |
|---|---|
| Descrições | `decodeItemDescription` remove metadados/setor do texto visível. Componentes compartilhados apresentam categoria e descrição da requisição, com fallback `—`. |
| Prioridade | A fila conserva a ordem recebida dentro de cada grupo; o selo comunica “Prioridade” por texto acessível, além do indicador visual. |
| Histórico | Projeções e renderização evitam expor os metadados internos como descrição. |
| Ressuprimento | Consulta foi retirada do módulo de página; calcula ponto de pedido sobre saldo livre do local central e mostra estado de erro explicitamente. |
| Excedentes | Endpoint agrega quantidades por setor e produto para saídas excedentes de requisições concluídas; cliente filtra/recalcula os totais e página tem proteção server-side. |
| QR | Decoder mantém BarcodeDetector e cai para `jsqr` se o detector nativo falhar; câmera é liberada por lease da montagem. Criado teste estrutural para as dez etiquetas offline e round-trip de seus códigos. `Permissions-Policy` de câmera cobre as rotas de estoque, checklist e cadastro facial. |
| Facial | Distâncias são calculadas contra a mediana coordenada, com descarte de no máximo um outlier apenas quando há núcleo consistente; valores locais de qualidade ficam centralizados em `lib/facial/config.ts`. A origem da rejeição local/serviço remoto é diagnosticável sem imagem ou descritor. |
| Cadastro facial por foto única | Não implementado. O caminho atual submete amostras ao serviço remoto e a persistência depende dos embeddings que ele retorna. Não foi criado upload da galeria nem um caminho paralelo de template. |

## Causa/decisões

- O alerta de ressuprimento ficava incoerente porque a consulta podia misturar locais e considerar saldo bruto, ao passo que a regra da tela precisa do saldo livre do estoque central. A consulta agora limita local e desconta reserva antes de comparar com o ponto de pedido.
- A visão de excedentes não representa sobra física recuperada: ela deriva `max(0, SAIDA - quantidade pedida)` apenas para requisições concluídas com motivo `EXCEDEU_LOTE_MINIMO`, e lê setor dos metadados existentes. A interface informa essa limitação explicitamente.
- Não foi mudado o comparador de login ou seu threshold. A comparação local de enrollment foi alterada para mediana por ser robusta a um outlier, preservando exigência de amostras consistentes.
- Não foi possível provar equivalência integral entre o detector local de qualidade e a extração do fornecedor externo; este último mantém o pipeline que gera os templates persistidos.

## Arquivos principais

- Metadados e prioridade: `lib/requisition-metadata.ts`, `lib/requisicoes-db.ts`, `app/almoxarifado/utils.ts`, `app/components/PriorityBadge.tsx`, `app/components/ItemDescription.tsx`.
- Histórico e fila: `app/api/historico/route.ts`, `app/api/minhas-requisicoes/route.ts`, `app/api/almoxarifado/requisicoes/[numeroPedido]/route.ts`, `app/historico/page.tsx`, `app/almoxarifado/queue.tsx`, `app/minhas-requisicoes/page.tsx`.
- Ressuprimento: `lib/ressuprimento/analise.ts`, `lib/ressuprimento/carregar-dados.ts`, `app/admin/ressuprimento/RessuprimentoTabela.tsx`.
- Excedentes: `app/api/deposito/sobras/route.ts`, `app/deposito/sobras/page.tsx`, `app/deposito/sobras/SobrasClient.tsx`, `lib/deposito/excedentes.ts`.
- QR: `lib/qr/decoder.ts`, `lib/qr/camera-utils.ts`, `lib/qr/parseEtiqueta.ts`, `lib/qr/localizarEstoqueItem.ts`, `app/components/ProductEtiquetaScanner.tsx`, `scripts/gerar-qr-demo.ts`, `public/qr-demo.html`, `next.config.ts`.
- Facial: `lib/facial/config.ts`, `lib/facial/face-count.ts`, `lib/face.ts`, `app/api/admin/face-enrollment/route.ts`, `app/admin/biometria/FaceEnrollmentManager.tsx`.

## Validações

| Comando | Resultado |
|---|---|
| `npx tsc --noEmit` | Passou, 0 erros. |
| `npm run lint` | Passou, sem erros. |
| `npm test` | Passou: 80 arquivos, 358 testes. O script padrão exclui `tests/integration-tidb.test.ts`. |
| Build de produção em cópia temporária sem `.env*` (`npm run build -- --webpack`) | Compilação e TypeScript passaram. A coleta das rotas falhou porque `DATABASE_URL` não está configurada. Nenhuma URL fictícia foi usada; a cópia temporária foi removida. |
| `git diff --check` | Passou na revisão de código; repetir depois desta alteração documental final. |

## Commits locais desta rodada

- `46cb960` — descrições seguras, histórico e prioridade.
- `fb94c41` — cálculo de ressuprimento.
- `bf4b066` — agregação de excedentes.
- `854458c` — scanner QR e permissões de câmera.
- `7d025a3` — consistência e diagnóstico facial.
- O relatório/documentação final será registrado em commit separado depois da última validação.

Branch mantida: `ajustes-finais`. Nenhum push, merge, migration, alteração de schema ou dependência foi feito.

## Riscos e roteiro manual

Os riscos de excedente inferido, integração facial externa, captura de câmera e layout não verificado constam em [RISCOS_ALMOXARIFADO.md](./RISCOS_ALMOXARIFADO.md) e [AUDITORIA_RESPONSIVA.md](./AUDITORIA_RESPONSIVA.md).

1. Abrir a fila com requisições prioritárias e comuns: verificar selo/ordem e que categoria/descrição aparecem sem metadados técnicos.
2. Abrir histórico e Minhas Requisições: confirmar as mesmas descrições e valores ausentes como `—`.
3. Abrir `/admin/ressuprimento`: conferir apenas saldo livre central e alertas para `saldo <= ponto de pedido`.
4. Abrir `/deposito/sobras` como almoxarife/admin; conferir agregados e aviso de que são excedentes entregues, não retorno físico. Repetir como operador e confirmar bloqueio.
5. Em estoque, ler um QR de produto conhecido e outro desconhecido; verificar destaque/entrada existente, formulário preenchido e alternativa manual.
6. Em `/admin/biometria?debug=1`, testar zero, um e mais de um rosto, consentimento, câmera e resultado de consistência. Em hardware real, repetir no browser padrão e não em navegador integrado.

**Não verificado em dispositivo:** todas as larguras de tela, câmera/QR físico, impressão, orientação da câmera e comportamento em navegadores integrados. Não foi realizado teste de banco nem de serviço facial externo.
