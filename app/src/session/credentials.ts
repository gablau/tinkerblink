// Credenziali: su Android nel keystore (expo-secure-store); sul web SecureStore non esiste,
// quindi si ricordano solo server ed email e la password non viene mai salvata.
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export interface Credentials {
  host: string;
  email: string;
  password: string;
}

/** Nessun server predefinito: l'utente scrive il suo. HOST_EXAMPLE è il segnaposto del campo. */
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
    // Non salvare le credenziali non è un errore bloccante.
  }
}

/** Al logout si dimentica la password ma si tengono server ed email. */
export async function forgetPassword(): Promise<void> {
  const current = await loadCredentials();
  if (!current) return;
  try {
    const kept = JSON.stringify({ host: current.host, email: current.email });
    if (Platform.OS === 'web') globalThis.localStorage?.setItem(KEY, kept);
    else await SecureStore.setItemAsync(KEY, kept);
  } catch {
    // ignorato
  }
}

/** "example.com" → "wss://example.com/dashws"; un URL completo viene usato così com'è. */
export function serverUrl(host: string): string {
  const h = host.trim();
  return h.includes('://') ? h : `wss://${h}/dashws`;
}
