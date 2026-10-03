// Selettore del pin: tipi disponibili (Digitale / Analogico /
// Virtuale) e pin della scheda del device, filtrati per tipo di widget. Prima voce "Nessuno". Accanto a ogni pin:
// IN USO (con i widget che lo usano), OCCUPATO (altro pin dello stesso
// widget: non selezionabile), PWM.
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { PinType } from '@/model/profile';
import type { DashboardTheme } from '@/ui/dashboardTheme';
import { FONT } from '@/ui/fonts';
import { withAlpha } from '@/widgets/color';
import { pinKeyOf, type BoardPin } from './boards/boards';
import { te } from './strings';

export interface PinChoice {
  type: PinType;
  index: number;
}

const TYPE_ORDER: PinType[] = ['DIGITAL', 'ANALOG', 'VIRTUAL'];
const TYPE_LABEL: Record<PinType, string> = { DIGITAL: te.digital, ANALOG: te.analog, VIRTUAL: te.virtual };
const ROW_HEIGHT = 52;
const USED_COLOR = '#ED9D00';
const BUSY_COLOR = '#D3435C';

type Row = { kind: 'none' } | { kind: 'pin'; pin: BoardPin };

export function PinPicker({
  visible,
  pins,
  current,
  used,
  busy,
  theme,
  accent,
  onSelect,
  onClose,
}: {
  visible: boolean;
  pins: BoardPin[];
  current: PinChoice | null;
  used: Map<string, string[]>;
  busy?: Set<string>;
  theme: DashboardTheme;
  accent: string;
  onSelect: (pin: PinChoice | null) => void;
  onClose: () => void;
}) {
  const types = TYPE_ORDER.filter((t) => pins.some((p) => p.type === t));
  const [type, setType] = useState<PinType>(current?.type ?? (types.includes('VIRTUAL') ? 'VIRTUAL' : types[0] ?? 'VIRTUAL'));
  const rows = useMemo<Row[]>(() => [{ kind: 'none' }, ...pins.filter((p) => p.type === type).map((pin) => ({ kind: 'pin' as const, pin }))], [pins, type]);
  const selectedIndex = current && current.type === type ? rows.findIndex((r) => r.kind === 'pin' && r.pin.index === current.index) : 0;
  const bg = theme.light ? '#FFFFFF' : '#2C2D32';
  const sub = withAlpha(theme.text, 0.55);

  const renderRow = ({ item }: { item: Row }) => {
    if (item.kind === 'none') {
      const active = current === null;
      return (
        <Pressable onPress={() => onSelect(null)} style={[styles.row, active && { backgroundColor: withAlpha(accent, 0.15) }]}>
          <Text style={[styles.name, { color: active ? accent : theme.text }]}>{te.noPin}</Text>
          {active && <MaterialCommunityIcons name="check" size={20} color={accent} />}
        </Pressable>
      );
    }
    const { pin } = item;
    const key = pinKeyOf(pin.type, pin.index);
    const usedBy = used.get(key);
    const isBusy = busy?.has(key) ?? false;
    const active = current?.type === pin.type && current.index === pin.index;
    return (
      <Pressable
        disabled={isBusy}
        onPress={() => onSelect({ type: pin.type, index: pin.index })}
        style={[styles.row, active && { backgroundColor: withAlpha(accent, 0.15) }, isBusy && { opacity: 0.45 }]}
      >
        <Text style={[styles.name, { color: active ? accent : usedBy || isBusy ? USED_COLOR : theme.text }]}>{pin.name}</Text>
        <View style={styles.right}>
          {isBusy ? (
            <Text style={[styles.badge, { color: BUSY_COLOR }]}>{te.pinBusy}</Text>
          ) : usedBy ? (
            <View style={styles.usedBox}>
              <Text style={[styles.badge, { color: USED_COLOR }]}>{te.pinUsed}</Text>
              <Text style={[styles.usedBy, { color: sub }]} numberOfLines={1}>
                {usedBy.join(', ')}
              </Text>
            </View>
          ) : pin.pwm ? (
            <Text style={[styles.badge, { color: accent }]}>{te.pinPwm}</Text>
          ) : null}
          {active && <MaterialCommunityIcons name="check" size={20} color={accent} />}
        </View>
      </Pressable>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: bg }]} onPress={() => {}}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>{te.selectPin}</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <MaterialCommunityIcons name="close" size={22} color={theme.text} />
            </Pressable>
          </View>
          <View style={[styles.tabs, { borderBottomColor: withAlpha(theme.text, 0.12) }]}>
            {types.map((t) => (
              <Pressable key={t} onPress={() => setType(t)} style={[styles.tab, t === type && { borderBottomColor: accent }]}>
                <Text style={[styles.tabText, { color: t === type ? accent : theme.text }]}>{TYPE_LABEL[t].toUpperCase()}</Text>
              </Pressable>
            ))}
          </View>
          <FlatList
            key={type}
            data={rows}
            renderItem={renderRow}
            keyExtractor={(r) => (r.kind === 'none' ? 'none' : pinKeyOf(r.pin.type, r.pin.index))}
            getItemLayout={(_, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index })}
            initialScrollIndex={Math.max(0, selectedIndex - 3)}
            style={styles.list}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  sheet: { borderRadius: 8, maxHeight: '85%', width: '100%', maxWidth: 480, alignSelf: 'center', overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 18, fontFamily: FONT.medium },
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontSize: 13, fontFamily: FONT.medium, letterSpacing: 0.5 },
  list: { flexGrow: 0 },
  row: { height: ROW_HEIGHT, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  name: { fontSize: 18, fontFamily: FONT.regular },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1, marginLeft: 16 },
  usedBox: { alignItems: 'flex-end', flexShrink: 1 },
  badge: { fontSize: 12, fontFamily: FONT.medium, letterSpacing: 0.5 },
  usedBy: { fontSize: 11, fontFamily: FONT.regular },
});
