import { execSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import env from "@/env";
import { createTestApp } from "@/lib/create-app";

import router from "./auth.index";

if (env.NODE_ENV !== "test") {
  throw new Error("NODE_ENV must be 'test'");
}

const app = createTestApp(router);

function pushSchemaTolerant() {
  // Parallel vitest workers share test.db — concurrent pushes can fail.
  // Retry, then continue; queries will surface a real problem.
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

describe("auth routes (through entry point)", () => {
  beforeAll(() => {
    pushSchemaTolerant();
  });

  afterAll(() => {});

  const user = { name: "Ada", email: "ada@huddle.test", password: "password123" };
  let token = "";

  it("rejects invalid registration", async () => {
    const res = await app.request("/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "not-an-email" }),
    });
    expect(res.status).toBe(422);
  });

  it("registers a user + returns token without passwordHash", async () => {
    const res = await app.request("/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(user),
    });
    expect(res.status).toBe(200);
    const json = await res.json() as { user: Record<string, unknown>; token: string };
    expect(json.user.email).toBe(user.email);
    expect(json.token.length).toBeGreaterThan(10);
    expect("passwordHash" in json.user).toBe(false);
    token = json.token;
  });

  it("rejects duplicate registration", async () => {
    const res = await app.request("/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(user),
    });
    expect(res.status).toBe(409);
  });

  it("rejects bad password", async () => {
    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: user.email, password: "wrong-password" }),
    });
    expect(res.status).toBe(401);
  });

  it("logs in + /auth/me works with token", async () => {
    const login = await app.request("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: user.email, password: user.password }),
    });
    expect(login.status).toBe(200);
    const { token: t } = await login.json() as { token: string };
    token = t;

    const me = await app.request("/auth/me", {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(me.status).toBe(200);
    const meJson = await me.json() as { email: string };
    expect(meJson.email).toBe(user.email);
  });

  it("rejects /auth/me without token", async () => {
    const me = await app.request("/auth/me");
    expect(me.status).toBe(401);
  });
});
