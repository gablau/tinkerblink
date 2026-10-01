// Framing dei messaggi app ↔ server. Solo Uint8Array/DataView: niente Buffer, così gira anche in React Native.
//
// TCP (MobileMessageDecoder/Encoder):  [comando u8][msgId u16][lunghezza o codice u32][body]
// WebSocket /dashws (WSMessageDecoder/Encoder), un messaggio per frame binario:
//                                      [comando u8][msgId u16][body]          (la lunghezza è quella del frame)
//                                      [0][msgId u16][codice u32]             per RESPONSE
// Tutto big-endian. Per RESPONSE (comando 0) il campo u32 è il codice di stato e non c'è body.

import { strFromU8, strToU8 } from 'fflate';
import { BINARY_RESPONSE_COMMANDS, Command } from './commands.ts';

export const APP_HEADER_SIZE = 7;
export const WS_HEADER_SIZE = 3;
export const BODY_SEPARATOR = '\0';
/** Limite difensivo in ricezione: un body più lungo indica un frame corrotto. */
export const MAX_BODY_SIZE = 10 * 1024 * 1024;

// UTF-8 con fflate invece di TextEncoder/TextDecoder: TextDecoder non è garantito su Hermes.

export type Message =
  | { kind: 'response'; command: 0; msgId: number; code: number }
  | { kind: 'text'; command: number; msgId: number; body: string }
  | { kind: 'binary'; command: number; msgId: number; body: Uint8Array };

/** Codifica/decodifica dei messaggi per un tipo di trasporto. */
export interface Codec {
  encode(command: number, msgId: number, body?: string): Uint8Array;
  /** Riceve i byte arrivati dal trasporto (chunk TCP o frame WebSocket) e restituisce i messaggi completi. */
  push(chunk: Uint8Array): Message[];
}

export type Framing = 'tcp' | 'ws';

export function createCodec(framing: Framing): Codec {
  return framing === 'tcp' ? new TcpCodec() : new WsCodec();
}

export function joinBody(...parts: (string | number)[]): string {
  return parts.map(String).join(BODY_SEPARATOR);
}

export function splitBody(body: string): string[] {
  return body.split(BODY_SEPARATOR);
}

/** Retrocompatibilità: codifica TCP. */
export function encodeMessage(command: number, msgId: number, body = ''): Uint8Array {
  return new TcpCodec().encode(command, msgId, body);
}

function toMessage(command: number, msgId: number, body: Uint8Array): Message {
  return BINARY_RESPONSE_COMMANDS.has(command)
    ? { kind: 'binary', command, msgId, body }
    : { kind: 'text', command, msgId, body: strFromU8(body) };
}

/** Header da 7 byte su stream TCP: accumula i chunk ed emette i messaggi completi. */
export class TcpCodec implements Codec {
  private buf: Uint8Array = new Uint8Array(0);

  encode(command: number, msgId: number, body = ''): Uint8Array {
    const payload = strToU8(body);
    const out = new Uint8Array(APP_HEADER_SIZE + payload.length);
    const view = new DataView(out.buffer);
    view.setUint8(0, command);
    view.setUint16(1, msgId);
    view.setUint32(3, payload.length);
    out.set(payload, APP_HEADER_SIZE);
    return out;
  }

  push(chunk: Uint8Array): Message[] {
    this.buf = concat(this.buf, chunk);
    const out: Message[] = [];
    for (;;) {
      if (this.buf.length < APP_HEADER_SIZE) break;
      const view = new DataView(this.buf.buffer, this.buf.byteOffset, this.buf.length);
      const command = view.getUint8(0);
      const msgId = view.getUint16(1);
      const lengthOrCode = view.getUint32(3);

      if (command === Command.RESPONSE) {
        out.push({ kind: 'response', command: 0, msgId, code: lengthOrCode });
        this.buf = this.buf.subarray(APP_HEADER_SIZE);
        continue;
      }
      if (lengthOrCode > MAX_BODY_SIZE) {
        throw new Error(`Messaggio troppo grande: ${lengthOrCode} byte (comando ${command})`);
      }
      if (this.buf.length < APP_HEADER_SIZE + lengthOrCode) break;

      const body = this.buf.slice(APP_HEADER_SIZE, APP_HEADER_SIZE + lengthOrCode);
      this.buf = this.buf.subarray(APP_HEADER_SIZE + lengthOrCode);
      out.push(toMessage(command, msgId, body));
    }
    return out;
  }
}

/** Header da 3 byte, un messaggio per frame WebSocket binario. */
export class WsCodec implements Codec {
  encode(command: number, msgId: number, body = ''): Uint8Array {
    const payload = strToU8(body);
    const out = new Uint8Array(WS_HEADER_SIZE + payload.length);
    const view = new DataView(out.buffer);
    view.setUint8(0, command);
    view.setUint16(1, msgId);
    out.set(payload, WS_HEADER_SIZE);
    return out;
  }

  push(frame: Uint8Array): Message[] {
    if (frame.length < WS_HEADER_SIZE) throw new Error(`Frame WebSocket troppo corto: ${frame.length} byte`);
    const view = new DataView(frame.buffer, frame.byteOffset, frame.length);
    const command = view.getUint8(0);
    const msgId = view.getUint16(1);
    if (command === Command.RESPONSE) {
      if (frame.length < WS_HEADER_SIZE + 4) throw new Error('RESPONSE WebSocket senza codice');
      return [{ kind: 'response', command: 0, msgId, code: view.getUint32(3) }];
    }
    if (frame.length - WS_HEADER_SIZE > MAX_BODY_SIZE) {
      throw new Error(`Messaggio troppo grande: ${frame.length} byte (comando ${command})`);
    }
    return [toMessage(command, msgId, frame.slice(WS_HEADER_SIZE))];
  }
}

/** Retrocompatibilità: il decoder TCP si chiamava FrameDecoder. */
export { TcpCodec as FrameDecoder };

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  if (a.length === 0) return b;
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}
