// LCD (modello LCD del server): display 16 × 2 caratteri su un
// rettangolo arrotondato del colore del widget, testo chiaro (textLight) o scuro, un carattere centrato per cella.
//
// - Modalità semplice: riga 1 = textFormatLine1 (default "/pin0/"), riga 2 = textFormatLine2 (default "/pin1/").
//   "/pin0/" è il valore del primo pin così com'è, "/pin0.##/" con 2 decimali fissi (come il Labeled Value).
//   Se il primo pin riceve due valori insieme ("a\0b"), vanno uno per riga.
// - Modalità avanzata: il firmware scrive "p\0x\0y\0testo" (posizione colonna x, riga y) e "clr" per pulire; il
//   testo che esce dai 32 caratteri si taglia. I comandi li tiene il LiveStore.
// Il widget non ha titolo.
import { useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { pinKey, type PinType } from '@/model/profile';
import { useLcdCommands, usePinValues, useWidgetProps } from '@/session/hooks';
import { FONT } from '@/ui/fonts';
import { widgetColor } from './color';
import { formatFixedDigits } from './format';
import type { WidgetViewProps } from './WidgetFrame';

const COLS = 16;
const ROWS = 2;

interface LcdPin {
  pin?: number;
  pinType?: PinType;
}

/** Scrive `text` nel buffer a partire dalla cella y × 16 + x, tagliando quello che esce. */
function putText(buf: string[], x: number, y: number, text: string): void {
  let start = y * COLS + x;
  if (start < -text.length || start > COLS * ROWS) return;
  let s = text;
  if (start < 0) {
    s = text.slice(-start);
    start = 0;
  }
  for (let i = 0; i < s.length && start + i < COLS * ROWS; i++) buf[start + i] = s[i]!;
}

/** Sostituisce "/pinN/" o "/pinN.##/" con il valore (decimali fissi se indicati). */
function applyFormat(format: string, n: 0 | 1, value: string | undefined): string {
  const re = new RegExp(`/pin${n}\\.?#*/`, 'i');
  return format.replace(re, (token) => {
    if (value === undefined || value === '') return '';
    const dot = token.indexOf('.');
    if (dot < 0) return value;
    const digits = token.length - dot - 2;
    const num = Number(value.replace(',', '.'));
    return Number.isFinite(num) ? formatFixedDigits(num, digits) : value;
  });
}

function fitLine(s: string): string {
  return s.length >= COLS ? s.slice(0, COLS) : s.padEnd(COLS, ' ');
}

export function LcdWidget({ dashId, widget, theme }: WidgetViewProps) {
  const props = useWidgetProps(dashId, widget);
  const pins = (Array.isArray(widget.pins) ? (widget.pins as LcdPin[]) : []).slice(0, 2);
  const deviceId = widget.deviceId ?? 0;
  const keyOf = (p?: LcdPin) => (p && p.pin !== undefined && p.pin >= 0 && p.pinType ? pinKey(dashId, deviceId, p.pinType, p.pin) : null);
  const advanced = widget.advancedMode === true;
  const values = usePinValues([keyOf(pins[0]), keyOf(pins[1])]);
  const commands = useLcdCommands(advanced ? keyOf(pins[0]) : null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });

  const buf: string[] = new Array(COLS * ROWS).fill(' ');
  if (advanced) {
    for (const c of commands) {
      const x = Number(c[1]);
      const y = Number(c[2]);
      if (/^\d+$/.test(c[1] ?? '') && /^\d+$/.test(c[2] ?? '')) putText(buf, x, y, c[3] ?? '');
    }
  } else {
    const v0arr = values[0];
    const v0 = v0arr?.[0];
    const v1 = v0arr && v0arr.length === 2 ? v0arr[1] : values[1]?.[0];
    const f1 = (widget.textFormatLine1 as string | undefined) ?? '';
    const f2 = (widget.textFormatLine2 as string | undefined) ?? '';
    const [l1, l2] = f1 === '' && f2 === '' ? ['/pin0/', '/pin1/'] : [f1, f2];
    const line1 = applyFormat(applyFormat(l1, 0, v0), 1, v1);
    const line2 = applyFormat(applyFormat(l2, 0, v0), 1, v1);
    putText(buf, 0, 0, fitLine(line1) + fitLine(line2));
  }

  const background = widgetColor(props.color ?? widget.color, theme);
  const textColor = widget.textLight === true ? theme.lcdLight : theme.lcdDark;
  const padH = 8;
  const padV = 6;
  const cellW = Math.max(1, (size.w - padH * 2) / COLS);
  const cellH = Math.max(1, (size.h - padV * 2) / ROWS);
  // VT323 è stretto e alto: la dimensione è limitata dall'altezza della cella e da 1,6 × la larghezza.
  const fontSize = Math.max(6, Math.min(cellH * 0.85, cellW * 1.6));

  return (
    <View style={[styles.lcd, { backgroundColor: background, paddingHorizontal: padH, paddingVertical: padV }]} onLayout={onLayout}>
      {size.w > 0 &&
        [0, 1].map((row) => (
          <View key={row} style={styles.row}>
            {buf.slice(row * COLS, row * COLS + COLS).map((ch, i) => (
              <Text key={i} style={[styles.cell, { width: cellW, height: cellH, lineHeight: cellH, fontSize, color: textColor }]}>
                {ch}
              </Text>
            ))}
          </View>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  lcd: { flex: 1, borderRadius: 4, justifyContent: 'center' },
  row: { flexDirection: 'row' },
  cell: { textAlign: 'center', fontFamily: FONT.lcd, includeFontPadding: false },
});
