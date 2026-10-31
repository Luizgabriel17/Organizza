# Organiza Família

Aplicação para organizar vendas, contas e encomendas usando PostgreSQL no Neon e uma API serverless no Vercel. O site não tem login: qualquer pessoa que acessar o endereço poderá consultar e alterar os dados da família. Não use para guardar informações que precisem de confidencialidade ou controle de acesso.

## Tecnologias

React, TypeScript, Vite, Vercel Functions e Neon PostgreSQL.

## Mapa das funcionalidades

- **Início (`/`)**: resumo de vendas, contas pendentes/atrasadas, encomendas e valores a receber; mostra também o total, os valores pendentes e os valores pagos das contas com vencimento no mês atual.
- **Vendas (`/vendas`)**: criar, editar, consultar e excluir logicamente vendas; busca por produto, filtros por período e forma de pagamento, e resumo diário/mensal.
- **Contas (`/contas`)**: cadastrar e editar contas, atribuir categorias com cores personalizáveis, filtrar por status e mês, buscar por descrição, marcar pagamento integral, cancelar ou excluir logicamente. Exibe totais por mês de vencimento, separando pendentes e pagas; contas canceladas ficam fora das somas. Recorrências mensais são geradas sem duplicidade até o horizonte configurado no banco.
- **Encomendas (`/encomendas`)**: cadastrar e editar encomendas com vários itens, buscar por cliente/telefone/produto, filtrar por etapa, avançar produção até a entrega, cancelar/reativar e registrar pagamentos parciais. Detalhes exibem itens e histórico financeiro.
- **Relatórios (`/relatorios`)**: filtrar por datas, consultar vendas brutas, pagamentos de contas, recebimentos de encomendas, saldos pendentes, etapas e produtos mais vendidos; exportar CSV.
- **Configurações (`/configuracoes`)**: criar, editar cores e excluir categorias; exportar os registros da família em JSON.
- **Busca global**: localizar vendas, contas e encomendas pelo cabeçalho, com atalho direto para os detalhes.

O dashboard e os relatórios não calculam lucro: vendas não registram custo ou estorno. O site não envia lembretes por e-mail, SMS ou notificações push.

## Configuração do banco Neon

1. Crie um projeto PostgreSQL no [Neon](https://neon.tech/).
2. No SQL Editor do Neon, execute o conteúdo de [`db/schema.sql`](./db/schema.sql). O script cria as tabelas, índices, validações e funções transacionais usadas pelo app. Se o schema já foi instalado, aplique também as migrações em [`db/migrations/`](./db/migrations/) na ordem numérica; elas adicionam cores persistidas às categorias existentes.
3. Crie o espaço inicial da família no SQL Editor:

   ```sql
   insert into public.families (name)
   values ('Minha família')
   returning id;
   ```

4. Copie o UUID retornado. Ele será configurado como `FAMILY_ID` e `VITE_FAMILY_ID`.
5. Gere uma nova senha/connection string do Neon antes de publicar se a string de conexão já tiver sido compartilhada. A senha do banco deve ficar privada.

O banco Neon começa vazio. Esta configuração cria a estrutura e a família, mas não importa registros de outro banco.

## Desenvolvimento local

1. Instale as dependências e crie `.env.local` a partir do exemplo:

   ```bash
   npm install
   cp .env.example .env.local
   ```

2. Em `.env.local`, configure:
   - `DATABASE_URL`: connection string do Neon; usada somente pela API no servidor.
   - `FAMILY_ID`: UUID da família; usado somente pela API no servidor.
   - `VITE_FAMILY_ID`: o mesmo UUID; esta variável é pública e não é uma credencial.

   Não coloque `DATABASE_URL` em uma variável com prefixo `VITE_`, nem a envie ao navegador ou ao repositório.

3. Inicie o Vercel localmente para disponibilizar tanto o site quanto a API:

   ```bash
   npm run dev
   ```

## Publicação no Vercel

1. Importe este repositório no Vercel.
2. Em **Project Settings → Environment Variables**, cadastre `DATABASE_URL` e `FAMILY_ID` como variáveis privadas do servidor e `VITE_FAMILY_ID` como variável de build. Use o mesmo UUID nos dois lugares.
3. Publique o projeto. O Vercel serve a aplicação e a função [`api/db.ts`](./api/db.ts); a conexão com o Neon nunca é enviada ao navegador.

## Acesso e proteção dos dados

- Não há login, senha de acesso ou autorização de membros.
- O endpoint da API é público. Ele valida operações e restringe consultas à família configurada, mas não consegue distinguir familiares de visitantes.
- Qualquer visitante pode ler os registros da família e fazer alterações por meio do site ou da API. O UUID da família não é uma senha.
- O navegador recebe apenas `VITE_FAMILY_ID`; `DATABASE_URL` permanece no servidor.
- O plano gratuito e seus limites dependem das condições atuais do Neon e do Vercel. Configure e teste backups no Neon.

## Verificações

```bash
npm test
npm run build
```

Os testes existentes cobrem formatadores. A conexão real e as funções do PostgreSQL devem ser verificadas com um projeto Neon configurado; não foi feita conexão com a sua conta.
# Organizza
