// Pin già usati nella dashboard: per ogni pin dello stesso device,
// i widget che lo usano (widget a un pin, widget a più pin come LCD / Joystick / RGB, stream dei SuperChart).
// "USED" = usato da un altro widget (si può scegliere comunque); "BUSY" = usato da un altro pin dello stesso
// widget (non si può scegliere).
import type { Dashboard, PinType, Widget } from '@/model/profile';
import { pinKeyOf } from './boards/boards';

interface PinRef {
  pin?: number;
  pinType?: PinType;
}

const valid = (p: PinRef | undefined): p is { pin: number; pinType: PinType } =>
  p !== undefined && typeof p.pin === 'number' && p.pin >= 0 && typeof p.pinType === 'string';

/** Pin di un widget con il device a cui puntano. */
export function widgetPins(w: Widget): { deviceId: number; pin: number; pinType: PinType }[] {
  const out: { deviceId: number; pin: number; pinType: PinType }[] = [];
  const dev = w.deviceId ?? 0;
  if (valid(w)) out.push({ deviceId: dev, pin: w.pin, pinType: w.pinType });
  if (Array.isArray(w.pins)) for (const p of w.pins as PinRef[]) if (valid(p)) out.push({ deviceId: dev, pin: p.pin, pinType: p.pinType });
  if (Array.isArray(w.dataStreams)) {
    for (const s of w.dataStreams as { targetId?: number; pin?: PinRef }[]) {
      if (valid(s.pin)) out.push({ deviceId: s.targetId ?? 0, pin: s.pin.pin, pinType: s.pin.pinType });
    }
  }
  return out;
}

/** "SEGMENTED_CONTROL" → "Segmented Control" (widget senza titolo). */
export function typeLabel(type: string): string {
  return type.toLowerCase().split('_').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
}

/** Pin del device usati dagli altri widget: chiave "TIPO:indice" → titoli (o tipi) dei widget. */
export function usedPins(dash: Dashboard, widget: Widget, deviceId: number): Map<string, string[]> {
  const used = new Map<string, string[]>();
  for (const w of dash.widgets) {
    if (w.id === widget.id) continue;
    const name = w.label && w.label !== '' ? w.label : typeLabel(w.type);
    for (const p of widgetPins(w)) {
      if (p.deviceId !== deviceId) continue;
      const key = pinKeyOf(p.pinType, p.pin);
      const list = used.get(key) ?? [];
      if (!list.includes(name)) list.push(name);
      used.set(key, list);
    }
  }
  return used;
}
