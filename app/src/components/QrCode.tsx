// QR code drawn with react-native-svg (qrcode-generator computes the modules). Dark modules on white, with the
// quiet zone, so that scanners read it also on the dark theme.
import createQr from 'qrcode-generator';
import { useMemo } from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

/** Quiet zone around the code, in modules (the standard asks for 4). */
const QUIET = 4;

export function QrCode({ value, size }: { value: string; size: number }) {
  const { path, count } = useMemo(() => {
    const qr = createQr(0, 'M');
    qr.addData(value);
    qr.make();
    const n = qr.getModuleCount();
    // One rectangle per run of dark modules in a row: fewer edges, no seams between adjacent modules.
    let d = '';
    for (let row = 0; row < n; row++) {
      let col = 0;
      while (col < n) {
        if (!qr.isDark(row, col)) {
          col++;
          continue;
        }
        const start = col;
        while (col < n && qr.isDark(row, col)) col++;
        d += `M${start + QUIET} ${row + QUIET}h${col - start}v1h${start - col}z`;
      }
    }
    return { path: d, count: n + QUIET * 2 };
  }, [value]);

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${count} ${count}`}>
      <Rect width={count} height={count} fill="#FFFFFF" />
      <Path d={path} fill="#000000" />
    </Svg>
  );
}
