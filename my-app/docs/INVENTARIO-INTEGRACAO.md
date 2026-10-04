# Integração futura do inventário invisível

Esta fase entrega apenas funções puras em `lib/inventario/`. Nenhuma tela, rota, consulta ao banco ou gravação de ajuste foi implementada.

## Pontuação e limite operacional

`PESOS_RISCO_INVENTARIO` em `lib/inventario/risco.ts` exporta os pesos usados por `pontuarRisco`:

| Fator | Peso máximo | Escala até o máximo |
|---|---:|---:|
| Movimentações recentes | 30 pontos | 20 movimentos |
| Divergências recentes | 30 pontos | 5 divergências |
| Dias desde a última contagem | 25 pontos | 90 dias |
| Saldo baixo | 15 pontos | saldo no ponto de reposição ou abaixo |

Cada fator cresce monotonicamente até seu teto; o total é arredondado e limitado entre 0 e 100. Sem uma data de contagem conhecida, o fator de idade recebe seu peso máximo. `selecionarParaContagem` aceita somente identificador, código e risco: saldo esperado não faz parte da entrada nem da saída. O limite padrão é três itens por viagem; itens repetidos são consolidados por id.

## Ponto futuro para a pergunta cega

O ponto de descoberta do produto já está no checklist em `app/almoxarifado/requisicoes/[numeroPedido]/page.tsx`: a função `conferirCodigo` trata o retorno bem-sucedido de `conferir-item`, recebe `itemId` e foca o campo existente “Quantidade real conferida”. Em uma futura modalidade explícita de inventário, após a identificação válida do item e antes de exibir qualquer informação de saldo, o operador deve receber a pergunta **“Quantos restaram na prateleira?”**.

Essa modalidade deve ser separada da quantidade solicitada na requisição: não reutilizar o valor pedido como quantidade esperada, não mostrar saldo/esperado antes de enviar a contagem e não alterar a ação atual de leitura QR nem o fluxo de assumir. O cliente envia apenas item, local e quantidade contada; o servidor mantém o esperado oculto e só então chama `avaliarContagem`.

## Registro futuro de divergência e ajuste

Depois de autenticar e validar o papel no servidor, uma divergência deve passar por recontagem humana antes de qualquer correção. A função atual recomenda `RECONTAR` para diferença acima da tolerância; ela não aplica ajuste.

Após confirmação da recontagem e autorização, a transação deve:

1. Ler novamente o saldo atual do par `(itemId, localId)` e validar a contagem dentro da mesma transação.
2. Atualizar o saldo com condição de concorrência e registrar um movimento `AJUSTE`, usando o funcionário autenticado em `Movimentacao.funcionarioId`, o saldo final em `saldoApos`/`reservadaApos` e uma observação com o motivo e a diferença assinada.
3. Persistir o resultado da contagem e o vínculo com o movimento no mesmo commit, para permitir auditoria; nunca sobrescrever uma contagem anterior.

O modelo atual `Movimentacao` guarda `AJUSTE`, quantidade absoluta, saldo após, executor e observação, mas não representa de forma estruturada a quantidade contada/esperada, tolerância, recontagem, local da contagem ou vínculo de correlação. Para histórico confiável, propor aditivamente `ContagemInventario` com id, item/local, executor, criadoEm, esperado (somente servidor), contado, tolerância, diferença assinada, resultado, decisão/recontagem e id da movimentação de ajuste. Criar FKs e índices somente após aprovação e migration humana; não há migration nesta fase.

## Dependências de dados

- Movimentações `SAIDA` já têm quantidade/data e vínculo com `SaldoEstoque`, podendo alimentar o fator de movimentação.
- Não há fonte estruturada para divergências recentes nem data da última contagem. `ContagemInventario` proposta acima é necessária para esses fatores.
- `SaldoEstoque` tem quantidade/reservada por item e local, mas não endereço de prateleira. Endereço físico exigirá decisão e campo aditivo.
- Os dados esperados para `avaliarContagem` devem permanecer no servidor até receber a quantidade contada; não incluí-los no resultado de seleção destinado à interface.
- Nenhum desses campos foi criado e nenhum banco foi acessado nesta fase.
