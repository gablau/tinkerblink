// Shared parts of the project and device screens: device fields, token, buttons and confirmations.
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Alert, Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from 'expo-router';
import { ChoiceField, Row, TextField, type ControlTheme } from '@/editor/controls';
import type { NewDevice } from '@/session/SessionManager';
import { FONT } from '@/ui/fonts';
import { withAlpha } from '@/widgets/color';
import { BOARD_TYPES, CONNECTION_TYPES, isWifiBoard } from './boardTypes';
import { tp } from './strings';

/** Name, board and connection of a device (new project screen and device screen). */
export function DeviceFields({ value, onChange, ct }: { value: NewDevice; onChange: (v: NewDevice) => void; ct: ControlTheme }) {
  // A board name unknown to the server (it should not happen) stays visible as an extra item.
  const boards = BOARD_TYPES.includes(value.boardType) ? BOARD_TYPES : [value.boardType, ...BOARD_TYPES];
  return (
    <>
      <Row label={tp.deviceName} ct={ct} column>
        <TextField value={value.name} onChange={(name) => onChange({ ...value, name: name.slice(0, 50) })} ct={ct} />
      </Row>
      <Row label={tp.hardwareModel} ct={ct}>
        <ChoiceField
          title={tp.hardwareModel}
          value={value.boardType}
          options={boards.map((b) => ({ value: b, label: b }))}
          // Choosing a Wi-Fi board switches the connection to Wi-Fi.
          onChange={(b) => onChange({ ...value, boardType: String(b), connectionType: isWifiBoard(String(b)) ? 'WI_FI' : value.connectionType })}
          ct={ct}
        />
      </Row>
      <Row label={tp.connection} ct={ct}>
        <ChoiceField
          title={tp.connection}
          value={value.connectionType}
          options={CONNECTION_TYPES}
          onChange={(c) => onChange({ ...value, connectionType: String(c) })}
          ct={ct}
        />
      </Row>
    </>
  );
}

/**
 * Device token: hidden until "Show" is tapped, selectable and shareable (to copy it into the
 * firmware). It never ends up in the logs.
 */
export function TokenField({ token, ct }: { token: string | undefined; ct: ControlTheme }) {
  const [shown, setShown] = useState(false);
  if (!token) return <Text style={[styles.hint, { color: withAlpha(ct.theme.text, 0.6) }]}>{tp.tokenAfterCreate}</Text>;
  return (
    <View style={styles.tokenBox}>
      <Text selectable={shown} style={[styles.token, { color: ct.theme.text }]} numberOfLines={shown ? undefined : 1}>
        {shown ? token : '•'.repeat(32)}
      </Text>
      <View style={styles.tokenActions}>
        <SmallButton icon={shown ? 'eye-off' : 'eye'} label={shown ? tp.hideToken : tp.showToken} onPress={() => setShown((s) => !s)} ct={ct} />
        {Platform.OS !== 'web' && <SmallButton icon="share-variant" label={tp.shareToken} onPress={() => void Share.share({ message: token })} ct={ct} />}
      </View>
    </View>
  );
}

export function SmallButton({
  icon,
  label,
  onPress,
  ct,
  color,
  disabled,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  onPress: () => void;
  ct: ControlTheme;
  color?: string;
  disabled?: boolean;
}) {
  const c = color ?? ct.accent;
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.button, { borderColor: c, opacity: disabled ? 0.4 : 1 }]} hitSlop={4}>
      <MaterialCommunityIcons name={icon} size={18} color={c} />
      <Text style={[styles.buttonText, { color: c }]}>{label.toUpperCase()}</Text>
    </Pressable>
  );
}

/** Confirmation before a destructive action (on the web with the browser confirm). */
export function confirmDestructive(title: string, message: string, action: string, onConfirm: () => void): void {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: tp.cancel, style: 'cancel' },
    { text: action, style: 'destructive', onPress: onConfirm },
  ]);
}

/**
 * Asks for confirmation before leaving with unsaved changes. Call `leave()` before an intended navigation
 * (after saving), which would otherwise be blocked.
 */
export function useUnsavedGuard(dirty: boolean): () => void {
  const navigation = useNavigation();
  const leaving = useRef(false);
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (e) => {
        if (!dirty || leaving.current) return;
        e.preventDefault();
        const go = () => {
          leaving.current = true;
          navigation.dispatch(e.data.action);
        };
        if (Platform.OS === 'web') {
          if (globalThis.confirm?.(tp.unsaved)) go();
          return;
        }
        Alert.alert(tp.unsaved, undefined, [
          { text: tp.keepEditing, style: 'cancel' },
          { text: tp.discard, style: 'destructive', onPress: go },
        ]);
      }),
    [navigation, dirty],
  );
  return () => {
    leaving.current = true;
  };
}

export function errorText(label: string, e: unknown): string {
  return `${label}: ${e instanceof Error ? e.message : String(e)}`;
}

export const projectStyles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 48, maxWidth: 640, width: '100%', alignSelf: 'center' },
  section: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  sectionTitle: { fontSize: 13, fontFamily: FONT.medium, letterSpacing: 1, marginTop: 8, marginBottom: 4 },
  headerText: { fontSize: 16, fontFamily: FONT.medium, color: '#1D1E22', paddingHorizontal: 4 },
  error: { color: '#D3435C', fontFamily: FONT.regular, marginBottom: 8 },
  hint: { fontSize: 13, fontFamily: FONT.regular, marginBottom: 6 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginVertical: 8 },
});

const styles = StyleSheet.create({
  hint: { fontSize: 13, fontFamily: FONT.regular },
  tokenBox: { gap: 8 },
  token: { fontSize: 15, fontFamily: Platform.select({ android: 'monospace', ios: 'Menlo', default: 'monospace' }) },
  tokenActions: { flexDirection: 'row', gap: 10 },
  button: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 4, paddingHorizontal: 12, paddingVertical: 8 },
  buttonText: { fontSize: 13, fontFamily: FONT.medium, letterSpacing: 0.5 },
});
