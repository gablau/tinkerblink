// Blocco dello scorrimento della dashboard mentre si trascina un controllo (slider, tavolozza zeRGBa).
// Su Android la ScrollView nativa può prendersi il gesto anche se il componente JS lo rifiuta: l'unico modo
// affidabile è disattivarla finché il dito è appoggiato sul controllo.
import { createContext, useContext } from 'react';

export const ScrollLockContext = createContext<(locked: boolean) => void>(() => {});

/** Funzione per bloccare (true) o sbloccare (false) lo scorrimento della dashboard. */
export function useScrollLock(): (locked: boolean) => void {
  return useContext(ScrollLockContext);
}
