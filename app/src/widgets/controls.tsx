// Controls and interface widgets: Button, Styled Button, Menu, Segmented Switch, Time Input, Terminal.
// Writes go through useWritePin (HARDWARE command): the shown value updates right away.
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type LayoutChangeEvent } from 'react-native';
import { t } from '@/i18n';
import type { Widget } from '@/model/profile';
import { useTerminalLog, useWidgetProps, useWidgetValue, useWritePin } from '@/session/hooks';
import { fontSizeOf, SMALL_FONT_SIZE, VALUE_FONT_SIZE } from '@/ui/dashboardTheme';
import { FONT } from '@/ui/fonts';
import { isTransparent, widgetColor } from './color';
import { formatDays, formatTimeOfDay, parseFloatValue } from './format';
import { MenuPicker, TimeEditor, type TimeSelection } from './pickers';
import { timeInputValue } from './time';
import { useLabel, WidgetFrame, type WidgetViewProps } from './WidgetFrame';

const BUTTON_FONT_SIZE = { SMALL: 16, MEDIUM: 22, LARGE: 30 } as const;

function minMax(widget: Widget): { min: number; max: number } {
  return {
    min: typeof widget.min === 'number' ? widget.min : 0,
    max: typeof widget.max === 'number' ? widget.max : 1,
  };
}

/** On/off state: on when the value equals `max` (usually 1). */
function useOn(dashId: number, widget: Widget): boolean {
  const value = useWidgetValue(dashId, widget);
  const n = parseFloatValue(value?.[0] ?? '');
  if (n === null) return false;
  const { min, max } = minMax(widget);
  return max !== min ? n === max : n !== 0;
}

/**
 * Button behaviour:
 * - push: `max` on press and `min` on release;
 * - switch: every tap toggles the state.
 */
function useButtonPress(dashId: number, widget: Widget, on: boolean) {
  const write = useWritePin(dashId, widget);
  const { min, max } = minMax(widget);
  if (widget.pushMode) {
    return { onPressIn: () => write([max]), onPressOut: () => write([min]) };
  }
  return { onPress: () => write([on ? min : max]) };
}

/**
 * Button: 50% radius with a colored border; on = filled. The height never exceeds the
 * width: in a cell taller than wide (2×2) it is a circle, in a wider one (4×2) a pill.
 */
export function ButtonWidget({ dashId, widget, theme }: WidgetViewProps) {
  const props = useWidgetProps(dashId, widget);
  const label = useLabel(dashId, widget);
  const on = useOn(dashId, widget);
  const press = useButtonPress(dashId, widget, on);
  const color = widgetColor(props.color ?? widget.color, theme);
  const onLabel = props.onLabel ?? (widget.onLabel as string | undefined) ?? 'ON';
  const offLabel = props.offLabel ?? (widget.offLabel as string | undefined) ?? 'OFF';
  const [area, setArea] = useState({ w: 0, h: 0 });
  const height = Math.min(area.h, area.w);
  return (
    <WidgetFrame label={label} theme={theme}>
      <View style={styles.buttonArea} onLayout={(e: LayoutChangeEvent) => setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        {height > 0 && (
          <Pressable
            {...press}
            style={({ pressed }) => [
              styles.button,
              { width: area.w, height, flex: 0, margin: 0, borderColor: color, borderRadius: height / 2 },
              { backgroundColor: on ? color : 'transparent', opacity: pressed ? 0.7 : 1 },
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
          </Pressable>
        )}
      </View>
    </WidgetFrame>
  );
}

interface ButtonState {
  textColor?: number;
  backgroundColor?: number;
}

/** Styled Button: different text and background colors for on/off, filled or outline style. */
export function StyledButtonWidget({ dashId, widget, theme }: WidgetViewProps) {
  const props = useWidgetProps(dashId, widget);
  const label = useLabel(dashId, widget);
  const on = useOn(dashId, widget);
  const press = useButtonPress(dashId, widget, on);
  const state = (on ? widget.onButtonState : widget.offButtonState) as ButtonState | undefined;
  const bg = widgetColor(on ? (props.onBackColor ?? state?.backgroundColor) : (props.offBackColor ?? state?.backgroundColor), theme);
  const fg = widgetColor(on ? (props.onColor ?? state?.textColor) : (props.offColor ?? state?.textColor), theme);
  const outline = widget.buttonStyle === 'OUTLINE';
  const radius = widget.edge === 'PILL' ? 999 : widget.edge === 'SQUARE' ? 0 : 4;
  const text = on ? (props.onLabel ?? (widget.onLabel as string | undefined) ?? 'ON') : (props.offLabel ?? (widget.offLabel as string | undefined) ?? 'OFF');
  return (
    <WidgetFrame label={label} theme={theme}>
      <Pressable
        {...press}
        style={({ pressed }) => [
          styles.button,
          { borderRadius: radius, borderColor: bg, borderWidth: 2, backgroundColor: outline ? 'transparent' : bg, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <Text style={{ color: outline ? bg : fg, fontSize: fontSizeOf(SMALL_FONT_SIZE, widget.fontSize) + 4, fontFamily: FONT.light }} numberOfLines={1}>
          {text}
        </Text>
      </Pressable>
    </WidgetFrame>
  );
}

function useLabels(dashId: number, widget: Widget): string[] {
  const props = useWidgetProps(dashId, widget);
  return props.labels ? props.labels.split('\0') : (widget.labels ?? []);
}

/** Menu: selected item (1-based index) or the hint, plus the arrow. Tap = list. */
export function MenuWidget({ dashId, widget, theme }: WidgetViewProps) {
  const value = useWidgetValue(dashId, widget);
  const props = useWidgetProps(dashId, widget);
  const label = useLabel(dashId, widget);
  const labels = useLabels(dashId, widget);
  const write = useWritePin(dashId, widget);
  const [open, setOpen] = useState(false);
  const idx = parseFloatValue(value?.[0] ?? '');
  const selected = idx !== null ? labels[idx - 1] : undefined;
  const color = widgetColor(props.color ?? widget.color, theme);
  const iconColor = widgetColor(widget.iconColor, theme);
  const text = selected ?? (widget.hint as string | undefined) ?? '';
  return (
    <WidgetFrame label={label} theme={theme}>
      <Pressable onPress={() => setOpen(true)} style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}>
        <Text
          style={[styles.menuText, { color, fontSize: fontSizeOf(VALUE_FONT_SIZE, widget.fontSize) }, !selected && { opacity: 0.5 }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
        >
          {text}
        </Text>
        {!isTransparent(iconColor) && <Text style={{ color: iconColor, fontSize: 18 }}>▼</Text>}
      </Pressable>
      <MenuPicker
        visible={open}
        title={label || (widget.hint as string | undefined) || ''}
        labels={labels}
        selected={idx ?? undefined}
        theme={theme}
        accent={theme.accent}
        onClose={() => setOpen(false)}
        onSelect={(i) => {
          setOpen(false);
          write([i]);
        }}
      />
    </WidgetFrame>
  );
}

/** Segmented Switch: side-by-side segments, the selected one filled. Tap = select. */
export function SegmentedWidget({ dashId, widget, theme }: WidgetViewProps) {
  const value = useWidgetValue(dashId, widget);
  const props = useWidgetProps(dashId, widget);
  const label = useLabel(dashId, widget);
  const labels = useLabels(dashId, widget);
  const write = useWritePin(dashId, widget);
  const idx = parseFloatValue(value?.[0] ?? '') ?? 0;
  const color = widgetColor(props.color ?? widget.color, theme);
  return (
    <WidgetFrame label={label} theme={theme}>
      <View style={[styles.segments, { borderColor: color }]}>
        {labels.map((l, i) => {
          const active = i + 1 === idx;
          return (
            <Pressable
              key={i}
              onPress={() => !active && write([i + 1])}
              style={[styles.segment, { backgroundColor: active ? color : 'transparent' }, i > 0 && { borderLeftWidth: 1, borderLeftColor: color }]}
            >
              <Text style={{ color: active ? theme.buttonSelectedText : color, fontSize: 14, fontFamily: FONT.regular }} numberOfLines={1}>
                {l}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </WidgetFrame>
  );
}

function toSeconds(raw: string | undefined): number | undefined {
  const n = Number(raw);
  return raw !== undefined && raw !== '' && Number.isFinite(n) && n >= 0 ? n : undefined;
}

/** Time Input: start time (and stop, if enabled) and days. Tap = editor. */
export function TimeInputWidget({ dashId, widget, theme }: WidgetViewProps) {
  const value = useWidgetValue(dashId, widget);
  const props = useWidgetProps(dashId, widget);
  const label = useLabel(dashId, widget);
  const write = useWritePin(dashId, widget);
  const [open, setOpen] = useState(false);
  const color = widgetColor(props.color ?? widget.color, theme);
  const format = (widget.format as string | undefined) ?? 'HH:mm';
  const tz = (widget.tzName as string | undefined) ?? 'Europe/Rome';
  // Value: <start>\0<stop>\0<tz>\0<days>\0<offset>; without a value the widget settings are used.
  const start = value?.[0] ?? (typeof widget.startAt === 'number' && widget.startAt >= 0 ? String(widget.startAt) : undefined);
  const stop = value?.[1] ?? (typeof widget.stopAt === 'number' && widget.stopAt >= 0 ? String(widget.stopAt) : undefined);
  const days = value?.[3] ? value[3].split(',').map(Number) : ((widget.days as number[] | undefined) ?? []);
  const startText = formatTimeOfDay(start, format, t) || '--:--';
  const stopText = formatTimeOfDay(stop, format, t);
  const allowStop = widget.isStartStopAllowed === true;
  const allowDays = widget.isDayOfWeekAllowed !== false;

  const save = (sel: TimeSelection) => {
    setOpen(false);
    write(timeInputValue({ start: sel.start, stop: allowStop ? sel.stop : undefined, tz, days: sel.days }));
  };

  return (
    <WidgetFrame label={label} theme={theme}>
      <Pressable onPress={() => setOpen(true)} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
        <Text style={{ color, fontSize: 22, fontFamily: FONT.light }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
          {stopText ? `${startText} - ${stopText}` : startText}
        </Text>
        {allowDays && (
          <Text style={{ color: theme.text, opacity: theme.labelAlpha, fontSize: 12, fontFamily: FONT.light }} numberOfLines={1}>
            {formatDays(days, t)}
          </Text>
        )}
      </Pressable>
      {/* Mounted only when open, so the editor always starts from the current value. */}
      {open && (
        <TimeEditor
          visible
          title={label}
          initial={{ start: toSeconds(start) ?? 0, stop: allowStop ? toSeconds(stop) : undefined, days }}
          allowStop={allowStop}
          allowDays={allowDays}
          format={format}
          theme={theme}
          accent={theme.accent}
          onSave={save}
          onClose={() => setOpen(false)}
        />
      )}
    </WidgetFrame>
  );
}

/** Terminal: received lines (history in the LiveStore, "clr" clears it) and, if enabled, an input line. */
export function TerminalWidget({ dashId, widget, theme }: WidgetViewProps) {
  const props = useWidgetProps(dashId, widget);
  const label = useLabel(dashId, widget);
  const lines = useTerminalLog(dashId, widget);
  const write = useWritePin(dashId, widget);
  // In the Terminal `color` is the BACKGROUND (transparent = default theme background) and `textLightOn`
  // picks light or dark text.
  const c = widgetColor(props.color ?? widget.color, theme);
  const background = isTransparent(c) ? theme.terminalBackground : c;
  const color = widget.textLightOn === false ? '#000000' : '#FFFFFF';
  const [scroll, setScroll] = useState<ScrollView | null>(null);
  const [input, setInput] = useState('');
  const send = () => {
    if (input === '') return;
    write([input]);
    setInput('');
  };
  return (
    <WidgetFrame label={label} theme={theme} contentStyle={styles.terminalOuter}>
      <ScrollView
        ref={setScroll}
        style={[styles.terminal, { backgroundColor: background }]}
        onContentSizeChange={() => widget.autoScrollOn !== false && scroll?.scrollToEnd({ animated: false })}
      >
        {lines.map((l, i) => (
          <Text key={i} style={[styles.terminalLine, { color }]}>
            {l}
          </Text>
        ))}
      </ScrollView>
      {widget.terminalInputOn === true && (
        <TextInput
          value={input}
          onChangeText={setInput}
          onSubmitEditing={send}
          returnKeyType="send"
          placeholder={t.send}
          placeholderTextColor={color + '80'}
          style={[styles.terminalInput, { color, backgroundColor: background }]}
          autoCapitalize="none"
          autoCorrect={false}
        />
      )}
    </WidgetFrame>
  );
}

const styles = StyleSheet.create({
  button: { flex: 1, borderWidth: 1, alignItems: 'center', justifyContent: 'center', margin: 4, paddingHorizontal: 6 },
  buttonArea: { flex: 1, margin: 4, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  menuText: { flexShrink: 1, fontFamily: FONT.light },
  segments: { flex: 1, flexDirection: 'row', borderWidth: 1, borderRadius: 4, overflow: 'hidden', marginVertical: 4 },
  segment: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  terminalOuter: { justifyContent: 'flex-start', paddingTop: 4 },
  terminal: { flex: 1, padding: 6 },
  terminalLine: { fontFamily: FONT.mono, fontSize: 12 },
  terminalInput: { fontFamily: FONT.mono, fontSize: 12, paddingHorizontal: 6, paddingVertical: 4, marginTop: 2 },
});
