import { createNodeWebSocket } from "@hono/node-ws";

import { createRouter } from "@/lib/create-app";
import { createGraphQLWebSocketHandler } from "@/routes/graphql/graphql.websocket";

import { createMessagesChannel } from "./messages.channel";
import { createTasksChannel } from "./tasks.channel";
import { wsManager } from "./websocket.manager";

const router = createRouter();
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app: router });

router.get(
  "/ws/tasks",
  upgradeWebSocket(() => createTasksChannel(crypto.randomUUID())),
);

router.get(
  "/ws/channels/:id",
  upgradeWebSocket((c) => {
    const channelId = Number(c.req.param("id"));
    return createMessagesChannel(channelId, crypto.randomUUID());
  }),
);

router.get(
  "/graphql",
  upgradeWebSocket(() => createGraphQLWebSocketHandler()),
);

router.get("/ws/stats", c => c.json(wsManager.getStats()));

router.get("/ws/health", c => c.json({
  status: "ok",
  websocket: "ready",
  timestamp: new Date().toISOString(),
}));

router.get("/ws-client", (c) => {
  return c.html(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>WebSocket Test Client</title>
    <style>
      body { font-family: system-ui, sans-serif; max-width: 960px; margin: 2rem auto; padding: 0 1rem; }
      textarea, pre { width: 100%; box-sizing: border-box; }
      textarea { min-height: 90px; font-family: ui-monospace, monospace; }
      pre { background: #111827; color: #f9fafb; padding: 1rem; min-height: 240px; overflow: auto; }
      button { padding: 0.5rem 0.75rem; margin-right: 0.5rem; }
    </style>
  </head>
  <body>
    <h1>WebSocket Test Client</h1>
    <p><button id="connect">Connect</button><button id="disconnect">Disconnect</button><button id="send">Send</button></p>
    <textarea id="message">{ "type": "hello", "message": "Hi from the browser" }</textarea>
    <pre id="log"></pre>
    <script>
      let socket;
      const log = document.getElementById("log");
      const write = (message) => { log.textContent += message + "\\n"; log.scrollTop = log.scrollHeight; };
      document.getElementById("connect").addEventListener("click", () => {
        socket = new WebSocket((location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/ws/channels/1");
        socket.addEventListener("open", () => write("connected"));
        socket.addEventListener("message", (event) => write(event.data));
        socket.addEventListener("close", () => write("closed"));
        socket.addEventListener("error", () => write("error"));
      });
      document.getElementById("disconnect").addEventListener("click", () => socket?.close());
      document.getElementById("send").addEventListener("click", () => socket?.send(document.getElementById("message").value));
    </script>
  </body>
</html>`);
});

export { injectWebSocket, upgradeWebSocket };
export default router;
