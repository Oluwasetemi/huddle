import type { WSContext } from "hono/ws";

import { parse, subscribe } from "graphql";

import db from "@/db";

import { schema } from "./graphql.schema";

type GraphQLWsMessage
  = | { type: "connection_init"; payload?: Record<string, unknown> }
    | { type: "ping"; payload?: Record<string, unknown> }
    | {
      type: "subscribe";
      id: string;
      payload: {
        query: string;
        variables?: Record<string, unknown>;
        operationName?: string;
      };
    }
    | { type: "complete"; id: string };

type SubscriptionContext = {
  subscriptions: Map<string, AsyncIterator<unknown>>;
};

function getContext(ws: WSContext): SubscriptionContext {
  const socket = ws as WSContext & { subscriptionContext?: SubscriptionContext };
  if (!socket.subscriptionContext) {
    socket.subscriptionContext = { subscriptions: new Map() };
  }
  return socket.subscriptionContext;
}

export function createGraphQLWebSocketHandler() {
  return {
    onOpen: (_event: Event, ws: WSContext) => {
      getContext(ws);
    },

    onMessage: async (event: MessageEvent, ws: WSContext) => {
      try {
        const message = JSON.parse(event.data.toString()) as GraphQLWsMessage;
        const context = getContext(ws);

        if (message.type === "connection_init") {
          ws.send(JSON.stringify({ type: "connection_ack" }));
          return;
        }

        if (message.type === "ping") {
          ws.send(JSON.stringify({ type: "pong", payload: message.payload }));
          return;
        }

        if (message.type === "complete") {
          const iterator = context.subscriptions.get(message.id);
          if (iterator?.return) {
            await iterator.return();
          }
          context.subscriptions.delete(message.id);
          return;
        }

        if (message.type !== "subscribe") {
          ws.send(JSON.stringify({ type: "error", payload: [{ message: "Unsupported message type" }] }));
          return;
        }

        const document = parse(message.payload.query);
        const result = await subscribe({
          schema,
          document,
          variableValues: message.payload.variables,
          operationName: message.payload.operationName,
          contextValue: { db },
        });

        if ("errors" in result && result.errors) {
          ws.send(JSON.stringify({
            type: "error",
            id: message.id,
            payload: result.errors.map(error => ({ message: error.message })),
          }));
          return;
        }

        if (!(Symbol.asyncIterator in result)) {
          ws.send(JSON.stringify({
            type: "error",
            id: message.id,
            payload: [{ message: "Expected a subscription operation" }],
          }));
          return;
        }

        const asyncIterable = result as AsyncIterable<unknown>;
        const iterator = asyncIterable[Symbol.asyncIterator]();
        context.subscriptions.set(message.id, iterator);

        void (async () => {
          try {
            for await (const value of asyncIterable) {
              ws.send(JSON.stringify({ type: "next", id: message.id, payload: value }));
            }
            ws.send(JSON.stringify({ type: "complete", id: message.id }));
          }
          catch (error) {
            ws.send(JSON.stringify({
              type: "error",
              id: message.id,
              payload: [{ message: error instanceof Error ? error.message : "Unknown subscription error" }],
            }));
          }
          finally {
            context.subscriptions.delete(message.id);
          }
        })();
      }
      catch (error) {
        ws.send(JSON.stringify({
          type: "error",
          payload: [{ message: error instanceof Error ? error.message : "Invalid message" }],
        }));
      }
    },

    onClose: async (_event: CloseEvent, ws: WSContext) => {
      const context = getContext(ws);
      for (const iterator of context.subscriptions.values()) {
        if (iterator.return) {
          await iterator.return();
        }
      }
      context.subscriptions.clear();
    },
  };
}
