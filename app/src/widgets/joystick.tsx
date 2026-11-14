// Joystick (server model TwoAxisJoystick):
// - circular base (theme color 9, alpha 0.1, border alpha 0.2) and a handle 30% of the side in the widget
//   color, with a grey border (color 8);
// - the finger position (from −radius to +radius on both axes, y pointing up) maps linearly onto the
//   min-max range of each pin; split = one pin per axis, otherwise "x\0y" on the first pin;
// - while dragging it sends at most once every `frequency` ms; with autoReturnOn the handle goes back to
//   the center on release and the center value is sent;
// - next to the title, the x and y values on two lines (pin colors of the settings: green and blue).
// Axis rotation in landscape (portraitLocked) is not handled: the app behaves as in portrait.
import { useState } from 'react';
import { StyleSheet, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import { useScrollLock } from '@/components/scrollLock';
import { pinKey, type PinType } from '@/model/profile';
import { usePinValues } from '@/session/hooks';
import { useSession } from '@/session/SessionContext';
import { FONT } from '@/ui/fonts';
import { widgetColor, withAlpha } from './color';
import { useThrottle } from './sliders';
import { useLabel, type WidgetViewProps } from './WidgetFrame';

interface JoyPin {
  pin?: number;
  pinType?: PinType;
  min?: number;
  max?: number;
}

const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

export function JoystickWidget({ dashId, widget, theme }: WidgetViewProps) {
  const label = useLabel(dashId, widget);
  const { writePin } = useSession();
  const lock = useScrollLock();
  const pins = (Array.isArray(widget.pins) ? (widget.pins as JoyPin[]) : []).slice(0, 2);
  const split = widget.split === true;
  const deviceId = widget.deviceId ?? 0;
  const keyOf = (p?: JoyPin) => (p && p.pin !== undefined && p.pin >= 0 && p.pinType ? pinKey(dashId, deviceId, p.pinType, p.pin) : null);
  const values = usePinValues(split ? [keyOf(pins[0]), keyOf(pins[1])] : [keyOf(pins[0])]);
  const range = (i: number) => ({ min: num(pins[i]?.min, 0), max: num(pins[i]?.max, 1023) });
  const center = (i: number) => Math.round((range(i).min + range(i).max) / 2);
  const stored = (i: number) => Number(split ? values[i]?.[0] : values[0]?.[i]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  // Handle position (-1..1 on each axis) while dragging; null = at rest.
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const throttle = useThrottle(num(widget.frequency, 100));
  const color = widgetColor(widget.color, theme);

  const side = Math.min(size.w, size.h);
  const baseR = side / 2 - 4;
  const handleR = Math.round(side * 0.3) / 2;
  const travel = Math.max(1, Math.min(size.w, size.h) / 2 - (handleR * 7) / 6);

  /** Position -1..1 → value of pin i (linear in min-max, integer). */
  const toValue = (i: number, f: number) => {
    const { min, max } = range(i);
    return Math.round(min + ((f + 1) / 2) * (max - min));
  };
  /** Value of pin i → position -1..1 (to show the handle at rest where the server says). */
  const toPos = (i: number, v: number) => {
    const { min, max } = range(i);
    return max === min || !Number.isFinite(v) ? 0 : ((v - min) / (max - min)) * 2 - 1;
  };

  const writeNow = (x: number, y: number) => {
    const vx = String(toValue(0, x));
    const vy = String(toValue(1, y));
    if (split) {
      if (pins[0]?.pin !== undefined && pins[0].pin >= 0) writePin(dashId, deviceId, pins[0].pin, [vx]);
      if (pins[1]?.pin !== undefined && pins[1].pin >= 0) writePin(dashId, deviceId, pins[1].pin, [vy]);
    } else if (pins[0]?.pin !== undefined && pins[0].pin >= 0) {
      writePin(dashId, deviceId, pins[0].pin, [vx, vy]);
    }
  };
  /** While dragging, at most one write every `frequency` ms; always on release. */
  const send = (x: number, y: number, force: boolean) => (force ? writeNow(x, y) : throttle(() => writeNow(x, y)));

  const move = (e: GestureResponderEvent) => {
    let dx = (e.nativeEvent.locationX - size.w / 2) / travel;
    let dy = -(e.nativeEvent.locationY - size.h / 2) / travel;
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    setPos({ x: dx, y: dy });
    send(dx, dy, false);
  };
  const release = () => {
    lock(false);
    if (widget.autoReturnOn !== false) {
      setPos(null);
      send(0, 0, true);
    } else if (pos) {
      send(pos.x, pos.y, true);
    }
  };

  const rest = { x: toPos(0, stored(0)), y: toPos(1, stored(1)) };
  const shown = pos ?? (widget.autoReturnOn !== false ? { x: 0, y: 0 } : rest);
  const valueX = pos ? toValue(0, pos.x) : Number.isFinite(stored(0)) ? stored(0) : center(0);
  const valueY = pos ? toValue(1, pos.y) : Number.isFinite(stored(1)) ? stored(1) : center(1);

  return (
    <View style={styles.frame}>
      <View style={styles.header}>
        <Text style={[styles.label, { color: theme.text, opacity: theme.labelAlpha }]} numberOfLines={1}>
          {label.toUpperCase()}
        </Text>
        <View>
          <Text style={[styles.value, { color: theme.accent }]}>{valueX}</Text>
          <Text style={[styles.value, { color: theme.joystickY }]}>{valueY}</Text>
        </View>
      </View>
      <View
        style={styles.area}
        onLayout={(e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={(e) => {
          lock(true);
          move(e);
        }}
        onResponderMove={move}
        onResponderRelease={release}
        onResponderTerminate={release}
      >
        {side > 0 && (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <View
              style={[
                styles.circle,
                {
                  width: baseR * 2,
                  height: baseR * 2,
                  borderRadius: baseR,
                  left: size.w / 2 - baseR,
                  top: size.h / 2 - baseR,
                  backgroundColor: withAlpha(theme.joystickBase, 0.1),
                  borderColor: withAlpha(theme.joystickBase, 0.2),
                },
              ]}
            />
            <View
              style={[
                styles.circle,
                {
                  width: handleR * 2,
                  height: handleR * 2,
                  borderRadius: handleR,
                  left: size.w / 2 + shown.x * travel - handleR,
                  top: size.h / 2 - shown.y * travel - handleR,
                  backgroundColor: color,
                  borderColor: theme.pinLabel,
                },
              ]}
            />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, paddingHorizontal: 4, paddingTop: 4, paddingBottom: 4 },
  header: { flexDirection: 'row', alignItems: 'flex-start' },
  label: { flex: 1, fontSize: 11, fontFamily: FONT.regular },
  value: { fontSize: 10, fontFamily: FONT.regular, textAlign: 'right' },
  area: { flex: 1, marginTop: 4 },
  circle: { position: 'absolute', borderWidth: 3 },
});
