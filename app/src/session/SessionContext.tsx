// Collega il SessionManager a React: stato osservato con useSyncExternalStore e
// pausa/ripresa della connessione in base allo stato dell'app (primo piano / background).
import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AppState } from 'react-native';
import type { GraphData, GraphPeriod } from '@tinkerblink/protocol';
import type { Widget } from '@/model/profile';
import type { Credentials } from './credentials';
import type { SensorsWorker } from '@/sensors/sensorsWorker';
import type { LiveStore } from './liveStore';
import { SessionManager, type SessionState } from './SessionManager';

export type { SessionStatus } from './SessionManager';

interface SessionValue extends SessionState {
  store: LiveStore;
  sensors: SensorsWorker;
  login(c: Credentials, rememberPassword: boolean): Promise<boolean>;
  logout(): Promise<void>;
  writePin(dashId: number, deviceId: number, pin: number, values: string[]): boolean;
  getGraphData(req: { dashId: number; widgetId: number; period: GraphPeriod; page?: number }): Promise<GraphData | null>;
  updateWidget(dashId: number, widget: Widget): Promise<void>;
  createWidget(dashId: number, widget: Widget): Promise<void>;
  deleteWidget(dashId: number, widgetId: number): Promise<void>;
  getEnergy(): Promise<number>;
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
    sensors: manager.sensors,
    login: manager.login,
    logout: manager.logout,
    writePin: manager.writePin,
    getGraphData: manager.getGraphData,
    updateWidget: manager.updateWidget,
    createWidget: manager.createWidget,
    deleteWidget: manager.deleteWidget,
    getEnergy: manager.getEnergy,
  };
}
