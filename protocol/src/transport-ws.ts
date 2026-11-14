import type { Transport } from './transport.ts';

/**
 * Transport over standard WebSocket (`globalThis.WebSocket`): works in React Native and Node 22+.
 * Typical URL: `wss://<host>/dashws` (behind a proxy on 443) or `wss://<host>:9443/dashws`.
 * Certificate validation is the platform's: it cannot be disabled here.
 */
export class WebSocketTransport implements Transport {
  readonly framing = 'ws' as const;
  private ws?: WebSocket;
  private dataListeners: ((chunk: Uint8Array) => void)[] = [];
  private closeListeners: ((error?: Error) => void)[] = [];

  constructor(private readonly url: string) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url);
      this.ws = ws;
      ws.binaryType = 'arraybuffer';
      let opened = false;
      let lastError: Error | undefined;
      ws.onopen = () => {
        opened = true;
        resolve();
      };
      ws.onmessage = (ev: MessageEvent) => {
        if (!(ev.data instanceof ArrayBuffer)) return; // the server only uses binary frames
        const bytes = new Uint8Array(ev.data);
        for (const l of this.dataListeners) l(bytes);
      };
      ws.onerror = (ev: Event) => {
        const msg = (ev as Event & { message?: string }).message;
        lastError = new Error(`Errore WebSocket${msg ? `: ${msg}` : ''}`);
        if (!opened) reject(lastError);
      };
      ws.onclose = (ev: { code: number }) => {
        if (!opened) reject(lastError ?? new Error(`WebSocket chiuso prima dell'apertura (codice ${ev.code})`));
        for (const l of this.closeListeners) l(lastError);
      };
    });
  }

  write(data: Uint8Array): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) throw new Error('WebSocket non connesso');
    this.ws.send(data);
  }

  close(): void {
    this.ws?.close();
  }

  onData(listener: (chunk: Uint8Array) => void): void {
    this.dataListeners.push(listener);
  }

  onClose(listener: (error?: Error) => void): void {
    this.closeListeners.push(listener);
  }
}
