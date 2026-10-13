import { beforeAll, describe, expect, it, vi } from "vitest";

import db from "@/db";
import { channels } from "@/db/schema";
import env from "@/env";
import { createTestApp } from "@/lib/create-app";
import { messagesChannelName } from "@/routes/websockets/messages.channel";
import { wsManager } from "@/routes/websockets/websocket.manager";
import { pushSchemaTolerant } from "@/test-utils";

import authRouter from "../auth/auth.index";
import router from "./channels.index";

if (env.NODE_ENV !== "test") {
  throw new Error("NODE_ENV must be 'test'");
}

const authApp = createTestApp(authRouter);
const app = createTestApp(router);

async function register(email: string, name: string): Promise<string> {
  const res = await authApp.request("/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, email, password: "password123" }),
  });
  if (res.status === 409) {
    const login = await authApp.request("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: "password123" }),
    });
    const j = await login.json() as { token: string };
    return j.token;
  }
  const j = await res.json() as { token: string };
  return j.token;
}

describe("channels + messaging (through entry point)", () => {
  let tokenA = "";
  let tokenB = "";
  let channelId = 1;

  beforeAll(async () => {
    pushSchemaTolerant();
    const existing = await db.query.channels.findMany();
    if (existing.length === 0) {
      await db.insert(channels).values([{ name: "general", description: "Team chat" }]);
    }
    tokenA = await register("a@huddle.test", "User A");
    tokenB = await register("b@huddle.test", "User B");
  });

  it("requires auth for /channels", async () => {
    const res = await app.request("/channels");
    expect(res.status).toBe(401);
  });

  it("lists channels with auth", async () => {
    const res = await app.request("/channels", {
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(res.status).toBe(200);
    const json = await res.json() as { id: number; name: string }[];
    expect(json.length).toBeGreaterThan(0);
    channelId = json[0].id;
  });

  it("rejects empty messages", async () => {
    const res = await app.request(`/channels/${channelId}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", "authorization": `Bearer ${tokenA}` },
      body: JSON.stringify({ text: "   " }),
    });
    expect(res.status).toBe(422);
  });

  it("user A sends → User B reads (sprint success flow)", async () => {
    const post = await app.request(`/channels/${channelId}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", "authorization": `Bearer ${tokenA}` },
      body: JSON.stringify({ text: "Hello from A" }),
    });
    expect(post.status).toBe(200);
    const created = await post.json() as { id: number; text: string };
    expect(created.text).toBe("Hello from A");

    const list = await app.request(`/channels/${channelId}/messages?limit=50`, {
      headers: { authorization: `Bearer ${tokenB}` },
    });
    expect(list.status).toBe(200);
    const msgs = await list.json() as { id: number; text: string; author: { name: string } }[];
    expect(msgs.some(m => m.text === "Hello from A")).toBe(true);
  });

  it("broadcasts new messages to the channel websocket topic", async () => {
    const broadcast = vi.spyOn(wsManager, "broadcast");

    const post = await app.request(`/channels/${channelId}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", "authorization": `Bearer ${tokenA}` },
      body: JSON.stringify({ text: "Hello over websocket" }),
    });

    expect(post.status).toBe(200);
    const created = await post.json() as { id: number; text: string };
    expect(broadcast).toHaveBeenCalledWith(messagesChannelName(channelId), {
      type: "message.created",
      channelId,
      message: expect.objectContaining({
        id: created.id,
        text: "Hello over websocket",
        author: expect.objectContaining({ name: "User A" }),
      }),
    });

    broadcast.mockRestore();
  });

  it("persists after re-fetch", async () => {
    const list = await app.request(`/channels/${channelId}/messages?limit=50`, {
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(list.status).toBe(200);
    const msgs = await list.json() as unknown[];
    expect(msgs.length).toBeGreaterThan(0);
  });
});
