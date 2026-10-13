import { describe, expect, it } from "vitest";

import app from "@/app";

describe("realtime scaffolding", () => {
  it("serves the GraphQL endpoint", async () => {
    const response = await app.request("/graphql", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "{ hello }" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: {
        hello: "Hello, world!",
      },
    });
  });

  it("serves the realtime test clients", async () => {
    const graphqlClient = await app.request("/graphql-client");
    const sseClient = await app.request("/sse-client");
    const wsClient = await app.request("/ws-client");

    expect(graphqlClient.status).toBe(200);
    expect(sseClient.status).toBe(200);
    expect(wsClient.status).toBe(200);
    await expect(wsClient.text()).resolves.toContain("/ws/channels/1");
  });

  it("serves WebSocket health metadata", async () => {
    const response = await app.request("/ws/health");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "ok",
      websocket: "ready",
    });
  });
});
