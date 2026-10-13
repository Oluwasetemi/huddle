# Huddle — Demo Sprint Monorepo

Lightweight collaboration for small remote teams.
One-week scope: **Authentication + Channel Messaging only**.

Sprint Goal: `New user → Create account → Login → Enter a channel → Send a message → Another user sees it.`

## Monorepo layout (pnpm)

```text
huddle/
  apps/
    api/            ← Hono + Zod OpenAPI backend (sqlite via libsql + drizzle)
    web/            ← React web app
    desktop/        ← Rust GPUI desktop app (outside pnpm)
  packages/
    contracts/      ← shared zod schemas for web + api — deep module
```

## Codebase design — deep modules

We follow deep-module discipline (see `packages/README.md`):

- **Module**: anything with an interface + implementation.
- **Interface**: everything a caller must know (types, invariants, errors, ordering).
- **Seam**: where the interface lives — the only way in.
- **Depth**: lots of behaviour behind a small interface.

Rules:

1. Each route group (`apps/api/src/routes/<name>/`) exposes only `index.ts` (entry point).
   `*.routes.ts` / `*.handlers.ts` are implementation — never import them directly.
2. Shared code lives in `packages/<name>/` with entry points at the package root
   (`index.ts`, `client.ts`), implementation in `lib/`, tests in `tests/`.
3. Tests import only through entry points.
4. No dependency cycles. Run `pnpm lint:boundaries` to verify.

## Quickstart (backend only)

```sh
cd apps/api
cp .env.example .env
# edit DATABASE_URL=file:./local.db and JWT_SECRET
pnpm install
pnpm drizzle-kit push
pnpm dev
```

Open:

- `GET /` — health
- `GET /doc` — OpenAPI spec
- `GET /reference` — Scalar docs

MVP endpoints:

```text
POST /auth/register
POST /auth/login
GET  /auth/me
GET  /channels
GET  /channels/{id}/messages
POST /channels/{id}/messages
```

See `apps/api/README.md` for full API tour.
