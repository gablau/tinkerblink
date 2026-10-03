// Table, Music Player e WebPage Button (modelli Table, Player e LinkButton del server,
// cc.blynk.server.core.model.widgets).
//
// - Table: righe con icona di selezione, nome e valore, nell'ordine delle colonne del widget (`columns`); la riga
//   corrente ("pick" dal firmware) è evidenziata. Con isClickableRows un tocco alterna la selezione e invia
//   "select\0id" / "deselect\0id". I comandi del firmware li applica il LiveStore. Il riordino trascinando le
//   righe (isReoderingAllowed, comando "order") non è ancora gestito.
// - Music Player: titolo centrato e tre pulsanti nel colore del widget; invia "prev", "play" / "stop", "next".
//   Lo stato play/stop viene dall'ultimo valore del pin o dalla proprietà isOnPlay.
// - WebPage Button: pulsante come lo Styled Button con il titolo dentro; tenendolo premuto prende i colori dello
//   stato "on", al rilascio apre `url` nel browser. L'URL non si mostra.
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { TableRow } from '@/session/liveStore';
import { useTable, useWidgetProps, useWidgetValue, useWritePin } from '@/session/hooks';
import { fontSizeOf, SMALL_FONT_SIZE } from '@/ui/dashboardTheme';
import { FONT } from '@/ui/fonts';
import { widgetColor, withAlpha } from './color';
import { useLabel, WidgetFrame, type WidgetViewProps } from './WidgetFrame';

type Column = 'icon' | 'name' | 'value';

export function TableWidget({ dashId, widget, theme }: WidgetViewProps) {
  const label = useLabel(dashId, widget);
  const table = useTable(dashId, widget);
  const write = useWritePin(dashId, widget);
  const color = widgetColor(widget.color, theme);
  const raw = Array.isArray(widget.columns) ? (widget.columns as { name?: string }[]).map((c) => c.name) : [];
  const columns = (raw.filter((c) => c === 'icon' || c === 'name' || c === 'value') as Column[]).slice(0, 3);
  const cols: Column[] = columns.length >= 2 ? columns : ['icon', 'name', 'value'];
  const clickable = widget.isClickableRows === true;

  const toggle = (row: TableRow) => write([row.isSelected ? 'deselect' : 'select', row.id]);

  const cell = (row: TableRow, col: Column, i: number) => {
    if (col === 'icon') {
      return (
        <MaterialCommunityIcons
          key={i}
          name={row.isSelected ? 'check-circle' : 'circle-outline'}
          size={18}
          color={row.isSelected ? color : withAlpha(theme.text, 0.3)}
          style={styles.icon}
        />
      );
    }
    const isValue = col === 'value';
    return (
      <Text key={i} style={[styles.cell, isValue ? styles.value : styles.name, { color: theme.text }]} numberOfLines={1}>
        {isValue ? row.value : row.name}
      </Text>
    );
  };

  return (
    <WidgetFrame label={label} theme={theme}>
      <ScrollView style={styles.table} nestedScrollEnabled>
        {table.rows.map((row) => (
          <Pressable
            key={row.id}
            disabled={!clickable}
            onPress={() => toggle(row)}
            style={[
              styles.row,
              { borderBottomColor: withAlpha(theme.text, 0.1) },
              row.id === table.current ? { backgroundColor: withAlpha(color, 0.2) } : null,
            ]}
          >
            {cols.map((c, i) => cell(row, c, i))}
          </Pressable>
        ))}
      </ScrollView>
    </WidgetFrame>
  );
}

export function PlayerWidget({ dashId, widget, theme }: WidgetViewProps) {
  const value = useWidgetValue(dashId, widget);
  const props = useWidgetProps(dashId, widget);
  const write = useWritePin(dashId, widget);
  const color = widgetColor(props.color ?? widget.color, theme);
  const last = value?.[0];
  const playing = last === 'play' ? true : last === 'stop' ? false : props.isOnPlay !== undefined ? props.isOnPlay === 'true' : widget.isOnPlay === true;
  const title = props.label ?? (widget.label as string | undefined) ?? '';
  const button = (icon: keyof typeof MaterialCommunityIcons.glyphMap, cmd: string, size: number) => (
    <Pressable onPress={() => write([cmd])} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
      <MaterialCommunityIcons name={icon} size={size} color={color} />
    </Pressable>
  );
  return (
    <View style={styles.player}>
      <Text style={[styles.playerTitle, { color: theme.text, opacity: theme.labelAlpha }]} numberOfLines={1}>
        {title.toUpperCase()}
      </Text>
      <View style={styles.playerButtons}>
        {button('skip-previous', 'prev', 36)}
        {button(playing ? 'pause' : 'play', playing ? 'stop' : 'play', 44)}
        {button('skip-next', 'next', 36)}
      </View>
    </View>
  );
}

interface ButtonState {
  textColor?: number;
  backgroundColor?: number;
}

export function LinkButtonWidget({ dashId, widget, theme }: WidgetViewProps) {
  const label = useLabel(dashId, widget);
  const url = typeof widget.url === 'string' ? widget.url : '';
  const outline = widget.buttonStyle === 'OUTLINE';
  const radius = widget.edge === 'PILL' ? 999 : widget.edge === 'SQUARE' ? 0 : 4;
  const look = (state: ButtonState | undefined) => ({
    bg: widgetColor(state?.backgroundColor, theme),
    fg: widgetColor(state?.textColor, theme),
  });
  const on = look(widget.onButtonState as ButtonState | undefined);
  const off = look(widget.offButtonState as ButtonState | undefined);
  const open = () => {
    if (/^https?:\/\//i.test(url)) void Linking.openURL(url).catch(() => undefined);
  };
  return (
    <View style={styles.linkFrame}>
      <Pressable
        onPress={open}
        style={({ pressed }) => {
          const c = pressed ? on : off;
          return [styles.link, { borderRadius: radius, borderColor: c.bg, backgroundColor: outline ? 'transparent' : c.bg }];
        }}
      >
        {({ pressed }) => {
          const c = pressed ? on : off;
          return (
            <Text style={{ color: outline ? c.bg : c.fg, fontSize: fontSizeOf(SMALL_FONT_SIZE, widget.fontSize) + 4, fontFamily: FONT.light }} numberOfLines={1}>
              {label}
            </Text>
          );
        }}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  table: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 32, borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 4 },
  icon: { marginHorizontal: 4 },
  cell: { fontSize: 14, fontFamily: FONT.regular, paddingHorizontal: 4 },
  name: { flex: 1 },
  value: { flexShrink: 0, textAlign: 'right' },
  player: { flex: 1, padding: 8, justifyContent: 'center' },
  playerTitle: { fontSize: 11, fontFamily: FONT.regular, textAlign: 'center' },
  playerButtons: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 32 },
  linkFrame: { flex: 1, padding: 4 },
  link: { flex: 1, borderWidth: 2, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
});
