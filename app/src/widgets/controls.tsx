// Controlli e widget di interfaccia: Button, Styled Button, Menu, Segmented Switch, Time Input, Terminal.
// Per ora solo visualizzazione dello stato: l'invio dei valori arriva con il punto 3 dell'MVP.
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { t } from '@/i18n';
import { useTerminalLog, useWidgetProps, useWidgetValue } from '@/session/hooks';
import { fontSizeOf, SMALL_FONT_SIZE, VALUE_FONT_SIZE } from '@/ui/dashboardTheme';
import { FONT } from '@/ui/fonts';
import { isTransparent, widgetColor } from './color';
import { formatDays, formatTimeOfDay, parseFloatValue } from './format';
import { useLabel, WidgetFrame, type WidgetViewProps } from './WidgetFrame';

const BUTTON_FONT_SIZE = { SMALL: 16, MEDIUM: 22, LARGE: 30 } as const;

/** Stato acceso/spento: acceso quando il valore coincide con `max` (di solito 1). */
function useOn(dashId: number, widget: WidgetViewProps['widget']): boolean {
  const value = useWidgetValue(dashId, widget);
  const n = parseFloatValue(value?.[0] ?? '');
  if (n === null) return false;
  const max = typeof widget.max === 'number' ? widget.max : 1;
  const min = typeof widget.min === 'number' ? widget.min : 0;
  return max !== min ? n === max : n !== 0;
}

/** Button: pillola (raggio 50%) con bordo colorato; acceso = pieno. */
export function ButtonWidget({ dashId, widget, theme }: WidgetViewProps) {
  const props = useWidgetProps(dashId, widget);
  const label = useLabel(dashId, widget);
  const on = useOn(dashId, widget);
  const color = widgetColor(props.color ?? widget.color, theme);
  const onLabel = props.onLabel ?? (widget.onLabel as string | undefined) ?? 'ON';
  const offLabel = props.offLabel ?? (widget.offLabel as string | undefined) ?? 'OFF';
  const [h, setH] = useState(0);
  return (
    <WidgetFrame label={label} theme={theme}>
      <View
        onLayout={(e: LayoutChangeEvent) => setH(e.nativeEvent.layout.height)}
        style={[
          styles.button,
          { borderColor: color, borderRadius: h / 2, backgroundColor: on ? color : 'transparent' },
        ]}
      >
        <Text
          style={{ color: on ? theme.buttonSelectedText : color, fontSize: fontSizeOf(BUTTON_FONT_SIZE, widget.fontSize), fontFamily: FONT.light }}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.4}
        >
          {on ? onLabel : offLabel}
        </Text>
      </View>
    </WidgetFrame>
  );
}

interface ButtonState {
  textColor?: number;
  backgroundColor?: number;
}

/** Styled Button: colori di testo e sfondo diversi per acceso/spento, stile pieno o solo bordo. */
export function StyledButtonWidget({ dashId, widget, theme }: WidgetViewProps) {
  const props = useWidgetProps(dashId, widget);
  const label = useLabel(dashId, widget);
  const on = useOn(dashId, widget);
  const state = (on ? widget.onButtonState : widget.offButtonState) as ButtonState | undefined;
  const bg = widgetColor(on ? (props.onBackColor ?? state?.backgroundColor) : (props.offBackColor ?? state?.backgroundColor), theme);
  const fg = widgetColor(on ? (props.onColor ?? state?.textColor) : (props.offColor ?? state?.textColor), theme);
  const outline = widget.buttonStyle === 'OUTLINE';
  const radius = widget.edge === 'PILL' ? 999 : widget.edge === 'SQUARE' ? 0 : 4;
  const text = on ? (props.onLabel ?? (widget.onLabel as string | undefined) ?? 'ON') : (props.offLabel ?? (widget.offLabel as string | undefined) ?? 'OFF');
  return (
    <WidgetFrame label={label} theme={theme}>
      <View
        style={[
          styles.button,
          { borderRadius: radius, borderColor: bg, borderWidth: 2, backgroundColor: outline ? 'transparent' : bg },
        ]}
      >
        <Text style={{ color: outline ? bg : fg, fontSize: fontSizeOf(SMALL_FONT_SIZE, widget.fontSize) + 4, fontFamily: FONT.light }} numberOfLines={1}>
          {text}
        </Text>
      </View>
    </WidgetFrame>
  );
}

function useLabels(dashId: number, widget: WidgetViewProps['widget']): string[] {
  const props = useWidgetProps(dashId, widget);
  return props.labels ? props.labels.split('\0') : (widget.labels ?? []);
}

/** Menu: voce selezionata (indice a partire da 1) oppure il suggerimento, più la freccia. */
export function MenuWidget({ dashId, widget, theme }: WidgetViewProps) {
  const value = useWidgetValue(dashId, widget);
  const props = useWidgetProps(dashId, widget);
  const label = useLabel(dashId, widget);
  const labels = useLabels(dashId, widget);
  const idx = parseFloatValue(value?.[0] ?? '');
  const selected = idx !== null ? labels[idx - 1] : undefined;
  const color = widgetColor(props.color ?? widget.color, theme);
  const iconColor = widgetColor(widget.iconColor, theme);
  const text = selected ?? (widget.hint as string | undefined) ?? '';
  return (
    <WidgetFrame label={label} theme={theme} contentStyle={styles.row}>
      <Text
        style={[styles.menuText, { color, fontSize: fontSizeOf(VALUE_FONT_SIZE, widget.fontSize) }, !selected && { opacity: 0.5 }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.5}
      >
        {text}
      </Text>
      {!isTransparent(iconColor) && <Text style={{ color: iconColor, fontSize: 18 }}>▼</Text>}
    </WidgetFrame>
  );
}

/** Segmented Switch: segmenti affiancati, quello selezionato pieno. */
export function SegmentedWidget({ dashId, widget, theme }: WidgetViewProps) {
  const value = useWidgetValue(dashId, widget);
  const props = useWidgetProps(dashId, widget);
  const label = useLabel(dashId, widget);
  const labels = useLabels(dashId, widget);
  const idx = parseFloatValue(value?.[0] ?? '') ?? 0;
  const color = widgetColor(props.color ?? widget.color, theme);
  return (
    <WidgetFrame label={label} theme={theme}>
      <View style={[styles.segments, { borderColor: color }]}>
        {labels.map((l, i) => {
          const active = i + 1 === idx;
          return (
            <View key={i} style={[styles.segment, { backgroundColor: active ? color : 'transparent' }, i > 0 && { borderLeftWidth: 1, borderLeftColor: color }]}>
              <Text style={{ color: active ? theme.buttonSelectedText : color, fontSize: 14, fontFamily: FONT.regular }} numberOfLines={1}>
                {l}
              </Text>
            </View>
          );
        })}
      </View>
    </WidgetFrame>
  );
}

/** Time Input: orario di inizio (e fine, se previsto) e giorni della settimana. */
export function TimeInputWidget({ dashId, widget, theme }: WidgetViewProps) {
  const value = useWidgetValue(dashId, widget);
  const props = useWidgetProps(dashId, widget);
  const label = useLabel(dashId, widget);
  const color = widgetColor(props.color ?? widget.color, theme);
  const format = (widget.format as string | undefined) ?? 'HH:mm';
  // Valore: <start>\0<stop>\0<tz>\0<giorni>\0<offset>; senza valore si usa la configurazione del widget.
  const start = value?.[0] ?? (typeof widget.startAt === 'number' && widget.startAt >= 0 ? String(widget.startAt) : undefined);
  const stop = value?.[1] ?? (typeof widget.stopAt === 'number' && widget.stopAt >= 0 ? String(widget.stopAt) : undefined);
  const days = value?.[3] ? value[3].split(',').map(Number) : ((widget.days as number[] | undefined) ?? []);
  const startText = formatTimeOfDay(start, format, t) || '--:--';
  const stopText = formatTimeOfDay(stop, format, t);
  return (
    <WidgetFrame label={label} theme={theme}>
      <Text style={{ color, fontSize: 22, fontFamily: FONT.light }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
        {stopText ? `${startText} - ${stopText}` : startText}
      </Text>
      {widget.isDayOfWeekAllowed !== false && (
        <Text style={{ color: theme.text, opacity: theme.labelAlpha, fontSize: 12, fontFamily: FONT.light }} numberOfLines={1}>
          {formatDays(days, t)}
        </Text>
      )}
    </WidgetFrame>
  );
}

/** Terminal: riquadro con le righe ricevute (cronologia nel LiveStore, "clr" pulisce). */
export function TerminalWidget({ dashId, widget, theme }: WidgetViewProps) {
  const props = useWidgetProps(dashId, widget);
  const label = useLabel(dashId, widget);
  const lines = useTerminalLog(dashId, widget);
  const c = widgetColor(props.color ?? widget.color, theme);
  const color = isTransparent(c) ? theme.text : c;
  const [scroll, setScroll] = useState<ScrollView | null>(null);
  return (
    <WidgetFrame label={label} theme={theme} contentStyle={styles.terminalOuter}>
      <ScrollView
        ref={setScroll}
        style={[styles.terminal, { backgroundColor: theme.terminalBackground }]}
        onContentSizeChange={() => widget.autoScrollOn !== false && scroll?.scrollToEnd({ animated: false })}
      >
        {lines.map((l, i) => (
          <Text key={i} style={[styles.terminalLine, { color }]}>
            {l}
          </Text>
        ))}
      </ScrollView>
    </WidgetFrame>
  );
}

const styles = StyleSheet.create({
  button: { flex: 1, borderWidth: 1, alignItems: 'center', justifyContent: 'center', margin: 4, paddingHorizontal: 6 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  menuText: { flexShrink: 1, fontFamily: FONT.light },
  segments: { flex: 1, flexDirection: 'row', borderWidth: 1, borderRadius: 4, overflow: 'hidden', marginVertical: 4 },
  segment: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  terminalOuter: { justifyContent: 'flex-start', paddingTop: 4 },
  terminal: { flex: 1, padding: 6 },
  terminalLine: { fontFamily: FONT.mono, fontSize: 12 },
});
