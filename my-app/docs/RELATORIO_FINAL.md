# Relatório final — estoque, demo, login e responsividade

## Resumo por tarefa

| Tarefa | Resultado |
|---|---|
| B1 — Ressuprimento | Corrigido o cálculo para usar apenas saldo livre e saídas do estoque central. Os itens no ponto de pedido ou abaixo ficam destacados e exibem a quantidade sugerida existente no módulo. A consulta falha com mensagem/código de referência, em vez de parecer uma lista vazia. |
| B2 — Layout de estoque | Lista e formulário ficam alinhados no início; a lista tem rolagem própria limitada e painel sticky em telas largas. Em largura menor que 768 px, formulário vem primeiro e a lista tem limite aproximado de `60dvh`. Leitura estática apenas; sem medição renderizada. |
| B3 — Visão de sobras | Criada visão somente leitura para almoxarife/admin, com filtro de produto e totais por setor. Os valores são excedentes entregues inferidos das divergências e movimentações; não são saldo físico reaproveitável. |
| B4 — QR no estoque | Scanner existente localiza e destaca produto conhecido; código desconhecido abre o cadastro com código preenchido. Entrada continua pela API/transação existente. Criação/ajuste exigem admin ou almoxarife; digitação manual permanece disponível. |
| C1 — Interface demo | Removidas as faixas de demonstração do layout e da fila. Reset administrativo ficou neutro e continua visível apenas quando `canResetDemo` é verdadeiro. Indicadores locais de dados simulados e alertas de negócio foram mantidos onde informam a origem/estado dos dados. |
| C2 — Cadastro facial por foto | **Não implementado.** O fluxo existente exige 3–5 capturas consistentes e envia imagem ao servidor/serviço. Aceitar uma foto sem enviar imagem exigiria outro pipeline; duplicar a mesma foto para simular múltiplas capturas ou contornar o controle de qualidade não é seguro. A rota continua restrita a admin; login facial permanece somente por câmera, 1:1 pelo crachá e com vivacidade. |
| C3 — Senha e atalho facial | Implementada validação da senha contra o hash bcrypt já existente em `Funcionario.senha`, erro genérico e registro no rate limit persistente. Login ganhou mostrar/ocultar e atalho para o desafio facial existente. TOTP, WebAuthn/dispositivo confiável, vivacidade e allowlist demo foram preservados. |
| C4 — Responsividade | Criada auditoria estática das telas e larguras solicitadas. Sem Playwright/browser/aparelho: todos os resultados visuais estão marcados como **não verificados em dispositivo** em [AUDITORIA_RESPONSIVA.md](./AUDITORIA_RESPONSIVA.md). |

## Causa do defeito de ressuprimento

O código tratava o total consultado como estoque central livre, mas incluía saldos e saídas de outros locais; isso tornava o cálculo e os alertas inconsistentes com o estoque apresentado. As consultas agora filtram por `LOCAL_ESTOQUE_SLUG`, e o saldo considera `quantidade - reservada`. A lista destaca estoque menor ou igual ao ponto de pedido. A sugestão é informativa; não foi criada uma operação de compra/ressuprimento que não existe no backend.

Durante o build isolado também foi encontrado um problema de compatibilidade com Next.js: a página de rota exportava uma função nomeada (`carregarDadosRessuprimento`), exportação que o verificador de rotas não aceita. A função e seu teste foram movidos para `lib/ressuprimento/carregar-dados.ts`; a página exporta apenas o componente padrão.

## Como a visão de sobras é derivada

O endpoint seleciona itens de requisições concluídas com motivo `EXCEDEU_LOTE_MINIMO`, usa o setor contido nos metadados da descrição, soma as quantidades das movimentações `SAIDA` vinculadas e calcula `max(0, separado - pedido)`. Agrupa por produto e setor e calcula totais setoriais. Exibe saldo livre central e saldo global do depósito apenas como contexto, não como vínculo ou prova de retorno físico. Se não houver registros compatíveis, a interface informa estado vazio; não inventa sobras.

## Arquivos principais

- Ressuprimento: [carregar-dados.ts](../lib/ressuprimento/carregar-dados.ts), [page.tsx](../app/admin/ressuprimento/page.tsx), [page.test.ts](../app/admin/ressuprimento/page.test.ts), [RessuprimentoTabela.tsx](../app/admin/ressuprimento/RessuprimentoTabela.tsx).
- Sobras: [route.ts](../app/api/deposito/sobras/route.ts), [page.tsx](../app/deposito/sobras/page.tsx) e [route.test.ts](../app/api/deposito/sobras/route.test.ts).
- Estoque/QR: [page.tsx](../app/estoque/page.tsx), [layout.tsx](../app/estoque/layout.tsx), [route.ts](../app/api/estoque/route.ts), [localizarEstoqueItem.ts](../lib/qr/localizarEstoqueItem.ts), [localizarEstoqueItem.test.ts](../lib/qr/localizarEstoqueItem.test.ts).
- Demo/login/facial: [layout.tsx](../app/layout.tsx), [queue.tsx](../app/almoxarifado/queue.tsx), [dashboard.tsx](../app/admin/dashboard.tsx), [route.ts](../app/api/auth/login/route.ts), [LoginForm.tsx](../app/login/LoginForm.tsx), [route.test.ts](../app/api/admin/face-enrollment/route.test.ts).
- Documentação: [DEMO.md](../DEMO.md), [AUDITORIA_RESPONSIVA.md](./AUDITORIA_RESPONSIVA.md).

## Validações

| Validação | Resultado |
|---|---|
| `npx tsc --noEmit` | **Passou, 0 erros.** |
| `npm run lint` | **Passou, sem erros.** |
| `npm test` | **Passou:** 72 arquivos e 326 testes. O script padrão exclui `tests/integration-tidb.test.ts`; nenhum teste conectou a banco. |
| Build isolado, cópia temporária sem `.env*`, `npm run build -- --webpack` | **Parcial/bloqueado por configuração ausente:** compilação otimizada e TypeScript concluíram; a coleta de rotas parou ao importar `/api/almoxarifado/requisicoes/[numeroPedido]` porque `DATABASE_URL` não estava configurada. Não forneci uma URL fictícia nem tentei conexão. A cópia temporária foi removida. |
| `git diff --check` | **Passou** após as alterações de código e documentação. |
| Browser/aparelho | **Não executado.** Auditoria estática somente. |

## Commits locais

Commits já existentes relacionados neste branch: `2ebd04a` (alerta de ressuprimento), `3796c0f` (resumo de excedentes), `e7f7466` (QR de estoque) e `7cc5009` (faixa global).

Commits criados nesta execução:

- `7992af8` — mover loader de ressuprimento para fora da página de rota.
- `db98d09` — neutralizar reset e rótulos da apresentação.
- `a3affd7` — remover faixa amarela simulada da fila e testá-la.
- `3bb8764` — senha e atalho de login facial.
- `b3b658b` — resumo de excedente entregue por setor.
- `a2df6a2` — scanner QR e layout de estoque.
- `c85dd09` — teste de acesso admin-only do cadastro facial.

O diretório estava na branch `ajustes-finais`, não `feat/inventario-invisivel`. Não troquei de branch e não fiz push ou merge. Nenhum schema, migration, dependência ou configuração de build foi alterado.

## Roteiro manual de 5 minutos no celular

1. **0:00–0:45 — Login:** use uma conta não allowlisted com senha bcrypt já cadastrada; valide senha incorreta e correta e mostrar/ocultar. Os crachás allowlisted do seed entram pelo caminho demo por código e não demonstram senha.
2. **0:45–1:20 — Facial:** toque em “Entrar com reconhecimento facial”. Se houver template ativo, confirme câmera ao vivo, vivacidade e correspondência 1:1; sem template, deve aparecer mensagem clara. O login não oferece galeria.
3. **1:20–1:40 — Banner:** confirme que não há faixa global ou faixa amarela de simulação na fila. Indicadores específicos de dado simulado podem permanecer.
4. **1:40–2:30 — Operador:** crie uma requisição prioritária, veja-a em Minhas Requisições e confirme setor/estado.
5. **2:30–3:30 — Estoque em 360 px:** confirme formulário primeiro e lista abaixo com rolagem interna; a página não deve ganhar rolagem aninhada fora da lista.
6. **3:30–4:20 — QR:** escaneie etiqueta existente e confirme seleção/destaque; teste etiqueta desconhecida e confira código preenchido no formulário. A galeria facial de cadastro **não está disponível** nesta versão.
7. **4:20–5:00 — Checklist:** no almoxarifado, confira pedido e quantidade separada, finalize e confirme movimentação/histórico; não repita envio.

## Pendências, publicação e riscos residuais

- **Facial por galeria/uma captura:** requer desenho e validação de um pipeline compatível com a exigência de imagem não enviada ao servidor; cadastro atual segue exigindo 3–5 capturas guiadas. Uma foto pode elevar falsa rejeição, portanto não foi reduzido limiar nem qualidade.
- **Build Vercel:** o build isolado não concluiu coleta de rotas sem `DATABASE_URL`. Para publicar, configurar variáveis por ambiente conforme [DEMO.md](../DEMO.md), verificar que Production não aponta para banco demo e validar o build em Preview com uma URL segura e apropriada. A opção `next build --webpack` está documentada como override opcional; não foi aplicada a configuração.
- **Banco/fixture:** migrações e dados reais não foram acessados. Aplicação de migrations e carga de fixture permanecem tarefas operacionais explícitas, fora desta execução.
- **Teste físico:** câmera/QR, comportamento do teclado móvel, Safari/iOS, Android, sticky e medidas de toque precisam de validação nos viewports 360, 390, 768, 1024 e 1440 px conforme a auditoria responsiva.
- **Senha inicial:** a coluna existente é hash bcrypt; o seed gera senha aleatória e os crachás allowlisted ignoram senha pelo caminho demo. Não há política de senha inicial igual ao crachá nem credenciais de jurado documentadas neste relatório.
- **Sobras:** sem registro confiável de retorno físico/setor associado ao saldo, a visão não permite reaproveitamento nem baixa de uma “sobra”. Isso exigiria modelagem operacional própria, fora do escopo e sem mudança de schema nesta execução.
- Decisões conservadoras: não criar um fluxo facial inseguro de uma foto, não simular consistência duplicando imagens, não usar URL fictícia no build e não mudar branch ativa.
