// Session with the server: a single WebSocket connection (wss://<host>/dashws) for the whole app.
// Plain class (outside React): the React context only observes its state.
//
// - In the background the connection is closed (pause): the server stops polling the devices and sends
//   "adis" to the Node-RED flows. Back in the foreground (resume) it reconnects and reloads the
//   profile, which already holds the last value of every widget.
// - If the connection drops while the app is active, it retries with growing delays.
// - The client is read-only except for pin writes (HARDWARE): the app controls the devices but cannot
//   change the projects.
import { LegacyClient, ProtocolError, Command, ResponseCode, WebSocketTransport, type DashSettings, type GraphData, type GraphPeriod } from '@tinkerblink/protocol';
import { t } from '@/i18n';
import { canControl, pinKey, type Dashboard, type Device, type Profile, type Widget } from '@/model/profile';
import { loadCreatedDashIds, saveCreatedDashIds } from '@/editor/policy';
import { syncGps } from '@/sensors/gps';
import { SensorsWorker } from '@/sensors/sensorsWorker';
// Installs the trust manager of the certificates trusted by the user before the first connection (Android).
import '../../modules/tinkerblink-tls';
import { describeConnectionError, isCertificateError } from './connectionError';
import { forgetPassword, saveCredentials, serverUrl, type Credentials } from './credentials';
import { LiveStore } from './liveStore';

export type SessionStatus = 'idle' | 'connecting' | 'online' | 'reconnecting' | 'paused' | 'error';

export interface SessionState {
  status: SessionStatus;
  error?: string;
  /** The last login failed on the server certificate: the login offers to look at it and trust it. */
  certificateError?: boolean;
  /** Server of that login: the certificate screen reads it from here, never from a (deep link) URL. */
  certificateHost?: string;
  profile?: Profile;
  /** Account and server of the open session (shown in the credits): set with the profile, cleared with it. */
  account?: { email: string; host: string };
  /** Temporary notice, for example device offline after a command. */
  notice?: string;
  /** Editable dashboards: the user's projects, including those just created by this app. */
  editableDashIds: readonly number[];
}

/** Data for a new project ("New Project" screen): a project with one device. */
export interface NewProject {
  name: string;
  theme: string;
  device: NewDevice;
}

export interface NewDevice {
  name: string;
  boardType: string;
  connectionType: string;
}

/**
 * The server does not serialize empty arrays (Jackson NON_EMPTY): a project without widgets comes without
 * `widgets` (and without devices without `devices`). They are added back here, so the rest of the app can rely on them.
 */
function normalizeProfile(p: Profile): Profile {
  return { ...p, dashBoards: (p.dashBoards ?? []).map((d) => ({ ...d, widgets: d.widgets ?? [], devices: d.devices ?? [] })) };
}

/** Random unused positive id (project ids are ints on the server, DashBoard.id). */
function freeId(used: number[], max = 2147483647): number {
  for (;;) {
    const id = 1 + Math.floor(Math.random() * (max - 1));
    if (!used.includes(id)) return id;
  }
}

const SETTINGS_KEYS = [
  'name',
  'isShared',
  'theme',
  'keepScreenOn',
  'isAppConnectedOn',
  'isNotificationsOff',
  'widgetBackgroundOn',
  'color',
  'isDefaultColor',
] as const;

/** Current settings of a project, with the server defaults for missing fields. */
export function dashSettingsOf(dash: Dashboard): DashSettings {
  return {
    name: dash.name,
    isShared: dash.isShared ?? false,
    theme: dash.theme ?? 'Blynk',
    keepScreenOn: dash.keepScreenOn ?? false,
    isAppConnectedOn: dash.isAppConnectedOn ?? false,
    isNotificationsOff: dash.isNotificationsOff ?? false,
    widgetBackgroundOn: dash.widgetBackgroundOn ?? false,
    color: dash.color ?? -1,
    isDefaultColor: dash.isDefaultColor ?? true,
  };
}

const RETRY_DELAYS_MS = [2000, 5000, 10000, 30000];
const NOTICE_MS = 3000;
/** The server reports write errors right away: after this time the msgId is no longer needed. */
const WRITE_ERROR_WINDOW_MS = 5000;

/**
 * Login rejected by the server: wrong password (5), user deleted (3), access not allowed (6: IP blocked after
 * too many attempts on the newer server, or login forbidden). No automatic retry: with the IP block the app
 * would lock itself out (docs/APP-CLIENT.md of the server fork).
 */
function isLoginRejected(e: unknown): boolean {
  return (
    e instanceof ProtocolError &&
    e.command === Command.LOGIN &&
    (e.code === ResponseCode.USER_NOT_AUTHENTICATED || e.code === ResponseCode.USER_NOT_REGISTERED || e.code === ResponseCode.NOT_ALLOWED)
  );
}

function describeError(e: unknown): string {
  if (e instanceof ProtocolError) {
    if (e.code === ResponseCode.USER_NOT_AUTHENTICATED) return t.wrongCredentials;
    if (e.code === ResponseCode.USER_NOT_REGISTERED) return t.userNotRegistered;
    if (e.code === ResponseCode.NOT_ALLOWED && e.command === Command.LOGIN) return t.loginNotAllowed;
    return e.message;
  }
  if (e instanceof Error) return describeConnectionError(e.message);
  return String(e);
}

export class SessionManager {
  readonly store = new LiveStore();
  /** Phone sensors: active only while the session is online. */
  readonly sensors = new SensorsWorker((dashId, deviceId, pin, values) => this.writeSensor(dashId, deviceId, pin, values));
  private state: SessionState = { status: 'idle', editableDashIds: [] };
  /** Projects created by this app with the current account (persisted in AsyncStorage). */
  private createdDashIds: number[] = [];
  private listeners = new Set<() => void>();
  private client: LegacyClient | null = null;
  private credentials: Credentials | null = null;
  private active = true;
  private retryAttempt = 0;
  private retryTimer?: ReturnType<typeof setTimeout>;
  private noticeTimer?: ReturnType<typeof setTimeout>;
  /** Recently sent writes (msgId → pin and previous value), to recognize errors and undo them. */
  private pendingWrites = new Map<number, { key: string; previous: string[] | undefined }>();

  getState = (): SessionState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  login = async (c: Credentials, rememberPassword: boolean): Promise<boolean> => {
    this.clearRetry();
    this.setState({ status: 'connecting', error: undefined, certificateError: false, certificateHost: undefined });
    try {
      await this.open(c);
      this.credentials = c;
      await saveCredentials(c, rememberPassword);
      return true;
    } catch (e) {
      this.closeClient();
      const certificateError = e instanceof Error && !(e instanceof ProtocolError) && isCertificateError(e.message);
      this.setState({ status: 'error', error: describeError(e), certificateError, certificateHost: certificateError ? c.host : undefined });
      return false;
    }
  };

  logout = async (): Promise<void> => {
    this.clearRetry();
    this.closeClient();
    this.credentials = null;
    this.createdDashIds = [];
    this.setState({ status: 'idle', error: undefined, profile: undefined, account: undefined, editableDashIds: [] });
    void syncGps(null, '');
    await forgetPassword();
  };

  /**
   * Writes a virtual pin (Button, Menu, Time Input…) and updates the shown value right away, because
   * the server does not send the value back to the sender. False when not connected.
   */
  writePin = (dashId: number, deviceId: number, pin: number, values: string[]): boolean => {
    const client = this.client;
    if (!client || this.state.status !== 'online') {
      this.showNotice(t.notConnected);
      return false;
    }
    const dash = this.state.profile?.dashBoards.find((d) => d.id === dashId);
    if (dash && !canControl(dash)) {
      this.showNotice(t.readOnlyProject);
      return false;
    }
    const key = pinKey(dashId, deviceId, 'VIRTUAL', pin);
    const msgId = client.writePin(dashId, deviceId, pin, values);
    this.pendingWrites.set(msgId, { key, previous: this.store.getValue(key) });
    setTimeout(() => this.pendingWrites.delete(msgId), WRITE_ERROR_WINDOW_MS);
    this.store.setLocal(key, values);
    return true;
  };

  /** Sensor writes: no notices (device offline, not connected), they arrive continuously. */
  private writeSensor(dashId: number, deviceId: number, pin: number, values: string[]): void {
    const client = this.client;
    if (!client || this.state.status !== 'online') return;
    const dash = this.state.profile?.dashBoards.find((d) => d.id === dashId);
    if (dash && !canControl(dash)) return;
    client.writePin(dashId, deviceId, pin, values);
    this.store.setLocal(pinKey(dashId, deviceId, 'VIRTUAL', pin), values);
  }

  /** SuperChart history (GET_ENHANCED_GRAPH_DATA). `null` = no data; error when not connected. */
  /**
   * Editor: saves a changed widget (UPDATE_WIDGET) and updates the local profile. Only on the allowed
   * dashboards (the client rejects the others). After saving, the dashboard APP_SYNC is requested, so the
   * values follow a possible pin change.
   */
  updateWidget = async (dashId: number, widget: Widget): Promise<void> => {
    const client = this.client;
    const profile = this.state.profile;
    if (!client || !profile || this.state.status !== 'online') throw new Error(t.notConnected);
    await client.updateWidget(dashId, widget);
    if (this.client !== client || this.state.profile !== profile) return;
    const next: Profile = {
      ...profile,
      dashBoards: profile.dashBoards.map((d) =>
        d.id !== dashId ? d : { ...d, widgets: d.widgets.map((w) => (w.id === widget.id ? { ...widget, value: w.value } : w)) },
      ),
    };
    this.setState({ profile: next });
    if (widget.type === 'GPS_STREAMING' || widget.type === 'GPS_TRIGGER') void syncGps(next, this.credentials?.host ?? '');
    await client.syncDashboard(dashId).catch(() => undefined);
  };

  /** Editor: adds a widget (CREATE_WIDGET) and inserts it into the local profile. */
  createWidget = async (dashId: number, widget: Widget): Promise<void> => {
    const client = this.requireOnline();
    await client.createWidget(dashId, widget);
    this.patchDash(dashId, (widgets) => [...widgets, widget]);
    await client.syncDashboard(dashId).catch(() => undefined);
  };

  /**
   * Editor: deletes a widget (DELETE_WIDGET). Like the server, deleting the Tabs widget also removes the
   * widgets of every tab after the first (MobileDeleteWidgetLogic.deleteTabs).
   */
  deleteWidget = async (dashId: number, widgetId: number): Promise<void> => {
    const client = this.requireOnline();
    const dash = this.state.profile?.dashBoards.find((d) => d.id === dashId);
    const isTabs = dash?.widgets.find((w) => w.id === widgetId)?.type === 'TABS';
    await client.deleteWidget(dashId, widgetId);
    this.patchDash(dashId, (widgets) => widgets.filter((w) => w.id !== widgetId && !(isTabs && (w.tabId ?? 0) > 0)));
  };

  /** Energy available for widgets (GET_ENERGY). */
  getEnergy = (): Promise<number> => this.requireOnline().getEnergy();

  /**
   * Creates a project with one device (CREATE_DASH), makes it editable and adds it to the local profile.
   * The server generates the device token: it is read right away with GET_DEVICES. Returns the project id.
   */
  createProject = async (p: NewProject): Promise<number> => {
    const client = this.requireOnline();
    const profile = this.state.profile!;
    const id = freeId(profile.dashBoards.map((d) => d.id));
    const now = Date.now();
    const dash: Dashboard = {
      id,
      name: p.name,
      createdAt: now,
      updatedAt: now,
      theme: p.theme,
      isActive: false,
      widgets: [],
      devices: [{ id: 0, name: p.device.name, boardType: p.device.boardType, connectionType: p.device.connectionType }],
    };
    await client.createDash(dash);
    await this.rememberCreated(id, true);
    const devices = (await client.getDevices(id).catch(() => null)) as Device[] | null;
    const current = this.state.profile ?? profile;
    this.setState({ profile: { ...current, dashBoards: [...current.dashBoards, { ...dash, devices: devices ?? dash.devices }] } });
    return id;
  };

  /** Clone code of a project (GET_CLONE_CODE): valid only on this server. */
  getCloneCode = (dashId: number): Promise<string> => this.requireOnline().getCloneCode(dashId);

  /**
   * Creates a project from a clone code (own or received from another user of the same server): the server
   * chooses the id and generates new device tokens, read right away with GET_DEVICES. The server keeps the name of
   * the cloned project: `nameSuffix` is added in brackets ("Garden (copy)"), so the two projects are not confused.
   * If the renaming fails the copy keeps the same name. Returns the project id.
   */
  cloneProject = async (code: string, nameSuffix: string): Promise<number> => {
    const client = this.requireOnline();
    const created = (await client.cloneProject(code)) as Dashboard;
    const dash: Dashboard = { ...created, widgets: created.widgets ?? [], devices: created.devices ?? [] };
    const devices = (await client.getDevices(dash.id).catch(() => null)) as Device[] | null;
    const current = this.state.profile!;
    const others = current.dashBoards.filter((d) => d.id !== dash.id);
    this.setState({ profile: { ...current, dashBoards: [...others, { ...dash, devices: devices ?? dash.devices }] } });
    this.setState({ editableDashIds: this.editableFor(this.state.profile) });
    await this.updateDashSettings(dash.id, { name: `${dash.name} (${nameSuffix})` }).catch(() => undefined);
    return dash.id;
  };

  /** Project settings (UPDATE_PROJECT_SETTINGS): starts from the current ones and changes only the given fields. */
  updateDashSettings = async (dashId: number, patch: Partial<DashSettings>): Promise<void> => {
    const client = this.requireOnline();
    const settings = { ...dashSettingsOf(this.dashOrThrow(dashId)), ...patch };
    await client.updateDashSettings(dashId, settings);
    const picked = Object.fromEntries(SETTINGS_KEYS.map((k) => [k, settings[k]]));
    this.patchDashboard(dashId, (d) => ({ ...d, ...picked }));
  };

  /**
   * Play / stop (ACTIVATE / DEACTIVATE_DASHBOARD). After play, APP_SYNC is requested as at startup.
   * Returns false if the server reports that no device of the project is connected.
   */
  setDashActive = async (dashId: number, active: boolean): Promise<boolean> => {
    const client = this.requireOnline();
    let devicesOnline = true;
    if (active) devicesOnline = await client.activateDash(dashId);
    else await client.deactivateDash(dashId);
    this.patchDashboard(dashId, (d) => ({ ...d, isActive: active }));
    if (active) await client.syncDashboard(dashId).catch(() => undefined);
    void syncGps(this.state.profile ?? null, this.credentials?.host ?? '');
    return devicesOnline;
  };

  /** Deletes a project (DELETE_DASH): the server also deletes the history of its devices. */
  deleteDash = async (dashId: number): Promise<void> => {
    const client = this.requireOnline();
    await client.deleteDash(dashId);
    await this.rememberCreated(dashId, false);
    const profile = this.state.profile;
    if (profile) this.setState({ profile: { ...profile, dashBoards: profile.dashBoards.filter((d) => d.id !== dashId) } });
    void syncGps(this.state.profile ?? null, this.credentials?.host ?? '');
  };

  /** Adds a device (CREATE_DEVICE): the server returns it with its token. */
  createDevice = async (dashId: number, d: NewDevice): Promise<Device> => {
    const client = this.requireOnline();
    const dash = this.dashOrThrow(dashId);
    const id = freeId((dash.devices ?? []).map((x) => x.id), 200000);
    const created = (await client.createDevice(dashId, { id, ...d })) as Device;
    this.patchDashboard(dashId, (x) => ({ ...x, devices: [...(x.devices ?? []), created] }));
    return created;
  };

  /** Changes name, board or connection of a device (UPDATE_DEVICE); the token does not change. */
  updateDevice = async (dashId: number, device: Device): Promise<void> => {
    const client = this.requireOnline();
    // Status and token are managed by the server: they are not sent back.
    const { token: _token, status: _status, connectTime: _connect, disconnectTime: _disconnect, ...body } = device;
    await client.updateDevice(dashId, { ...body, boardType: device.boardType ?? 'Generic Board' });
    this.patchDashboard(dashId, (x) => ({ ...x, devices: (x.devices ?? []).map((v) => (v.id === device.id ? { ...v, ...body } : v)) }));
  };

  /** Deletes a device (DELETE_DEVICE): the server also deletes its pin history and the values of bound widgets. */
  deleteDevice = async (dashId: number, deviceId: number): Promise<void> => {
    const client = this.requireOnline();
    await client.deleteDevice(dashId, deviceId);
    this.patchDashboard(dashId, (x) => ({ ...x, devices: (x.devices ?? []).filter((v) => v.id !== deviceId) }));
    void syncGps(this.state.profile ?? null, this.credentials?.host ?? '');
  };

  private dashOrThrow(dashId: number): Dashboard {
    const dash = this.state.profile?.dashBoards.find((d) => d.id === dashId);
    if (!dash) throw new Error(`Dashboard ${dashId}?`);
    return dash;
  }

  private patchDashboard(dashId: number, update: (d: Dashboard) => Dashboard): void {
    const profile = this.state.profile;
    if (!profile) return;
    this.setState({ profile: { ...profile, dashBoards: profile.dashBoards.map((d) => (d.id === dashId ? update(d) : d)) } });
  }

  /** Editable projects: the user's own and those created by the app, never those assigned by other users. */
  private editableFor(profile: Profile | undefined): number[] {
    const assigned = new Set((profile?.dashBoards ?? []).filter((d) => d.assigned).map((d) => d.id));
    const own = (profile?.dashBoards ?? []).map((d) => d.id);
    return [...new Set([...this.createdDashIds, ...own])].filter((id) => !assigned.has(id));
  }

  /** Updates the list of projects created by the app (and therefore editable) and saves it. */
  private async rememberCreated(dashId: number, add: boolean): Promise<void> {
    const others = this.createdDashIds.filter((x) => x !== dashId);
    this.createdDashIds = add ? [...others, dashId] : others;
    this.setState({ editableDashIds: this.editableFor(this.state.profile) });
    const c = this.credentials;
    if (c) await saveCreatedDashIds(c.host, c.email, this.createdDashIds);
  }

  private requireOnline(): LegacyClient {
    const client = this.client;
    if (!client || !this.state.profile || this.state.status !== 'online') throw new Error(t.notConnected);
    return client;
  }

  private patchDash(dashId: number, update: (widgets: Widget[]) => Widget[]): void {
    this.patchDashboard(dashId, (d) => ({ ...d, widgets: update(d.widgets) }));
  }

  getGraphData = (req: { dashId: number; widgetId: number; period: GraphPeriod; page?: number }): Promise<GraphData | null> => {
    const client = this.client;
    if (!client || this.state.status !== 'online') return Promise.reject(new Error(t.notConnected));
    return client.getGraphData(req);
  };

  /** App in the background: closes the connection. */
  pause(): void {
    this.active = false;
    if (!this.credentials) return;
    this.clearRetry();
    this.closeClient();
    this.setState({ status: 'paused' });
  }

  /** App in the foreground: reconnects if there was a session. */
  resume(): void {
    this.active = true;
    if (!this.credentials || this.client) return;
    this.reconnectNow();
  }

  dispose(): void {
    this.clearRetry();
    this.closeClient();
    this.sensors.update(null);
    if (this.noticeTimer) clearTimeout(this.noticeTimer);
    this.listeners.clear();
  }

  private async open(c: Credentials): Promise<void> {
    this.closeClient();
    const client = new LegacyClient(new WebSocketTransport(serverUrl(c.host)), {
      readOnly: true,
      allowHardwareWrites: true,
      editableDashIds: [],
      allowCreateDash: true,
    });
    this.client = client;
    client.onMessage((m) => {
      if (m.kind === 'response') {
        const write = this.pendingWrites.get(m.msgId);
        if (!write) return;
        this.pendingWrites.delete(m.msgId);
        if (m.code === ResponseCode.DEVICE_NOT_IN_NETWORK) this.showNotice(t.deviceOffline);
        else if (m.code === ResponseCode.NOT_ALLOWED) {
          // Command rejected (read-only assigned project): the widget goes back to how it was.
          this.store.restoreValue(write.key, write.previous);
          this.showNotice(t.writeRejected);
        }
        return;
      }
      this.store.apply(m);
    });
    client.onDisconnect(() => {
      if (this.client !== client) return; // intentional close or connection already replaced
      this.client = null;
      this.scheduleReconnect();
    });
    await client.connect();
    await client.login(c.email, c.password);
    const profile = normalizeProfile((await client.loadProfile()) as Profile);
    // Projects created by this app in earlier sessions: they stay editable as long as they exist.
    const existing = new Set(profile.dashBoards.map((d) => d.id));
    const created = (await loadCreatedDashIds(c.host, c.email)).filter((id) => existing.has(id));
    if (this.client !== client) return;
    this.createdDashIds = created;
    for (const id of created) client.allowEditing(id);
    for (const id of this.editableFor(profile)) client.allowEditing(id);
    this.store.load(profile);
    this.retryAttempt = 0;
    this.setState({
      status: 'online',
      error: undefined,
      profile,
      account: { email: c.email, host: c.host },
      editableDashIds: this.editableFor(profile),
    });
    void syncGps(profile, c.host);
    // Sync of the active dashboards (APP_SYNC). The server resends the state of every widget,
    // including the Terminal history, which is not in the profile.
    for (const dash of profile.dashBoards) {
      if (dash.isActive === false || this.client !== client) continue;
      await client.syncDashboard(dash.id).catch(() => undefined);
    }
  }

  private reconnectNow(): void {
    const c = this.credentials;
    if (!c) return;
    this.setState({ status: 'reconnecting' });
    this.open(c).catch((e) => {
      this.closeClient();
      if (isLoginRejected(e)) {
        this.loginRejected(e);
        return;
      }
      this.setState({ error: describeError(e) });
      this.scheduleReconnect();
    });
  }

  /**
   * Reconnection rejected (password changed from the admin panel, user deleted, IP blocked): back to the login
   * screen with the reason, and the saved password is forgotten, so the automatic login does not retry either.
   */
  private loginRejected(e: unknown): void {
    this.clearRetry();
    this.credentials = null;
    this.createdDashIds = [];
    this.setState({ status: 'error', error: `${t.sessionEnded}. ${describeError(e)}`, profile: undefined, account: undefined, editableDashIds: [] });
    void syncGps(null, '');
    void forgetPassword();
  }

  private scheduleReconnect(): void {
    if (!this.credentials || !this.active || this.retryTimer) return;
    const delay = RETRY_DELAYS_MS[Math.min(this.retryAttempt, RETRY_DELAYS_MS.length - 1)]!;
    this.retryAttempt++;
    this.setState({ status: 'reconnecting' });
    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined;
      this.reconnectNow();
    }, delay);
  }

  private clearRetry(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
    this.retryAttempt = 0;
  }

  /** Server whose certificate the certificate screen shows: set only by in-app actions (login screen). */
  selectCertificateHost = (host: string): void => {
    this.setState({ certificateHost: host.trim() });
  };

  /** Clears the error of a failed login (e.g. after trusting the server certificate). */
  dismissError = (): void => {
    if (this.state.status === 'error') this.setState({ status: 'idle', error: undefined, certificateError: false });
  };

  showNotice = (text: string): void => {
    if (this.noticeTimer) clearTimeout(this.noticeTimer);
    this.setState({ notice: text });
    this.noticeTimer = setTimeout(() => this.setState({ notice: undefined }), NOTICE_MS);
  };

  /** Intentional close: clearing this.client before close() keeps the reconnection from starting. */
  private closeClient(): void {
    const c = this.client;
    this.client = null;
    c?.close();
  }

  private setState(patch: Partial<SessionState>): void {
    this.state = { ...this.state, ...patch };
    this.sensors.update(this.state.status === 'online' ? (this.state.profile ?? null) : null);
    this.listeners.forEach((l) => l());
  }
}
