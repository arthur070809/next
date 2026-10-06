# Plano de execução

Trabalho baseado na branch atual e nos commits locais de QR/facial já existentes. Não serão lidos arquivos `.env*`, nem acessado banco, executados scripts de dados/migrations/push/merge ou adicionadas dependências.

| Tarefa | Arquivos previstos | Riscos e abordagem |
|---|---|---|
| A1 — Preservar descrições dos itens | `app/api/requests/route.ts`, `app/api/almoxarifado/requisicoes/route.ts`, `app/api/historico/route.ts`, `app/api/estoque/route.ts`, `app/api/itens/route.ts`, tipos e componentes de fila/checklist/histórico/estoque | Corrigir select/mapeamento sem expor metadados de setor/idempotência nem alterar escrita ou transações. |
| A2 — Indicador de prioridade consistente | `PriorityBadge.tsx`, fila, checklist, histórico, nova lista pessoal | Preservar ordenação atual dentro dos grupos; ordenar prioridade antes do grupo padrão e comunicar além da cor. |
| A3 — Descrição obrigatória em prioridade | formulário, `app/api/requests/route.ts` e testes de API | Validar no servidor; pedidos padrão continuam aceitando descrição vazia. |
| A4 — Minhas Requisições | novo `app/minhas-requisicoes/{page.tsx,layout.tsx}` ou integração na navegação; endpoint autenticado e testes; menu do operador | Restringir consulta pelo ID da sessão, limitar/paginar resultados, não confiar em ID recebido pelo cliente e não usar polling agressivo. |
| A5 — Sessão de operador | `app/api/auth/login/route.ts`, `lib/auth.ts`, `PortalShell.tsx`, componente de sessão e testes | Cookie de sessão não persistente mais expiração/timeout server-side; preservar duração e comportamento dos demais perfis e allowlist demo. |
| B1 — Diagnosticar e corrigir ressuprimento | página e análise existente, testes de rota/página | Manter a regra estoque livre <= ponto de pedido; diferenciar dados simulados dos reais e manter acesso admin. |
| B2 — Layout de estoque | `app/estoque/page.tsx`, `app/estoque/stock-list.module.css` e testes/validação visual disponível | Scroll interno apenas na lista; evitar overflow/scroll aninhado da página. Auditar 360/768/1440 por código se não houver navegador automatizado. |
| B3 — Visão somente leitura das sobras | página existente do depósito ou nova visão, queries read-only e testes | Só derivar sobras de divergências/movimentações se houver associação confiável entre setor, item e quantidade; caso contrário, estado vazio explícito. |
| B4 — QR no cadastro de estoque | `ProductEtiquetaScanner.tsx`, `app/estoque/page.tsx`, API de estoque e testes | Reusar decoder existente; preservar autorização e transações de estoque; permitir digitação manual. |
| C1 — Ocultar indicadores visuais de demo | `app/layout.tsx`, painel admin/reset, teste de renderização | Desativar apenas apresentação; não mexer em flags, allowlist, seed/reset ou proteção CSRF. |
| C2 — Cadastro facial por foto única/galeria | manager/API e testes, somente após verificar compatibilidade do pipeline | Reusar exatamente o pipeline de enrollment/verificação; nunca enviar imagem ao servidor nem salvar imagem/vetor novo. Se não for seguro, documentar como não feito. |
| C3 — Senha e atalho facial no login | schema existente, login API/form e testes; atualizar `DEMO.md` | O schema já contém `senha`; verificar o contrato e o hash atual antes de usar. Preservar rate limit, TOTP, WebAuthn, facial, vivacidade e allowlist. |
| C4 — Responsividade | CSS/componentes das telas priorizadas e `docs/AUDITORIA_RESPONSIVA.md` | Reutilizar tokens existentes, evitar redesenhar fluxos; auditoria física só será declarada se puder ser executada em dispositivo/browser. |
| Documentação e entrega | `DEMO.md`, `docs/RELATORIO_FINAL.md`, `docs/PLANO.md`, `docs/PROGRESSO.md` | Registrar limitações e evidência real; atualizar progresso/commits por tarefa e validações de cada bloco. |

## Ordem

1. Bloco A completo; validar `tsc`, lint, suíte padrão e diff.
2. Bloco B completo; validar novamente.
3. C1, investigar C2/C3 e implementar somente mudanças seguras; depois C4.
4. Gerar relatórios, build em cópia temporária sem arquivos `.env*` e validar estado final.
