// App ↔ server message framing. Only Uint8Array/DataView, no Buffer, so it also runs in React Native.
//
// TCP (MobileMessageDecoder/Encoder):  [command u8][msgId u16][length or code u32][body]
// WebSocket /dashws (WSMessageDecoder/Encoder), one message per binary frame:
//                                      [command u8][msgId u16][body]          (the length is the frame length)
//                                      [0][msgId u16][code u32]               for RESPONSE
// All big-endian. For RESPONSE (command 0) the u32 field is the status code and there is no body.

import { strFromU8, strToU8 } from 'fflate';
import { BINARY_RESPONSE_COMMANDS, Command } from './commands.ts';

export const APP_HEADER_SIZE = 7;
export const WS_HEADER_SIZE = 3;
export const BODY_SEPARATOR = '\0';
/** Defensive limit on receive: a longer body means a corrupted frame. */
export const MAX_BODY_SIZE = 10 * 1024 * 1024;

// UTF-8 with fflate instead of TextEncoder/TextDecoder: TextDecoder is not guaranteed on Hermes.

export type Message =
  | { kind: 'response'; command: 0; msgId: number; code: number }
  | { kind: 'text'; command: number; msgId: number; body: string }
  | { kind: 'binary'; command: number; msgId: number; body: Uint8Array };

/** Message encoding/decoding for one kind of transport. */
export interface Codec {
  encode(command: number, msgId: number, body?: string): Uint8Array;
  /** Takes the bytes received by the transport (TCP chunk or WebSocket frame) and returns the complete messages. */
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

/** Backward compatibility: TCP encoding. */
export function encodeMessage(command: number, msgId: number, body = ''): Uint8Array {
  return new TcpCodec().encode(command, msgId, body);
}

function toMessage(command: number, msgId: number, body: Uint8Array): Message {
  return BINARY_RESPONSE_COMMANDS.has(command)
    ? { kind: 'binary', command, msgId, body }
    : { kind: 'text', command, msgId, body: strFromU8(body) };
}

/** 7-byte header on a TCP stream: buffers the chunks and emits the complete messages. */
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
        throw new Error(`Message too large: ${lengthOrCode} bytes (command ${command})`);
      }
      if (this.buf.length < APP_HEADER_SIZE + lengthOrCode) break;

      const body = this.buf.slice(APP_HEADER_SIZE, APP_HEADER_SIZE + lengthOrCode);
      this.buf = this.buf.subarray(APP_HEADER_SIZE + lengthOrCode);
      out.push(toMessage(command, msgId, body));
    }
    return out;
  }
}

/** 3-byte header, one message per binary WebSocket frame. */
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
    if (frame.length < WS_HEADER_SIZE) throw new Error(`WebSocket frame too short: ${frame.length} bytes`);
    const view = new DataView(frame.buffer, frame.byteOffset, frame.length);
    const command = view.getUint8(0);
    const msgId = view.getUint16(1);
    if (command === Command.RESPONSE) {
      if (frame.length < WS_HEADER_SIZE + 4) throw new Error('WebSocket RESPONSE without code');
      return [{ kind: 'response', command: 0, msgId, code: view.getUint32(3) }];
    }
    if (frame.length - WS_HEADER_SIZE > MAX_BODY_SIZE) {
      throw new Error(`Message too large: ${frame.length} bytes (command ${command})`);
    }
    return [toMessage(command, msgId, frame.slice(WS_HEADER_SIZE))];
  }
}

/** Backward compatibility: the TCP decoder used to be called FrameDecoder. */
export { TcpCodec as FrameDecoder };

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  if (a.length === 0) return b;
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}
