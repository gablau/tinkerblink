// Visualizzazione provvisoria di un widget dentro la sua cella della griglia: etichetta e valore corrente.
// Nel punto 2 dell'MVP verrà sostituita dai componenti dedicati per ogni tipo di widget.
import { StyleSheet, Text, View } from 'react-native';
import { toCssColor, type Widget } from '@/model/profile';
import { useWidgetProps, useWidgetValue } from '@/session/hooks';
import type { Palette } from '@/ui/theme';

function formatTimeOfDay(seconds: string | undefined): string {
  if (seconds === 'sr') return 'alba';
  if (seconds === 'ss') return 'tramonto';
  const s = Number(seconds);
  if (!seconds || !Number.isFinite(s)) return '—';
  const hh = String(Math.floor(s / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  return `${hh}:${mm}`;
}

function describe(widget: Widget, value: string[] | undefined, labels: string[]): string {
  const first = value?.[0];
  switch (widget.type) {
    case 'MENU':
    case 'SEGMENTED_CONTROL': {
      const idx = Number(first);
      return (Number.isFinite(idx) && labels[idx - 1]) || (first ?? '—');
    }
    case 'TIME_INPUT': {
      const [start, stop] = value ?? [];
      return stop ? `${formatTimeOfDay(start)} → ${formatTimeOfDay(stop)}` : formatTimeOfDay(start);
    }
    case 'BUTTON':
    case 'STYLED_BUTTON':
      return first === undefined ? '—' : Number(first) > 0 ? 'ON' : 'OFF';
    case 'TERMINAL':
    case 'ENHANCED_GRAPH':
    case 'VIDEO':
    case 'TABS':
    case 'NOTIFICATION':
    case 'MAP':
      return '';
    default:
      return value && value.length > 0 ? value.join(' · ') : '—';
  }
}

const TYPE_NAMES: Record<string, string> = {
  DIGIT4_DISPLAY: 'Value Display',
  LABELED_VALUE_DISPLAY: 'Labeled Value',
  LED: 'LED',
  BUTTON: 'Button',
  STYLED_BUTTON: 'Styled Button',
  MENU: 'Menu',
  SEGMENTED_CONTROL: 'Segmented Switch',
  TIME_INPUT: 'Time Input',
  TERMINAL: 'Terminal',
  ENHANCED_GRAPH: 'SuperChart',
  GAUGE: 'Gauge',
  LEVEL_DISPLAY: 'Level H',
  VERTICAL_STEP: 'Step V',
  VERTICAL_SLIDER: 'Vertical Slider',
  SLIDER: 'Slider',
  RGB: 'zeRGBa',
  MAP: 'Map',
  VIDEO: 'Video',
  NOTIFICATION: 'Notification',
};

export function WidgetCard({ dashId, widget, palette }: { dashId: number; widget: Widget; palette: Palette }) {
  const value = useWidgetValue(dashId, widget);
  const props = useWidgetProps(dashId, widget);
  const label = props.label ?? widget.label ?? '';
  const labels = props.labels ? props.labels.split('\0') : (widget.labels ?? []);
  const color = toCssColor(props.color ?? widget.color, palette.accent);
  const text = describe(widget, value, labels);
  const pin = widget.pin !== undefined && widget.pin >= 0 ? `V${widget.pin}` : '';

  return (
    <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
      <Text style={[styles.label, { color: palette.muted }]} numberOfLines={1}>
        {label || TYPE_NAMES[widget.type] || widget.type}
      </Text>
      <View style={styles.body}>
        {widget.type === 'LED' ? (
          <View
            style={[
              styles.led,
              { backgroundColor: color, borderColor: color, opacity: Math.max(0.15, Number(value?.[0] ?? 0) / 255) },
            ]}
          />
        ) : text ? (
          <Text style={[styles.value, { color }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.5}>
            {text}
          </Text>
        ) : (
          <Text style={[styles.placeholder, { color: palette.muted }]} numberOfLines={1}>
            {TYPE_NAMES[widget.type] ?? widget.type} {pin}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 4 },
  label: { fontSize: 11, textAlign: 'center' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  value: { fontSize: 20, fontWeight: '500', textAlign: 'center' },
  placeholder: { fontSize: 11, textAlign: 'center' },
  led: { width: 20, height: 20, borderRadius: 10, borderWidth: 1 },
});
