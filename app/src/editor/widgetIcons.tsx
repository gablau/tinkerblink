// Icone dei widget (Widget Box dell'editor), disegnate per questa app: tratto sottile
// su griglia 48×48, un soggetto per widget (manopola del Gauge, LED, slider, terminale…).
// Sono disegni propri di TinkerBlink.
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

type El =
  | { p: string; fill?: boolean; dash?: string; color?: string }
  | { c: [number, number, number]; fill?: boolean; dash?: string; color?: string }
  | { r: [number, number, number, number, number?]; fill?: boolean; color?: string }
  | { l: [number, number, number, number] }
  | { t: [number, number, string, number] };

/** Goccia con la punta in (x, y) alta h. */
const drop = (x: number, y: number, h: number) => {
  const w = h * 0.45;
  return `M${x} ${y} C${x} ${y} ${x - w} ${y + h * 0.55} ${x - w} ${y + h * 0.72} A${w} ${w} 0 0 0 ${x + w} ${y + h * 0.72} C${x + w} ${y + h * 0.55} ${x} ${y} ${x} ${y} Z`;
};

/** Cifra a 7 segmenti in (x, y), larga w e alta 2w; segs = lettere dei segmenti accesi (a…g). */
const seg = (x: number, y: number, w: number, segs: string) => {
  const h = w;
  const parts: Record<string, string> = {
    a: `M${x} ${y} H${x + w}`,
    b: `M${x + w} ${y} V${y + h}`,
    c: `M${x + w} ${y + h} V${y + 2 * h}`,
    d: `M${x} ${y + 2 * h} H${x + w}`,
    e: `M${x} ${y + h} V${y + 2 * h}`,
    f: `M${x} ${y} V${y + h}`,
    g: `M${x} ${y + h} H${x + w}`,
  };
  return segs.split('').map((k) => parts[k]).join(' ');
};

const ICONS: Record<string, El[]> = {
  ACCELEROMETER: [
    { p: 'M24 27 V7 M24 27 L7 37 M24 27 L41 37' },
    { p: 'M20 11 L24 6 L28 11 M8 31 L6 37.5 L12.5 38 M35.5 38 L42 37.5 L40 31' },
  ],
  BAROMETER: [{ c: [24, 24, 17] }, { p: 'M24 24 L32 15 M14 15 L16 17 M24 11 V13.5 M14 33 L16 31 M11 24 H13.5' }, { c: [24, 24, 2.2], fill: true }],
  BRIDGE: [{ p: 'M8 17 V31 M40 17 V31' }, { p: 'M12 24 H36', dash: '3 3' }, { p: 'M11 13 Q24 7 37 13 M11 35 Q24 41 37 35' }],
  BUTTON: [{ c: [24, 24, 17] }, { c: [24, 24, 10] }],
  STYLED_BUTTON: [{ r: [5, 15, 38, 18, 9] }, { t: [24, 28.5, 'ON', 11] }],
  LINK_BUTTON: [{ c: [24, 24, 16] }, { p: 'M24 8 C15 15 15 33 24 40 M24 8 C33 15 33 33 24 40 M9 19 H39 M9 29 H39' }],
  SLIDER: [{ p: 'M5 24 H43' }, { r: [17, 19.5, 14, 9, 4.5], fill: true }],
  VERTICAL_SLIDER: [{ p: 'M24 5 V43' }, { r: [19.5, 17, 9, 14, 4.5], fill: true }],
  STEP: [{ r: [5, 15, 38, 18, 2] }, { p: 'M24 15 V33 M10 24 H18 M30 24 H38 M34 20 V28' }],
  VERTICAL_STEP: [{ r: [15, 5, 18, 38, 2] }, { p: 'M15 24 H33 M24 10 V18 M20 14 H28 M20 34 H28' }],
  TIMER: [{ c: [24, 27, 14] }, { p: 'M20 7 H28 M24 7 V13 M24 27 L30 21 M36 13 L38.5 10.5' }],
  TWO_AXIS_JOYSTICK: [
    { c: [24, 24, 17] },
    { p: 'M20 13 L24 9.5 L28 13 M20 35 L24 38.5 L28 35 M13 20 L9.5 24 L13 28 M35 20 L38.5 24 L35 28' },
    { c: [24, 24, 3], fill: true },
  ],
  RGB: [
    { c: [24, 17, 9.5], color: '#D3435C' },
    { c: [17, 29, 9.5], color: '#23C48E' },
    { c: [31, 29, 9.5], color: '#5F7CD8' },
  ],
  DIGIT4_DISPLAY: [{ r: [5, 14, 38, 20, 2] }, { t: [24, 29, '1024', 12] }],
  LABELED_VALUE_DISPLAY: [{ r: [5, 14, 38, 20, 2] }, { t: [24, 29, 'V: 220', 11] }],
  LED: [{ c: [24, 24, 10] }, { c: [24, 24, 5], fill: true }, { p: 'M24 5 V9 M24 39 V43 M5 24 H9 M39 24 H43 M10.5 10.5 L13.5 13.5 M34.5 34.5 L37.5 37.5 M10.5 37.5 L13.5 34.5 M34.5 13.5 L37.5 10.5' }],
  GAUGE: [{ p: 'M12.7 35.3 A16 16 0 1 1 35.3 35.3' }, { p: 'M24 24 L16 17' }, { c: [24, 24, 3] }],
  LEVEL_DISPLAY: [{ r: [5, 16, 38, 16, 2] }, { r: [8, 19, 14, 10, 1], fill: true }],
  VERTICAL_LEVEL_DISPLAY: [{ r: [16, 5, 16, 38, 2] }, { r: [19, 26, 10, 14, 1], fill: true }],
  LCD: [{ r: [5, 11, 38, 26, 2] }, { p: seg(13, 16, 8, 'abged') + ' ' + seg(27, 16, 8, 'afgcd') }, { c: [24.5, 32, 0.8], fill: true }],
  TERMINAL: [{ r: [5, 9, 38, 30, 2] }, { p: 'M10 16 H30 M10 21 H24 M10 26 H34' }, { t: [12, 35.5, '$', 9] }, { p: 'M17 33.5 H23' }],
  ENHANCED_GRAPH: [{ p: 'M5 41 H43' }, { p: 'M9 37 V30 M13 37 V33 M17 37 V24 M21 37 V31 M25 37 V9 M29 37 V22 M33 37 V28 M37 37 V19 M41 37 V32' }],
  VIDEO: [{ r: [5, 11, 38, 26, 3] }, { p: 'M20 18 L30 24 L20 30 Z', fill: true }],
  IMAGE: [{ p: 'M12 10 H40 A2 2 0 0 1 42 12 V32 M8 6 H36' }, { r: [5, 14, 32, 26, 2] }, { p: 'M8 37 L16 27 L23 34 L27 30 L34 37' }, { c: [29, 21, 2.5] }],
  TABS: [{ r: [5, 17, 12, 13, 1] }, { r: [18, 17, 12, 13, 1] }, { r: [31, 17, 12, 13, 1] }, { p: 'M5 34 H17' }],
  MENU: [{ r: [5, 8, 38, 11, 2] }, { p: 'M34 12 L37 15.5 L40 12 Z', fill: true }, { p: 'M9 26 H33 M9 33 H33 M9 40 H33' }],
  SEGMENTED_CONTROL: [{ r: [4, 15, 40, 18, 2] }, { r: [4, 15, 20, 18, 2], fill: true }, { p: 'M24 15 V33' }, { t: [34, 28.5, 'B', 11] }],
  TEXT_INPUT: [{ r: [5, 14, 38, 20, 2] }, { t: [19, 29, 'abc', 11] }, { p: 'M34 18 V30' }],
  NUMBER_INPUT: [{ r: [5, 14, 38, 20, 2] }, { t: [20, 29, '42', 12] }, { p: 'M36 18 V30' }],
  TIME_INPUT: [{ c: [24, 26, 15] }, { p: 'M24 17 V26 L30 30' }, { p: 'M6 9 L14 13 L6 17 Z', fill: true }],
  TABLE: [{ r: [5, 9, 38, 30, 2] }, { p: 'M5 16.5 H43 M5 24 H43 M5 31.5 H43 M14 9 V39' }],
  MAP: [{ p: 'M5 12 L17 8 L31 12 L43 8 V36 L31 40 L17 36 L5 40 Z M17 8 V36 M31 12 V40' }, { c: [24, 18, 4], fill: true }, { p: 'M24 22 V30' }],
  NOTIFICATION: [{ r: [9, 10, 20, 32, 3] }, { p: 'M17 37 H21' }, { c: [35, 11, 6], fill: true }],
  EMAIL: [{ r: [5, 11, 38, 26, 2] }, { p: 'M5 12 L24 27 L43 12' }],
  RTC: [{ r: [5, 9, 25, 25, 2] }, { p: 'M5 16 H30 M11 5 V11 M24 5 V11 M10 22 H14 M17 22 H21 M10 28 H14 M17 28 H21' }, { c: [36, 35, 8] }, { p: 'M36 30.5 V35 L39 37' }],
  WEBHOOK: [{ c: [24, 11, 4] }, { c: [11, 35, 4] }, { c: [37, 35, 4] }, { p: 'M22 14.5 L13 31.5 M15 35 H33 M26 14.5 L35 31.5' }],
  PLAYER: [{ p: 'M17 34 V11 L37 7 V30 M17 15 L37 11' }, { c: [13, 34, 4.5], fill: true }, { c: [33, 30, 4.5], fill: true }],
  GPS_STREAMING: [{ p: 'M7 22 L41 7 L26 41 L22 26 Z' }],
  GPS_TRIGGER: [{ c: [24, 24, 17], dash: '4 3' }, { p: 'M24 33 C24 33 17 25 17 20 A7 7 0 0 1 31 20 C31 25 24 33 24 33 Z' }, { c: [24, 20, 2.5], fill: true }],
  LIGHT: [{ c: [24, 24, 8] }, { p: 'M24 16 A8 8 0 0 1 24 32 Z', fill: true }, { p: 'M24 6 V10 M24 38 V42 M6 24 H10 M38 24 H42 M11 11 L14 14 M34 34 L37 37 M11 37 L14 34 M34 14 L37 11' }],
  PROXIMITY: [{ p: 'M8 40 H40' }, { p: 'M15 20 Q24 12 33 20 M18.5 26 Q24 21 29.5 26' }, { c: [24, 32, 2.5], fill: true }],
  TEMPERATURE: [{ p: 'M21 29 V10 A3 3 0 0 1 27 10 V29 A6.5 6.5 0 1 1 21 29 Z' }, { c: [24, 34, 3], fill: true }, { c: [34, 10, 2.5] }],
  HUMIDITY: [{ p: drop(24, 14, 26) }, { p: drop(12, 6, 11) }, { p: drop(36, 4, 11) }],
  GRAVITY: [{ c: [17, 31, 7] }, { p: 'M22 26 L38 10 M17.5 24 L32 9.5 M24 30.5 L39 15.5' }, { p: 'M6 43 H42' }],
};

export function hasWidgetIcon(type: string): boolean {
  return (ICONS[type]?.length ?? 0) > 0;
}

export function WidgetIcon({ type, size = 32, color = '#FFFFFF' }: { type: string; size?: number; color?: string }) {
  const els = ICONS[type] ?? [{ r: [8, 8, 32, 32, 3] as [number, number, number, number, number] }];
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {els.map((e, i) => {
        if ('t' in e) {
          const [x, y, text, fs] = e.t;
          return <SvgText key={i} x={x} y={y} fill={color} fontSize={fs} textAnchor="middle" fontWeight="500">{text}</SvgText>;
        }
        const stroke = 'color' in e && e.color ? e.color : color;
        const common = { stroke, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
        const fill = 'fill' in e && e.fill ? stroke : 'none';
        if ('l' in e) {
          const [x1, y1, x2, y2] = e.l;
          return <Line key={i} x1={x1} y1={y1} x2={x2} y2={y2} {...common} />;
        }
        if ('c' in e) {
          const [cx, cy, r] = e.c;
          return <Circle key={i} cx={cx} cy={cy} r={r} fill={fill} strokeDasharray={e.dash} {...common} />;
        }
        if ('r' in e) {
          const [x, y, w, h, rx] = e.r;
          // I rettangoli pieni senza contorno: con il tratto i quadratini piccoli (LCD) si fonderebbero.
          return <Rect key={i} x={x} y={y} width={w} height={h} rx={rx ?? 0} fill={fill} {...common} strokeWidth={fill === 'none' ? 1.8 : 0} />;
        }
        return <Path key={i} d={e.p} fill={fill} strokeDasharray={e.dash} {...common} />;
      })}
    </Svg>
  );
}
