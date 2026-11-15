// Projects pinned to the top of the list, in their order, per account (AsyncStorage: only on this phone, the server
// has no place for it). Ids of projects that no longer exist are dropped when the list is shown.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

type Account = { host: string; email: string };

const storageKey = (a: Account) => `projects.pinned:${a.host.trim().toLowerCase()}|${a.email.trim().toLowerCase()}`;

async function loadPinned(a: Account): Promise<number[]> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(a));
    const ids: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(ids) ? ids.filter((id): id is number => Number.isInteger(id)) : [];
  } catch {
    return [];
  }
}

async function savePinned(a: Account, ids: readonly number[]): Promise<void> {
  try {
    await AsyncStorage.setItem(storageKey(a), JSON.stringify(ids));
  } catch {
    // Only a convenience: the order stays until the app is closed.
  }
}

/** Pinned project ids (in order) and a setter that also saves them; undefined until loaded. */
export function usePinnedProjects(account: Account | undefined): [number[] | undefined, (ids: number[]) => void] {
  const [ids, setIds] = useState<number[]>();
  const host = account?.host;
  const email = account?.email;
  useEffect(() => {
    if (host === undefined || email === undefined) return;
    let live = true;
    void loadPinned({ host, email }).then((loaded) => {
      if (live) setIds(loaded);
    });
    return () => {
      live = false;
    };
  }, [host, email]);
  const update = useCallback(
    (next: number[]) => {
      setIds(next);
      if (host !== undefined && email !== undefined) void savePinned({ host, email }, next);
    },
    [host, email],
  );
  return [ids, update];
}
