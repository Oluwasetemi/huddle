import { eq } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";

import type { AppRouteHandler } from "@/lib/types";

import db from "@/db";
import { users } from "@/db/schema";
import { hashPassword, signToken, verifyPassword } from "@/lib/auth";

import type { LoginRoute, MeRoute, RegisterRoute } from "./auth.routes";

function toPublicUser(row: typeof users.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export const register: AppRouteHandler<RegisterRoute> = async (c) => {
  const { name, email, password } = c.req.valid("json");
  const normalizedEmail = email.trim().toLowerCase();

  const existing = await db.query.users.findFirst({
    where(fields, ops) {
      return ops.eq(fields.email, normalizedEmail);
    },
  });
  if (existing) {
    return c.json({ message: "Email already in use" }, HttpStatusCodes.CONFLICT);
  }

  const [inserted] = await db
    .insert(users)
    .values({ name: name.trim(), email: normalizedEmail, passwordHash: hashPassword(password) })
    .returning();

  const token = await signToken({ id: inserted.id, email: inserted.email, name: inserted.name });
  return c.json({ user: toPublicUser(inserted), token }, HttpStatusCodes.OK);
};

export const login: AppRouteHandler<LoginRoute> = async (c) => {
  const { email, password } = c.req.valid("json");
  const normalizedEmail = email.trim().toLowerCase();

  const found = await db.query.users.findFirst({
    where(fields, ops) {
      return ops.eq(fields.email, normalizedEmail);
    },
  });
  if (!found || !verifyPassword(password, found.passwordHash)) {
    return c.json({ message: "Invalid email or password" }, HttpStatusCodes.UNAUTHORIZED);
  }

  const token = await signToken({ id: found.id, email: found.email, name: found.name });
  return c.json({ user: toPublicUser(found), token }, HttpStatusCodes.OK);
};

export const me: AppRouteHandler<MeRoute> = async (c) => {
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ message: "Unauthorized" }, HttpStatusCodes.UNAUTHORIZED);
  }
  const found = await db.query.users.findFirst({
    where(fields, ops) {
      return ops.eq(fields.id, userId);
    },
  });
  if (!found) {
    return c.json({ message: "Unauthorized" }, HttpStatusCodes.UNAUTHORIZED);
  }
  // touch updatedAt? no — read-only
  void eq;
  return c.json(toPublicUser(found), HttpStatusCodes.OK);
};
