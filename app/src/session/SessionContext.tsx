// Collega il SessionManager a React: stato osservato con useSyncExternalStore e
// pausa/ripresa della connessione in base allo stato dell'app (primo piano / background).
import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AppState } from 'react-native';
import type { Credentials } from './credentials';
import type { LiveStore } from './liveStore';
import { SessionManager, type SessionState } from './SessionManager';

export type { SessionStatus } from './SessionManager';

interface SessionValue extends SessionState {
  store: LiveStore;
  login(c: Credentials, rememberPassword: boolean): Promise<boolean>;
  logout(): Promise<void>;
  writePin(dashId: number, deviceId: number, pin: number, values: string[]): boolean;
}

const SessionContext = createContext<SessionManager | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [manager] = useState(() => new SessionManager());

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') manager.pause();
      else if (state === 'active') manager.resume();
    });
    return () => {
      sub.remove();
      manager.dispose();
    };
  }, [manager]);

  return <SessionContext.Provider value={manager}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const manager = useContext(SessionContext);
  if (!manager) throw new Error('useSession va usato dentro <SessionProvider>');
  const state = useSyncExternalStore(manager.subscribe, manager.getState);
  return {
    ...state,
    store: manager.store,
    login: manager.login,
    logout: manager.logout,
    writePin: manager.writePin,
  };
}
