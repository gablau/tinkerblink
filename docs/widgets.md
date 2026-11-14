# Widgets, layout and pin value formats

How TinkerBlink lays out dashboards, which widgets it supports and what each widget reads from or writes
to its pins. The reference for the data model is the Blynk Legacy server source (blynk-server 0.41.x,
`server/core/src/main/java/cc/blynk/server/core/model/`): class names below (`Button`, `Superchart`,
`TimeInput`…) are the server models. The JSON field names in the profile are the same as the server
fields.

Notation: `\0` is the field separator inside a value (`BODY_SEPARATOR` on the server); `<dash>-<dev>` is a
target (dashboard id and device id).

## Dashboard grid

- A dashboard is a grid **8 columns wide**. Each widget has `x`, `y`, `width`, `height` in cells.
- Cell height is **1.35 × cell width** (`CELL_ASPECT` in `app/src/layout/bandLayout.ts`).
- **Tabs**: when a dashboard has a `Tabs` widget, it occupies row 0. TinkerBlink hides that row and draws a
  tab bar instead (colors from the widget: `color` background, `textColor`, `activeTxtColor`,
  `underlineColor`). Other widgets start at `y = 1`. A widget's `tabId` is the **position** of its tab in
  `tabs`.
- **Wide screens** (landscape, tablets, web): TinkerBlink splits the grid into bands of rows and flows them
  into side-by-side columns 340–560 px wide. Data is never changed: it is only a different rendering. In
  edit mode the single-column grid is always used.
- **Sizes** used by the editor (`app/src/editor/layoutRules.ts`): default size per type (for example Button
  2×2, Slider 4×1, Terminal 8×3, SuperChart 8×3, Map 8×5, Table 8×5, sensors 2×1), minimum and maximum sizes
  (default maximum 8×9; Timer at most 4×1, LED at most 4×4).

## Supported widgets

✅ rendered and editable · ➖ can be added, no visual part (handled by the server or the firmware) ·
⏳ not yet · 🚫 not planned. The JSON type is the `type` field in the profile (`@JsonSubTypes` of `Widget`).

| Group | Widget | JSON type | Status |
|---|---|---|---|
| Controllers | Button, Styled Button | `BUTTON`, `STYLED_BUTTON` | ✅ |
| | Slider, Vertical Slider | `SLIDER`, `VERTICAL_SLIDER` | ✅ |
| | Step H, Step V | `STEP`, `VERTICAL_STEP` | ✅ |
| | Timer | `TIMER` | ✅ |
| | Joystick | `TWO_AXIS_JOYSTICK` | ✅ |
| | RGB | `RGB` | ✅ |
| | Switch | `SWITCH` | 🚫 |
| Displays | Value Display, Labeled Value | `DIGIT4_DISPLAY`, `LABELED_VALUE_DISPLAY` | ✅ |
| | LED | `LED` | ✅ |
| | Gauge, Level H, Level V | `GAUGE`, `LEVEL_DISPLAY`, `VERTICAL_LEVEL_DISPLAY` | ✅ |
| | LCD | `LCD` | ✅ |
| | Terminal | `TERMINAL` | ✅ |
| | SuperChart | `ENHANCED_GRAPH` | ✅ |
| | Video Streaming | `VIDEO` | ✅ (Android; RTSP not available on web) |
| | Image Gallery | `IMAGE` | ✅ |
| Interface | Tabs | `TABS` | ✅ |
| | Menu, Segmented Switch | `MENU`, `SEGMENTED_CONTROL` | ✅ |
| | Text Input, Numeric Input | `TEXT_INPUT`, `NUMBER_INPUT` | ✅ |
| | Time Input | `TIME_INPUT` | ✅ |
| | Table | `TABLE` | ✅ |
| | Map | `MAP` | ✅ |
| | Text | `TEXT` | 🚫 |
| Notifications | Notification | `NOTIFICATION` | ⏳ (placeholder) |
| | Email | `EMAIL` | ➖ |
| | Twitter | `TWITTER` | 🚫 |
| Other | Bridge, Real-time clock, WebHook | `BRIDGE`, `RTC`, `WEBHOOK` | ➖ |
| | WebPage Button | `LINK_BUTTON` | ✅ |
| | Music Player | `PLAYER` | ✅ |
| | Eventor, Reports | `EVENTOR`, `REPORT` | ⏳ |
| | BLE, Bluetooth | `BLUETOOTH`, `BLUETOOTH_SERIAL` | 🚫 |
| Device management | Device Selector, Device Tiles | `DEVICE_SELECTOR`, `DEVICE_TILES` | ⏳ |
| Phone sensors | GPS Stream, GPS Trigger | `GPS_STREAMING`, `GPS_TRIGGER` | ✅ (Android) |
| | Light, Proximity, Temperature, Barometer, Humidity, Accelerometer, Gravity | `LIGHT`, `PROXIMITY`, `TEMPERATURE`, `BAROMETER`, `HUMIDITY`, `ACCELEROMETER`, `GRAVITY` | ✅ (Android) |

Unknown or unsupported types are drawn as a placeholder with the type name; their data is kept as is.
The server also defines `QR` and `SMS`, which TinkerBlink does not offer.

## Messages that carry values

| Command | Body | When |
|---|---|---|
| `HARDWARE` (20) | `<dash>-<dev>\0vw\0<pin>\0<v1>[\0<v2>…]` | firmware writes a virtual pin (`dw`/`aw` for digital/analog) |
| `HARDWARE` (20) app → server | same format | the app writes a pin (controls, sensors) |
| `SET_WIDGET_PROPERTY` (19) | `<dash>-<dev>\0<pin>\0<property>\0<value>` | firmware calls `Blynk.setProperty` |
| `APP_SYNC` (25) | `<dash>-<dev>\0vw\0<pin>\0<value>` or `…\0vm\0<pin>\0<v1>\0<v2>…` | after the app asks for a dashboard sync |

The server stores the last value in the widget (`value`) and the property in the model, so a fresh profile
always reflects the current state. Values of pins without a widget are in the profile's `pinsStorage`,
keyed `"<dash>-<dev>-v<pin>"`; TinkerBlink uses the same key for its live values.

**Properties settable from the firmware** (`WidgetProperty`): `label`, `color`, `onBackColor`,
`offBackColor`, `onColor`, `offColor`, `onLabel`, `offLabel`, `labels`, `min`, `max`, `isOnPlay`, `url`,
`urls`, `step`, `valueFormatting`, `suffix`, `maximumFractionDigits`, `opacity`, `scale`, `rotation`.
Colors arrive as strings (`#23C48E`); `labels` and `urls` have several values separated by `\0`.

## Colors

- Colors in the profile JSON are **RGBA** signed 32-bit integers (`0xRRGGBBAA`); the server converts from
  ARGB (`ByteUtils.convertARGBtoRGBA`). Example: `-308477697` = `#ED9D00`. Alpha 0 means transparent.
- Four special values mean a **gradient** that depends on the value between `min` and `max`:
  `2147483647` warm (green → yellow → red), `2147483646` warm reversed, `-2147483648` cold
  (green → light blue → blue), `-2147483647` cold reversed. TinkerBlink takes the gradient stops from the
  dashboard theme and interpolates between neighbouring stops (`app/src/widgets/color.ts`).
- Themes: `Blynk` (dark) and `BlynkLight` (light), the dashboard `theme` field.

## Numbers and formats

Implemented in `app/src/widgets/format.ts`.

- **Value Display**: an integer is shown as is; a decimal number is formatted as `#.##` (at most 2
  decimals, rounding half up, no trailing zeros: `0.00` → `0`, `52.870000000000005` → `52.87`); anything
  else is shown as text.
- **Labeled Value**: format in `valueFormatting`, default `/pin/` (pattern `/pin.?#*/`, case insensitive):
  `/pin/` value as is, `/pin./` no decimals, `/pin.#/` one fixed decimal, `/pin.##/` two… Text around the
  pattern is kept (`Temp /pin.#/ °C`). Without a value the text is shown without the pattern.
- Range mapping (`rangeMappingOn`) is not implemented yet.

## Per-widget values

| Widget | Direction | Value |
|---|---|---|
| Value Display, Labeled Value | firmware → app | any string |
| LED | firmware → app | `0`–`255` brightness (shown as opacity) |
| Button, Styled Button | both | `min`/`max` of the pin (usually `0`/`1`); push mode sends `max` on press and `min` on release, switch mode toggles |
| Menu, Segmented Switch | both | **1-based** index of the item in `labels` |
| Gauge, Level H/V | firmware → app | number, scaled between `min` and `max` |
| Slider, Vertical Slider | app → firmware | number between `min` and `max` |
| Step H/V | app → firmware | new value, or `±step` with `isSendStep` |
| RGB | app → firmware | `r\0g\0b` on one pin, or one value per pin with `splitMode` |
| Joystick | app → firmware | `x\0y` on one pin, or one pin per axis with `split` |
| Time Input | app → firmware | see [Time Input](#time-input) |
| Text Input | app → firmware | text, at most `limit` characters, sent on submit |
| Numeric Input | app → firmware | number between `min` and `max`, ± `step` |
| Terminal | both | text lines; `clr` from the firmware clears it |
| LCD | firmware → app | see [LCD](#lcd) |
| Table | both | see [Table](#table) |
| Map | firmware → app | `<index>\0<lat>\0<lon>\0<name>`; `clr` removes all markers |
| Music Player | app → firmware | `prev`, `play` / `stop`, `next`; `isOnPlay` via property |
| Image Gallery | firmware → app | 1-based index into `urls` |
| Timer | server → firmware | `startValue` / `stopValue` written by the server |
| WebPage Button, Video | no pin | URL in the widget (`url`, can be set as a property) |

### Sliders, Step and RGB

- Sliders and RGB with `sendOnReleaseOn` write only when the finger is lifted; otherwise they also write
  while dragging, at most once every `frequency` ms.
- Slider values have `maximumFractionDigits` decimals.
- **Step** (`Step`, `VerticalStep`): each tap adds or subtracts `step`. With `isLoopOn`, going past `max`
  wraps to `min` and vice versa; otherwise the value stops at the limits. The new value is sent with up to 5
  decimals, or only `+step`/`-step` with `isSendStep`. The shown value has at most 2 decimals. Note the
  field name: `isArrowsOn = true` shows `+`/`−`, `false` shows arrows.
- **RGB** (`RGB`): the palette has hue horizontally (0–360°) and brightness vertically (full at the top,
  black at the bottom), saturation 1; a white dot in the top-left corner gives white. Each 0–255 component
  becomes `round(c × (max − min) / 255 + min)` of its pin. Values are in `pins[i].value`.
- While a finger is on a slider, the RGB palette, the joystick or the map, the dashboard does not scroll.

### Time Input

Value written by the app (`TimeInput.updateIfSame` on the server):

```
<start>\0<stop>\0<tzName>\0<days>\0<tzOffset>
example: 18000\0\0Europe/Rome\01,2,3,4,5,6,7\07200
```

| Field | Meaning |
|---|---|
| start, stop | seconds from midnight (18000 = 05:00), `sr` sunrise, `ss` sunset, empty = not set |
| tzName | IANA time zone |
| days | comma-separated, **1 = Monday … 7 = Sunday**; empty = no days |
| tzOffset | UTC offset of the zone **in seconds at the moment of saving** (7200 in summer, 3600 in winter for Europe/Rome) |

The offset depends on daylight saving time, so TinkerBlink computes it every time it writes
(`app/src/widgets/time.ts`). The fields shown and editable depend on `isStartStopAllowed`,
`isDayOfWeekAllowed`, `isSunsetSunriseAllowed` and `isTimezoneAllowed`.

### Timer

`startTime` / `stopTime` are seconds from midnight **UTC** (the server's `TimerWorker` runs them in UTC); -1
means not set. The server writes `startValue` / `stopValue` to the pin; the app sends nothing. TinkerBlink
shows the start time converted to the phone time zone (`HH:mm:ss`).

### Terminal

- `color` is the **background** (transparent = theme background); `textLightOn` picks light or dark text.
- Lines sent from the app are shown in the log too, as are lines sent by other apps on the same account
  (they arrive as `APP_SYNC`).
- History: the server keeps the last lines in memory (`Terminal.lastCommands`, transient, not saved in the
  profile; `terminal.strings.pool.size`, default 25) and sends them back on a dashboard `APP_SYNC` as one
  multi-value `vm` message. They are lost when the server restarts.

### LCD

A 16 × 2 character display (`LCD`), no title; light or dark text with `textLight`.

- **Simple mode** (`advancedMode` false, two pins): line 1 = `textFormatLine1`, line 2 = `textFormatLine2`
  (defaults `/pin0/` and `/pin1/`), 16 characters each; `/pin0.##/` gives fixed decimals. Two values in
  one write on the first pin (`a\0b`) go one per line.
- **Advanced mode** (one pin): `clr` clears; `p\0x\0y\0text` writes from column `x`, row `y` and cuts what
  goes past the 32 characters. The server keeps only the last **6** commands in memory
  (`lcd.strings.pool.size`) and resends them on `APP_SYNC`; they are lost on restart or when the widget is
  saved again from the editor.

### Table

Commands written by the firmware (`Table.updateIfSame`): `add\0id\0name\0value` (adds the row or updates it
if the id exists), `update\0id\0name\0value`, `pick\0id` (current row), `select\0id`, `deselect\0id`,
`clr`. The server keeps the rows in the profile (`rows`, at most 100) and sends them back in one `APP_SYNC`
with groups of 5 fields: `add\0id\0name\0value\0selected`.

With `isClickableRows` a tap sends `select\0id` or `deselect\0id`. Reordering rows by dragging
(`isReoderingAllowed`, `order` command) is not implemented yet.

### Map

The same index replaces a marker; `clr` removes all of them. The server keeps the last commands in memory
(`Map.lastCommands`, `map.strings.pool.size`) and resends them one by one on `APP_SYNC`; the profile has only
the last `value`. TinkerBlink draws the map with Leaflet and OpenStreetMap (satellite view with
`isSatelliteMode`), with a button to fit all markers and, if `isMyLocationSupported`, the phone position.

### Image Gallery and Video

- **Image Gallery** (`Image`): shows URL number `value` (1-based) of `urls`. `scaling` FIT = contain,
  otherwise cover; then `rotation` (degrees), `scale` and `opacity` (%). Properties: `urls` (list, or
  `clr`), `url` (index and URL), `opacity`, `scale`, `rotation`.
- **Video** (`Video`): the stream starts when the dashboard is shown; a tap pauses or resumes. RTSP is played
  with expo-video (Media3) patched to use RTP over TCP (`patches/expo-video+57.0.5.patch`). The URL often
  contains camera credentials: TinkerBlink never logs it.

## SuperChart

Model: `Superchart` with a list of `dataStreams` (`GraphDataStream`). Code: `app/src/widgets/superchart/`.

**Periods** (`GraphPeriod`): the names stored in the profile and sent to the server are the server's.

| Period | Points × granularity | Label |
|---|---|---|
| `LIVE` | last 60 raw values | Live |
| `FIFTEEN_MINUTES`, `THIRTY_MINUTES`, `ONE_HOUR`, `THREE_HOURS`, `SIX_HOURS`, `TWELVE_HOURS` | 15…720 × minute | 15m … 12h |
| `DAY` | 1440 × minute | 1d |
| `N_DAY`, `TWO_DAYS` | 24 / 48 × hour | 1d, 2d |
| `THREE_DAYS`, `N_THREE_DAYS` | 72 × hour | 3d |
| `WEEK`, `TWO_WEEKS` | 168 / 336 × hour | 1w, 2w |
| `N_WEEK`, `N_TWO_WEEKS` | 7 / 14 × day | 1w, 2w |
| `MONTH`, `THREE_MONTHS` | 720 / 2160 × hour | 1M, 3M |
| `N_MONTH`, `N_THREE_MONTHS`, `SIX_MONTHS`, `ONE_YEAR` | 30 / 90 / 180 / 360 × day | 1M, 3M, 6M, 1Y |
| `ALL` | 8640 × hour | all |

- Default selectable periods of a new chart: `LIVE`, `ONE_HOUR`, `SIX_HOURS`, `N_DAY`, `N_WEEK`, `N_MONTH`,
  `N_THREE_MONTHS`. The profile's `period` is only the initial one: the period chosen on the phone and the
  streams hidden from the legend are saved locally (AsyncStorage), per dashboard and widget.
- **Data**: history with `GET_ENHANCED_GRAPH_DATA` (60), reloaded every 60 s while visible. Older pages are
  requested with `page` (the server skips `page × points`); `NO_DATA` means there are no more. LIVE starts
  from the last 60 raw values the server keeps per pin (`RawDataCacheForGraphProcessor`) and appends every
  `HARDWARE` write of the pin; a second value in the write is used as the timestamp.
- **Y scale** (`yAxisScale`): with `overrideYAxis` one shared axis rounded to round numbers; otherwise per
  stream: `AUTO` min/max of the data, `MINMAX` fixed `yAxisMin`/`yAxisMax`, `HEIGHT` min/max of the data
  drawn in the band from `yAxisMin`% to `yAxisMax`% of the height, `DELTA` a range at least `delta` wide.
  Without `yAxisScale`: `isPercentMaxMin` → `HEIGHT`, otherwise `MINMAX`.
- **Y axes**: only streams with `showYAxis` and a pin; labels in the stream color with
  `maximumFractionDigits` decimals. Two axes: left and right; an even number above 2: first two left, the
  rest right; an odd number: all left.
- **Types** (`GraphType`): `LINE` (line with a fading fill), `FILLED_LINE`, `BAR`, `BINARY` (steps: the
  value is `pin.max` above `flip`, otherwise `pin.min`).
- **Interaction**: long press shows a cursor with the time and the value of each stream; a tap on the
  legend hides or shows a stream; dragging right goes back in time.
- Not implemented yet: full screen, goal line (`goalLine`), smoothed curves (`cubicSmoothingEnabled`).

## Phone sensors

Sensor widgets only write their pin (`PinMode.out`); nothing is read back from the server.

| Widget | Android sensor | Value written | Shown as |
|---|---|---|---|
| Accelerometer | `TYPE_ACCELEROMETER` (1) | `x\0y\0z` (float, m/s²) | title and icon |
| Gravity | `TYPE_GRAVITY` (9) | `x\0y\0z` (float, m/s²) | title and icon |
| Light | `TYPE_LIGHT` (5) | integer (lx) | `123lx` |
| Proximity | `TYPE_PROXIMITY` (8) | `1` near / `0` far (threshold: half of the max range) | Near / Far |
| Barometer | `TYPE_PRESSURE` (6) | integer (hPa) | `1013mbar` |
| Humidity | `TYPE_RELATIVE_HUMIDITY` (12) | integer (%) | `55%` |
| Temperature | `TYPE_AMBIENT_TEMPERATURE` (13) | integer, °F when `isCelsius` is false | `24°C` / `75°F` |
| GPS Stream | location | `lat\0lon\0alt\0speed` | latitude and longitude, 5 decimals |
| GPS Trigger | geofence | `1` on enter (with `triggerOnEnter`) or on exit (without), otherwise `0` | enter/exit icon |

- **Sensors** (`app/src/sensors/sensorsWorker.ts`, native module `app/modules/tinkerblink-sensors`): a
  sensor is active while a widget of its type is in a running dashboard and the app is connected. Values
  are written with `HARDWARE` at most once every `frequency` ms (default 100). Readings that are not finite
  or above 1e7 in absolute value are dropped. `--` until the first reading.
- **GPS** (`app/src/sensors/gps.ts`, expo-location + expo-task-manager): works in the background and
  always writes through the server's **HTTP API** with the device token
  (`GET https://<server>/<token>/update/V<pin>?value=…`), so no login is needed and the devices get no
  `acon`/`adis`. `accuracy` 0/1/2 = high / balanced / low power, with intervals 30 s / 5 min / 30 min (with
  high accuracy, the widget `interval` if set). The geofence has radius `triggerRadius` (m) around
  `triggerLat`/`triggerLon`. Without a GPS widget with a pin in a running dashboard, no task runs and no
  location permission is requested.

## Effects of the app on the devices

- When the app logs in, the server sends `BLYNK_INTERNAL "acon"` to the devices of the running dashboards;
  when it disconnects, `"adis"`. Firmware and Node-RED flows can react to these events.
- Widgets with `frequency` > 0 make the server send `vr <pin>` to the device at each interval, **only while
  an app is connected** (`ReadingWidgetsWorker`).
- For these reasons TinkerBlink closes the connection when it goes to the background.
