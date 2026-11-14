// Locks dashboard scrolling while a control is being dragged (slider, zeRGBa palette).
// On Android the native ScrollView can take over the gesture even when the JS component refuses it: the only
// reliable way is to disable it while the finger is on the control.
import { createContext, useContext } from 'react';

export const ScrollLockContext = createContext<(locked: boolean) => void>(() => {});

/** Locks (true) or unlocks (false) dashboard scrolling. */
export function useScrollLock(): (locked: boolean) => void {
  return useContext(ScrollLockContext);
}
