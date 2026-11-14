// Time zone for the Time Input: the value sent contains the UTC offset of the zone **at the moment of
// saving** (see docs/widgets.md), so it is computed every time (daylight saving / standard time).

/** Offset in seconds of the IANA zone `tz` at instant `at` (e.g. Europe/Rome in October → 7200). */
export function tzOffsetSeconds(tz: string | undefined, at: Date = new Date()): number {
  if (tz) {
    try {
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' }).formatToParts(at);
      const name = parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
      if (name === 'GMT') return 0;
      const m = /GMT([+-])(\d{1,2}):?(\d{2})?/.exec(name);
      if (m) return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 3600 + Number(m[3] ?? 0) * 60);
    } catch {
      // Intl without time zone support: the phone time zone is used.
    }
  }
  return -at.getTimezoneOffset() * 60;
}

/** Value to send: <start>\0<stop>\0<tzName>\0<days>\0<offset> (empty stop = not set). */
export function timeInputValue(opts: {
  start: number | 'sr' | 'ss';
  stop?: number | 'sr' | 'ss';
  tz: string;
  days: number[];
}): string[] {
  const days = [...new Set(opts.days)].filter((d) => d >= 1 && d <= 7).sort();
  return [
    String(opts.start),
    opts.stop === undefined ? '' : String(opts.stop),
    opts.tz,
    days.join(','),
    String(tzOffsetSeconds(opts.tz)),
  ];
}
