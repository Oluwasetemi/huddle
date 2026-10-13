import type { WSContext } from "hono/ws";

import { wsManager } from "./websocket.manager";

const PING_INTERVAL_MS = 30_000;

export function messagesChannelName(channelId: number): string {
  return `channel:${channelId}:messages`;
}

export function createMessagesChannel(channelId: number, connectionId: string) {
  const channelName = messagesChannelName(channelId);
  let pingInterval: NodeJS.Timeout | undefined;

  return {
    onOpen: (_event: Event, ws: WSContext) => {
      wsManager.addConnection(connectionId, ws);
      wsManager.joinChannel(connectionId, channelName);

      ws.send(JSON.stringify({
        type: "connected",
        channel: channelName,
        channelId,
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
        const data = JSON.parse(event.data.toString()) as { type?: string };

        if (data.type === "pong")
          return;

        ws.send(JSON.stringify({
          type: "ack",
          channel: channelName,
          channelId,
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
