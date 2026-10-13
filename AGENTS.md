# AGENTS.md — Huddle

Packages are deep modules: see [packages/README.md](./packages/README.md) before adding or importing one.

Backend routes are deep modules too: `apps/api/src/routes/<name>/` exposes only `index.ts`.
Never import `*.routes.ts` / `*.handlers.ts` directly from another route group.
