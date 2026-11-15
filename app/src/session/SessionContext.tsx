// Connects the SessionManager to React: state observed with useSyncExternalStore, and the connection
// paused/resumed following the app state (foreground / background).
import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AppState } from 'react-native';
import type { DashSettings, GraphData, GraphPeriod } from '@tinkerblink/protocol';
import type { Device, Widget } from '@/model/profile';
import type { Credentials } from './credentials';
import type { SensorsWorker } from '@/sensors/sensorsWorker';
import type { LiveStore } from './liveStore';
import { SessionManager, type NewDevice, type NewProject, type SessionState } from './SessionManager';

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
  createProject(p: NewProject): Promise<number>;
  updateDashSettings(dashId: number, patch: Partial<DashSettings>): Promise<void>;
  setDashActive(dashId: number, active: boolean): Promise<boolean>;
  deleteDash(dashId: number): Promise<void>;
  createDevice(dashId: number, d: NewDevice): Promise<Device>;
  updateDevice(dashId: number, device: Device): Promise<void>;
  deleteDevice(dashId: number, deviceId: number): Promise<void>;
  /** Temporary notice at the bottom (NoticeToast). */
  showNotice(text: string): void;
  dismissError(): void;
  selectCertificateHost(host: string): void;
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
  if (!manager) throw new Error('useSession must be used inside <SessionProvider>');
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
    createProject: manager.createProject,
    updateDashSettings: manager.updateDashSettings,
    setDashActive: manager.setDashActive,
    deleteDash: manager.deleteDash,
    createDevice: manager.createDevice,
    updateDevice: manager.updateDevice,
    deleteDevice: manager.deleteDevice,
    showNotice: manager.showNotice,
    dismissError: manager.dismissError,
    selectCertificateHost: manager.selectCertificateHost,
  };
}
