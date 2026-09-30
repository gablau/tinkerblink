import type { Framing } from './frame.ts';

/**
 * Trasporto a byte, indipendente dalla piattaforma.
 * Implementazioni: TLS di Node (`transport-node.ts`, solo test) e WebSocket standard
 * (`transport-ws.ts`, Node 22+ e React Native).
 */
export interface Transport {
  /** Formato dei messaggi che il server usa su questo trasporto. */
  readonly framing: Framing;
  connect(): Promise<void>;
  write(data: Uint8Array): void;
  close(): void;
  /** TCP: chunk arbitrari dello stream. WebSocket: un frame binario completo per chiamata. */
  onData(listener: (chunk: Uint8Array) => void): void;
  onClose(listener: (error?: Error) => void): void;
}
