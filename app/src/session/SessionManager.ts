// Sessione con il server: una sola connessione WebSocket (wss://<host>/dashws) per tutta l'app.
// Classe normale (fuori da React): il contesto React ne osserva solo lo stato.
//
// - In background la connessione si chiude (pause): il server smette di interrogare i device e invia
//   "adis" ai flussi Node-RED. Al ritorno in primo piano (resume) si riconnette e ricarica il
//   profilo, che contiene già l'ultimo valore di ogni widget.
// - Se la connessione cade mentre l'app è attiva, si riprova con attese crescenti.
import { LegacyClient, ProtocolError, ResponseCode, WebSocketTransport } from '@tinkerblink/protocol';
import { t } from '@/i18n';
import type { Profile } from '@/model/profile';
import { forgetPassword, saveCredentials, serverUrl, type Credentials } from './credentials';
import { LiveStore } from './liveStore';

export type SessionStatus = 'idle' | 'connecting' | 'online' | 'reconnecting' | 'paused' | 'error';

export interface SessionState {
  status: SessionStatus;
  error?: string;
  profile?: Profile;
}

const RETRY_DELAYS_MS = [2000, 5000, 10000, 30000];

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
  private state: SessionState = { status: 'idle' };
  private listeners = new Set<() => void>();
  private client: LegacyClient | null = null;
  private credentials: Credentials | null = null;
  private active = true;
  private retryAttempt = 0;
  private retryTimer?: ReturnType<typeof setTimeout>;

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
    await forgetPassword();
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
    this.listeners.clear();
  }

  private async open(c: Credentials): Promise<void> {
    this.closeClient();
    const client = new LegacyClient(new WebSocketTransport(serverUrl(c.host)), { readOnly: true });
    this.client = client;
    client.onMessage((m) => this.store.apply(m));
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

  /** Chiusura voluta: azzerare this.client prima di close() evita che parta la riconnessione. */
  private closeClient(): void {
    const c = this.client;
    this.client = null;
    c?.close();
  }

  private setState(patch: Partial<SessionState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }
}
