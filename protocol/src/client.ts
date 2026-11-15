import { decompressSync, strFromU8, strToU8 } from 'fflate';
import { Command, commandName, ResponseCode, responseName } from './commands.ts';
import { createCodec, joinBody, type Codec, type Message } from './frame.ts';
import { parseGraphData, type GraphData, type GraphPeriod } from './graph.ts';
import { passwordHash } from './hash.ts';
import type { Transport } from './transport.ts';

/**
 * OS, version and app name sent with LOGIN (MobileLoginHandler). The server looks the user up by
 * email + app name (AppNameUtil.BLYNK = "Blynk"); the OS is used for push notifications (OsType);
 * the version (x.y.z) is only read by Version.isOutdated().
 */
export const CLIENT_OS = 'Android';
export const CLIENT_VERSION = '0.1.0';
export const APP_NAME = 'Blynk';

/** Commands that change nothing on the server. In readOnly mode they are the only ones allowed. */
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

/**
 * Editor commands: in read-only mode they are allowed only on the dashboards in `editableDashIds` (the dashId
 * is the first field of the body). DEACTIVATE_DASHBOARD with an empty body would stop every dashboard: no
 * dashId, so it is blocked.
 */
const EDIT_COMMANDS: ReadonlySet<number> = new Set([
  Command.CREATE_WIDGET,
  Command.UPDATE_WIDGET,
  Command.DELETE_WIDGET,
  Command.UPDATE_PROJECT_SETTINGS,
  Command.DELETE_DASH,
  Command.ACTIVATE_DASHBOARD,
  Command.DEACTIVATE_DASHBOARD,
  Command.CREATE_DEVICE,
  Command.UPDATE_DEVICE,
  Command.DELETE_DEVICE,
]);

/** Project settings (server DashboardSettings): the ones UPDATE_PROJECT_SETTINGS replaces. */
export interface DashSettings {
  name: string;
  isShared: boolean;
  theme: string;
  keepScreenOn: boolean;
  isAppConnectedOn: boolean;
  isNotificationsOff: boolean;
  widgetBackgroundOn: boolean;
  color: number;
  isDefaultColor: boolean;
}

export class ProtocolError extends Error {
  constructor(
    readonly command: number,
    readonly code: number,
  ) {
    super(`${commandName(command)} failed: ${responseName(code)} (${code})`);
  }
}

export interface ClientOptions {
  /** Blocks commands that write to the server. */
  readOnly?: boolean;
  /**
   * In read-only mode, still allows pin writes (HARDWARE command): what the app needs to control the
   * devices without being able to change the projects.
   */
  allowHardwareWrites?: boolean;
  /**
   * In read-only mode, still allows the editor commands (widgets, settings, devices, play/stop, project
   * deletion), but only on these dashboards: the dashId is the first field of the body.
   * Empty = no changes. Extended with allowEditing().
   */
  editableDashIds?: readonly number[];
  /** In read-only mode, allows CREATE_DASH; the created dashboard becomes editable. */
  allowCreateDash?: boolean;
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
  private readonly editable: Set<number>;

  constructor(
    private readonly transport: Transport,
    opts: ClientOptions = {},
  ) {
    this.opts = {
      readOnly: true,
      allowHardwareWrites: false,
      editableDashIds: [],
      allowCreateDash: false,
      requestTimeoutMs: 15000,
      pingIntervalMs: 10000,
      ...opts,
    };
    this.editable = new Set(this.opts.editableDashIds);
    this.codec = createCodec(transport.framing);
    transport.onData((chunk) => {
      for (const m of this.codec.push(chunk)) this.dispatch(m);
    });
    transport.onClose((err) => this.handleClosed(err));
  }

  /** Connection closed (by the transport or after an unanswered ping): notified only once. */
  private handleClosed(err?: Error): void {
    if (this.closed) return;
    this.closed = true;
    this.stopPing();
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(err ?? new Error('Connection closed'));
    }
    this.pending.clear();
    for (const l of this.disconnectListeners) l(err);
  }

  /** Messages the client did not ask for (hardware updates, status notifications...). */
  onMessage(listener: (m: Message) => void): void {
    this.listeners.push(listener);
  }

  /** Called when the connection closes (by the server, the network or close()). */
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
   * Asks the server for the current state of a dashboard (MobileSyncLogic): it replies OK and then sends
   * one APP_SYNC (msgId SYNC_MESSAGE_ID) per widget to the onMessage listeners. It is the only way to get
   * the Terminal history, which the server keeps only in memory (Terminal.lastCommands).
   */
  async syncDashboard(dashId: number, deviceId?: number): Promise<void> {
    await this.expectOk(Command.APP_SYNC, deviceId === undefined ? String(dashId) : `${dashId}-${deviceId}`);
  }

  /** Whole profile (all dashboards), decompressed and parsed. */
  async loadProfile(): Promise<unknown> {
    const reply = await this.request(Command.LOAD_PROFILE_GZIPPED, '');
    if (reply.kind === 'response') throw new ProtocolError(Command.LOAD_PROFILE_GZIPPED, reply.code);
    const bytes = reply.kind === 'binary' ? reply.body : strToU8(reply.body);
    return JSON.parse(strFromU8(decompressSync(bytes)));
  }

  /**
   * SuperChart history (GET_ENHANCED_GRAPH_DATA). Returns one series per datastream of the widget, in the
   * same order; `null` when the server replies NO_DATA.
   * `deviceId` is only needed when the chart follows a Device Selector or Device Tiles.
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

  /** Sends a command and waits for the message with the same msgId. */
  request(command: number, body = ''): Promise<Message> {
    if (!this.isAllowed(command, body)) {
      return Promise.reject(new Error(`Command ${commandName(command)} blocked: read-only client`));
    }
    const msgId = this.allocId();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(msgId);
        reject(new Error(`Timeout on ${commandName(command)} (msgId ${msgId})`));
      }, this.opts.requestTimeoutMs);
      this.pending.set(msgId, { command, resolve, reject, timer });
      this.transport.write(this.codec.encode(command, msgId, body));
    });
  }

  /**
   * Sends a command without waiting for a reply. Used for HARDWARE: the server does not reply on success
   * and only sends an error RESPONSE (for example DEVICE_NOT_IN_NETWORK = 7 with the device offline),
   * which reaches the onMessage listeners with the same msgId returned here.
   */
  send(command: number, body = ''): number {
    if (!this.isAllowed(command, body)) throw new Error(`Command ${commandName(command)} blocked: read-only client`);
    const msgId = this.allocId();
    this.transport.write(this.codec.encode(command, msgId, body));
    return msgId;
  }

  /**
   * Writes a device pin: body "<dashId>-<deviceId>\0vw\0<pin>\0<v1>[\0<v2>…]" (MobileHardwareLogic).
   * The server forwards it to the device, updates the stored value and sends it to the other apps of the
   * same account as APP_SYNC.
   */
  writePin(dashId: number, deviceId: number, pin: number, values: (string | number)[], pinType: 'v' | 'd' | 'a' = 'v'): number {
    return this.send(Command.HARDWARE, joinBody(`${dashId}-${deviceId}`, `${pinType}w`, pin, ...values));
  }

  /**
   * Updates an existing widget (UPDATE_WIDGET, MobileUpdateWidgetLogic): body "<dashId>\0<json>".
   * Send the complete widget JSON (same id and type): the server replaces the widget and keeps only the
   * current value. So start from the profile JSON and change only the edited fields, to avoid losing
   * fields the client does not know.
   */
  async updateWidget(dashId: number, widget: { id: number; type: string }): Promise<void> {
    await this.expectOk(Command.UPDATE_WIDGET, joinBody(dashId, JSON.stringify(widget)));
  }

  /**
   * Creates a widget (CREATE_WIDGET, MobileCreateWidgetLogic): body "<dashId>\0<json>". The server rejects ids
   * already in use and charges the widget Energy (ENERGY_LIMIT if there is not enough).
   */
  async createWidget(dashId: number, widget: { id: number; type: string }): Promise<void> {
    await this.expectOk(Command.CREATE_WIDGET, joinBody(dashId, JSON.stringify(widget)));
  }

  /**
   * Deletes a widget (DELETE_WIDGET): body "<dashId>\0<widgetId>". The Energy goes back to the user.
   * Careful: deleting the Tabs widget also makes the server delete the widgets of every tab after the first.
   */
  async deleteWidget(dashId: number, widgetId: number): Promise<void> {
    await this.expectOk(Command.DELETE_WIDGET, joinBody(dashId, widgetId));
  }

  /** Available Energy (GET_ENERGY, read-only). */
  async getEnergy(): Promise<number> {
    const reply = await this.request(Command.GET_ENERGY, '');
    if (reply.kind === 'response') throw new ProtocolError(Command.GET_ENERGY, reply.code);
    return Number(reply.kind === 'text' ? reply.body : '');
  }

  /**
   * Creates a project (CREATE_DASH, MobileCreateDashLogic): body = dashboard JSON. The server rejects ids
   * already in use (NOT_ALLOWED) and too many projects (QUOTA_LIMIT), and generates the tokens of the devices
   * in the JSON: reload the profile to read them. The created project becomes editable.
   */
  async createDash(dash: { id: number; name: string }): Promise<void> {
    await this.expectOk(Command.CREATE_DASH, JSON.stringify(dash));
    this.editable.add(dash.id);
  }

  /** Replaces the settings of a project (UPDATE_PROJECT_SETTINGS): body "<dashId>\0<json>". */
  async updateDashSettings(dashId: number, settings: DashSettings): Promise<void> {
    await this.expectOk(Command.UPDATE_PROJECT_SETTINGS, joinBody(dashId, JSON.stringify(settings)));
  }

  /**
   * Deletes a project (DELETE_DASH): body = dashId. The server also deletes timers, tokens, device
   * connections and the whole history of their pins.
   */
  async deleteDash(dashId: number): Promise<void> {
    await this.expectOk(Command.DELETE_DASH, String(dashId));
    this.editable.delete(dashId);
  }

  /**
   * Play (ACTIVATE_DASHBOARD): body = dashId. The dashboard is activated anyway; when no device is connected
   * the server replies DEVICE_NOT_IN_NETWORK (or OK with notifications off): returns false in that case.
   */
  async activateDash(dashId: number): Promise<boolean> {
    const reply = await this.request(Command.ACTIVATE_DASHBOARD, String(dashId));
    if (reply.kind !== 'response' || reply.code === ResponseCode.OK) return true;
    if (reply.code === ResponseCode.DEVICE_NOT_IN_NETWORK) return false;
    throw new ProtocolError(Command.ACTIVATE_DASHBOARD, reply.code);
  }

  /** Stop (DEACTIVATE_DASHBOARD): body = dashId (never empty, which would stop every dashboard). */
  async deactivateDash(dashId: number): Promise<void> {
    await this.expectOk(Command.DEACTIVATE_DASHBOARD, String(dashId));
  }

  /**
   * Adds a device (CREATE_DEVICE): body "<dashId>\0<json>"; needs a new id, a name (max 50) and boardType.
   * The server replies with a CREATE_DEVICE holding the device with its generated token.
   */
  async createDevice<T extends { id: number; name: string; boardType: string }>(dashId: number, device: T): Promise<T & { token?: string }> {
    const reply = await this.request(Command.CREATE_DEVICE, joinBody(dashId, JSON.stringify(device)));
    if (reply.kind === 'response') throw new ProtocolError(Command.CREATE_DEVICE, reply.code);
    const text = reply.kind === 'binary' ? strFromU8(reply.body) : reply.body;
    return JSON.parse(text) as T & { token?: string };
  }

  /** Updates an existing device (UPDATE_DEVICE): name, board, connection, icon; the token does not change. */
  async updateDevice(dashId: number, device: { id: number; name: string; boardType: string }): Promise<void> {
    await this.expectOk(Command.UPDATE_DEVICE, joinBody(dashId, JSON.stringify(device)));
  }

  /** Deletes a device (DELETE_DEVICE): body "<dashId>\0<deviceId>". Also deletes the history of its pins. */
  async deleteDevice(dashId: number, deviceId: number): Promise<void> {
    await this.expectOk(Command.DELETE_DEVICE, joinBody(dashId, deviceId));
  }

  /** Devices of a project with status and token (GET_DEVICES, read-only). */
  async getDevices(dashId: number): Promise<unknown[]> {
    const reply = await this.request(Command.GET_DEVICES, String(dashId));
    if (reply.kind === 'response') throw new ProtocolError(Command.GET_DEVICES, reply.code);
    return JSON.parse(reply.kind === 'binary' ? strFromU8(reply.body) : reply.body) as unknown[];
  }

  /** Makes another dashboard editable (for example a project created by this app in an earlier session). */
  allowEditing(dashId: number): void {
    this.editable.add(dashId);
  }

  private isAllowed(command: number, body: string): boolean {
    if (!this.opts.readOnly) return true;
    if (READ_ONLY_COMMANDS.has(command)) return true;
    if (command === Command.HARDWARE) return this.opts.allowHardwareWrites;
    if (command === Command.CREATE_DASH) return this.opts.allowCreateDash;
    if (EDIT_COMMANDS.has(command)) {
      const first = body.split('\0', 1)[0]!;
      return /^\d+$/.test(first) && this.editable.has(Number(first));
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
    // Replies have the msgId of the request; messages the server sends on its own use their own msgId.
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
      // An unanswered ping means the connection died silently (network lost without the socket being
      // closed): declare it closed right away, so that the client user can reconnect.
      this.request(Command.PING).catch(() => {
        if (this.pingTimer) this.handleClosed(new Error('No reply to ping'));
        this.transport.close();
      });
    }, this.opts.pingIntervalMs);
  }

  private stopPing(): void {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = undefined;
  }
}
