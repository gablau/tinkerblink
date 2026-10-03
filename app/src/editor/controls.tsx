// Controlli del modulo dell'editor, nello stile scuro/chiaro del tema della dashboard.
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import type { Device, PinType } from '@/model/profile';
import type { DashboardTheme } from '@/ui/dashboardTheme';
import { FONT } from '@/ui/fonts';
import { MenuPicker } from '@/widgets/pickers';
import { withAlpha } from '@/widgets/color';
import { cssToRgba, GRADIENTS, palette, rgbaToHex } from './colors';
import { pinKeyOf, type BoardPin } from './boards/boards';
import type { Option } from './fields';
import { PinPicker } from './PinPicker';
import { te } from './strings';

export interface ControlTheme {
  theme: DashboardTheme;
  accent: string;
}

function fieldBg(theme: DashboardTheme): string {
  return theme.light ? '#EEF1F3' : '#2C2D32';
}

export function Row({ label, ct, children, column }: { label: string; ct: ControlTheme; children: ReactNode; column?: boolean }) {
  return (
    <View style={[styles.row, column && styles.rowColumn]}>
      <Text style={[styles.label, { color: ct.theme.text }]}>{label.toUpperCase()}</Text>
      <View style={column ? undefined : styles.rowControl}>{children}</View>
    </View>
  );
}

export function TextField({
  value,
  onChange,
  ct,
  placeholder,
  secret,
  multiline,
}: {
  value: string;
  onChange: (v: string) => void;
  ct: ControlTheme;
  placeholder?: string;
  /** Testo nascosto (URL con credenziali): si vede solo tenendo premuto l'occhio. */
  secret?: boolean;
  multiline?: boolean;
}) {
  const [shown, setShown] = useState(false);
  const input = (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={withAlpha(ct.theme.text, 0.35)}
      style={[styles.input, { color: ct.theme.text, backgroundColor: fieldBg(ct.theme) }, multiline && styles.multiline, secret && { flex: 1 }]}
      autoCorrect={false}
      autoCapitalize={secret ? 'none' : undefined}
      secureTextEntry={secret && !shown}
      multiline={multiline}
    />
  );
  if (!secret) return input;
  return (
    <View style={styles.secretRow}>
      {input}
      <Pressable onPressIn={() => setShown(true)} onPressOut={() => setShown(false)} hitSlop={8}>
        <MaterialCommunityIcons name={shown ? 'eye-off' : 'eye'} size={22} color={ct.theme.text} />
      </Pressable>
    </View>
  );
}

/** Numero modificabile come testo: il valore cambia solo quando il testo è un numero valido. */
export function NumberField({
  value,
  onChange,
  ct,
  integer,
  width,
}: {
  value: number | undefined;
  onChange: (v: number) => void;
  ct: ControlTheme;
  integer?: boolean;
  width?: number;
}) {
  const [text, setText] = useState(value === undefined ? '' : String(value));
  const parse = (s: string) => (integer ? Number.parseInt(s, 10) : Number.parseFloat(s.replace(',', '.')));
  const valid = text.trim() !== '' && Number.isFinite(parse(text));
  return (
    <TextInput
      value={text}
      onChangeText={(s) => {
        setText(s);
        const n = parse(s);
        if (s.trim() !== '' && Number.isFinite(n)) onChange(n);
      }}
      keyboardType={integer ? 'number-pad' : 'numbers-and-punctuation'}
      style={[
        styles.input,
        { color: ct.theme.text, backgroundColor: fieldBg(ct.theme), width: width ?? 110, minWidth: 0, textAlign: 'right' },
        !valid && { borderColor: '#D3435C', borderWidth: 1 },
      ]}
    />
  );
}

export function BoolField({ value, onChange, ct }: { value: boolean; onChange: (v: boolean) => void; ct: ControlTheme }) {
  return <Switch value={value} onValueChange={onChange} trackColor={{ true: ct.accent }} thumbColor={value ? '#FFFFFF' : undefined} />;
}

/** Pochi valori: pulsanti affiancati; tanti: elenco a comparsa. */
export function ChoiceField({ value, options, onChange, ct, title }: { value: unknown; options: Option[]; onChange: (v: Option['value']) => void; ct: ControlTheme; title: string }) {
  const [open, setOpen] = useState(false);
  if (options.length <= 4) {
    return (
      <View style={[styles.segments, { borderColor: ct.accent }]}>
        {options.map((o, i) => {
          const active = o.value === value;
          return (
            <Pressable key={i} onPress={() => onChange(o.value)} style={[styles.segment, active && { backgroundColor: ct.accent }]}>
              <Text style={[styles.segmentText, { color: active ? ct.theme.background : ct.theme.text }]} numberOfLines={1}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  }
  const index = options.findIndex((o) => o.value === value);
  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={[styles.picker, { backgroundColor: fieldBg(ct.theme) }]}>
        <Text style={[styles.pickerText, { color: ct.theme.text }]}>{index >= 0 ? options[index]!.label : '—'}</Text>
        <MaterialCommunityIcons name="menu-down" size={20} color={ct.theme.text} />
      </Pressable>
      <MenuPicker
        visible={open}
        title={title}
        labels={options.map((o) => o.label)}
        selected={index + 1}
        theme={ct.theme}
        accent={ct.accent}
        onSelect={(i) => {
          setOpen(false);
          onChange(options[i - 1]!.value);
        }}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

function GradientSwatch({ stops, size }: { stops: string[]; size: number }) {
  const id = `g${stops.join('').replace(/#/g, '')}`;
  return (
    <Svg width={size} height={size}>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          {stops.map((c, i) => (
            <Stop key={i} offset={i / (stops.length - 1)} stopColor={c} />
          ))}
        </LinearGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
    </Svg>
  );
}

export function ColorField({ value, onChange, ct, gradients }: { value: unknown; onChange: (v: number) => void; ct: ControlTheme; gradients: boolean }) {
  const current = typeof value === 'number' ? value : undefined;
  const hex = current !== undefined && !GRADIENTS.includes(current) ? rgbaToHex(current) : undefined;
  const size = 34;
  const ring = (active: boolean, child: ReactNode, key: string | number, onPress: () => void) => (
    <Pressable key={key} onPress={onPress} style={[styles.swatchRing, { borderColor: active ? ct.theme.text : 'transparent' }]}>
      {child}
    </Pressable>
  );
  const stops = [ct.theme.warm, [...ct.theme.warm].reverse(), ct.theme.cold, [...ct.theme.cold].reverse()];
  return (
    <View style={styles.swatches}>
      {palette(ct.theme).map((c) =>
        ring(hex === c.toUpperCase(), <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c }} />, c, () => onChange(cssToRgba(c))),
      )}
      {gradients && GRADIENTS.map((g, i) => ring(current === g, <GradientSwatch stops={stops[i]!} size={size} />, g, () => onChange(g)))}
      {/* Un colore personalizzato fuori tavolozza resta visibile e selezionato. */}
      {hex && !palette(ct.theme).some((c) => c.toUpperCase() === hex) &&
        ring(true, <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: hex }} />, 'custom', () => {})}
    </View>
  );
}

/** Scelta del device del widget (solo se la dashboard ne ha più di uno). */
export function DeviceField({ deviceId, devices, onChange, ct }: { deviceId: number; devices: Device[]; onChange: (id: number) => void; ct: ControlTheme }) {
  if (devices.length <= 1) return null;
  return <ChoiceField title={te.device} value={deviceId} options={devices.map((d) => ({ value: d.id, label: d.name }))} onChange={(v) => onChange(v as number)} ct={ct} />;
}

/**
 * Pulsante con il pin attuale che apre il selettore (PinPicker). Sotto, se il pin è già usato da altri widget,
 * l'avviso con i loro nomi. `busy` = pin di altre posizioni dello stesso widget (non selezionabili).
 */
export function PinButton({
  pinType,
  pin,
  pins,
  used,
  busy,
  onChange,
  ct,
  color,
  prefix,
}: {
  pinType: PinType | undefined;
  pin: number | undefined;
  pins: BoardPin[];
  used: Map<string, string[]>;
  busy?: Set<string>;
  onChange: (v: { pinType: PinType | null; pin: number }) => void;
  ct: ControlTheme;
  /** Colore del pin (posizioni del Joystick / RGB). */
  color?: string;
  /** Nome della posizione mostrato prima del pin (X, Y, R, G, B, /pin0/…). */
  prefix?: string;
}) {
  const [open, setOpen] = useState(false);
  const hasPin = pinType !== undefined && pin !== undefined && pin >= 0;
  const boardPin = hasPin ? pins.find((p) => p.type === pinType && p.index === pin) : undefined;
  const label = !hasPin ? te.noPin : (boardPin?.name ?? `${pinType.charAt(0)}${pin}`);
  const usedBy = hasPin ? used.get(pinKeyOf(pinType, pin)) : undefined;
  return (
    <View style={styles.pinBox}>
      <Pressable onPress={() => setOpen(true)} style={[styles.picker, styles.pinButton, { backgroundColor: fieldBg(ct.theme) }]}>
        {prefix !== undefined && <Text style={[styles.pinPrefix, { color: color ?? ct.theme.text }]}>{prefix}</Text>}
        <Text style={[styles.pinText, { color: hasPin ? (color ?? ct.accent) : ct.theme.text }]}>{label}</Text>
        <MaterialCommunityIcons name="menu-down" size={22} color={ct.theme.text} />
      </Pressable>
      {usedBy && (
        <Text style={[styles.pinWarning, { color: '#ED9D00' }]} numberOfLines={2}>
          {te.pinUsed} · {usedBy.join(', ')}
        </Text>
      )}
      {open && (
        <PinPicker
          visible
          pins={pins}
          current={hasPin ? { type: pinType, index: pin } : null}
          used={used}
          busy={busy}
          theme={ct.theme}
          accent={ct.accent}
          onClose={() => setOpen(false)}
          onSelect={(p) => {
            setOpen(false);
            onChange({ pinType: p?.type ?? null, pin: p?.index ?? -1 });
          }}
        />
      )}
    </View>
  );
}

/** Device e pin di un widget a un pin. "Nessuno" = pin -1 senza pinType. */
export function PinField({
  deviceId,
  pinType,
  pin,
  devices,
  pins,
  used,
  onChange,
  ct,
}: {
  deviceId: number;
  pinType: PinType | undefined;
  pin: number | undefined;
  devices: Device[];
  /** Pin selezionabili per il device scelto. */
  pins: BoardPin[];
  /** Pin usati dagli altri widget dello stesso device. */
  used: Map<string, string[]>;
  onChange: (v: { deviceId: number; pinType: PinType | null; pin: number }) => void;
  ct: ControlTheme;
}) {
  return (
    <View style={styles.pinBox}>
      <DeviceField deviceId={deviceId} devices={devices} onChange={(id) => onChange({ deviceId: id, pinType: pinType ?? null, pin: pin ?? -1 })} ct={ct} />
      <PinButton pinType={pinType} pin={pin} pins={pins} used={used} onChange={(v) => onChange({ deviceId, ...v })} ct={ct} />
    </View>
  );
}

export function RangeField({ min, max, onChange, ct }: { min: number | undefined; max: number | undefined; onChange: (v: { min?: number; max?: number }) => void; ct: ControlTheme }) {
  return (
    <View style={styles.pinRow}>
      <NumberField value={min} onChange={(n) => onChange({ min: n })} ct={ct} width={90} />
      <Text style={{ color: ct.theme.text, marginHorizontal: 8 }}>–</Text>
      <NumberField value={max} onChange={(n) => onChange({ max: n })} ct={ct} width={90} />
    </View>
  );
}

export function LabelsField({ value, onChange, ct }: { value: string[]; onChange: (v: string[]) => void; ct: ControlTheme }) {
  const set = (i: number, s: string) => onChange(value.map((v, j) => (j === i ? s : v)));
  return (
    <View style={styles.labels}>
      {value.map((v, i) => (
        <View key={i} style={styles.labelRow}>
          <Text style={[styles.labelIndex, { color: withAlpha(ct.theme.text, 0.5) }]}>{i + 1}</Text>
          <View style={{ flex: 1 }}>
            <TextField value={v} onChange={(s) => set(i, s)} ct={ct} />
          </View>
          <Pressable onPress={() => onChange(value.filter((_, j) => j !== i))} hitSlop={8} disabled={value.length <= 1}>
            <MaterialCommunityIcons name="close" size={20} color={withAlpha(ct.theme.text, value.length <= 1 ? 0.2 : 0.7)} />
          </Pressable>
        </View>
      ))}
      <Pressable onPress={() => onChange([...value, ''])} style={styles.addRow} hitSlop={6}>
        <MaterialCommunityIcons name="plus" size={18} color={ct.accent} />
        <Text style={[styles.addText, { color: ct.accent }]}>{te.addItem.toUpperCase()}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, gap: 12 },
  rowColumn: { flexDirection: 'column', alignItems: 'stretch', gap: 8 },
  rowControl: { flexShrink: 1, alignItems: 'flex-end' },
  label: { fontSize: 12, fontFamily: FONT.medium, letterSpacing: 0.5, opacity: 0.7, flexShrink: 0 },
  input: { minWidth: 160, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 4, fontSize: 16, fontFamily: FONT.regular },
  multiline: { minHeight: 90, textAlignVertical: 'top', alignSelf: 'stretch' },
  secretRow: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'stretch' },
  segments: { flexDirection: 'row', borderWidth: 1, borderRadius: 4, overflow: 'hidden', alignSelf: 'flex-start' },
  segment: { paddingHorizontal: 12, paddingVertical: 8, minWidth: 44, alignItems: 'center' },
  segmentText: { fontSize: 14, fontFamily: FONT.medium },
  picker: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 4, minWidth: 110, justifyContent: 'space-between' },
  pickerText: { fontSize: 15, fontFamily: FONT.regular },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  swatchRing: { borderWidth: 2, borderRadius: 22, padding: 2 },
  pinBox: { gap: 8, alignItems: 'flex-start' },
  pinButton: { minWidth: 140 },
  pinText: { fontSize: 18, fontFamily: FONT.medium, flex: 1 },
  pinPrefix: { fontSize: 14, fontFamily: FONT.medium, marginRight: 8, minWidth: 18 },
  pinWarning: { fontSize: 12, fontFamily: FONT.regular },
  pinRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  labels: { gap: 6 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  labelIndex: { width: 18, textAlign: 'right', fontFamily: FONT.regular },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6 },
  addText: { fontSize: 13, fontFamily: FONT.medium },
});
