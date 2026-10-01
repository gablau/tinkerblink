// Cornice comune: etichetta piccola in maiuscolo in alto a sinistra e contenuto.
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

export function useLabel(dashId: number, widget: Widget): string {
  const props = useWidgetProps(dashId, widget);
  return props.label ?? widget.label ?? '';
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
