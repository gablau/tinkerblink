import tls from 'node:tls';
import type { Transport } from './transport.ts';

export interface NodeTlsOptions {
  host: string;
  port: number;
  /**
   * false = accetta qualsiasi certificato: per i server con certificato autofirmato o scaduto
   * (il server di default ne usa uno integrato sulla 9443).
   */
  verifyCertificate: boolean;
}

export class NodeTlsTransport implements Transport {
  readonly framing = 'tcp' as const;
  private socket?: tls.TLSSocket;
  private dataListeners: ((chunk: Uint8Array) => void)[] = [];
  private closeListeners: ((error?: Error) => void)[] = [];

  constructor(private readonly opts: NodeTlsOptions) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = tls.connect({
        host: this.opts.host,
        port: this.opts.port,
        servername: this.opts.host,
        rejectUnauthorized: this.opts.verifyCertificate,
      });
      this.socket = socket;
      socket.setNoDelay(true);
      socket.setKeepAlive(true);
      let lastError: Error | undefined;
      socket.once('secureConnect', () => resolve());
      socket.on('data', (chunk: Buffer) => {
        const bytes = new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.length);
        for (const l of this.dataListeners) l(bytes);
      });
      socket.on('error', (err) => {
        lastError = err;
        reject(err);
      });
      socket.on('close', () => {
        for (const l of this.closeListeners) l(lastError);
      });
    });
  }

  write(data: Uint8Array): void {
    if (!this.socket) throw new Error('Trasporto non connesso');
    this.socket.write(data);
  }

  close(): void {
    this.socket?.end();
  }

  onData(listener: (chunk: Uint8Array) => void): void {
    this.dataListeners.push(listener);
  }

  onClose(listener: (error?: Error) => void): void {
    this.closeListeners.push(listener);
  }

  /** Dati del certificato presentato dal server (solo diagnostica). */
  peerCertificate(): { subject?: string; validTo?: string; authorized: boolean; authError?: string } {
    const s = this.socket;
    if (!s) return { authorized: false };
    const cert = s.getPeerCertificate();
    return {
      subject: [cert?.subject?.CN].flat().join(', ') || undefined,
      validTo: cert?.valid_to,
      authorized: s.authorized,
      authError: s.authorizationError ? String(s.authorizationError) : undefined,
    };
  }
}
