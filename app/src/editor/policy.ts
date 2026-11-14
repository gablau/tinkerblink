// Dashboards editable with the editor: all of the user's own projects, never those assigned by other users
// (servers with shared projects), which the server would reject. Projects created by this app are also
// remembered per account in AsyncStorage, so they stay editable before the profile contains them.
// The list goes to the LegacyClient (editableDashIds / allowEditing), which rejects edit commands on the others.
import AsyncStorage from '@react-native-async-storage/async-storage';

export function isEditableDash(dashId: number, editable: readonly number[]): boolean {
  return editable.includes(dashId);
}

const storageKey = (host: string, email: string) => `editor.createdDashIds:${host.trim().toLowerCase()}|${email.trim().toLowerCase()}`;

/** Projects created by the app with this account (empty if AsyncStorage does not answer). */
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
    // Only a convenience: at the next start the project will stay visible but not editable.
  }
}
