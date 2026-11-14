// Timer and Image Gallery (server models Timer and Image).
//
// - Timer: the app shows only the start time (`startTime`, seconds from midnight UTC, converted to the phone
//   time zone) as HH:mm:ss, centered, in the widget color. The server starts and stops it, writing
//   `startValue` / `stopValue` to the pin at those times: the app sends nothing.
// - Image Gallery: shows image number `value` (1-based) among the widget URLs. `scaling` FIT = the whole
//   image in the box, otherwise it fills and crops; then rotation, scale (%) and opacity (%).
//   The firmware can change the URLs with setProperty: "urls" (list, or "clr" to empty it) and "url"
//   (index and URL), as well as "opacity", "scale" and "rotation".
import { Image, StyleSheet, Text, View } from 'react-native';
import { useWidgetProps, useWidgetValue } from '@/session/hooks';
import { fontSizeOf, VALUE_FONT_SIZE } from '@/ui/dashboardTheme';
import { FONT } from '@/ui/fonts';
import { widgetColor } from './color';
import { useLabel, WidgetFrame, type WidgetViewProps } from './WidgetFrame';

const pad = (n: number) => String(n).padStart(2, '0');

/** Seconds from midnight UTC → "HH:mm:ss" in the phone time zone. */
function utcSecondsToLocal(seconds: unknown): string {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return '--:--:--';
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, seconds));
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function TimerWidget({ dashId, widget, theme }: WidgetViewProps) {
  const label = useLabel(dashId, widget);
  const props = useWidgetProps(dashId, widget);
  const color = widgetColor(props.color ?? widget.color, theme);
  return (
    <WidgetFrame label={label} theme={theme} contentStyle={styles.center}>
      <Text
        style={{ color, fontSize: fontSizeOf(VALUE_FONT_SIZE, widget.fontSize), fontFamily: FONT.light }}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.5}
      >
        {utcSecondsToLocal(widget.startTime)}
      </Text>
    </WidgetFrame>
  );
}

const clampInt = (v: unknown, lo: number, hi: number, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.trunc(n))) : fallback;
};

/** Current URLs: those of the widget, replaced by setProperty "urls" and updated by "url" (index\0URL). */
function currentUrls(widgetUrls: unknown, props: Record<string, string>): string[] {
  let urls = Array.isArray(widgetUrls) ? widgetUrls.map(String) : [];
  if (props.urls !== undefined) {
    const list = props.urls.split('\0');
    urls = list.length === 1 && list[0]!.toLowerCase() === 'clr' ? [] : list;
  }
  if (props.url !== undefined) {
    const [i, u] = props.url.split('\0');
    const idx = Number(i) - 1;
    if (u && Number.isInteger(idx) && idx >= 0 && idx < urls.length) urls = urls.map((x, j) => (j === idx ? u : x));
  }
  return urls.filter((u) => /^https?:\/\//i.test(u));
}

export function ImageGalleryWidget({ dashId, widget, theme }: WidgetViewProps) {
  const label = useLabel(dashId, widget);
  const value = useWidgetValue(dashId, widget);
  const props = useWidgetProps(dashId, widget);
  const urls = currentUrls(widget.urls, props);
  let index = clampInt(value?.[0], -1, 1e6, 1) - 1;
  if (index < 0 || index >= urls.length) index = 0;
  const url = urls[index];
  const opacity = clampInt(props.opacity ?? widget.opacity, 0, 100, 100) / 100;
  const scale = clampInt(props.scale ?? widget.scale, 0, 100, 100) / 100;
  const rotation = clampInt(props.rotation ?? widget.rotation, -36000, 36000, 0);
  return (
    <WidgetFrame label={label} theme={theme}>
      <View style={styles.imageBox}>
        {url && (
          <Image
            source={{ uri: url }}
            resizeMode={widget.scaling === 'FIT' || widget.scaling === undefined ? 'contain' : 'cover'}
            style={[StyleSheet.absoluteFill, { opacity, transform: [{ rotate: `${rotation}deg` }, { scale }] }]}
          />
        )}
      </View>
    </WidgetFrame>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center' },
  imageBox: { flex: 1, overflow: 'hidden' },
});
