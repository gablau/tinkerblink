// Credentials: on Android in the keystore (expo-secure-store); on the web there is no SecureStore,
// so only server and email are remembered and the password is never stored.
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export interface Credentials {
  host: string;
  email: string;
  password: string;
}

/** No default server: users type their own. HOST_EXAMPLE is the field placeholder. */
export const DEFAULT_HOST = '';
export const HOST_EXAMPLE = 'myserver.example.com:9443';
const KEY = 'blynk.credentials';

export async function loadCredentials(): Promise<Partial<Credentials> | null> {
  try {
    const raw = Platform.OS === 'web' ? globalThis.localStorage?.getItem(KEY) : await SecureStore.getItemAsync(KEY);
    return raw ? (JSON.parse(raw) as Partial<Credentials>) : null;
  } catch {
    return null;
  }
}

export async function saveCredentials(c: Credentials, rememberPassword: boolean): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.setItem(KEY, JSON.stringify({ host: c.host, email: c.email }));
    } else {
      const stored: Partial<Credentials> = rememberPassword ? c : { host: c.host, email: c.email };
      await SecureStore.setItemAsync(KEY, JSON.stringify(stored));
    }
  } catch {
    // Failing to save the credentials is not a blocking error.
  }
}

/** On logout the password is forgotten, but server and email are kept. */
export async function forgetPassword(): Promise<void> {
  const current = await loadCredentials();
  if (!current) return;
  try {
    const kept = JSON.stringify({ host: current.host, email: current.email });
    if (Platform.OS === 'web') globalThis.localStorage?.setItem(KEY, kept);
    else await SecureStore.setItemAsync(KEY, kept);
  } catch {
    // ignored
  }
}

/** "example.com" → "wss://example.com/dashws"; a full URL is used as is. */
export function serverUrl(host: string): string {
  const h = host.trim();
  return h.includes('://') ? h : `wss://${h}/dashws`;
}

/** Host and port of the server (default 443 for wss/https, 80 otherwise), for the certificate check. */
export function serverAddress(host: string): { host: string; port: number; secure: boolean } | null {
  const m = serverUrl(host).match(/^([a-z]+):\/\/(\[[^\]]+\]|[^/:?#]+)(?::(\d+))?/i);
  if (!m) return null;
  const secure = /^(wss|https)$/i.test(m[1]!);
  return { host: m[2]!.replace(/^\[|\]$/g, ''), port: m[3] ? Number(m[3]) : secure ? 443 : 80, secure };
}
