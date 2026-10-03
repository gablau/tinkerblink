// Gauge e Level H (modelli Gauge e LevelDisplay del server, cc.blynk.server.core.model.widgets.outputs).
import { useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Path, Text as SvgText } from 'react-native-svg';
import { useWidgetProps, useWidgetValue } from '@/session/hooks';
import { fontSizeOf, VALUE_FONT_SIZE } from '@/ui/dashboardTheme';
import { FONT } from '@/ui/fonts';
import { widgetColor, withAlpha } from './color';
import { formatFixedDigits, formatMaxDigits, parseFloatValue } from './format';
import { useLabel, WidgetFrame, type WidgetViewProps } from './WidgetFrame';

/** Valore mancante. */
const EMPTY_VALUE = '----';
const PIN_PATTERN = /\/pin\.?#*\//i;

/** Arco del Gauge: parte da 140° (in senso orario da destra) e copre 260°. */
const ARC_START = 140;
const ARC_SWEEP = 260;

const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

/**
 * Testo del Gauge: il numero ha al massimo 2 decimali, oppure quelli del formato
 * "/pin.##/". Con `valueFormatting` il testo attorno al numero è a metà grandezza.
 */
function gaugeText(value: number | null, formatting: string | undefined): { before: string; number: string; after: string } {
  if (value === null) return { before: '', number: EMPTY_VALUE, after: '' };
  const match = formatting ? PIN_PATTERN.exec(formatting) : null;
  if (!formatting || !match) return { before: '', number: formatMaxDigits(value), after: '' };
  const token = match[0];
  const dot = token.indexOf('.');
  const digits = dot < 0 ? null : token.length - dot - 2;
  const number = digits === null ? formatMaxDigits(value) : formatFixedDigits(value, digits);
  return { before: formatting.slice(0, match.index), number, after: formatting.slice(match.index + token.length) };
}

function arcPoint(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function arcPath(cx: number, cy: number, r: number, start: number, sweep: number): string {
  const [x0, y0] = arcPoint(cx, cy, r, start);
  const [x1, y1] = arcPoint(cx, cy, r, start + sweep);
  return `M${x0.toFixed(2)},${y0.toFixed(2)}A${r.toFixed(2)},${r.toFixed(2)} 0 ${sweep > 180 ? 1 : 0} 1 ${x1.toFixed(2)},${y1.toFixed(2)}`;
}

/**
 * Gauge: arco di sfondo e arco del valore (estremi arrotondati), min e max agli estremi, valore al centro
 * nel colore dell'arco. Il valore fuori da [min, max] riempie l'arco fino all'estremo.
 */
export function GaugeWidget({ dashId, widget, theme }: WidgetViewProps) {
  const value = useWidgetValue(dashId, widget);
  const props = useWidgetProps(dashId, widget);
  const label = useLabel(dashId, widget);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });

  const min = num(props.min !== undefined ? Number(props.min) : widget.min, 0);
  const max = num(props.max !== undefined ? Number(props.max) : widget.max, 100);
  const v = parseFloatValue(value?.[0] ?? '');
  const clamped = v === null ? min : Math.min(Math.max(v, Math.min(min, max)), Math.max(min, max));
  const sweep = max === min ? 0 : Math.abs(((clamped - min) * ARC_SWEEP) / (max - min));
  const color = widgetColor(props.color ?? widget.color, theme, { min, max, value: clamped });
  const formatting = props.valueFormatting ?? (widget.valueFormatting as string | undefined);
  const text = gaugeText(v, formatting);
  const fontSize = fontSizeOf(VALUE_FONT_SIZE, widget.fontSize);

  // Geometria: quadrato del 90% del lato corto, spessore = 1/10 del lato per cella.
  const box = Math.min(size.w, size.h) * 0.9;
  const cols = Math.max(1, widget.width);
  const rows = Math.max(1, widget.height);
  const stroke = Math.min(((size.w * 4) / cols) * 0.9, ((size.h * 3) / rows) * 0.9) / 10;
  const r = box / 2;
  const cx = size.w / 2;
  const cy = size.h / 2;
  const [minX, minY] = arcPoint(cx, cy, r, 130);
  const [maxX, maxY] = arcPoint(cx, cy, r, 50);
  const inner = Math.max(0, box - stroke * 2);

  return (
    <WidgetFrame label={label} theme={theme}>
      <View style={styles.fill} onLayout={onLayout}>
        {box > 0 && (
          <>
            <Svg width={size.w} height={size.h} style={StyleSheet.absoluteFill}>
              <Path d={arcPath(cx, cy, r, ARC_START, ARC_SWEEP)} stroke={theme.gaugeTrack} strokeWidth={stroke} strokeLinecap="round" fill="none" />
              <Path d={arcPath(cx, cy, r, ARC_START, Math.max(sweep, 0.5))} stroke={color} strokeWidth={stroke} strokeLinecap="round" fill="none" />
              <SvgText x={minX + 10} y={minY} fontSize={10} fontFamily={FONT.regular} fill={theme.text} fillOpacity={0.7} textAnchor="start">
                {String(Math.trunc(min))}
              </SvgText>
              <SvgText x={maxX - 10} y={maxY} fontSize={10} fontFamily={FONT.regular} fill={theme.text} fillOpacity={0.7} textAnchor="end">
                {String(Math.trunc(max))}
              </SvgText>
            </Svg>
            <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
              <Text
                style={{ color, fontSize, fontFamily: FONT.light, maxWidth: inner, textAlign: 'center' }}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.4}
              >
                {text.before !== '' && <Text style={{ fontSize: fontSize / 2 }}>{text.before}</Text>}
                {text.number}
                {text.after !== '' && <Text style={{ fontSize: fontSize / 2 }}>{text.after}</Text>}
              </Text>
            </View>
          </>
        )}
      </View>
    </WidgetFrame>
  );
}

/**
 * Level H: barra arrotondata con lo sfondo del colore del widget (alfa 0,3) e il riempimento in percentuale
 * (intera). Con isAxisFlipOn si riempie da destra. Con showValueOn il valore (#.##) sta a
 * destra del titolo, come negli altri widget con titolo e valore.
 */
export function LevelWidget({ dashId, widget, theme }: WidgetViewProps) {
  const value = useWidgetValue(dashId, widget);
  const props = useWidgetProps(dashId, widget);
  const label = useLabel(dashId, widget);
  const min = num(props.min !== undefined ? Number(props.min) : widget.min, 0);
  const max = num(props.max !== undefined ? Number(props.max) : widget.max, 100);
  const v = parseFloatValue(value?.[0] ?? '') ?? min;
  const progress = v - min;
  const range = max - min;
  // Percentuale intera, limitata a 0-100 (anche con max < min).
  const percent = range === 0 ? 0 : Math.max(0, Math.min(100, Math.trunc((progress * 100) / range)));
  const color = widgetColor(props.color ?? widget.color, theme, { min, max, value: v });
  const flipped = widget.isAxisFlipOn === true;
  const showValue = widget.showValueOn !== false;

  if (widget.type === 'VERTICAL_LEVEL_DISPLAY') {
    // Level V: titolo, valore sotto, barra che si riempie dal basso
    // (dall'alto con isAxisFlipOn).
    return (
      <View style={styles.levelFrame}>
        <Text style={[styles.levelLabel, styles.levelLabelV, { color: theme.text, opacity: theme.labelAlpha }]} numberOfLines={1}>
          {label.toUpperCase()}
        </Text>
        {showValue && <Text style={[styles.levelValue, styles.levelValueV, { color: theme.pinLabel }]}>{formatMaxDigits(v)}</Text>}
        <View style={[styles.levelTrack, { backgroundColor: withAlpha(color, 0.3) }]}>
          <View
            style={[
              styles.levelRadius,
              styles.levelBarV,
              { backgroundColor: color, height: `${percent}%` },
              flipped ? { top: 0 } : { bottom: 0 },
            ]}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.levelFrame}>
      <View style={styles.levelHeader}>
        <Text style={[styles.levelLabel, { color: theme.text, opacity: theme.labelAlpha }]} numberOfLines={1}>
          {label.toUpperCase()}
        </Text>
        {showValue && <Text style={[styles.levelValue, { color: theme.pinLabel }]}>{formatMaxDigits(v)}</Text>}
      </View>
      <View style={[styles.levelTrack, { backgroundColor: withAlpha(color, 0.3) }]}>
        <View
          style={[
            styles.levelRadius,
            styles.levelBar,
            { backgroundColor: color, width: `${percent}%` },
            flipped ? { right: 0 } : { left: 0 },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  levelFrame: { flex: 1, paddingHorizontal: 4, paddingTop: 4, paddingBottom: 4 },
  levelHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  levelLabel: { flex: 1, fontSize: 11, fontFamily: FONT.regular },
  levelValue: { fontSize: 10, fontFamily: FONT.regular, marginLeft: 2 },
  levelTrack: { flex: 1, borderRadius: 2, overflow: 'hidden' },
  levelRadius: { borderRadius: 2 },
  levelLabelV: { flex: 0 },
  levelValueV: { marginLeft: 0, marginBottom: 2 },
  levelBarV: { position: 'absolute', left: 0, right: 0 },
  levelBar: { position: 'absolute', top: 0, bottom: 0 },
});
