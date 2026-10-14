import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useHead } from "@unhead/react";
import { useForesight } from "@foresightjs/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";

import {
  channelSocketUrl,
  getMe,
  listChannels,
  listMessages,
  login,
  postMessage,
  register,
} from "./api";
import type { AuthSession, Channel, Message } from "./api";

type AuthMode = "login" | "register";
type SocketStatus = "idle" | "live" | "offline";

const sessionStorageKey = "huddle.session";
const emptyChannels: Channel[] = [];

function readStoredSession(): AuthSession | null {
  const raw = window.localStorage.getItem(sessionStorageKey);
  if (!raw)
    return null;

  try {
    return JSON.parse(raw) as AuthSession;
  }
  catch {
    window.localStorage.removeItem(sessionStorageKey);
    return null;
  }
}

function PrefetchChannelButton({ channel, selected, onSelect }: {
  channel: Channel;
  selected: boolean;
  onSelect: () => void;
}) {
  const { elementRef } = useForesight<HTMLButtonElement>({
    callback: onSelect,
    hitSlop: 36,
    name: `prefetch-channel-${channel.id}`,
  });

  return (
    <button
      ref={elementRef}
      type="button"
      className={`channel-card ${selected ? "selected" : ""}`}
      onClick={onSelect}
    >
      <span className="channel-card__name">#{channel.name}</span>
      <span>{channel.description ?? "Team conversation"}</span>
    </button>
  );
}

function App() {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<AuthSession | null>(() => readStoredSession());
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [selectedChannelId, setSelectedChannelId] = useState<number | null>(null);
  const [messageText, setMessageText] = useState("");
  const [socketStatus, setSocketStatus] = useState<SocketStatus>("idle");
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useHead({
    title: session ? "Huddle — Team messages" : "Huddle — Sign in",
    meta: [
      {
        name: "description",
        content: "Huddle is a lightweight collaboration space for focused remote teams.",
      },
    ],
  });

  const token = session?.token;

  const meQuery = useQuery({
    queryKey: ["me", token],
    queryFn: () => getMe(token!),
    enabled: Boolean(token),
  });

  const channelsQuery = useQuery({
    queryKey: ["channels", token],
    queryFn: () => listChannels(token!),
    enabled: Boolean(token),
  });

  const channels = channelsQuery.data ?? emptyChannels;
  const activeChannel = useMemo(
    () => channels.find(channel => channel.id === selectedChannelId) ?? channels[0],
    [channels, selectedChannelId],
  );

  const activeChannelId = activeChannel?.id;

  const messagesQuery = useQuery({
    queryKey: ["messages", token, activeChannelId],
    queryFn: () => listMessages(token!, activeChannelId!),
    enabled: Boolean(token && activeChannelId),
  });
  const messages = messagesQuery.data ?? [];
  const latestMessageId = messages.at(-1)?.id;

  const authMutation = useMutation({
    mutationFn: (formData: FormData) => {
      const email = String(formData.get("email") ?? "");
      const password = String(formData.get("password") ?? "");

      if (authMode === "register") {
        const name = String(formData.get("name") ?? "");
        return register({ name, email, password });
      }

      return login({ email, password });
    },
    onSuccess: (nextSession) => {
      window.localStorage.setItem(sessionStorageKey, JSON.stringify(nextSession));
      setSession(nextSession);
      void queryClient.invalidateQueries();
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: () => postMessage(token!, activeChannelId!, messageText.trim()),
    onSuccess: (message) => {
      setMessageText("");
      queryClient.setQueryData<Message[]>(["messages", token, activeChannelId], (current = []) => {
        if (current.some(item => item.id === message.id))
          return current;
        return [...current, message];
      });
      void queryClient.invalidateQueries({ queryKey: ["channels", token] });
    },
  });

  useLayoutEffect(() => {
    const container = messagesContainerRef.current;
    if (!container)
      return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth",
    });
  }, [activeChannelId, latestMessageId, messages.length]);

  useEffect(() => {
    if (!activeChannelId || !token)
      return;

    const socket = new WebSocket(channelSocketUrl(activeChannelId));

    socket.addEventListener("open", () => setSocketStatus("live"));
    socket.addEventListener("close", () => setSocketStatus("offline"));
    socket.addEventListener("error", () => setSocketStatus("offline"));
    socket.addEventListener("message", (event) => {
      try {
        const data = JSON.parse(event.data) as { type?: string; message?: Message };
        if (data.type !== "message.created" || !data.message)
          return;

        queryClient.setQueryData<Message[]>(["messages", token, activeChannelId], (current = []) => {
          if (current.some(message => message.id === data.message!.id))
            return current;
          return [...current, data.message!];
        });
      }
      catch {
        // Ignore non-JSON websocket control frames.
      }
    });

    return () => socket.close();
  }, [activeChannelId, queryClient, token]);

  function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    authMutation.mutate(new FormData(event.currentTarget));
  }

  function handleSendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!messageText.trim() || !activeChannelId)
      return;

    sendMessageMutation.mutate();
  }

  function handleSignOut() {
    window.localStorage.removeItem(sessionStorageKey);
    setSession(null);
    setSelectedChannelId(null);
    queryClient.clear();
  }

  if (!session) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <p className="eyebrow">Huddle MVP</p>
          <h1>Bring the team back into one calm room.</h1>
          <p className="lede">
            Sign in to test authenticated channels, message history, and the live WebSocket message base.
          </p>

          <div className="auth-switch" aria-label="Authentication mode">
            <button type="button" className={authMode === "login" ? "active" : ""} onClick={() => setAuthMode("login")}>Log in</button>
            <button type="button" className={authMode === "register" ? "active" : ""} onClick={() => setAuthMode("register")}>Create account</button>
          </div>

          <form className="auth-form" onSubmit={handleAuthSubmit}>
            {authMode === "register" ? (
              <label>
                Name
                <input name="name" placeholder="Ada Lovelace" minLength={1} maxLength={100} required />
              </label>
            ) : null}
            <label>
              Email
              <input name="email" type="email" placeholder="a@huddle.test" required />
            </label>
            <label>
              Password
              <input name="password" type="password" placeholder="password123" minLength={authMode === "register" ? 8 : 1} required />
            </label>
            {authMutation.error ? <p className="form-error">{authMutation.error.message}</p> : null}
            <button type="submit" className="primary-action" disabled={authMutation.isPending}>
              {authMutation.isPending ? "Working…" : authMode === "login" ? "Enter Huddle" : "Create Huddle account"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">Workspace</p>
          <h1>Huddle</h1>
          <p className="muted">Signed in as {meQuery.data?.name ?? session.user.name}</p>
        </div>

        <nav className="channel-list" aria-label="Channels">
          {channelsQuery.isPending ? <p className="muted">Loading channels…</p> : null}
          {channels.map(channel => (
            <PrefetchChannelButton
              key={channel.id}
              channel={channel}
              selected={channel.id === activeChannelId}
              onSelect={() => {
                setSelectedChannelId(channel.id);
                void queryClient.prefetchQuery({
                  queryKey: ["messages", token, channel.id],
                  queryFn: () => listMessages(token!, channel.id),
                });
              }}
            />
          ))}
        </nav>

        <button type="button" className="ghost-action" onClick={handleSignOut}>Sign out</button>
      </aside>

      <section className="message-panel">
        <header className="message-header">
          <div>
            <p className="eyebrow">#{activeChannel?.name ?? "channel"}</p>
            <h2>{activeChannel?.description ?? "Team conversation"}</h2>
          </div>
          <div className={`socket-pill ${socketStatus}`}>
            <span />
            {socketStatus === "live" ? "Live" : socketStatus}
          </div>
        </header>

        <div ref={messagesContainerRef} className="messages" role="region" aria-label="Channel messages" aria-live="polite" tabIndex={0}>
          {messagesQuery.isPending ? <p className="muted">Loading messages…</p> : null}
          {messagesQuery.error ? <p className="form-error">{messagesQuery.error.message}</p> : null}
          {messages.map(message => (
            <article key={message.id} className="message-bubble">
              <div>
                <strong>{message.author.name}</strong>
                <time>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
              </div>
              <p>{message.text}</p>
            </article>
          ))}
        </div>

        <form className="composer" onSubmit={handleSendMessage}>
          <input
            value={messageText}
            onChange={event => setMessageText(event.target.value)}
            placeholder="Write a message…"
            maxLength={2000}
            disabled={!activeChannelId || sendMessageMutation.isPending}
          />
          <button type="submit" disabled={!messageText.trim() || sendMessageMutation.isPending}>Send</button>
        </form>
      </section>

      <Link className="skip-link" to="/">Home</Link>
    </main>
  );
}

export default App;
