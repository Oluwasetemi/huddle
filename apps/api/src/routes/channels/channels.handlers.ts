import { and, asc, desc, eq, lt } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import * as HttpStatusPhrases from "stoker/http-status-phrases";

import type { AppRouteHandler } from "@/lib/types";

import db from "@/db";
import { messages, users } from "@/db/schema";
import { messagesChannelName } from "@/routes/websockets/messages.channel";
import { wsManager } from "@/routes/websockets/websocket.manager";

import type { ListChannelsRoute, ListMessagesRoute, PostMessageRoute } from "./channels.routes";

export const listChannels: AppRouteHandler<ListChannelsRoute> = async (c) => {
  if (!c.get("userId")) {
    return c.json({ message: "Unauthorized" }, HttpStatusCodes.UNAUTHORIZED);
  }
  const rows = await db.query.channels.findMany({ orderBy: (f, ops) => [ops.asc(f.id)] });
  return c.json(rows, HttpStatusCodes.OK);
};

export const listMessages: AppRouteHandler<ListMessagesRoute> = async (c) => {
  if (!c.get("userId")) {
    return c.json({ message: "Unauthorized" }, HttpStatusCodes.UNAUTHORIZED);
  }
  const { id } = c.req.valid("param");
  const { limit, beforeId } = c.req.valid("query");

  const channel = await db.query.channels.findFirst({
    where(fields, ops) {
      return ops.eq(fields.id, id);
    },
  });
  if (!channel) {
    return c.json({ message: HttpStatusPhrases.NOT_FOUND }, HttpStatusCodes.NOT_FOUND);
  }

  const whereClause = beforeId
    ? and(eq(messages.channelId, id), lt(messages.id, beforeId))
    : eq(messages.channelId, id);

  // newest first, then reverse for chronological display
  const rows = await db
    .select({
      id: messages.id,
      channelId: messages.channelId,
      userId: messages.userId,
      text: messages.text,
      createdAt: messages.createdAt,
      authorId: users.id,
      authorName: users.name,
      authorEmail: users.email,
    })
    .from(messages)
    .innerJoin(users, eq(messages.userId, users.id))
    .where(whereClause)
    .orderBy(desc(messages.id))
    .limit(limit);

  const chronological = rows.reverse().map(r => ({
    id: r.id,
    channelId: r.channelId,
    userId: r.userId,
    text: r.text,
    createdAt: r.createdAt,
    author: { id: r.authorId, name: r.authorName, email: r.authorEmail },
  }));

  // keep asc import referenced for future cursor work
  void asc;
  return c.json(chronological, HttpStatusCodes.OK);
};

export const postMessage: AppRouteHandler<PostMessageRoute> = async (c) => {
  const userId = c.get("userId");
  const user = c.get("user");
  if (!userId || !user) {
    return c.json({ message: "Unauthorized" }, HttpStatusCodes.UNAUTHORIZED);
  }
  const { id } = c.req.valid("param");
  const { text } = c.req.valid("json");

  const channel = await db.query.channels.findFirst({
    where(fields, ops) {
      return ops.eq(fields.id, id);
    },
  });
  if (!channel) {
    return c.json({ message: HttpStatusPhrases.NOT_FOUND }, HttpStatusCodes.NOT_FOUND);
  }

  const [inserted] = await db.insert(messages).values({ channelId: id, userId, text }).returning();

  const message = {
    ...inserted,
    author: user,
  };

  wsManager.broadcast(messagesChannelName(id), {
    type: "message.created",
    channelId: id,
    message,
  });

  return c.json(message, HttpStatusCodes.OK);
};
