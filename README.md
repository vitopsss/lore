# Projeto Lore

Base para um app mobile em Expo + backend Node.js/TypeScript focado em catalogo social de leitura no Brasil, com identidade visual propria do Lore.

## Stack

- Mobile: React Native com Expo
- Backend: Node.js + Express + TypeScript
- Banco: PostgreSQL
- Catalogo: Google Books API + Open Library
- Compartilhamento: `@napi-rs/canvas` + upload opcional para Cloudinary

Se voce estiver sem PostgreSQL ou Docker no ambiente local, a API tambem aceita `DATA_PROVIDER=memory` e sobe com dados demo.
Se quiser desligar livros fake na busca, defina `ALLOW_DEMO_BOOK_FALLBACK=false`.

## Estrutura

```text
apps/
  api/       Backend, integracoes, endpoints e migracoes SQL
  mobile/    App Expo com feed, busca, registro de atividade e stats
```

## Endpoints

- `GET /search?q=dom+casmurro`
- `POST /activity`
- `GET /feed`
- `GET /stats/:userId`
- `GET /health`

## Banco e migracoes

As migracoes estao em [apps/api/sql/migrations/001_init.sql](/C:/app/apps/api/sql/migrations/001_init.sql) e [apps/api/sql/migrations/002_seed_demo.sql](/C:/app/apps/api/sql/migrations/002_seed_demo.sql).

Scripts uteis:

- `npm run db:migrate`
- `npm run db:seed`
- `npm run db:setup`

Seed de demonstracao:

- Usuario basico: `00000000-0000-0000-0000-000000000001`
- Usuario premium: `00000000-0000-0000-0000-000000000002`

## Variaveis principais

Arquivo base: [apps/api/.env.example](/C:/app/apps/api/.env.example)

- `DATABASE_URL`
- `DATA_PROVIDER` (`postgres` ou `memory`)
- `GOOGLE_BOOKS_BASE_URL`
- `OPEN_LIBRARY_BASE_URL`
- `OPEN_LIBRARY_CONTACT_EMAIL`
- `ALLOW_DEMO_BOOK_FALLBACK`
- `AMAZON_ASSOCIATE_TAG`
- `APP_NAME`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

## Observacoes de produto

- Links de compra sao normalizados com `tag` de afiliado da Amazon Brasil.
- Temas exclusivos de card e estatisticas avancadas exigem `premium_status = true`.
- O app mobile alterna entre um perfil basico e um premium para demonstrar o gating.
