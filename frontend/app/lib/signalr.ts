import * as signalR from "@microsoft/signalr";
import { MessagePackHubProtocol } from "@microsoft/signalr-protocol-msgpack";
import { SIGNALR_URL } from './api';
import { getToken } from './tokenStore';

let connection: signalR.HubConnection | null = null;
let connectionPromise: Promise<void> | null = null;

export function getConnection(): signalR.HubConnection {
  if (!connection) {
    // Use the configured SIGNALR_URL
    const backendUrl = SIGNALR_URL;
    
    connection = new signalR.HubConnectionBuilder()
      .withUrl(backendUrl, {
        accessTokenFactory: () => getToken() || "",
      })
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
      connectionPromise = null;
    });

    connection.onreconnecting(() => {
      console.warn("[SignalR] Reconnecting...");
    });

    connection.onreconnected(() => {
      console.log("[SignalR] Reconnected.");
    });
  }
  return connection;
}

export async function startConnection(): Promise<signalR.HubConnection> {
  const conn = getConnection();
  if (conn.state === signalR.HubConnectionState.Disconnected) {
    // If we are disconnected, any existing promise is stale.
    connectionPromise = conn.start().catch(err => {
      connectionPromise = null;
      throw err;
    });

    try {
      await connectionPromise;
    } catch (err) {
      console.error("[SignalR] Failed to connect:", err);
      throw new Error("فشل الاتصال بالخادم — تأكد من تشغيل السيرفر");
    }
  } else if (conn.state === signalR.HubConnectionState.Connecting && connectionPromise) {
    try {
      await connectionPromise;
    } catch (err) {
      console.error("[SignalR] Failed to connect while waiting:", err);
      throw new Error("فشل الاتصال بالخادم — تأكد من تشغيل السيرفر");
    }
  } else if (conn.state === signalR.HubConnectionState.Reconnecting) {
    // Wait until JS/SignalR handles the reconnect?
    // SignalR will automatically queue or we can throw. 
    // Usually stateful reconnect handles calls on its own!
  }
  return conn;
}

export async function invoke<T = unknown>(method: string, ...args: unknown[]): Promise<T> {
  const conn = await startConnection();
  if (conn.state !== signalR.HubConnectionState.Connected) {
    if (conn.state === signalR.HubConnectionState.Reconnecting) {
       throw new Error("جاري إعادة الاتصال بالخادم...");
    }
    throw new Error("لا يمكن إرسال البيانات لأن الاتصال غير متاح.");
  }
  return await conn.invoke<T>(method, ...args);
}

export function on(event: string, callback: (...args: unknown[]) => void) {
  const conn = getConnection();
  conn.on(event, callback);
  return () => conn.off(event, callback);
}

export function getConnectionState(): signalR.HubConnectionState {
  return connection?.state ?? signalR.HubConnectionState.Disconnected;
}

/** Reset the connection (e.g. after login/logout so new token is used) */
export async function resetConnection(): Promise<void> {
  if (connection) {
    try { await connection.stop(); } catch { /* ignore */ }
    connection = null;
  }
  connectionPromise = null;
}
