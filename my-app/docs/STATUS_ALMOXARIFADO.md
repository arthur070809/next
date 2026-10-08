# Status funcional do almoxarifado

Escopo: alterações locais da revisão de fluxo, QR e cadastro facial. Não houve conexão a banco.

| Área | Estado | Limite conhecido |
|---|---|---|
| Descrição de item e categoria | Implementada a leitura de categoria existente e da descrição salva na requisição, removendo prefixos/metadados internos antes de mostrar. | `Item` não tem coluna própria de descrição; não se alterou o schema. |
| Prioridade na fila | O selo expõe o texto “Prioridade”; a ordenação conserva a ordem do resultado recebido dentro dos grupos prioritário e padrão. | A ordem inicial ainda depende da ordenação da consulta da API. |
| Histórico | Metadados não são usados como descrição visível; campos ausentes recebem estado legível. | Nenhuma validação visual em dispositivo. |
| Alerta de ressuprimento | Usa o estoque central, saldo livre (`quantidade - reservada`) e regra `saldo <= ponto de pedido`; informa a sugestão disponível. | Não cria pedido de compra nem baixa de estoque. |
| Sobras/excedentes | A página de resumo foi removida; o endpoint de leitura `/api/deposito/sobras` permanece disponível e protegido. | É excesso entregue ao solicitante, não estoque físico recuperado. |
| QR de estoque | Código conhecido localiza/destaca item; código não conhecido pode alimentar cadastro; entrada utiliza a API existente. Entrada manual permanece. | Fluxo de UI com câmera física e viewport não testado neste ambiente. |
| QR de checklist | Detector nativo tem fallback de inicialização/leitura para `jsqr`; ownership de streams é por montagem e desmontagem. | Testes unitários simulam câmera; não validam hardware/navegadores integrados. |
| Facial | A página de cadastro facial e o botão de início voluntário do login foram removidos. O login mantém a etapa facial somente quando a API responde com um desafio `step: "face"`. | APIs de cadastro/identificação e schema foram preservados; endpoints sem interface ficam como código legado após a demonstração. |
| Cadastro facial por foto única | Não implementado. | O contrato atual manda amostras de imagem ao serviço remoto; não há pipeline compatível para persistir só um descritor local. |

## Acessos

- `/api/deposito/sobras`: endpoint de leitura protegido para almoxarife/admin; não há página de resumo na interface.
- Scanner de estoque: interfaces administrativas/de almoxarife usam o scanner existente; criação/entrada continuam restritas pela API atual.
- `/admin/biometria`: página removida (404 direta); APIs relacionadas foram preservadas conforme o escopo.

## Próximo estado

Ver resultados de verificação e instruções manuais em [RELATORIO_ALMOXARIFADO.md](./RELATORIO_ALMOXARIFADO.md). Para riscos e tarefas que precisam de dados/dispositivo reais, ver [RISCOS_ALMOXARIFADO.md](./RISCOS_ALMOXARIFADO.md).
