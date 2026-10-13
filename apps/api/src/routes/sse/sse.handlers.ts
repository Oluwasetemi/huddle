import { streamSSE } from "hono/streaming";

import type { AppRouteHandler } from "@/lib/types";

import { pubsub, SUBSCRIPTION_EVENTS } from "@/lib/pubsub";

import type { TasksStreamRoute } from "./sse.routes";

const HEARTBEAT_INTERVAL_MS = 30_000;

export const tasksStream: AppRouteHandler<TasksStreamRoute> = async (c) => {
  const { taskId } = c.req.valid("query");

  return streamSSE(c, async (stream) => {
    const connectionId = crypto.randomUUID();
    let aborted = false;

    await stream.writeSSE({
      event: "connected",
      data: JSON.stringify({
        connectionId,
        channel: "tasks",
        taskId: taskId ?? null,
        timestamp: new Date().toISOString(),
      }),
    });

    const heartbeat = setInterval(() => {
      void stream.writeSSE({
        event: "heartbeat",
        data: JSON.stringify({ timestamp: new Date().toISOString() }),
      });
    }, HEARTBEAT_INTERVAL_MS);

    stream.onAbort(() => {
      aborted = true;
      clearInterval(heartbeat);
    });

    const iterators = [
      pubsub.asyncIterableIterator<{ taskCreated: { id: number } }>(SUBSCRIPTION_EVENTS.TASK_CREATED),
      pubsub.asyncIterableIterator<{ taskUpdated: { id: number } }>(SUBSCRIPTION_EVENTS.TASK_UPDATED),
      pubsub.asyncIterableIterator<{ taskDeleted: { id: number } }>(SUBSCRIPTION_EVENTS.TASK_DELETED),
    ];

    const writeEvents = async (eventName: string, iterator: AsyncIterable<Record<string, unknown>>) => {
      for await (const payload of iterator) {
        if (aborted)
          break;

        const value = Object.values(payload)[0] as { id?: number } | undefined;
        if (taskId && value?.id !== taskId)
          continue;

        await stream.writeSSE({
          event: eventName,
          data: JSON.stringify({
            ...payload,
            timestamp: new Date().toISOString(),
          }),
        });
      }
    };

    await Promise.race([
      writeEvents("task.created", iterators[0]),
      writeEvents("task.updated", iterators[1]),
      writeEvents("task.deleted", iterators[2]),
    ]);
  });
};
