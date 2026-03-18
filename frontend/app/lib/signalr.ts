import * as signalR from "@microsoft/signalr";
import { MessagePackHubProtocol } from "@microsoft/signalr-protocol-msgpack";
import { SIGNALR_URL } from './api';

let connection: signalR.HubConnection | null = null;

export function getConnection(): signalR.HubConnection {
  if (!connection) {
    // Use the configured SIGNALR_URL
    const backendUrl = SIGNALR_URL;
    
    connection = new signalR.HubConnectionBuilder()
      .withUrl(backendUrl)
      .withHubProtocol(new MessagePackHubProtocol()) // Use MessagePack for better performance
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: (retryContext) => {
          // Exponential backoff with jitter for better reconnection
          if (retryContext.elapsedMilliseconds < 120000) {
            const baseDelay = Math.min(1000 * Math.pow(2, retryContext.previousRetryCount), 30000);
            const jitter = Math.random() * 1000; // Add jitter to prevent thundering herd
            return baseDelay + jitter;
          }
          return null; // Stop retrying after 2 minutes
        }
      })
      .withStatefulReconnect() // Enable stateful reconnect for better UX
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    connection.onclose(() => {
      console.error("[SignalR] Connection closed.");
    });

    connection.onreconnecting(() => {
      console.warn("[SignalR] Reconnecting...");
    });

    connection.onreconnected(() => {
      console.log("[SignalR] Reconnected.");
    });
    
    connection.onreconnected(error => {
      console.error("[SignalR] Connection failed:", error);
    });
  }
  return connection;
}

export async function startConnection(): Promise<signalR.HubConnection> {
  const conn = getConnection();
  if (conn.state === signalR.HubConnectionState.Disconnected) {
    try {
      await conn.start();
    } catch (err) {
      console.error("[SignalR] Failed to connect:", err);
      throw new Error("فشل الاتصال بالخادم — تأكد من تشغيل السيرفر");
    }
  }
  return conn;
}

export async function invoke<T = unknown>(method: string, ...args: unknown[]): Promise<T> {
  const conn = await startConnection();
  console.log(`[SignalR] Invoking ${method} with args:`, args);
  const result = await conn.invoke<T>(method, ...args);
  console.log(`[SignalR] ${method} result:`, result);
  return result;
}

export function on(event: string, callback: (...args: unknown[]) => void) {
  const conn = getConnection();
  conn.on(event, callback);
  return () => conn.off(event, callback);
}

export function getConnectionState(): signalR.HubConnectionState {
  return connection?.state ?? signalR.HubConnectionState.Disconnected;
}
