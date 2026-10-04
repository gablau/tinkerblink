// Sessione con il server: una sola connessione WebSocket (wss://<host>/dashws) per tutta l'app.
// Classe normale (fuori da React): il contesto React ne osserva solo lo stato.
//
// - In background la connessione si chiude (pause): il server smette di interrogare i device e invia
//   "adis" ai flussi Node-RED. Al ritorno in primo piano (resume) si riconnette e ricarica il
//   profilo, che contiene già l'ultimo valore di ogni widget.
// - Se la connessione cade mentre l'app è attiva, si riprova con attese crescenti.
// - Il client è in sola lettura tranne le scritture sui pin (HARDWARE): l'app comanda i device ma non
//   può modificare i progetti.
import { LegacyClient, ProtocolError, ResponseCode, WebSocketTransport, type GraphData, type GraphPeriod } from '@tinkerblink/protocol';
import { t } from '@/i18n';
import { pinKey, type Profile, type Widget } from '@/model/profile';
import { EDITABLE_DASH_IDS } from '@/editor/policy';
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
}

const RETRY_DELAYS_MS = [2000, 5000, 10000, 30000];
const NOTICE_MS = 3000;
/** Il server segnala gli errori di scrittura subito: oltre questo tempo il msgId non serve più. */
const WRITE_ERROR_WINDOW_MS = 5000;

function describeError(e: unknown): string {
  if (e instanceof ProtocolError) {
    if (e.code === ResponseCode.USER_NOT_AUTHENTICATED || e.code === ResponseCode.USER_NOT_REGISTERED) {
      return t.wrongCredentials;
    }
    return e.message;
  }
  if (e instanceof Error) return e.message;
  return String(e);
}

export class SessionManager {
  readonly store = new LiveStore();
  /** Sensori del telefono: attivi solo mentre la sessione è online. */
  readonly sensors = new SensorsWorker((dashId, deviceId, pin, values) => this.writeSensor(dashId, deviceId, pin, values));
  private state: SessionState = { status: 'idle' };
  private listeners = new Set<() => void>();
  private client: LegacyClient | null = null;
  private credentials: Credentials | null = null;
  private active = true;
  private retryAttempt = 0;
  private retryTimer?: ReturnType<typeof setTimeout>;
  private noticeTimer?: ReturnType<typeof setTimeout>;
  /** msgId delle scritture inviate di recente, per riconoscere gli errori che le riguardano. */
  private pendingWrites = new Set<number>();

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
    this.setState({ status: 'idle', error: undefined, profile: undefined });
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
    const msgId = client.writePin(dashId, deviceId, pin, values);
    this.pendingWrites.add(msgId);
    setTimeout(() => this.pendingWrites.delete(msgId), WRITE_ERROR_WINDOW_MS);
    this.store.setLocal(pinKey(dashId, deviceId, 'VIRTUAL', pin), values);
    return true;
  };

  /** Scrittura dei sensori: niente avvisi (device offline, non connessi), arrivano di continuo. */
  private writeSensor(dashId: number, deviceId: number, pin: number, values: string[]): void {
    const client = this.client;
    if (!client || this.state.status !== 'online') return;
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

  private requireOnline(): LegacyClient {
    const client = this.client;
    if (!client || !this.state.profile || this.state.status !== 'online') throw new Error(t.notConnected);
    return client;
  }

  private patchDash(dashId: number, update: (widgets: Widget[]) => Widget[]): void {
    const profile = this.state.profile;
    if (!profile) return;
    this.setState({
      profile: { ...profile, dashBoards: profile.dashBoards.map((d) => (d.id === dashId ? { ...d, widgets: update(d.widgets) } : d)) },
    });
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
      editableDashIds: EDITABLE_DASH_IDS,
    });
    this.client = client;
    client.onMessage((m) => {
      if (m.kind === 'response') {
        if (this.pendingWrites.delete(m.msgId) && m.code === ResponseCode.DEVICE_NOT_IN_NETWORK) {
          this.showNotice(t.deviceOffline);
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
    const profile = (await client.loadProfile()) as Profile;
    if (this.client !== client) return;
    this.store.load(profile);
    this.retryAttempt = 0;
    this.setState({ status: 'online', error: undefined, profile });
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
      this.setState({ error: describeError(e) });
      this.scheduleReconnect();
    });
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

  private showNotice(text: string): void {
    if (this.noticeTimer) clearTimeout(this.noticeTimer);
    this.setState({ notice: text });
    this.noticeTimer = setTimeout(() => this.setState({ notice: undefined }), NOTICE_MS);
  }

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
