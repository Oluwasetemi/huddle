import type { WSContext } from "hono/ws";

import { wsManager } from "./websocket.manager";

const CHANNEL_NAME = "tasks";
const PING_INTERVAL_MS = 30_000;

export function createTasksChannel(connectionId: string) {
  let pingInterval: NodeJS.Timeout | undefined;

  return {
    onOpen: (_event: Event, ws: WSContext) => {
      wsManager.addConnection(connectionId, ws);
      wsManager.joinChannel(connectionId, CHANNEL_NAME);

      ws.send(JSON.stringify({
        type: "connected",
        channel: CHANNEL_NAME,
        connectionId,
        timestamp: new Date().toISOString(),
      }));

      pingInterval = setInterval(() => {
        if (!wsManager.isConnected(connectionId)) {
          if (pingInterval)
            clearInterval(pingInterval);
          return;
        }

        ws.send(JSON.stringify({
          type: "ping",
          timestamp: new Date().toISOString(),
        }));
      }, PING_INTERVAL_MS);
    },

    onMessage: (event: MessageEvent, ws: WSContext) => {
      try {
        const data = JSON.parse(event.data.toString()) as { type?: string; taskId?: number };

        if (data.type === "pong")
          return;

        if (data.type === "subscribe" && data.taskId) {
          wsManager.joinChannel(connectionId, `task:${data.taskId}`);
          ws.send(JSON.stringify({ type: "subscribed", taskId: data.taskId }));
          return;
        }

        if (data.type === "unsubscribe" && data.taskId) {
          wsManager.leaveChannel(connectionId, `task:${data.taskId}`);
          ws.send(JSON.stringify({ type: "unsubscribed", taskId: data.taskId }));
          return;
        }

        ws.send(JSON.stringify({
          type: "echo",
          data,
          timestamp: new Date().toISOString(),
        }));
      }
      catch {
        ws.send(JSON.stringify({
          type: "error",
          message: "Failed to process message",
          timestamp: new Date().toISOString(),
        }));
      }
    },

    onClose: () => {
      if (pingInterval)
        clearInterval(pingInterval);
      wsManager.removeConnection(connectionId);
    },

    onError: () => {
      if (pingInterval)
        clearInterval(pingInterval);
      wsManager.removeConnection(connectionId);
    },
  };
}
