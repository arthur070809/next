# Ciclo de vida das sessões

As sessões são tokens opacos guardados na tabela `sessoes`; o cookie `marcon_session` é de sessão do navegador (`HttpOnly`, `SameSite=Lax`, `Path=/` e `Secure` em produção), sem `Max-Age` nem `Expires`.

## Validade no servidor

Toda página e API autenticada usa `getAuthenticatedFuncionario`, `requireAdmin` ou `requireAlmoxarife`, que validam a linha de sessão antes de autorizar a requisição. Heartbeats só atualizam `ultimo_sinal_em` quando passaram mais de cinco segundos desde a escrita anterior; uma saída válida é anulada junto com essa atualização. O logout explícito define `revogada_em`.

| Perfil | Inatividade | Carência após pagehide |
|---|---:|---:|
| Operador | 25 s | 15 s |
| Almoxarife | 180 s | 180 s |
| Admin | 180 s | 180 s |

Os limites podem ser sobrescritos em milissegundos com `SESSION_OPERATOR_IDLE_TIMEOUT_MS`, `SESSION_OPERATOR_LEAVE_GRACE_MS`, `SESSION_WAREHOUSE_IDLE_TIMEOUT_MS`, `SESSION_WAREHOUSE_LEAVE_GRACE_MS`, `SESSION_ADMIN_IDLE_TIMEOUT_MS` e `SESSION_ADMIN_LEAVE_GRACE_MS`. Valores configurados devem ser inteiros positivos; configuração inválida falha explicitamente.

O cliente envia `POST /api/auth/heartbeat` a cada 10 segundos enquanto visível, ao voltar à visibilidade e ao restaurar uma página do BFCache. `pagehide` envia `POST /api/auth/leave`; esse endpoint somente registra `saida_em`. Uma mensagem `BroadcastChannel` avisa outras abas para renovarem a sessão. Toda decisão de expiração usa o relógio do servidor; não há cron ou estado de sessão em memória.

## Migration manual

O schema Prisma e a migration versionada adicionam `ultimo_sinal_em`, `saida_em` e `revogada_em` à tabela existente `sessoes`. Para o banco de demonstração, aplique manualmente pelo DBeaver o SQL em [`prisma/manual_sql/add_session_lifecycle.sql`](../prisma/manual_sql/add_session_lifecycle.sql). O SQL também está versionado em `prisma/migrations/20261007120000_add_session_lifecycle/migration.sql`.

Não executei a migration nem conectei ao banco. Até as colunas existirem, o helper central nega acesso e registra um erro indicando a migration necessária; não faz fallback para a sessão antiga.
