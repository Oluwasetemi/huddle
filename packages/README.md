# packages/ — deep modules

Every package here is a **deep module**: lots of behaviour behind a small interface.

## Layout (copy-me)

```text
packages/<name>/
  index.ts        ← entry point (public). Import this from outside.
  client.ts       ← optional second entry point. Several small entries > one barrel.
  lib/            ← implementation (private). Free to nest, never import from outside.
  tests/          ← tests + fixtures. Import only through entry points.
```

Example:

```ts
// packages/contracts/index.ts (public seam)
export { loginSchema, registerSchema } from "./lib/auth.js";
export type { AuthInput } from "./lib/auth.js";

// packages/contracts/lib/auth.ts (private implementation)
import { z } from "zod";
export const registerSchema = z.object({ /* ... */ });
```

## The four rules

1. **Entry-point boundary**: code outside a package may import only that package's root files, never anything in its subfolders.
2. **Intra-package freedom**: a package's own files import each other freely.
3. **Tests through entry points**: files under `<pkg>/tests/` import only entry points (their own fixtures excepted), never subfolder internals.
4. **No cycles**.

Barrel files that re-export a whole subtree are discouraged — expose several small entry points instead.

Run `pnpm lint:boundaries` from the repo root. See `/.dependency-cruiser.cjs`.
