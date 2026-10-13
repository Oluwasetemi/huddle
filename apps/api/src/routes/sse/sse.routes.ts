import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";

export const tasksStream = createRoute({
  path: "/sse/tasks",
  method: "get",
  tags: ["SSE"],
  summary: "Stream task events via Server-Sent Events",
  request: {
    query: z.object({
      taskId: z.coerce.number().optional().openapi({
        description: "Optional task ID to subscribe to a specific task",
        example: 1,
      }),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: {
      description: "SSE stream of task events",
      content: {
        "text/event-stream": {
          schema: {
            type: "string",
          },
        },
      },
    },
  },
});

export type TasksStreamRoute = typeof tasksStream;
