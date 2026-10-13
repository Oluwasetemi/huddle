const API_BASE_URL = import.meta.env.VITE_API_URL ?? "";
const WS_BASE_URL = import.meta.env.VITE_WS_URL ?? `${window.location.origin.replace(/^http/, "ws")}`;

export type User = {
  id: number;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
};

export type Channel = {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Message = {
  id: number;
  channelId: number;
  userId: number;
  text: string;
  createdAt: string;
  author: Pick<User, "id" | "name" | "email">;
};

export type AuthSession = {
  user: User;
  token: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type RegisterInput = LoginInput & {
  name: string;
};

async function request<T>(path: string, options: RequestInit & { token?: string } = {}): Promise<T> {
  const { token, headers, ...init } = options;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ message: response.statusText }));
    const message = typeof payload.message === "string" ? payload.message : "Request failed";
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export function login(input: LoginInput): Promise<AuthSession> {
  return request<AuthSession>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function register(input: RegisterInput): Promise<AuthSession> {
  return request<AuthSession>("/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getMe(token: string): Promise<User> {
  return request<User>("/auth/me", { token });
}

export function listChannels(token: string): Promise<Channel[]> {
  return request<Channel[]>("/channels", { token });
}

export function listMessages(token: string, channelId: number): Promise<Message[]> {
  return request<Message[]>(`/channels/${channelId}/messages?limit=50`, { token });
}

export function postMessage(token: string, channelId: number, text: string): Promise<Message> {
  return request<Message>(`/channels/${channelId}/messages`, {
    method: "POST",
    token,
    body: JSON.stringify({ text }),
  });
}

export function channelSocketUrl(channelId: number): string {
  return `${WS_BASE_URL}/ws/channels/${channelId}`;
}
