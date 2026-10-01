import { decompressSync, strFromU8, strToU8 } from 'fflate';
import { Command, commandName, ResponseCode, responseName } from './commands.ts';
import { createCodec, joinBody, type Codec, type Message } from './frame.ts';
import { parseGraphData, type GraphData, type GraphPeriod } from './graph.ts';
import { passwordHash } from './hash.ts';
import type { Transport } from './transport.ts';

/**
 * Sistema, versione e nome dell'app inviati nel LOGIN (MobileLoginHandler). Il server cerca l'utente per
 * email + nome dell'app (AppNameUtil.BLYNK = "Blynk"); il sistema serve alle notifiche push (OsType);
 * la versione (x.y.z) la legge solo Version.isOutdated().
 */
export const CLIENT_OS = 'Android';
export const CLIENT_VERSION = '0.1.0';
export const APP_NAME = 'Blynk';

/** Comandi che non modificano nulla sul server. In modalità readOnly sono gli unici ammessi. */
const READ_ONLY_COMMANDS: ReadonlySet<number> = new Set([
  Command.LOGIN,
  Command.PING,
  Command.LOAD_PROFILE_GZIPPED,
  Command.APP_SYNC,
  Command.GET_DEVICES,
  Command.GET_ENHANCED_GRAPH_DATA,
  Command.GET_ENERGY,
  Command.GET_WIDGET,
  Command.LOGOUT,
]);

export class ProtocolError extends Error {
  constructor(
    readonly command: number,
    readonly code: number,
  ) {
    super(`${commandName(command)} fallito: ${responseName(code)} (${code})`);
  }
}

export interface ClientOptions {
  /** Blocca l'invio di comandi che scrivono sul server. */
  readOnly?: boolean;
  requestTimeoutMs?: number;
  pingIntervalMs?: number;
}

type Pending = {
  command: number;
  resolve: (m: Message) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

export class LegacyClient {
  private readonly codec: Codec;
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private listeners: ((m: Message) => void)[] = [];
  private disconnectListeners: ((error?: Error) => void)[] = [];
  private pingTimer?: ReturnType<typeof setInterval>;
  private readonly opts: Required<ClientOptions>;

  constructor(
    private readonly transport: Transport,
    opts: ClientOptions = {},
  ) {
    this.opts = { readOnly: true, requestTimeoutMs: 15000, pingIntervalMs: 10000, ...opts };
    this.codec = createCodec(transport.framing);
    transport.onData((chunk) => {
      for (const m of this.codec.push(chunk)) this.dispatch(m);
    });
    transport.onClose((err) => {
      this.stopPing();
      for (const [, p] of this.pending) {
        clearTimeout(p.timer);
        p.reject(err ?? new Error('Connessione chiusa'));
      }
      this.pending.clear();
      for (const l of this.disconnectListeners) l(err);
    });
  }

  /** Messaggi non richiesti dal client (aggiornamenti hardware, notifiche di stato...). */
  onMessage(listener: (m: Message) => void): void {
    this.listeners.push(listener);
  }

  /** Chiamato quando la connessione si chiude (dal server, dalla rete o con close()). */
  onDisconnect(listener: (error?: Error) => void): void {
    this.disconnectListeners.push(listener);
  }

  async connect(): Promise<void> {
    await this.transport.connect();
  }

  async login(email: string, password: string): Promise<void> {
    const normalized = email.trim().toLowerCase();
    const body = joinBody(normalized, passwordHash(password, normalized), CLIENT_OS, CLIENT_VERSION, APP_NAME);
    await this.expectOk(Command.LOGIN, body);
    this.startPing();
  }

  /** Profilo completo (tutte le dashboard), già decompresso e parsato. */
  async loadProfile(): Promise<unknown> {
    const reply = await this.request(Command.LOAD_PROFILE_GZIPPED, '');
    if (reply.kind === 'response') throw new ProtocolError(Command.LOAD_PROFILE_GZIPPED, reply.code);
    const bytes = reply.kind === 'binary' ? reply.body : strToU8(reply.body);
    return JSON.parse(strFromU8(decompressSync(bytes)));
  }

  /**
   * Dati storici di un SuperChart (GET_ENHANCED_GRAPH_DATA). Restituisce una serie per ogni datastream
   * del widget, nello stesso ordine; `null` se il server risponde NO_DATA.
   * `deviceId` serve solo quando il grafico segue un Device Selector o un Device Tiles.
   */
  async getGraphData(req: {
    dashId: number;
    widgetId: number;
    period: GraphPeriod;
    page?: number;
    deviceId?: number;
  }): Promise<GraphData | null> {
    const target = req.deviceId === undefined ? String(req.dashId) : `${req.dashId}-${req.deviceId}`;
    const parts: (string | number)[] = [target, req.widgetId, req.period];
    if (req.page) parts.push(req.page);
    const reply = await this.request(Command.GET_ENHANCED_GRAPH_DATA, joinBody(...parts));
    if (reply.kind === 'response') {
      if (reply.code === ResponseCode.NO_DATA) return null;
      throw new ProtocolError(Command.GET_ENHANCED_GRAPH_DATA, reply.code);
    }
    const bytes = reply.kind === 'binary' ? reply.body : strToU8(reply.body);
    return parseGraphData(decompressSync(bytes));
  }

  close(): void {
    this.stopPing();
    this.transport.close();
  }

  /** Invia un comando e attende il messaggio con lo stesso msgId. */
  request(command: number, body = ''): Promise<Message> {
    if (this.opts.readOnly && !READ_ONLY_COMMANDS.has(command)) {
      return Promise.reject(new Error(`Comando ${commandName(command)} bloccato: client in sola lettura`));
    }
    const msgId = this.allocId();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(msgId);
        reject(new Error(`Timeout su ${commandName(command)} (msgId ${msgId})`));
      }, this.opts.requestTimeoutMs);
      this.pending.set(msgId, { command, resolve, reject, timer });
      this.transport.write(this.codec.encode(command, msgId, body));
    });
  }

  private async expectOk(command: number, body: string): Promise<void> {
    const reply = await this.request(command, body);
    if (reply.kind !== 'response') return;
    if (reply.code !== ResponseCode.OK) throw new ProtocolError(command, reply.code);
  }

  private dispatch(m: Message): void {
    const p = this.pending.get(m.msgId);
    // Le risposte hanno lo stesso msgId della richiesta; i messaggi spontanei del server usano msgId propri.
    if (p && (m.kind === 'response' || m.command === p.command)) {
      clearTimeout(p.timer);
      this.pending.delete(m.msgId);
      p.resolve(m);
      return;
    }
    for (const l of this.listeners) l(m);
  }

  private allocId(): number {
    const id = this.nextId;
    this.nextId = this.nextId >= 0xffff ? 1 : this.nextId + 1;
    return id;
  }

  private startPing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      this.request(Command.PING).catch(() => undefined);
    }, this.opts.pingIntervalMs);
  }

  private stopPing(): void {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = undefined;
  }
}
