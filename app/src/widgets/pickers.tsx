// Selettori aperti dai widget: elenco delle voci del Menu ed editor di orario e giorni del Time Input.
import { useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { t } from '@/i18n';
import type { DashboardTheme } from '@/ui/dashboardTheme';
import { FONT } from '@/ui/fonts';
import { formatTimeOfDay } from './format';

function Sheet({
  visible,
  title,
  theme,
  onClose,
  children,
  footer,
}: {
  visible: boolean;
  title: string;
  theme: DashboardTheme;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const bg = theme.light ? '#FFFFFF' : '#2C2D32';
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Il tocco dentro il pannello non deve chiuderlo. */}
        <Pressable style={[styles.sheet, { backgroundColor: bg }]} onPress={() => {}}>
          {title !== '' && <Text style={[styles.title, { color: theme.text }]}>{title}</Text>}
          {children}
          {footer && <View style={styles.footer}>{footer}</View>}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function SheetButton({ label, color, onPress }: { label: string; color: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={styles.footerButton}>
      <Text style={[styles.footerText, { color }]}>{label.toUpperCase()}</Text>
    </Pressable>
  );
}

/** Elenco delle voci di un Menu; `selected` e il valore restituito partono da 1, come nel protocollo. */
export function MenuPicker({
  visible,
  title,
  labels,
  selected,
  theme,
  accent,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  labels: string[];
  selected?: number;
  theme: DashboardTheme;
  accent: string;
  onSelect: (index1: number) => void;
  onClose: () => void;
}) {
  return (
    <Sheet visible={visible} title={title} theme={theme} onClose={onClose}>
      <ScrollView style={styles.list}>
        {labels.map((l, i) => {
          const active = i + 1 === selected;
          return (
            <Pressable key={i} onPress={() => onSelect(i + 1)} style={styles.item}>
              <Text style={[styles.itemText, { color: active ? accent : theme.text }]}>{l}</Text>
              {active && <Text style={{ color: accent, fontSize: 18 }}>✓</Text>}
            </Pressable>
          );
        })}
      </ScrollView>
    </Sheet>
  );
}

function clampTime(s: number): number {
  const day = 24 * 3600;
  return ((s % day) + day) % day;
}

/** Orario modificabile con pulsanti: ore ±1, minuti ±1 e ±5. */
function TimeField({ value, onChange, theme, accent }: { value: number; onChange: (s: number) => void; theme: DashboardTheme; accent: string }) {
  const step = (delta: number) => onChange(clampTime(value + delta));
  const btn = (label: string, delta: number) => (
    <Pressable key={label} onPress={() => step(delta)} style={[styles.stepBtn, { borderColor: accent }]} hitSlop={4}>
      <Text style={[styles.stepText, { color: accent }]}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={styles.timeRow}>
      <View style={styles.timeCol}>
        {btn('+', 3600)}
        <Text style={[styles.timeValue, { color: theme.text }]}>{String(Math.floor(value / 3600)).padStart(2, '0')}</Text>
        {btn('−', -3600)}
      </View>
      <Text style={[styles.timeValue, { color: theme.text }]}>:</Text>
      <View style={styles.timeCol}>
        <View style={styles.stepPair}>
          {btn('+5', 300)}
          {btn('+1', 60)}
        </View>
        <Text style={[styles.timeValue, { color: theme.text }]}>{String(Math.floor((value % 3600) / 60)).padStart(2, '0')}</Text>
        <View style={styles.stepPair}>
          {btn('−5', -300)}
          {btn('−1', -60)}
        </View>
      </View>
    </View>
  );
}

export interface TimeSelection {
  start: number;
  stop?: number;
  days: number[];
}

/** Editor del Time Input: orario di inizio, fine (se previsto dal widget) e giorni (se previsti). */
export function TimeEditor({
  visible,
  title,
  initial,
  allowStop,
  allowDays,
  format,
  theme,
  accent,
  onSave,
  onClose,
}: {
  visible: boolean;
  title: string;
  initial: TimeSelection;
  allowStop: boolean;
  allowDays: boolean;
  format: string;
  theme: DashboardTheme;
  accent: string;
  onSave: (sel: TimeSelection) => void;
  onClose: () => void;
}) {
  const [start, setStart] = useState(initial.start);
  const [stop, setStop] = useState<number | undefined>(initial.stop);
  const [days, setDays] = useState<number[]>(initial.days.length > 0 ? initial.days : [1, 2, 3, 4, 5, 6, 7]);
  const toggleDay = (d: number) => setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));

  return (
    <Sheet
      visible={visible}
      title={title}
      theme={theme}
      onClose={onClose}
      footer={
        <>
          <SheetButton label={t.cancel} color={theme.text} onPress={onClose} />
          <SheetButton label={t.save} color={accent} onPress={() => onSave({ start, stop, days: allowDays ? days : initial.days })} />
        </>
      }
    >
      <Text style={[styles.section, { color: theme.text }]}>
        {t.start} · {formatTimeOfDay(String(start), format, t)}
      </Text>
      <TimeField value={start} onChange={setStart} theme={theme} accent={accent} />

      {allowStop && (
        <>
          <View style={styles.stopHeader}>
            <Text style={[styles.section, { color: theme.text }]}>
              {t.stop} · {stop === undefined ? t.noStop : formatTimeOfDay(String(stop), format, t)}
            </Text>
            <Switch value={stop !== undefined} onValueChange={(on) => setStop(on ? clampTime(start + 3600) : undefined)} />
          </View>
          {stop !== undefined && <TimeField value={stop} onChange={setStop} theme={theme} accent={accent} />}
        </>
      )}

      {allowDays && (
        <View style={styles.days}>
          {t.days.map((name, i) => {
            const d = i + 1;
            const on = days.includes(d);
            return (
              <Pressable
                key={d}
                onPress={() => toggleDay(d)}
                style={[styles.day, { borderColor: accent, backgroundColor: on ? accent : 'transparent' }]}
              >
                <Text style={[styles.dayText, { color: on ? '#FFFFFF' : accent }]}>{name}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#00000080', justifyContent: 'center', alignItems: 'center', padding: 24 },
  sheet: { width: '100%', maxWidth: 420, borderRadius: 8, padding: 16, maxHeight: '85%' },
  title: { fontFamily: FONT.regular, fontSize: 20, marginBottom: 12 },
  list: { flexGrow: 0 },
  item: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  itemText: { fontFamily: FONT.regular, fontSize: 18 },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: 24, marginTop: 16 },
  footerButton: { paddingVertical: 6 },
  footerText: { fontFamily: FONT.medium, fontSize: 15 },
  section: { fontFamily: FONT.regular, fontSize: 15, marginTop: 8 },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginVertical: 8 },
  timeCol: { alignItems: 'center', gap: 6 },
  timeValue: { fontFamily: FONT.light, fontSize: 40 },
  stepPair: { flexDirection: 'row', gap: 6 },
  stepBtn: { borderWidth: 1, borderRadius: 4, minWidth: 40, paddingVertical: 4, alignItems: 'center' },
  stepText: { fontFamily: FONT.medium, fontSize: 15 },
  stopHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  days: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 16 },
  day: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6 },
  dayText: { fontFamily: FONT.medium, fontSize: 13 },
});
