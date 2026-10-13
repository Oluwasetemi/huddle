import { createMiddleware } from "hono/factory";
import { sign, verify } from "hono/jwt";
import { Buffer } from "node:buffer";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import * as HttpStatusCodes from "stoker/http-status-codes";

import env from "@/env";

import type { AppBindings } from "./types";

const SCRYPT_OPTS = { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 } as const;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64, SCRYPT_OPTS).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [algo, salt, hashHex] = stored.split("$");
  if (algo !== "scrypt" || !salt || !hashHex)
    return false;
  try {
    const hash = Buffer.from(hashHex, "hex");
    const test = scryptSync(password, salt, 64, SCRYPT_OPTS);
    if (hash.length !== test.length)
      return false;
    return timingSafeEqual(hash, test);
  }
  catch {
    return false;
  }
}

export type JwtPayload = {
  sub: number;
  email: string;
  name: string;
  exp?: number;
  iat?: number;
};

export async function signToken(user: { id: number; email: string; name: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  // JWT_EXPIRES_IN is like "7d" — keep simple: 7 days
  const payload: JwtPayload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    iat: now,
    exp: now + 7 * 24 * 60 * 60,
  };
  return sign(payload, env.JWT_SECRET, "HS256");
}

export async function verifyToken(token: string): Promise<JwtPayload> {
  return (await verify(token, env.JWT_SECRET, "HS256")) as unknown as JwtPayload;
}

function getBearerToken(header: string | undefined): string | null {
  if (!header)
    return null;
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token)
    return null;
  return token;
}

// Seam: requireAuth — the only way protected handlers learn the caller.
// Sets `userId` + `user` variables or returns 401.
export const requireAuth = createMiddleware<AppBindings>(async (c, next) => {
  const token = getBearerToken(c.req.header("authorization"));
  if (!token) {
    return c.json({ message: "Unauthorized" }, HttpStatusCodes.UNAUTHORIZED);
  }
  try {
    const payload = await verifyToken(token);
    if (!payload.sub) {
      return c.json({ message: "Unauthorized" }, HttpStatusCodes.UNAUTHORIZED);
    }
    c.set("userId", payload.sub);
    c.set("user", { id: payload.sub, name: payload.name, email: payload.email });
    await next();
  }
  catch {
    return c.json({ message: "Unauthorized" }, HttpStatusCodes.UNAUTHORIZED);
  }
});
