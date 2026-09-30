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

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
