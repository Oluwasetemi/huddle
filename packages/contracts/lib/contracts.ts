import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(128),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const messageSchema = z.object({
  text: z.string().trim().min(1).max(2000),
});

export type MessageInput = z.infer<typeof messageSchema>;

export function greet(name: string): string {
  return formatGreeting(name);
}

function formatGreeting(name: string): string {
  return `hello, ${name}`;
}
