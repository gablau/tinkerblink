// Sessione con il server: una sola connessione WebSocket (wss://<host>/dashws) per tutta l'app.
// Classe normale (fuori da React): il contesto React ne osserva solo lo stato.
//
// - In background la connessione si chiude (pause): il server smette di interrogare i device e invia
//   "adis" ai flussi Node-RED. Al ritorno in primo piano (resume) si riconnette e ricarica il
//   profilo, che contiene già l'ultimo valore di ogni widget.
// - Se la connessione cade mentre l'app è attiva, si riprova con attese crescenti.
// - Il client è in sola lettura tranne le scritture sui pin (HARDWARE): l'app comanda i device ma non
//   può modificare i progetti.
import { LegacyClient, ProtocolError, Command, ResponseCode, WebSocketTransport, type DashSettings, type GraphData, type GraphPeriod } from '@tinkerblink/protocol';
import { t } from '@/i18n';
import { canControl, pinKey, type Dashboard, type Device, type Profile, type Widget } from '@/model/profile';
import { EDITABLE_DASH_IDS, loadCreatedDashIds, saveCreatedDashIds } from '@/editor/policy';
import { syncGps } from '@/sensors/gps';
import { SensorsWorker } from '@/sensors/sensorsWorker';
import { forgetPassword, saveCredentials, serverUrl, type Credentials } from './credentials';
import { LiveStore } from './liveStore';

export type SessionStatus = 'idle' | 'connecting' | 'online' | 'reconnecting' | 'paused' | 'error';

export interface SessionState {
  status: SessionStatus;
  error?: string;
  profile?: Profile;
  /** Avviso temporaneo, per esempio device offline dopo un comando. */
  notice?: string;
  /** Dashboard modificabili: i progetti dell'utente, compresi quelli appena creati da questa app. */
  editableDashIds: readonly number[];
}

/** Dati per un progetto nuovo (schermata "New Project"): un progetto con un device. */
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
 * Il server non serializza gli array vuoti (Jackson NON_EMPTY): un progetto senza widget arriva senza `widgets`
 * (e senza device senza `devices`). Qui si rimettono, così il resto dell'app può contarci.
 */
function normalizeProfile(p: Profile): Profile {
  return { ...p, dashBoards: (p.dashBoards ?? []).map((d) => ({ ...d, widgets: d.widgets ?? [], devices: d.devices ?? [] })) };
}

/** Id casuale positivo non usato (gli id dei progetti sono int lato server, DashBoard.id). */
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

/** Impostazioni correnti di un progetto, con i default del server per i campi assenti. */
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
/** Il server segnala gli errori di scrittura subito: oltre questo tempo il msgId non serve più. */
const WRITE_ERROR_WINDOW_MS = 5000;

/**
 * Login rifiutato dal server: password sbagliata (5), utente cancellato (3), accesso non consentito (6: IP bloccato
 * dopo troppi tentativi sul server nuovo, oppure login vietato). Non si riprova in automatico: con il blocco per IP
 * l'app si bloccherebbe da sola (docs/APP-CLIENT.md del fork del server).
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
  if (e instanceof Error) return e.message;
  return String(e);
}

export class SessionManager {
  readonly store = new LiveStore();
  /** Sensori del telefono: attivi solo mentre la sessione è online. */
  readonly sensors = new SensorsWorker((dashId, deviceId, pin, values) => this.writeSensor(dashId, deviceId, pin, values));
  private state: SessionState = { status: 'idle', editableDashIds: [] };
  /** Progetti creati da questa app con l'account corrente (persistiti in AsyncStorage). */
  private createdDashIds: number[] = [];
  private listeners = new Set<() => void>();
  private client: LegacyClient | null = null;
  private credentials: Credentials | null = null;
  private active = true;
  private retryAttempt = 0;
  private retryTimer?: ReturnType<typeof setTimeout>;
  private noticeTimer?: ReturnType<typeof setTimeout>;
  /** Scritture inviate di recente (msgId → pin e valore di prima), per riconoscere gli errori e annullarle. */
  private pendingWrites = new Map<number, { key: string; previous: string[] | undefined }>();

  getState = (): SessionState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  login = async (c: Credentials, rememberPassword: boolean): Promise<boolean> => {
    this.clearRetry();
    this.setState({ status: 'connecting', error: undefined });
    try {
      await this.open(c);
      this.credentials = c;
      await saveCredentials(c, rememberPassword);
      return true;
    } catch (e) {
      this.closeClient();
      this.setState({ status: 'error', error: describeError(e) });
      return false;
    }
  };

  logout = async (): Promise<void> => {
    this.clearRetry();
    this.closeClient();
    this.credentials = null;
    this.createdDashIds = [];
    this.setState({ status: 'idle', error: undefined, profile: undefined, editableDashIds: [] });
    void syncGps(null, '');
    await forgetPassword();
  };

  /**
   * Scrive un pin virtuale (Button, Menu, Time Input…) e aggiorna subito il valore mostrato, perché
   * il server non rimanda il valore a chi lo ha inviato. False se non connessi.
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

  /** Scrittura dei sensori: niente avvisi (device offline, non connessi), arrivano di continuo. */
  private writeSensor(dashId: number, deviceId: number, pin: number, values: string[]): void {
    const client = this.client;
    if (!client || this.state.status !== 'online') return;
    const dash = this.state.profile?.dashBoards.find((d) => d.id === dashId);
    if (dash && !canControl(dash)) return;
    client.writePin(dashId, deviceId, pin, values);
    this.store.setLocal(pinKey(dashId, deviceId, 'VIRTUAL', pin), values);
  }

  /** Storico di un SuperChart (GET_ENHANCED_GRAPH_DATA). `null` = nessun dato; errore se non connessi. */
  /**
   * Editor: salva un widget modificato (UPDATE_WIDGET) e aggiorna il profilo locale. Solo sulle dashboard
   * ammesse (il client rifiuta le altre). Dopo il salvataggio si chiede l'APP_SYNC della dashboard, così i
   * valori seguono un eventuale cambio di pin.
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

  /** Editor: aggiunge un widget (CREATE_WIDGET) e lo inserisce nel profilo locale. */
  createWidget = async (dashId: number, widget: Widget): Promise<void> => {
    const client = this.requireOnline();
    await client.createWidget(dashId, widget);
    this.patchDash(dashId, (widgets) => [...widgets, widget]);
    await client.syncDashboard(dashId).catch(() => undefined);
  };

  /**
   * Editor: elimina un widget (DELETE_WIDGET). Come il server, eliminando il widget Tabs si tolgono anche i
   * widget delle schede oltre la prima (MobileDeleteWidgetLogic.deleteTabs).
   */
  deleteWidget = async (dashId: number, widgetId: number): Promise<void> => {
    const client = this.requireOnline();
    const dash = this.state.profile?.dashBoards.find((d) => d.id === dashId);
    const isTabs = dash?.widgets.find((w) => w.id === widgetId)?.type === 'TABS';
    await client.deleteWidget(dashId, widgetId);
    this.patchDash(dashId, (widgets) => widgets.filter((w) => w.id !== widgetId && !(isTabs && (w.tabId ?? 0) > 0)));
  };

  /** Energy disponibile per i widget (GET_ENERGY). */
  getEnergy = (): Promise<number> => this.requireOnline().getEnergy();

  /**
   * Crea un progetto con un device (CREATE_DASH), lo rende modificabile e lo aggiunge al profilo locale.
   * Il server genera il token del device: lo si legge subito con GET_DEVICES. Restituisce l'id del progetto.
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

  /** Impostazioni del progetto (UPDATE_PROJECT_SETTINGS): si parte da quelle correnti e si cambiano solo i campi dati. */
  updateDashSettings = async (dashId: number, patch: Partial<DashSettings>): Promise<void> => {
    const client = this.requireOnline();
    const settings = { ...dashSettingsOf(this.dashOrThrow(dashId)), ...patch };
    await client.updateDashSettings(dashId, settings);
    const picked = Object.fromEntries(SETTINGS_KEYS.map((k) => [k, settings[k]]));
    this.patchDashboard(dashId, (d) => ({ ...d, ...picked }));
  };

  /**
   * Play / stop (ACTIVATE / DEACTIVATE_DASHBOARD). Dopo il play si chiede l'APP_SYNC come all'avvio.
   * Restituisce false se il server segnala che nessun device del progetto è connesso.
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

  /** Elimina un progetto (DELETE_DASH): il server cancella anche lo storico dei suoi device. */
  deleteDash = async (dashId: number): Promise<void> => {
    const client = this.requireOnline();
    await client.deleteDash(dashId);
    await this.rememberCreated(dashId, false);
    const profile = this.state.profile;
    if (profile) this.setState({ profile: { ...profile, dashBoards: profile.dashBoards.filter((d) => d.id !== dashId) } });
    void syncGps(this.state.profile ?? null, this.credentials?.host ?? '');
  };

  /** Aggiunge un device (CREATE_DEVICE): il server lo restituisce con il token. */
  createDevice = async (dashId: number, d: NewDevice): Promise<Device> => {
    const client = this.requireOnline();
    const dash = this.dashOrThrow(dashId);
    const id = freeId((dash.devices ?? []).map((x) => x.id), 200000);
    const created = (await client.createDevice(dashId, { id, ...d })) as Device;
    this.patchDashboard(dashId, (x) => ({ ...x, devices: [...(x.devices ?? []), created] }));
    return created;
  };

  /** Modifica nome, board o connessione di un device (UPDATE_DEVICE); il token non cambia. */
  updateDevice = async (dashId: number, device: Device): Promise<void> => {
    const client = this.requireOnline();
    // Stato e token li gestisce il server: non si rimandano.
    const { token: _token, status: _status, connectTime: _connect, disconnectTime: _disconnect, ...body } = device;
    await client.updateDevice(dashId, { ...body, boardType: device.boardType ?? 'Generic Board' });
    this.patchDashboard(dashId, (x) => ({ ...x, devices: (x.devices ?? []).map((v) => (v.id === device.id ? { ...v, ...body } : v)) }));
  };

  /** Elimina un device (DELETE_DEVICE): il server cancella anche lo storico dei suoi pin e i valori dei widget collegati. */
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

  /** Progetti modificabili: quelli dell'utente e quelli creati dall'app, mai quelli assegnati da altri utenti. */
  private editableFor(profile: Profile | undefined): number[] {
    const assigned = new Set((profile?.dashBoards ?? []).filter((d) => d.assigned).map((d) => d.id));
    return [...EDITABLE_DASH_IDS, ...this.createdDashIds].filter((id) => !assigned.has(id));
  }

  /** Aggiorna l'elenco dei progetti creati dall'app (e quindi modificabili) e lo salva. */
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

  /** App in background: chiude la connessione. */
  pause(): void {
    this.active = false;
    if (!this.credentials) return;
    this.clearRetry();
    this.closeClient();
    this.setState({ status: 'paused' });
  }

  /** App in primo piano: riconnette se c'era una sessione. */
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
          // Comando rifiutato (progetto assegnato in sola lettura): il widget torna com'era.
          this.store.restoreValue(write.key, write.previous);
          this.showNotice(t.writeRejected);
        }
        return;
      }
      this.store.apply(m);
    });
    client.onDisconnect(() => {
      if (this.client !== client) return; // chiusura voluta o connessione già sostituita
      this.client = null;
      this.scheduleReconnect();
    });
    await client.connect();
    await client.login(c.email, c.password);
    const profile = normalizeProfile((await client.loadProfile()) as Profile);
    // Progetti creati da questa app in sessioni precedenti: restano modificabili finché esistono.
    const existing = new Set(profile.dashBoards.map((d) => d.id));
    const created = (await loadCreatedDashIds(c.host, c.email)).filter((id) => existing.has(id));
    if (this.client !== client) return;
    this.createdDashIds = created;
    for (const id of created) client.allowEditing(id);
    this.store.load(profile);
    this.retryAttempt = 0;
    this.setState({ status: 'online', error: undefined, profile, editableDashIds: this.editableFor(profile) });
    void syncGps(profile, c.host);
    // Sincronizzazione delle dashboard attive (APP_SYNC). Il server rimanda lo stato di ogni widget,
    // compresa la cronologia dei Terminal, che non è nel profilo.
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
   * Riconnessione rifiutata (password cambiata dal pannello admin, utente cancellato, IP bloccato): si torna al
   * login con il motivo e si dimentica la password salvata, così nemmeno l'accesso automatico ritenta.
   */
  private loginRejected(e: unknown): void {
    this.clearRetry();
    this.credentials = null;
    this.createdDashIds = [];
    this.setState({ status: 'error', error: `${t.sessionEnded}. ${describeError(e)}`, profile: undefined, editableDashIds: [] });
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

  showNotice = (text: string): void => {
    if (this.noticeTimer) clearTimeout(this.noticeTimer);
    this.setState({ notice: text });
    this.noticeTimer = setTimeout(() => this.setState({ notice: undefined }), NOTICE_MS);
  };

  /** Chiusura voluta: azzerare this.client prima di close() evita che parta la riconnessione. */
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
