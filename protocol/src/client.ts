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

/** Comandi dell'editor: in sola lettura sono ammessi solo sulle dashboard di `editableDashIds`. */
const EDIT_COMMANDS: ReadonlySet<number> = new Set([Command.CREATE_WIDGET, Command.UPDATE_WIDGET, Command.DELETE_WIDGET]);

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
  /**
   * In sola lettura permette comunque le scritture sui pin (comando HARDWARE): è quello che serve
   * all'app per comandare i device senza poter modificare i progetti.
   */
  allowHardwareWrites?: boolean;
  /**
   * In sola lettura permette comunque i comandi dell'editor (CREATE_WIDGET, UPDATE_WIDGET, DELETE_WIDGET),
   * ma solo su queste dashboard: il dashId è il primo campo del body. Vuoto = nessuna modifica.
   */
  editableDashIds?: readonly number[];
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
  private closed = false;
  private readonly opts: Required<ClientOptions>;

  constructor(
    private readonly transport: Transport,
    opts: ClientOptions = {},
  ) {
    this.opts = {
      readOnly: true,
      allowHardwareWrites: false,
      editableDashIds: [],
      requestTimeoutMs: 15000,
      pingIntervalMs: 10000,
      ...opts,
    };
    this.codec = createCodec(transport.framing);
    transport.onData((chunk) => {
      for (const m of this.codec.push(chunk)) this.dispatch(m);
    });
    transport.onClose((err) => this.handleClosed(err));
  }

  /** Chiusura della connessione (dal trasporto o per ping senza risposta): notificata una volta sola. */
  private handleClosed(err?: Error): void {
    if (this.closed) return;
    this.closed = true;
    this.stopPing();
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(err ?? new Error('Connessione chiusa'));
    }
    this.pending.clear();
    for (const l of this.disconnectListeners) l(err);
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

  /**
   * Chiede al server di inviare lo stato corrente di una dashboard (MobileSyncLogic): risponde OK e poi
   * manda un APP_SYNC (msgId SYNC_MESSAGE_ID) per ogni widget, ai listener di onMessage. È l'unico modo
   * per avere la cronologia dei Terminal, che il server tiene solo in memoria (Terminal.lastCommands).
   */
  async syncDashboard(dashId: number, deviceId?: number): Promise<void> {
    await this.expectOk(Command.APP_SYNC, deviceId === undefined ? String(dashId) : `${dashId}-${deviceId}`);
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
    if (!this.isAllowed(command, body)) {
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

  /**
   * Invia un comando senza attendere risposta. Serve per HARDWARE: il server non risponde se va a buon
   * fine e manda solo un RESPONSE di errore (per esempio DEVICE_NOT_IN_NETWORK = 7 con il device
   * offline), che arriva ai listener di onMessage con lo stesso msgId restituito qui.
   */
  send(command: number, body = ''): number {
    if (!this.isAllowed(command, body)) throw new Error(`Comando ${commandName(command)} bloccato: client in sola lettura`);
    const msgId = this.allocId();
    this.transport.write(this.codec.encode(command, msgId, body));
    return msgId;
  }

  /**
   * Scrive un pin di un device: body "<dashId>-<deviceId>\0vw\0<pin>\0<v1>[\0<v2>…]" (MobileHardwareLogic).
   * Il server lo inoltra al device, aggiorna il valore salvato e lo rimanda alle altre app dello stesso
   * account come APP_SYNC.
   */
  writePin(dashId: number, deviceId: number, pin: number, values: (string | number)[], pinType: 'v' | 'd' | 'a' = 'v'): number {
    return this.send(Command.HARDWARE, joinBody(`${dashId}-${deviceId}`, `${pinType}w`, pin, ...values));
  }

  /**
   * Modifica un widget esistente (UPDATE_WIDGET, MobileUpdateWidgetLogic): body "<dashId>\0<json>".
   * Va inviato il JSON completo del widget (stesso id e stesso tipo): il server sostituisce il widget e
   * conserva solo il valore corrente. Si parte quindi dal JSON del profilo e si cambiano solo i campi
   * toccati, così non si perdono i campi che il client non conosce.
   */
  async updateWidget(dashId: number, widget: { id: number; type: string }): Promise<void> {
    await this.expectOk(Command.UPDATE_WIDGET, joinBody(dashId, JSON.stringify(widget)));
  }

  private isAllowed(command: number, body: string): boolean {
    if (!this.opts.readOnly) return true;
    if (READ_ONLY_COMMANDS.has(command)) return true;
    if (command === Command.HARDWARE) return this.opts.allowHardwareWrites;
    if (EDIT_COMMANDS.has(command)) {
      const dashId = Number(body.split('\0', 1)[0]);
      return this.opts.editableDashIds.includes(dashId);
    }
    return false;
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
      // Se un ping non riceve risposta la connessione è morta "in silenzio" (rete caduta senza chiusura
      // del socket): si dichiara chiusa subito, così chi usa il client può riconnettersi.
      this.request(Command.PING).catch(() => {
        if (this.pingTimer) this.handleClosed(new Error('Nessuna risposta al ping'));
        this.transport.close();
      });
    }, this.opts.pingIntervalMs);
  }

  private stopPing(): void {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = undefined;
  }
}
