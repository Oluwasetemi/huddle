import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent, jsonContentRequired } from "stoker/openapi/helpers";
import { createErrorSchema } from "stoker/openapi/schemas";

import { insertMessageInputSchema, messageWithAuthorSchema, selectChannelSchema } from "@/db/schema";

const tags = ["Channels"];

const channelIdParams = z.object({
  id: z.coerce.number().int().positive(),
});

const messageListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  beforeId: z.coerce.number().int().positive().optional(),
});

export const listChannels = createRoute({
  path: "/channels",
  method: "get",
  tags,
  security: [{ Bearer: [] }],
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.array(selectChannelSchema), "Channels"),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(z.object({ message: z.string() }), "Unauthorized"),
  },
});

export const listMessages = createRoute({
  path: "/channels/{id}/messages",
  method: "get",
  tags,
  security: [{ Bearer: [] }],
  request: {
    params: channelIdParams,
    query: messageListQuery,
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.array(messageWithAuthorSchema), "Channel messages"),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(z.object({ message: z.string() }), "Channel not found"),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(z.object({ message: z.string() }), "Unauthorized"),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(channelIdParams),
      "Invalid params",
    ),
  },
});

export const postMessage = createRoute({
  path: "/channels/{id}/messages",
  method: "post",
  tags,
  security: [{ Bearer: [] }],
  request: {
    params: channelIdParams,
    body: jsonContentRequired(insertMessageInputSchema, "Message to send"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(messageWithAuthorSchema, "Created message"),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(z.object({ message: z.string() }), "Channel not found"),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(z.object({ message: z.string() }), "Unauthorized"),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(insertMessageInputSchema),
      "Validation error",
    ),
  },
});

export type ListChannelsRoute = typeof listChannels;
export type ListMessagesRoute = typeof listMessages;
export type PostMessageRoute = typeof postMessage;
