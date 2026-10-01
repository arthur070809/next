This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

### MySQL

O projeto usa somente MySQL para persistir usuários, catálogo, requisições e histórico. O driver utilizado no servidor é `mysql2`.

1. Crie as tabelas e carregue os 20 itens iniciais usando MySQL 8.0.16 ou superior. No cliente `mysql`, execute:

   ```powershell
   SOURCE database/schema.sql;
   ```

2. Copie `.env.example` para `.env.local` e informe as credenciais do seu MySQL.
3. Registre os usuários pela página `/cadastro`. Novos cadastros recebem o perfil `operador`.
4. Para permitir que um funcionário atenda requisições, altere seu perfil no MySQL:

   ```sql
   UPDATE usuarios SET role = 'almoxarife' WHERE codigo_cracha = 'CODIGO_DO_CRACHA';
   ```

As rotas de mutação usam transações InnoDB. A atribuição de uma requisição usa bloqueio da linha do pedido para impedir que dois almoxarifes a assumam ao mesmo tempo. Não há dados demo de requisições/histórico inseridos; esses registros passam a ser criados pelo fluxo da aplicação.

O cadastro/login atual ainda não cria uma sessão segura no servidor; a tela guarda o usuário autenticado no navegador para associar novas requisições ao respectivo registro. Use sessão por cookie HttpOnly antes de expor o sistema como aplicação de produção.

## Getting Started (Next.js)

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Stock quantity limits

Packaging count and quantity per package must be positive integers no greater than 1,000,000 each. The calculated stock balance cannot exceed 2,147,483,647 (the MySQL `INT` maximum); the server calculates this total.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Autenticacao por aparelho e rosto

Usuarios do almoxarifado passam por senha, aparelho confiavel/WebAuthn e, depois, desafio facial emitido pelo servidor. A sessao somente e criada por `app/api/auth/login/face/verify/route.ts`; nenhum resultado de comparacao enviado pelo navegador e aceito.

O servico facial e externo ao Next.js e deve expor `POST /v1/enroll`, recebendo `{ "captures": [data-uri, ...] }` e retornando `{ "embeddings": [[...], ...] }`, e `POST /v1/verify`, retornando somente `{ "livenessPassed": boolean, "matched": boolean }`. Use HTTPS entre os servicos, `FACE_SERVICE_TOKEN`, validacao de tipo/tamanho/dimensoes e memoria volatil para imagens.

O fornecedor deve confirmar licenca comercial do modelo e fornecer PAD/liveness adequado. Pesos do InsightFace/ArcFace nao devem ser tratados como liberados para uso comercial sem verificacao da licenca. O backend falha fechado quando `FACE_SERVICE_URL` ou a chave de embeddings nao estao configuradas.

### Migration e rollback

Antes de aplicar em producao, faca backup do MySQL e valide a migration em uma copia. A partir de `next/my-app`:

```powershell
npx prisma migrate status
npx prisma migrate deploy
npx prisma generate
```

A migration `20261001140000_add_face_authentication` cria templates criptografados, desafios e tentativas. O rollback recomendado e restaurar o backup. Em janela de manutencao, apos confirmar impacto, as tabelas podem ser removidas com `DROP TABLE face_auth_attempts, liveness_challenges, face_templates`.

### Operacao segura e LGPD

Gere `FACE_EMBEDDING_ENCRYPTION_KEY` com 32 bytes aleatorios, armazene-a em Secret Manager/KMS e nunca a versione. Para rotacionar, mantenha a chave antiga somente durante a migracao, recripte todos os templates, valide a contagem e remova a antiga. O limiar `0.42` e ponto de partida, nao garantia: FAR/FRR precisam ser medidos pelo fornecedor no ambiente real.

A finalidade e autenticar funcionarios do almoxarifado. O dado sensivel e o embedding facial; fotos nao sao armazenadas. Templates ficam cifrados no MySQL, com acesso restrito, retencao enquanto o acesso for necessario e exclusao no desligamento ou revogacao. O termo deve registrar consentimento especifico, versao, data, coletor, finalidade, prazo e direito de revogacao. Riscos principais: falsos positivos/negativos, deepfake, falha de camera e comprometimento da chave. Controles: aparelho confiavel, WebAuthn, desafio ativo, nonce, rate limit, bloqueio, auditoria sem biometria e acesso emergencial auditado. RH/juridico deve aprovar a base legal e o RIPD antes da ativacao.

### Validacao manual

1. Admin cria um aparelho, mostra o codigo de uso unico e conclui o pareamento no celular.
2. Admin coleta 3 a 5 amostras com consentimento, frente/giro/iluminacao adequada; capturas escuras, borradas, cortadas ou com varios rostos devem ser rejeitadas pelo servico.
3. Usuario entra com cracha e senha, confirma o aparelho, executa o desafio facial e chega ao Almoxarifado.
4. Repita com foto de foto, outra pessoa, nonce expirado/reutilizado e aparelho revogado; todos devem falhar com mensagem generica.
5. Admin concede acesso emergencial com justificativa e valide uso unico/expiracao.
6. Desative o usuario e confirme exclusao dos templates, desafios e sessoes; usuario comum recebe 403 nas rotas administrativas e visitante 401.

Pendencias de producao: validar PAD certificado contra deepfakes, medir FAR/FRR com dados reais, manter contingencia quando a camera falhar e manter TOTP habilitado para o admin. WebAuthn local e vinculo do aparelho, nao prova de identidade facial.
