// Pins of multi-pin widgets (Joystick, RGB, LCD,
// MultiPinWidget on the server):
// - SPLIT / MERGE switch (LCD: SIMPLE / ADVANCED);
// - separate pins: one button per position; the pins of the other positions are BUSY (not selectable);
// - single pin: one button and the same pin written in every position of the `pins` array;
// - each position has its own min–max range (also with a single pin, except the advanced LCD).
import { StyleSheet, Text, View } from 'react-native';
import type { Dashboard, PinType, Widget } from '@/model/profile';
import { pinKeyOf, pinsForWidget } from './boards/boards';
import { ChoiceField, DeviceField, PinButton, RangeField, type ControlTheme } from './controls';
import type { MultiPinConfig } from './fields';
import { usedPins } from './pinUsage';
import { FONT } from '@/ui/fonts';

interface DataStream {
  pin?: number;
  pinType?: PinType;
  min?: number;
  max?: number;
  pwmMode?: boolean;
  rangeMappingOn?: boolean;
  value?: string;
  [key: string]: unknown;
}

const EMPTY: DataStream = { pin: -1, pwmMode: false, rangeMappingOn: false, min: 0, max: 255 };

function slotsOf(w: Widget, count: number): DataStream[] {
  const pins = Array.isArray(w.pins) ? (w.pins as DataStream[]) : [];
  return Array.from({ length: count }, (_, i) => ({ ...EMPTY, ...pins[i] }));
}

/** Sets the pin of a position; pinType null = no pin (field removed, like a new widget). */
function withPin(s: DataStream, pinType: PinType | null, pin: number): DataStream {
  const next: DataStream = { ...s, pin };
  if (pinType) next.pinType = pinType;
  else delete next.pinType;
  return next;
}

const hasPin = (s: DataStream) => typeof s.pin === 'number' && s.pin >= 0 && typeof s.pinType === 'string';

export function MultiPinField({
  config,
  widget,
  draft,
  setDraft,
  dash,
  ct,
}: {
  config: MultiPinConfig;
  /** Widget being edited (to exclude it when computing the used pins). */
  widget: Widget;
  draft: Widget;
  setDraft: (update: (d: Widget) => Widget) => void;
  dash: Dashboard;
  ct: ControlTheme;
}) {
  const n = config.slots.length;
  const slots = slotsOf(draft, n);
  const split = config.mode ? (draft[config.mode.key] === true) === config.mode.splitWhen : true;
  const deviceId = draft.deviceId ?? 0;
  const board = dash.devices?.find((d) => d.id === deviceId)?.boardType;
  const allPins = pinsForWidget(widget.type, board);
  const mergedPins = config.mergedVirtualOnly ? allPins.filter((p) => p.type === 'VIRTUAL') : allPins;
  const used = usedPins(dash, widget, deviceId);
  const colors: Record<string, string> = { x: ct.theme.accent, y: ct.theme.joystickY, r: ct.theme.rgbRed, g: ct.theme.rgbGreen, b: ct.theme.rgbBlue };

  const setSlots = (update: (s: DataStream[]) => DataStream[]) => setDraft((d) => ({ ...d, pins: update(slotsOf(d, n)) }));

  const setMode = (toSplit: boolean) => {
    if (!config.mode) return;
    const key = config.mode.key;
    setDraft((d) => {
      const cur = slotsOf(d, n);
      const first = cur[0]!;
      const pins = toSplit
        ? // From single pin to separate pins: the first position keeps the pin, the others (equal) are cleared.
          cur.map((s, i) => (i === 0 || !hasPin(s) || pinKeyOf(s.pinType!, s.pin!) !== pinKeyOf(first.pinType ?? 'VIRTUAL', first.pin ?? -1) ? s : withPin(s, null, -1)))
        : cur.map((s) => (hasPin(first) ? withPin(s, first.pinType!, first.pin!) : withPin(s, null, -1)));
      return { ...d, [key]: toSplit === config.mode!.splitWhen, pins };
    });
  };

  const range = (i: number) => (
    <View key={`r${i}`} style={styles.rangeRow}>
      <Text style={[styles.slotLabel, { color: colors[config.slots[i]!.color ?? ''] ?? ct.theme.text }]}>{config.slots[i]!.label}</Text>
      <RangeField
        min={slots[i]!.min}
        max={slots[i]!.max}
        onChange={(v) => setSlots((s) => s.map((x, j) => (j === i ? { ...x, ...v } : x)))}
        ct={ct}
      />
    </View>
  );

  return (
    <View style={styles.box}>
      <DeviceField deviceId={deviceId} devices={dash.devices ?? []} onChange={(id) => setDraft((d) => ({ ...d, deviceId: id }))} ct={ct} />
      {config.mode && (
        <ChoiceField
          title={config.mode.labels.join(' / ')}
          value={split}
          options={[
            { value: true, label: config.mode.labels[0] },
            { value: false, label: config.mode.labels[1] },
          ]}
          onChange={(v) => setMode(v === true)}
          ct={ct}
        />
      )}
      {split ? (
        slots.map((s, i) => {
          // Pins of the other positions of the same widget: BUSY.
          const busy = new Set(slots.filter((o, j) => j !== i && hasPin(o)).map((o) => pinKeyOf(o.pinType!, o.pin!)));
          const color = colors[config.slots[i]!.color ?? ''];
          return (
            <View key={i} style={styles.slot}>
              <PinButton
                prefix={config.slots[i]!.label}
                color={color}
                pinType={s.pinType}
                pin={s.pin}
                pins={allPins}
                used={used}
                busy={busy}
                onChange={({ pinType, pin }) => setSlots((all) => all.map((x, j) => (j === i ? withPin(x, pinType, pin) : x)))}
                ct={ct}
              />
              <RangeField
                min={s.min}
                max={s.max}
                onChange={(v) => setSlots((all) => all.map((x, j) => (j === i ? { ...x, ...v } : x)))}
                ct={ct}
              />
            </View>
          );
        })
      ) : (
        <>
          <PinButton
            pinType={slots[0]!.pinType}
            pin={slots[0]!.pin}
            pins={mergedPins}
            used={used}
            onChange={({ pinType, pin }) => setSlots((all) => all.map((x) => withPin(x, pinType, pin)))}
            ct={ct}
          />
          {config.rangeInMerge && slots.map((_, i) => range(i))}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 12 },
  slot: { gap: 8 },
  rangeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  slotLabel: { width: 28, fontSize: 14, fontFamily: FONT.medium },
});
