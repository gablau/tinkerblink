import type { Transport } from './transport.ts';

/**
 * Trasporto su WebSocket standard (`globalThis.WebSocket`): funziona in React Native e in Node 22+.
 * URL tipico: `wss://<host>/dashws` (dietro un proxy sulla 443) oppure `wss://<host>:9443/dashws`.
 * La verifica del certificato è quella della piattaforma: qui non si può disattivare.
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
        if (!(ev.data instanceof ArrayBuffer)) return; // il server usa solo frame binari
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
