/**
 * WebSocket connection manager for guest saves.
 *
 * Guests maintain a persistent WS connection to receive sync_updated pushes
 * from the server whenever the host presses the Sync button.
 *
 * Plain class (not a React hook) — instantiated once inside SyncContext.
 */

const WS_BASE_URL = (import.meta.env.VITE_SYNC_API_URL as string | undefined)
  ?.replace(/^http/, 'ws')
  ?.replace(/\/$/, '') ?? '';

export type SyncUpdateCallback = (sharedBlob: string, characterBlob: string) => void;
export type ConnectionStateCallback = (connected: boolean) => void;

const BACKOFF_INITIAL = 1_000;  // 1 s
const BACKOFF_MAX     = 30_000; // 30 s

export class SyncService {
  private ws: WebSocket | null = null;
  private charCode: string | null = null;
  private onUpdate: SyncUpdateCallback | null = null;
  private onConnectionChange: ConnectionStateCallback | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private backoffMs = BACKOFF_INITIAL;
  private stopped = false;

  connect(
    charCode: string,
    onUpdate: SyncUpdateCallback,
    onConnectionChange: ConnectionStateCallback,
  ): void {
    this.charCode          = charCode;
    this.onUpdate          = onUpdate;
    this.onConnectionChange = onConnectionChange;
    this.stopped           = false;
    this.backoffMs         = BACKOFF_INITIAL;
    this.openSocket();
  }

  disconnect(): void {
    this.stopped = true;
    this.clearReconnect();
    if (this.ws) {
      this.ws.onclose = null; // prevent reconnect trigger
      this.ws.close();
      this.ws = null;
    }
    this.onConnectionChange?.(false);
  }

  private openSocket(): void {
    if (!WS_BASE_URL || !this.charCode) return;

    const url = `${WS_BASE_URL}/ws?code=${encodeURIComponent(this.charCode)}`;
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onopen = () => {
      this.backoffMs = BACKOFF_INITIAL;
      this.onConnectionChange?.(true);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as {
          type: string;
          sharedBlob: string;
          characterBlob: string;
        };
        if (msg.type === 'sync_updated') {
          this.onUpdate?.(msg.sharedBlob, msg.characterBlob);
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      this.ws = null;
      this.onConnectionChange?.(false);
      if (!this.stopped) this.scheduleReconnect();
    };

    ws.onerror = () => {
      // onclose fires after onerror, so reconnect is handled there
    };
  }

  private scheduleReconnect(): void {
    this.clearReconnect();
    this.reconnectTimer = setTimeout(() => {
      if (!this.stopped) this.openSocket();
    }, this.backoffMs);
    this.backoffMs = Math.min(this.backoffMs * 2, BACKOFF_MAX);
  }

  private clearReconnect(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
