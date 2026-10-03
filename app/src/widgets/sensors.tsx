// Widget dei sensori del telefono (Light, Proximity, Barometer, Humidity, Temperature, Accelerometer,
// Gravity, GPS Stream, GPS Trigger). Leggono e inviano i valori i worker in src/sensors.
//
// - Light, Proximity, Barometer, Humidity, Temperature: titolo e valore nel colore del widget, con l'unità
//   ("%slx", "Near"/"Far", "%smbar", "%s%", "%s°C" / "%s°F"); "--" finché non arriva un valore (o se il
//   telefono non ha il sensore).
// - Accelerometer, Gravity: titolo e icona nel colore del widget (nessun valore mostrato).
// - GPS Stream: latitudine e longitudine con 5 decimali (dal pin, aggiornato dal server); grigio se il pin
//   non c'è o manca il permesso di posizione.
// - GPS Trigger: icona di ingresso o di uscita a seconda di triggerOnEnter, grigia come sopra.
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
