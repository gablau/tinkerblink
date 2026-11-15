// Last project opened, per account (AsyncStorage): at the next start the app opens it straight after the login,
// as if the user had never left it. Going back to the project list forgets it, so the app reopens where it was left.
import AsyncStorage from '@react-native-async-storage/async-storage';

type Account = { host: string; email: string };

const storageKey = (a: Account) => `session.lastDashId:${a.host.trim().toLowerCase()}|${a.email.trim().toLowerCase()}`;

/** Id of the project open when the app was closed, or undefined. */
export async function loadLastDash(a: Account): Promise<number | undefined> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(a));
    const id = raw === null ? NaN : Number(raw);
    return Number.isInteger(id) ? id : undefined;
  } catch {
    return undefined;
  }
}

export async function saveLastDash(a: Account, dashId: number | undefined): Promise<void> {
  try {
    if (dashId === undefined) await AsyncStorage.removeItem(storageKey(a));
    else await AsyncStorage.setItem(storageKey(a), String(dashId));
  } catch {
    // Only a convenience: at the next start the project list is shown.
  }
}
