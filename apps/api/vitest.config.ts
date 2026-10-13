import path from "node:path";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    exclude: [...configDefaults.exclude, "dist/**"],
    // sqlite test.db is shared by all suites — one worker keeps file
    // access (drizzle-kit push, writes) sequential and deterministic.
    maxWorkers: 1,
  },
});
