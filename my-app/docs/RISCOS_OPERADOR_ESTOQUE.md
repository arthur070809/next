# Pré-mortem — demonstração operador, estoque e ressuprimento

## O1 — descrição de prioridade

1. Cliente envia descrição com espaços/unicode invisível e contorna validação: normalizar `trim()` no servidor e testar chamada API direta.
2. Pedido parcial é criado antes de descobrir item prioritário inválido: validar todos os itens antes de chamar criação/transação.
3. Erro técnico expõe metadados internos: devolver mensagem em português e não serializar marcador.

## O2 — Minhas Requisições

1. Parâmetro de operador/crachá substitui a identidade autenticada: ignorar identidade enviada pelo cliente e restringir query pelo funcionário da sessão; testar tentativa de URL/body adulterado.
2. Detalhe por id expõe outra pessoa: filtro de proprietário na própria consulta e resposta 404 sem distinguir inexistente.
3. Muitos pedidos somem silenciosamente pelo limite: paginação explícita, ordenação estável e estado “mais pedidos”.

## O3 — sair ao fechar

1. `pagehide` ocorre ao abrir scanner/permissão e encerra a sessão: indicador local de scanner ativo, carência ao voltar e testes do ciclo de câmera.
2. Navegador mata o processo sem disparar evento: manter o timeout de servidor como proteção real e documentar que fechamento não é garantido.
3. Logout best-effort falha por rede: tratar `sendBeacon` como tentativa, sem depender dele; ao voltar após carência, fazer logout síncrono e redirecionar.

## E1 — layout de estoque

1. Header, banner ou teclado reduz a área útil e corta a lista: manter scroll interno limitado por `dvh` e validar visualmente quando houver browser/device.
2. Breakpoint 768 px ativa duas colunas estreitas: confirmar empilhamento abaixo e grid a partir do breakpoint CSS.
3. Conteúdo da busca/lista cria overflow horizontal: restringir min-width e `overflow` no painel; viewport permanece não verificado em dispositivo.

## E2 — QR e entrada de estoque

1. Código parcial `1794` seleciona `17940`: igualdade exata e teste dos dois códigos.
2. Timeout seguido de retry credita duas vezes: mesma chave de idempotência no cliente/servidor e replay sem novo movimento, sem criar lógica paralela de saldo.
3. Operador chama API diretamente: autorização no handler POST e teste 403 antes de consultas/gravações.

## R1 — ponto de pedido

1. Reserva faz alerta divergente entre dashboard, estoque e página: helper compartilhado para saldo livre e teste cruzado.
2. Itens exatamente no ponto ou saldo zero desaparecem: regra inclusiva `livre <= ponto`, com casos igual/zero.
3. Ponto ausente ou histórico escasso causa erro/dado real enganoso: validar o domínio atual do ponto e preservar rótulo explícito de dados simulados/sem dados.
