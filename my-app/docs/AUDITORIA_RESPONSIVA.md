# Auditoria responsiva

## Escopo e método

Revisão estática dos componentes, classes Tailwind e breakpoints. Não foi iniciado um servidor nem feita validação renderizada em Playwright, browser ou aparelho. Todos os resultados abaixo são expectativas inferidas do código e ficam **não verificados em dispositivo**.

## Viewports solicitados

| Largura | Cobertura estática e expectativa | Estado |
|---|---|---|
| 360 px | Layout estreito; formulário de estoque antes da lista; lista limitada a cerca de `60dvh`; tabelas largas contidas em seus próprios wrappers. Conferir também teclado virtual e câmera. | Não verificado em dispositivo |
| 390 px | Mesmo breakpoint estreito de 360 px; conferir quebra de texto, botões e inputs com teclado. | Não verificado em dispositivo |
| 768 px | Limite do layout da tela de estoque: duas colunas; formulário não deve esticar com a lista; painel/lista tem altura limitada e rolagem dos produtos. | Não verificado em dispositivo |
| 1024 px | Layout intermediário; validar menu lateral, colunas, tabelas contidas e sticky sem cobrir conteúdo. | Não verificado em dispositivo |
| 1440 px | Layout amplo limitado pelos containers da aplicação; validar alinhamento de grids e painel sticky. | Não verificado em dispositivo |

## Cobertura por tela

| Tela | Achado estático/correção presente | Arquivos examinados | Estado |
|---|---|---|---|
| Login | Formulário em coluna, senha com mostrar/ocultar, botão de atalho facial e botões de pelo menos 44 px (`min-h-11`). Não há input de arquivo; login facial mantém câmera. | `app/login/LoginForm.tsx`, `app/login/LoginForm.test.ts` | Não verificado em dispositivo |
| Operador — nova requisição | Grid responsivo; conferir selects, tabela/lista de itens e ação de prioridade com teclado aberto e largura estreita. | `app/requisicao/page.tsx` | Não verificado em dispositivo |
| Operador — Minhas Requisições | Conferir cartões/listagem, estado vazio, textos longos e largura da navegação em 360/390 px. | `app/requisicao/minhas/page.tsx` | Não verificado em dispositivo |
| Fila do almoxarifado | A tabela possui largura mínima e wrapper com rolagem horizontal contida; testar filtros e prioridade. | `app/almoxarifado/queue.tsx` | Não verificado em dispositivo |
| Checklist e scanner | Conferir checklist com teclado virtual; modal do scanner usa viewport cheio e depende de HTTPS/permissão de câmera. Não foi testado em telefone. | `app/almoxarifado/requisicoes/[numeroPedido]/page.tsx`, `app/components/ProductEtiquetaScanner.tsx` | Não verificado em dispositivo |
| Estoque | Em telas abaixo de 768 px, formulário primeiro e lista depois com máximo próximo de `60dvh`; em 768 px ou mais, duas colunas com alinhamento no início, lista sticky e rolagem interna dos resultados. | `app/estoque/page.tsx`, `app/estoque/stock-list.module.css` | Não verificado em dispositivo |
| Histórico | Filtros usam grids responsivos e cartões devem se ajustar; conferir textos longos e a tabela/rolagem no celular. | `app/historico/page.tsx` | Não verificado em dispositivo |
| Dashboard | Cards/grids são responsivos; conferir gráficos, ações administrativas e textos em telas estreitas. | `app/admin/dashboard.tsx` | Não verificado em dispositivo |
| Ressuprimento | Lista/tabela com rolagem horizontal própria quando necessário; conferir filtros, sugestões e cards de alerta. | `app/admin/ressuprimento/page.tsx`, `app/admin/ressuprimento/RessuprimentoTabela.tsx` | Não verificado em dispositivo |
| Biometria | Fluxo existente usa captura guiada; revisar câmera, consentimento e controles em viewport baixo. Cadastro por uma única foto não foi implementado. | `app/admin/biometria/page.tsx`, `app/api/admin/face-enrollment/route.ts` | Não verificado em dispositivo |

## Verificações pendentes em aparelho/browser

1. Em 360×800 e 390×844, testar menu, foco, teclado virtual, login, nova requisição e **Minhas Requisições**.
2. Em 360 px, conferir que a rolagem da página não fica presa no formulário e que apenas a lista de estoque rola internamente; testar também o scanner em HTTPS.
3. Em 768×900, 1024×900 e 1440×900, conferir a altura/sticky da lista e se header fixo não cobre conteúdo.
4. Testar fila e ressuprimento por rolagem horizontal confinada, checklist com teclado aberto e navegação de histórico/dashboard.
5. Em dispositivo real, validar permissão, orientação, câmera e fechamento do scanner e da captura facial (Safari/iOS e Android).

Contraste e foco visível foram examinados apenas por classes/fontes no código, não medidos por ferramenta de acessibilidade. Alvos comuns do login usam altura mínima de 44 px; não foi feita medição automatizada de todos os alvos de toque.
