// Common frame: small upper-case label at the top left, then the content.
import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import type { Widget } from '@/model/profile';
import type { DashboardTheme } from '@/ui/dashboardTheme';
import { useWidgetProps } from '@/session/hooks';
import { FONT } from '@/ui/fonts';

export interface WidgetViewProps {
  dashId: number;
  widget: Widget;
  theme: DashboardTheme;
}

/**
 * Default title when the widget has no label.
 * Types with an optional title (Value Display, Labeled
 * Value, Menu, Styled Button, Switch, Text Input…) and those that show no label are left out on purpose.
 */
const DEFAULT_TITLES: Record<string, string> = {
  BUTTON: 'Button',
  SLIDER: 'Slider',
  TIMER: 'Timer',
  TWO_AXIS_JOYSTICK: 'Joystick',
  RGB: 'RGB',
  LED: 'LED',
  GAUGE: 'Gauge',
  LCD: 'LCD',
  TERMINAL: 'Terminal',
  VIDEO: 'Video Streaming',
  PLAYER: 'Music Player',
  TABLE: 'Table',
  TIME_INPUT: 'Time Input',
  MAP: 'Map',
  LEVEL_DISPLAY: 'Level H',
  STEP: 'Step H',
  VERTICAL_STEP: 'Step V',
  SEGMENTED_CONTROL: 'Segmented Switch',
  ACCELEROMETER: 'Accelermtr',
  BAROMETER: 'Barometer',
  GRAVITY: 'Gravity',
  HUMIDITY: 'Humidity',
  LIGHT: 'Light',
  PROXIMITY: 'Proximity',
  TEMPERATURE: 'Temperature',
  GPS_STREAMING: 'GPS',
  GPS_TRIGGER: 'GPS',
};

export function useLabel(dashId: number, widget: Widget): string {
  const props = useWidgetProps(dashId, widget);
  const label = props.label ?? widget.label ?? '';
  return label !== '' ? label : (DEFAULT_TITLES[widget.type] ?? '');
}

export function WidgetFrame({
  label,
  theme,
  children,
  contentStyle,
}: {
  label: string;
  theme: DashboardTheme;
  children: ReactNode;
  contentStyle?: ViewStyle;
}) {
  return (
    <View style={styles.frame}>
      {label !== '' && (
        <Text style={[styles.label, { color: theme.text, opacity: theme.labelAlpha }]} numberOfLines={1}>
          {label.toUpperCase()}
        </Text>
      )}
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, paddingHorizontal: 4, paddingTop: 4, paddingBottom: 2 },
  label: { fontSize: 11, fontFamily: FONT.regular },
  content: { flex: 1, justifyContent: 'center' },
});
