/* eslint-disable node/no-process-env */
import { config } from "dotenv";
import { expand } from "dotenv-expand";
import path from "node:path";
import { z } from "zod";

expand(
  config({
    path: path.resolve(
      process.cwd(),
      process.env.NODE_ENV === "test" ? ".env.test" : ".env",
    ),
  }),
);

const EnvSchema = z
  .object({
    NODE_ENV: z.string().default("development"),
    PORT: z.coerce.number().default(4444),
    LOG_LEVEL: z.enum([
      "fatal",
      "error",
      "warn",
      "info",
      "debug",
      "trace",
      "silent",
    ]),
    DATABASE_URL: z.string().min(1).default("file:./local.db"),
    DATABASE_AUTH_TOKEN: z.string().optional(),
    JWT_SECRET: z.string().min(16).default("dev-only-secret-change-me-123456"),
    JWT_EXPIRES_IN: z.string().default("7d"),
  })
  .superRefine((input, ctx) => {
    if (input.NODE_ENV === "production" && input.JWT_SECRET.startsWith("dev-only")) {
      ctx.addIssue({
        code: z.ZodIssueCode.invalid_type,
        expected: "string",
        received: "undefined",
        path: ["JWT_SECRET"],
        message: "Set a real JWT_SECRET when NODE_ENV is 'production'",
      });
    }
    if (input.NODE_ENV === "production" && !input.DATABASE_AUTH_TOKEN && !input.DATABASE_URL.startsWith("file:")) {
      ctx.addIssue({
        code: z.ZodIssueCode.invalid_type,
        expected: "string",
        received: "undefined",
        path: ["DATABASE_AUTH_TOKEN"],
        message: "Must be set when NODE_ENV is 'production' with a remote DB",
      });
    }
  });

export type env = z.infer<typeof EnvSchema>;

const { data: env, error } = EnvSchema.safeParse(process.env);

if (error) {
  console.error("❌ Invalid env:");
  console.error(JSON.stringify(error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

export default env!;
