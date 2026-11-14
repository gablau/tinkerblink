// Phone sensor widgets (Light, Proximity, Barometer, Humidity, Temperature, Accelerometer,
// Gravity, GPS Stream, GPS Trigger). The workers in src/sensors read and send the values.
//
// - Light, Proximity, Barometer, Humidity, Temperature: title and value in the widget color, with the unit
//   ("%slx", "Near"/"Far", "%smbar", "%s%", "%s°C" / "%s°F"); "--" until a value arrives (or if the
//   phone has no such sensor).
// - Accelerometer, Gravity: title and icon in the widget color (no value shown).
// - GPS Stream: latitude and longitude with 5 decimals (from the pin, updated by the server); grey if there
//   is no pin or the location permission is missing.
// - GPS Trigger: enter or exit icon depending on triggerOnEnter, grey as above.
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text } from 'react-native';
import { t } from '@/i18n';
import { useGpsPermission, useSensorValue, useWidgetProps, useWidgetValue } from '@/session/hooks';
import { fontSizeOf, VALUE_FONT_SIZE } from '@/ui/dashboardTheme';
import { FONT } from '@/ui/fonts';
import { widgetColor, withAlpha } from './color';
import { useLabel, WidgetFrame, type WidgetViewProps } from './WidgetFrame';

function sensorText(type: string, value: string, isCelsius: boolean): string {
  switch (type) {
    case 'BAROMETER':
      return `${value}mbar`;
    case 'HUMIDITY':
      return `${value}%`;
    case 'LIGHT':
      return `${value}lx`;
    case 'PROXIMITY':
      return value === '1' ? t.near : t.far;
    case 'TEMPERATURE':
      return `${value}°${isCelsius ? 'C' : 'F'}`;
    default:
      return value;
  }
}

export function SensorValueWidget({ dashId, widget, theme }: WidgetViewProps) {
  const label = useLabel(dashId, widget);
  const sensor = useSensorValue(dashId, widget);
  const pinValue = useWidgetValue(dashId, widget);
  const props = useWidgetProps(dashId, widget);
  const raw = sensor?.[0] ?? pinValue?.[0] ?? (typeof widget.value === 'string' ? widget.value : '');
  const text = raw === '' ? '--' : sensorText(widget.type, raw, widget.isCelsius !== false);
  const color = widgetColor(props.color ?? widget.color, theme);
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

const ICONS: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  ACCELEROMETER: 'axis-arrow',
  GRAVITY: 'arrow-collapse-down',
};

export function SensorIconWidget({ dashId, widget, theme }: WidgetViewProps) {
  const label = useLabel(dashId, widget);
  const props = useWidgetProps(dashId, widget);
  const color = widgetColor(props.color ?? widget.color, theme);
  return (
    <WidgetFrame label={label} theme={theme} contentStyle={styles.center}>
      <MaterialCommunityIcons name={ICONS[widget.type] ?? 'cellphone'} size={28} color={color} />
    </WidgetFrame>
  );
}

const hasPin = (w: WidgetViewProps['widget']) => w.pin !== undefined && w.pin >= 0;

export function GpsStreamWidget({ dashId, widget, theme }: WidgetViewProps) {
  const label = useLabel(dashId, widget);
  const value = useWidgetValue(dashId, widget);
  const allowed = useGpsPermission();
  const enabled = allowed && hasPin(widget);
  const color = enabled ? widgetColor(widget.color, theme) : withAlpha(theme.text, 0.3);
  const lat = Number.parseFloat(value?.[0] ?? '');
  const lon = Number.parseFloat(value?.[1] ?? '');
  const valid = hasPin(widget) && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
  const fmt = (n: number) => String(Math.round(n * 1e5) / 1e5);
  return (
    <WidgetFrame label={label} theme={theme}>
      <Text style={[styles.coord, { color }]} numberOfLines={1}>
        {valid ? fmt(lat) : '--'}
      </Text>
      <Text style={[styles.coord, { color }]} numberOfLines={1}>
        {valid ? fmt(lon) : '--'}
      </Text>
    </WidgetFrame>
  );
}

export function GpsTriggerWidget({ dashId, widget, theme }: WidgetViewProps) {
  const label = useLabel(dashId, widget);
  const allowed = useGpsPermission();
  const color = allowed && hasPin(widget) ? widgetColor(widget.color, theme) : withAlpha(theme.text, 0.3);
  return (
    <WidgetFrame label={label} theme={theme} contentStyle={styles.center}>
      <MaterialCommunityIcons name={widget.triggerOnEnter === true ? 'map-marker-down' : 'map-marker-up'} size={28} color={color} />
    </WidgetFrame>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center' },
  coord: { fontSize: 14, fontFamily: FONT.regular },
});
