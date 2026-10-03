// Campi particolari dell'editor: orario del Timer, periodi del SuperChart, schede del widget Tabs.
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import type { Widget } from '@/model/profile';
import { FONT } from '@/ui/fonts';
import { withAlpha } from '@/widgets/color';
import { periodLabel } from '@/widgets/superchart/periods';
import type { GraphPeriod } from '@tinkerblink/protocol';
import { TextField, type ControlTheme } from './controls';
import { te } from './strings';

const DAY = 86400;

/** Scarto del fuso del telefono rispetto a UTC, in secondi. */
function localOffset(): number {
  return -new Date().getTimezoneOffset() * 60;
}

/**
 * Orario del Timer: nel JSON secondi dalla mezzanotte UTC (-1 = non impostato); qui si mostra e si modifica
 * nel fuso del telefono.
 */
export function TimeOfDayField({ value, onChange, ct }: { value: unknown; onChange: (v: number) => void; ct: ControlTheme }) {
  const utc = typeof value === 'number' ? value : -1;
  const set = utc >= 0;
  const local = set ? (((utc + localOffset()) % DAY) + DAY) % DAY : 12 * 3600;
  const change = (localSeconds: number) => onChange(((((localSeconds - localOffset()) % DAY) + DAY) % DAY));
  const step = (delta: number) => change((((local + delta) % DAY) + DAY) % DAY);
  const btn = (label: string, delta: number) => (
    <Pressable key={label} onPress={() => step(delta)} style={[styles.stepBtn, { borderColor: ct.accent }]} hitSlop={4}>
      <Text style={[styles.stepText, { color: ct.accent }]}>{label}</Text>
    </Pressable>
  );
  const two = (n: number) => String(n).padStart(2, '0');
  return (
    <View style={styles.timeBox}>
      <View style={styles.timeHead}>
        <Text style={[styles.timeValue, { color: set ? ct.theme.text : withAlpha(ct.theme.text, 0.4) }]}>
          {set ? `${two(Math.floor(local / 3600))}:${two(Math.floor((local % 3600) / 60))}` : te.noTime}
        </Text>
        <Switch value={set} onValueChange={(on) => (on ? change(local) : onChange(-1))} trackColor={{ true: ct.accent }} thumbColor={set ? '#FFFFFF' : undefined} />
      </View>
      {set && (
        <View style={styles.steps}>
          {btn('−1h', -3600)}
          {btn('+1h', 3600)}
          {btn('−5m', -300)}
          {btn('+5m', 300)}
          {btn('−1m', -60)}
          {btn('+1m', 60)}
        </View>
      )}
    </View>
  );
}

/**
 * Periodi selezionabili del SuperChart (massimo 7, "Time Ranges Picker"). Per 1d, 3d, 1w, 1M
 * e 3M il server ha due versioni: standard (N_*) e ad alta risoluzione.
 */
const PERIOD_CHOICES: { value: GraphPeriod; high?: boolean }[] = [
  { value: 'LIVE' },
  { value: 'FIFTEEN_MINUTES' },
  { value: 'THIRTY_MINUTES' },
  { value: 'ONE_HOUR' },
  { value: 'THREE_HOURS' },
  { value: 'SIX_HOURS' },
  { value: 'TWELVE_HOURS' },
  { value: 'N_DAY' },
  { value: 'DAY', high: true },
  { value: 'TWO_DAYS' },
  { value: 'N_THREE_DAYS' },
  { value: 'THREE_DAYS', high: true },
  { value: 'N_WEEK' },
  { value: 'WEEK', high: true },
  { value: 'N_TWO_WEEKS' },
  { value: 'TWO_WEEKS', high: true },
  { value: 'N_MONTH' },
  { value: 'MONTH', high: true },
  { value: 'N_THREE_MONTHS' },
  { value: 'THREE_MONTHS', high: true },
  { value: 'SIX_MONTHS' },
  { value: 'ONE_YEAR' },
  { value: 'ALL' },
];
const MAX_PERIODS = 7;

export function PeriodsField({ value, onChange, ct }: { value: unknown; onChange: (v: GraphPeriod[]) => void; ct: ControlTheme }) {
  const selected = Array.isArray(value) ? (value as GraphPeriod[]) : [];
  const toggle = (p: GraphPeriod) => {
    if (selected.includes(p)) onChange(selected.filter((x) => x !== p));
    else if (selected.length < MAX_PERIODS) onChange([...selected, p]);
  };
  return (
    <View style={styles.chips}>
      {PERIOD_CHOICES.map(({ value: p, high }) => {
        const on = selected.includes(p);
        const disabled = !on && selected.length >= MAX_PERIODS;
        return (
          <Pressable
            key={p}
            onPress={() => toggle(p)}
            disabled={disabled}
            style={[styles.chip, { borderColor: on ? ct.accent : withAlpha(ct.theme.text, 0.25), backgroundColor: on ? ct.accent : 'transparent', opacity: disabled ? 0.35 : 1 }]}
          >
            <Text style={[styles.chipText, { color: on ? ct.theme.background : ct.theme.text }]}>
              {periodLabel(p)}
              {high ? ` · ${te.highRes}` : ''}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

interface Tab {
  id?: number;
  label?: string;
}

/**
 * Schede del widget Tabs: si rinominano e se ne aggiungono. Togliere una scheda farebbe cancellare al server
 * i widget che contiene (MobileDeleteWidgetLogic.deleteTabs): si permette solo per l'ultima e solo se è vuota.
 */
export function TabsField({ draft, widgets, onChange, ct }: { draft: Widget; widgets: Widget[]; onChange: (tabs: Tab[]) => void; ct: ControlTheme }) {
  const tabs = Array.isArray(draft.tabs) ? (draft.tabs as Tab[]) : [];
  const lastEmpty = tabs.length > 1 && !widgets.some((w) => w.type !== 'TABS' && (w.tabId ?? 0) === tabs.length - 1);
  return (
    <View style={styles.tabs}>
      {tabs.map((tab, i) => (
        <View key={i} style={styles.tabRow}>
          <Text style={[styles.tabIndex, { color: withAlpha(ct.theme.text, 0.5) }]}>{i + 1}</Text>
          <View style={{ flex: 1 }}>
            <TextField value={tab.label ?? ''} onChange={(v) => onChange(tabs.map((t, j) => (j === i ? { ...t, label: v } : t)))} ct={ct} />
          </View>
          {i === tabs.length - 1 && lastEmpty ? (
            <Pressable onPress={() => onChange(tabs.slice(0, -1))} hitSlop={8}>
              <MaterialCommunityIcons name="close" size={20} color={withAlpha(ct.theme.text, 0.7)} />
            </Pressable>
          ) : (
            <View style={{ width: 20 }} />
          )}
        </View>
      ))}
      <Pressable onPress={() => onChange([...tabs, { id: 0, label: `Tab ${tabs.length + 1}` }])} style={styles.addRow} hitSlop={6}>
        <MaterialCommunityIcons name="plus" size={18} color={ct.accent} />
        <Text style={[styles.addText, { color: ct.accent }]}>{te.addTab.toUpperCase()}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  timeBox: { gap: 8, alignItems: 'flex-end' },
  timeHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  timeValue: { fontSize: 22, fontFamily: FONT.medium },
  steps: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' },
  stepBtn: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4 },
  stepText: { fontSize: 13, fontFamily: FONT.medium },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontSize: 13, fontFamily: FONT.medium },
  tabs: { gap: 6 },
  tabRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tabIndex: { width: 18, textAlign: 'right', fontFamily: FONT.regular },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6 },
  addText: { fontSize: 13, fontFamily: FONT.medium },
});
