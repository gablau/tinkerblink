import type { Framing } from './frame.ts';

/**
 * Platform-independent byte transport.
 * Implementations: Node TLS (`transport-node.ts`, tests only) and standard WebSocket
 * (`transport-ws.ts`, Node 22+ and React Native).
 */
export interface Transport {
  /** Message format the server uses on this transport. */
  readonly framing: Framing;
  connect(): Promise<void>;
  write(data: Uint8Array): void;
  close(): void;
  /** TCP: arbitrary chunks of the stream. WebSocket: one complete binary frame per call. */
  onData(listener: (chunk: Uint8Array) => void): void;
  onClose(listener: (error?: Error) => void): void;
}
