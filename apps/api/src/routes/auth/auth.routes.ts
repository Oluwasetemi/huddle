import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent, jsonContentRequired } from "stoker/openapi/helpers";
import { createErrorSchema } from "stoker/openapi/schemas";

import { loginInputSchema, registerInputSchema, selectUserSchema } from "@/db/schema";

const tags = ["Auth"];

const tokenResponseSchema = z.object({
  user: selectUserSchema,
  token: z.string(),
});

const unauthorizedSchema = z.object({
  message: z.string(),
});

export const register = createRoute({
  path: "/auth/register",
  method: "post",
  tags,
  request: {
    body: jsonContentRequired(registerInputSchema, "Register a new user"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(tokenResponseSchema, "Registered user + token"),
    [HttpStatusCodes.CONFLICT]: jsonContent(unauthorizedSchema, "Email already in use"),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(registerInputSchema),
      "Validation error",
    ),
  },
});

export const login = createRoute({
  path: "/auth/login",
  method: "post",
  tags,
  request: {
    body: jsonContentRequired(loginInputSchema, "Log in"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(tokenResponseSchema, "Logged-in user + token"),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(unauthorizedSchema, "Invalid credentials"),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(loginInputSchema),
      "Validation error",
    ),
  },
});

export const me = createRoute({
  path: "/auth/me",
  method: "get",
  tags,
  security: [{ Bearer: [] }],
  responses: {
    [HttpStatusCodes.OK]: jsonContent(selectUserSchema, "Current user"),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(unauthorizedSchema, "Unauthorized"),
  },
});

export type RegisterRoute = typeof register;
export type LoginRoute = typeof login;
export type MeRoute = typeof me;
