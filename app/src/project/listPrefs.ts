// Preferences of the project list, per account, saved only on this phone (AsyncStorage: the server has no place for
// them): the projects pinned to the top, in their order, and the hidden ones. Ids of projects that no longer exist
// are ignored when the list is shown and dropped at the next change.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

type Account = { host: string; email: string };
export type ProjectIdList = 'pinned' | 'hidden';

const storageKey = (list: ProjectIdList, a: Account) => `projects.${list}:${a.host.trim().toLowerCase()}|${a.email.trim().toLowerCase()}`;

async function loadIds(list: ProjectIdList, a: Account): Promise<number[]> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(list, a));
    const ids: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(ids) ? ids.filter((id): id is number => Number.isInteger(id)) : [];
  } catch {
    return [];
  }
}

async function saveIds(list: ProjectIdList, a: Account, ids: readonly number[]): Promise<void> {
  try {
    await AsyncStorage.setItem(storageKey(list, a), JSON.stringify(ids));
  } catch {
    // Only a convenience: the change stays until the app is closed.
  }
}

/** Project ids of the list (in order) and a setter that also saves them; undefined until loaded. */
export function useProjectIds(list: ProjectIdList, account: Account | undefined): [number[] | undefined, (ids: number[]) => void] {
  const [ids, setIds] = useState<number[]>();
  const host = account?.host;
  const email = account?.email;
  useEffect(() => {
    if (host === undefined || email === undefined) return;
    let live = true;
    void loadIds(list, { host, email }).then((loaded) => {
      if (live) setIds(loaded);
    });
    return () => {
      live = false;
    };
  }, [list, host, email]);
  const update = useCallback(
    (next: number[]) => {
      setIds(next);
      if (host !== undefined && email !== undefined) void saveIds(list, { host, email }, next);
    },
    [list, host, email],
  );
  return [ids, update];
}
