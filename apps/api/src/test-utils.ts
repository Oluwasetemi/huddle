import { execSync } from "node:child_process";

export function pushSchemaTolerant() {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      execSync("pnpm drizzle-kit push", { stdio: "ignore" });
      return;
    }
    catch {
      execSync("sleep 1", { stdio: "ignore" });
    }
  }
}
