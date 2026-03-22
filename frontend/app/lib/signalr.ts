import * as signalR from "@microsoft/signalr";
import { MessagePackHubProtocol } from "@microsoft/signalr-protocol-msgpack";
import { SIGNALR_URL } from './api';
import { getToken } from './tokenStore';

let connection: signalR.HubConnection | null = null;
let connectionPromise: Promise<void> | null = null;

// Callbacks registered by the game page so it can re-join its session
// whenever SignalR transparently reconnects.
let _reconnectedCallback: (() => void) | null = null;
let _disconnectedCallback: (() => void) | null = null;

export function setReconnectedCallback(cb: (() => void) | null) {
  _reconnectedCallback = cb;
}
export function setDisconnectedCallback(cb: (() => void) | null) {
  _disconnectedCallback = cb;
}

/** Tear down the singleton so the next startConnection() builds a fresh one. */
export function resetConnection() {
  try { connection?.stop(); } catch { /* ignore */ }
  connection = null;
  connectionPromise = null;
}

export function getConnection(): signalR.HubConnection {
  if (!connection) {
    const backendUrl = SIGNALR_URL;

    connection = new signalR.HubConnectionBuilder()
      .withUrl(backendUrl, {
        accessTokenFactory: () => getToken() || "",
      })
      .withHubProtocol(new MessagePackHubProtocol())
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: (retryContext) => {
          // Keep retrying for up to 10 minutes with capped exponential backoff.
          // Mobile browsers can be backgrounded for a long time.
          if (retryContext.elapsedMilliseconds < 600_000) {
            const base = Math.min(1000 * Math.pow(2, retryContext.previousRetryCount), 30_000);
            const jitter = Math.random() * 1000;
            return base + jitter;
          }
          return null; // give up after 10 min — onclose fires
        }
      })
      .withStatefulReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    connection.onclose(() => {
      console.error("[SignalR] Connection closed permanently.");
      connectionPromise = null;
      // Reset singleton so a future visibility/online event can start fresh.
      connection = null;
      _disconnectedCallback?.();
    });

    connection.onreconnecting(() => {
      console.warn("[SignalR] Reconnecting...");
    });

    connection.onreconnected(() => {
      console.log("[SignalR] Reconnected — rejoining session.");
      _reconnectedCallback?.();
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
