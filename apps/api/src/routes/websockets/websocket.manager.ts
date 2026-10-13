import type { WSContext } from "hono/ws";

type Connection = {
  ws: WSContext;
  channels: Set<string>;
  connectedAt: Date;
};

export class WebSocketManager {
  private static instance: WebSocketManager;
  private connections = new Map<string, Connection>();
  private channels = new Map<string, Set<string>>();

  static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }

  addConnection(connectionId: string, ws: WSContext): void {
    this.connections.set(connectionId, {
      ws,
      channels: new Set(),
      connectedAt: new Date(),
    });
  }

  removeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection)
      return;

    for (const channel of connection.channels) {
      this.leaveChannel(connectionId, channel);
    }
    this.connections.delete(connectionId);
  }

  joinChannel(connectionId: string, channel: string): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection)
      return false;

    connection.channels.add(channel);

    const connections = this.channels.get(channel) ?? new Set<string>();
    connections.add(connectionId);
    this.channels.set(channel, connections);
    return true;
  }

  leaveChannel(connectionId: string, channel: string): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection)
      return false;

    connection.channels.delete(channel);
    const connections = this.channels.get(channel);
    connections?.delete(connectionId);
    if (connections?.size === 0) {
      this.channels.delete(channel);
    }
    return true;
  }

  broadcast(channel: string, message: unknown): void {
    const connections = this.channels.get(channel);
    if (!connections)
      return;

    for (const connectionId of connections) {
      this.sendToConnection(connectionId, message);
    }
  }

  sendToConnection(connectionId: string, message: unknown): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection)
      return false;

    try {
      connection.ws.send(JSON.stringify(message));
      return true;
    }
    catch {
      this.removeConnection(connectionId);
      return false;
    }
  }

  isConnected(connectionId: string): boolean {
    return this.connections.has(connectionId);
  }

  getStats() {
    return {
      totalConnections: this.connections.size,
      totalChannels: this.channels.size,
      channels: Array.from(this.channels.entries()).map(([channel, connections]) => ({
        channel,
        connections: connections.size,
      })),
    };
  }
}

export const wsManager = WebSocketManager.getInstance();
