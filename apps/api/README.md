# @huddle/api

Hono + Zod OpenAPI backend for Huddle. SQLite via libsql + Drizzle.
Deep modules: each `src/routes/<name>/` exposes only `index.ts`.

## Routes (seams)

- `src/routes/auth/auth.index.ts` — `POST /auth/register`, `POST /auth/login`, `GET /auth/me`
- `src/routes/channels/channels.index.ts` — `GET /channels`, `GET /channels/{id}/messages`, `POST /channels/{id}/messages`
- `src/routes/tasks/` — starter example (kept for reference)

## Env

```sh
cp .env.example .env
```

| var            | default           | notes                                     |
| -------------- | ----------------- | ----------------------------------------- |
| `DATABASE_URL` | `file:./local.db` | sqlite file                               |
| `JWT_SECRET`   | dev-only…         | min 16 chars, must override in production |
| `PORT`         | 4444              |                                           |

## Commands

```sh
pnpm install
pnpm db:push
pnpm db:seed
pnpm dev
pnpm typecheck
pnpm test
```

## Sprint flow test

`src/routes/channels/channels.test.ts` encodes Definition of Success:
User A sends → User B reads → re-fetch persists.
