// Display widgets: Value Display, Labeled Value, LED.
import { useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { useWidgetProps, useWidgetValue } from '@/session/hooks';
import { fontSizeOf, VALUE_FONT_SIZE } from '@/ui/dashboardTheme';
import { FONT } from '@/ui/fonts';
import { widgetColor } from './color';
import { formatLabeled, formatValueDisplay, parseFloatValue } from './format';
import { useLabel, WidgetFrame, type WidgetViewProps } from './WidgetFrame';

export function ValueDisplay({ dashId, widget, theme }: WidgetViewProps) {
  const value = useWidgetValue(dashId, widget);
  const props = useWidgetProps(dashId, widget);
  const label = useLabel(dashId, widget);
  const { text, number } = formatValueDisplay(value?.[0]);
  const color = widgetColor(props.color ?? widget.color, theme, { min: widget.min, max: widget.max, value: number });
  return (
    <WidgetFrame label={label} theme={theme}>
      <Text
        style={{ color, fontSize: fontSizeOf(VALUE_FONT_SIZE, widget.fontSize), fontFamily: FONT.light }}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.5}
      >
        {text}
      </Text>
    </WidgetFrame>
  );
}

const ALIGN = { LEFT: 'left', MIDDLE: 'center', CENTER: 'center', RIGHT: 'right' } as const;

export function LabeledValue({ dashId, widget, theme }: WidgetViewProps) {
  const value = useWidgetValue(dashId, widget);
  const props = useWidgetProps(dashId, widget);
  const label = useLabel(dashId, widget);
  const formatting = props.valueFormatting ?? (widget.valueFormatting as string | undefined);
  const { text, number } = formatLabeled(value?.[0], formatting);
  const color = widgetColor(props.color ?? widget.color, theme, { min: widget.min, max: widget.max, value: number });
  const align = ALIGN[(widget.textAlignment as keyof typeof ALIGN) ?? 'LEFT'] ?? 'left';
  return (
    <WidgetFrame label={label} theme={theme}>
      <Text
        style={{ color, fontSize: fontSizeOf(VALUE_FONT_SIZE, widget.fontSize), fontFamily: FONT.light, textAlign: align }}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.5}
      >
        {text}
      </Text>
    </WidgetFrame>
  );
}

/** LED: circle with a border, filled with the widget color and opacity = value / 255. */
export function Led({ dashId, widget, theme }: WidgetViewProps) {
  const value = useWidgetValue(dashId, widget);
  const props = useWidgetProps(dashId, widget);
  const label = useLabel(dashId, widget);
  const brightness = Math.max(0, Math.min(255, parseFloatValue(value?.[0] ?? '') ?? 0));
  const color = widgetColor(props.color ?? widget.color, theme, { min: 0, max: 255, value: brightness });
  // The circle scales with the cell: 80% of the shorter side of the available space.
  const [size, setSize] = useState(0);
  const onLayout = (e: LayoutChangeEvent) =>
    setSize(Math.floor(Math.min(e.nativeEvent.layout.width, e.nativeEvent.layout.height) * 0.8));
  return (
    <WidgetFrame label={label} theme={theme} contentStyle={styles.center}>
      <View style={styles.ledArea} onLayout={onLayout}>
        {size > 0 && (
          <View style={[styles.led, { width: size, height: size, borderRadius: size / 2, borderColor: theme.ledStroke }]}>
            <View
              style={[StyleSheet.absoluteFill, { borderRadius: size / 2, backgroundColor: color, opacity: brightness / 255 }]}
            />
          </View>
        )}
      </View>
    </WidgetFrame>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center' },
  ledArea: { flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  led: { borderWidth: 1.5, overflow: 'hidden' },
});
