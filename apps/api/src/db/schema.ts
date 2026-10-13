import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
// Simpler explicit zod schemas for the API seam (small interface):
import { z } from "zod";

// ---- starter example (kept for reference) ----
export const tasks = sqliteTable("tasks", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  done: integer("done", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
});

export const selectTasksSchema = createSelectSchema(tasks);

export const insertTasksSchema = createInsertSchema(tasks, {
  // eslint-disable-next-line style/arrow-parens
  name: (schema) => schema.min(1).max(500),
})
  .required({
    done: true,
  })
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  });

export const patchTasksSchema = insertTasksSchema.partial();

// ---- Huddle: users ----
export const users = sqliteTable("users", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
});

export const selectUserSchema = createSelectSchema(users).omit({
  passwordHash: true,
});

export const registerInputSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
});

export const loginInputSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(128),
});

// ---- Huddle: channels ----
export const channels = sqliteTable("channels", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
});

export const selectChannelSchema = createSelectSchema(channels);

export const insertChannelSchema = createInsertSchema(channels, {
  // eslint-disable-next-line style/arrow-parens
  name: (schema) => schema.min(1).max(80),
})
  .omit({ id: true, createdAt: true, updatedAt: true });

// ---- Huddle: messages ----
export const messages = sqliteTable("messages", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  channelId: integer("channel_id", { mode: "number" }).notNull(),
  userId: integer("user_id", { mode: "number" }).notNull(),
  text: text("text").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
});

export const selectMessageSchema = createSelectSchema(messages);

export const insertMessageInputSchema = z.object({
  text: z.string().trim().min(1).max(2000),
});

export const messageWithAuthorSchema = selectMessageSchema.extend({
  author: z.object({
    id: z.number(),
    name: z.string(),
    email: z.string().email(),
  }),
});
