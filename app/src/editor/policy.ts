// Dashboard modificabili con l'editor: quelle ammesse in EDITABLE_DASH_IDS.
// Lo stesso elenco arriva al LegacyClient (editableDashIds), che rifiuta i comandi di modifica sulle altre:
// anche un errore dell'interfaccia non può toccare gli altri progetti.
export const EDITABLE_DASH_IDS: readonly number[] = [];

export function isEditableDash(dashId: number): boolean {
  return EDITABLE_DASH_IDS.includes(dashId);
}
