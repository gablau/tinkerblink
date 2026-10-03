// Text Input e Numeric Input (modelli TextInput e NumberInput del server).
//
// - Text Input: campo di testo nel colore del widget, suggerimento (`hint` o "Input value here"), al massimo
//   `limit` caratteri; il valore si invia con Invio/Fine della tastiera.
// - Numeric Input: "−  valore  +" con i pulsanti nel colore del widget; ogni tocco aggiunge o toglie `step`
//   (con isLoopOn oltre i limiti si riparte dall'altro estremo), il valore si può anche scrivere a mano ed è
//   sempre limitato a [min, max]. Si invia a ogni cambio. Se step, min e max sono interi il valore è intero,
//   altrimenti fino a 5 decimali. `suffix` si mostra dopo il numero.
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { t } from '@/i18n';
import { useWidgetProps, useWidgetValue, useWritePin } from '@/session/hooks';
import { FONT } from '@/ui/fonts';
import { widgetColor, withAlpha } from './color';
import { parseFloatValue } from './format';
import { useLabel, WidgetFrame, type WidgetViewProps } from './WidgetFrame';

const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

/** Dimensioni del testo per FontSize. */
const TEXT_INPUT_SIZE = { SMALL: 14, MEDIUM: 18, LARGE: 24 } as const;
/** Dimensioni del testo del Numeric Input per FontSize (si riducono se non ci stanno). */
const NUMBER_INPUT_SIZE = { SMALL: 24, MEDIUM: 32, LARGE: 64 } as const;

export function TextInputWidget({ dashId, widget, theme }: WidgetViewProps) {
  const label = useLabel(dashId, widget);
  const value = useWidgetValue(dashId, widget);
  const props = useWidgetProps(dashId, widget);
  const write = useWritePin(dashId, widget);
  const current = value?.join(' ') ?? '';
  // Bozza mentre si scrive; quando il campo non ha il fuoco si mostra il valore del server.
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? current;
  const color = widgetColor(props.color ?? widget.color, theme);
  const limit = num(widget.limit, 0);
  const fontSize = TEXT_INPUT_SIZE[(widget.fontSize as keyof typeof TEXT_INPUT_SIZE) ?? 'MEDIUM'] ?? 18;
  const hint = (widget.hint as string | undefined) || t.inputHint;
  return (
    <WidgetFrame label={label} theme={theme}>
      <TextInput
        value={text}
        onChangeText={setDraft}
        onFocus={() => setDraft(current)}
        onBlur={() => setDraft(null)}
        onSubmitEditing={() => write([text])}
        placeholder={hint}
        placeholderTextColor={withAlpha(theme.text, 0.4)}
        maxLength={limit > 0 ? limit : undefined}
        returnKeyType="send"
        submitBehavior="blurAndSubmit"
        style={[styles.box, styles.textInput, { color, fontSize, backgroundColor: withAlpha(theme.text, 0.07) }]}
      />
    </WidgetFrame>
  );
}

/** Numero come lo mostra NumberInput: intero se tutto è intero, altrimenti fino a 5 decimali senza zeri finali. */
function formatNumber(v: number, integers: boolean): string {
  if (integers) return String(Math.round(v));
  return String(Number(v.toFixed(5)));
}

export function NumberInputWidget({ dashId, widget, theme }: WidgetViewProps) {
  const label = useLabel(dashId, widget);
  const value = useWidgetValue(dashId, widget);
  const props = useWidgetProps(dashId, widget);
  const write = useWritePin(dashId, widget);
  const min = num(props.min !== undefined ? Number(props.min) : widget.min, 0);
  const max = num(props.max !== undefined ? Number(props.max) : widget.max, 255);
  const step = num(props.step !== undefined ? Number(props.step) : widget.step, 1);
  const integers = Number.isInteger(step) && Number.isInteger(min) && Number.isInteger(max);
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  const current = Math.min(Math.max(parseFloatValue(value?.[0] ?? '') ?? min, lo), hi);
  const suffix = (props.suffix ?? (widget.suffix as string | undefined)) || '';
  const color = widgetColor(props.color ?? widget.color, theme);
  const fontSize = NUMBER_INPUT_SIZE[(widget.fontSize as keyof typeof NUMBER_INPUT_SIZE) ?? 'MEDIUM'] ?? 32;
  const [editing, setEditing] = useState<string | null>(null);

  const send = (v: number) => {
    const clamped = Math.min(Math.max(v, lo), hi);
    const text = formatNumber(clamped, integers);
    if (text !== formatNumber(current, integers) || value === undefined) write([text]);
  };
  const press = (dir: 1 | -1) => {
    let next = current + step * dir;
    if (widget.isLoopOn === true) {
      if (next > hi) next = lo;
      if (next < lo) next = hi;
    }
    send(next);
  };
  const commit = () => {
    if (editing !== null) {
      const v = parseFloatValue(editing);
      if (v !== null) send(v);
    }
    setEditing(null);
  };

  return (
    <WidgetFrame label={label} theme={theme}>
      <View style={[styles.box, styles.numberRow, { backgroundColor: withAlpha(theme.text, 0.07) }]}>
        <Pressable onPress={() => press(-1)} hitSlop={6} style={({ pressed }) => [styles.stepButton, { opacity: pressed ? 0.5 : 1 }]}>
          <MaterialCommunityIcons name="minus" size={22} color={color} />
        </Pressable>
        {editing !== null ? (
          <TextInput
            value={editing}
            onChangeText={setEditing}
            onSubmitEditing={commit}
            onBlur={commit}
            autoFocus
            keyboardType="decimal-pad"
            returnKeyType="send"
            style={[styles.numberText, { color: theme.text, fontSize }]}
          />
        ) : (
          <Pressable style={styles.numberPress} onPress={() => setEditing(formatNumber(current, integers))}>
            <Text style={[styles.numberText, { color: theme.text, fontSize }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.4}>
              {formatNumber(current, integers)}
              {suffix}
            </Text>
          </Pressable>
        )}
        <Pressable onPress={() => press(1)} hitSlop={6} style={({ pressed }) => [styles.stepButton, { opacity: pressed ? 0.5 : 1 }]}>
          <MaterialCommunityIcons name="plus" size={22} color={color} />
        </Pressable>
      </View>
    </WidgetFrame>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, borderRadius: 2 },
  textInput: { paddingHorizontal: 8, paddingVertical: 0, fontFamily: FONT.light },
  numberRow: { flexDirection: 'row', alignItems: 'center' },
  stepButton: { paddingHorizontal: 10, alignSelf: 'stretch', justifyContent: 'center' },
  numberPress: { flex: 1, alignSelf: 'stretch', justifyContent: 'center' },
  numberText: { flex: 1, textAlign: 'center', fontFamily: FONT.light, padding: 0 },
});
