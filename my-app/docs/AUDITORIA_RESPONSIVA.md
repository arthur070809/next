# Auditoria responsiva

## Escopo e método

Revisão estática dos layouts e breakpoints das telas principais, sem iniciar o servidor nem acessar banco. Não foram feitas capturas renderizadas em dispositivo; as dimensões abaixo são cenários para validação manual, não resultados de browser.

## Verificação por largura

| Viewport | Comportamento esperado no código | Evidência |
|---|---|---|
| 360 px | Menu lateral inicia fora do viewport e é aberto pelo botão do header; formulário de requisição e formulário de estoque empilham em uma coluna. A lista de estoque tem altura máxima de `60dvh` e é a única área vertical interna dessa tela. | `app/components/PortalShell.tsx`, `app/requisicao/page.tsx`, `app/estoque/page.tsx`, `app/estoque/stock-list.module.css` |
| 767 px | Continua no layout estreito; a lista vem depois do formulário de estoque e permite rolagem própria, sem rolagem interna do formulário. | `app/estoque/page.tsx`, `app/estoque/stock-list.module.css` |
| 768 px | O layout de estoque passa a duas colunas. A lista fica sticky abaixo do header e sua altura máxima é `100dvh - 6rem`; somente a lista de itens rola. | `app/estoque/page.tsx`, `app/estoque/stock-list.module.css` |
| 1440 px | O conteúdo é limitado por `max-w-7xl`; o painel lateral é reservado em desktop; grids de dashboard e fila expandem progressivamente. | `app/components/PortalShell.tsx`, `app/admin/dashboard.tsx`, `app/almoxarifado/queue.tsx` |

## Telas examinadas

- **Shell/menu:** navegação móvel por drawer com overlay e fechamento por botão; em desktop o menu fixo tem largura reservada no conteúdo. Ver [PortalShell.tsx](../app/components/PortalShell.tsx).
- **Nova requisição:** coluna única até o breakpoint `lg`, duas colunas em telas maiores; controles ocupam a largura disponível. Ver [page.tsx](../app/requisicao/page.tsx).
- **Estoque:** formulário e lista empilhados abaixo de 768 px; acima disso, duas colunas. O painel de lista é sticky em desktop e tem rolagem interna apenas em seus resultados. O menu de sugestões de material não tem uma região de scroll independente. Ver [page.tsx](../app/estoque/page.tsx) e [stock-list.module.css](../app/estoque/stock-list.module.css).
- **Fila do almoxarifado:** filtros passam de coluna única para linha; tabela mantém largura mínima de 900 px e rolagem horizontal explícita em telas menores. Ver [queue.tsx](../app/almoxarifado/queue.tsx).
- **Histórico:** filtros passam de uma para duas/três colunas; cartões de eventos são fluidos. Ver [page.tsx](../app/historico/page.tsx).
- **Ressuprimento:** gráfico e tabela preservam legibilidade com rolagem horizontal explícita quando necessário. Ver [RessuprimentoTabela.tsx](../app/admin/ressuprimento/RessuprimentoTabela.tsx).
- **Checklist e câmera QR:** captura usa modal de viewport inteiro; a tela de checklist e os cartões devem ser conferidos com teclado virtual aberto em dispositivo móvel. Ver [page.tsx](../app/almoxarifado/requisicoes/[numeroPedido]/page.tsx) e [ProductEtiquetaScanner.tsx](../app/components/ProductEtiquetaScanner.tsx).

## Riscos restantes e roteiro manual

1. Em 360×800, abrir/fechar o menu, rolar a página e verificar que o foco não fica preso atrás do drawer.
2. Em 360×800 e 767×900, completar o formulário de estoque com teclado virtual aberto; confirmar que não há rolagem interna no formulário e que a lista permanece alcançável abaixo dele.
3. Em 768×900 e 1440×900, percorrer muitos itens na lista e confirmar que o painel sticky não fica escondido pelo header fixo nem impede a rolagem principal da página.
4. Em 360 px, testar a tabela da fila e ressuprimento por rolagem horizontal sem deslocar o layout inteiro.
5. Em telefone real, testar permissão, orientação e fechamento da câmera QR; o acesso à câmera exige HTTPS ou localhost.

Não foi possível confirmar sobreposição de teclado móvel, alturas reais de conteúdo, comportamento de Safari/iOS ou Android por inspeção estática. A validação final de publicação deve incluir esses cinco passos em browser e telefone reais.
