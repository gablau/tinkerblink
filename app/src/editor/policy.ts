// Dashboard modificabili con l'editor: tutti i progetti dell'utente, mai quelli assegnati da altri utenti
// (server con i progetti condivisi), che il server rifiuterebbe. I progetti creati da questa app si ricordano
// anche per account in AsyncStorage, così restano modificabili prima che il profilo li contenga.
// L'elenco arriva al LegacyClient (editableDashIds / allowEditing), che rifiuta i comandi di modifica sulle altre.
import AsyncStorage from '@react-native-async-storage/async-storage';

export function isEditableDash(dashId: number, editable: readonly number[]): boolean {
  return editable.includes(dashId);
}

const storageKey = (host: string, email: string) => `editor.createdDashIds:${host.trim().toLowerCase()}|${email.trim().toLowerCase()}`;

/** Progetti creati dall'app con questo account (vuoto se AsyncStorage non risponde). */
export async function loadCreatedDashIds(host: string, email: string): Promise<number[]> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(host, email));
    const ids: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(ids) ? ids.filter((id): id is number => typeof id === 'number') : [];
  } catch {
    return [];
  }
}

export async function saveCreatedDashIds(host: string, email: string, ids: readonly number[]): Promise<void> {
  try {
    await AsyncStorage.setItem(storageKey(host, email), JSON.stringify(ids));
  } catch {
    // Solo una comodità: al prossimo avvio il progetto resterà visibile ma non modificabile.
  }
}
