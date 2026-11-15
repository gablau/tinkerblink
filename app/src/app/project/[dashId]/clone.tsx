// Share a project as a clone code: the server stores a copy and returns a code, shown as a QR code and as text.
// Any user of the same server can then create a copy of the project in New Project (scanning or typing it).
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, Share, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { QrCode } from '@/components/QrCode';
import type { ControlTheme } from '@/editor/controls';
import { isEditableDash } from '@/editor/policy';
import { te } from '@/editor/strings';
import type { Dashboard } from '@/model/profile';
import { tp } from '@/project/strings';
import { errorText, projectStyles as styles, SmallButton } from '@/project/ui';
import { useSession } from '@/session/SessionContext';
import { dashboardTheme } from '@/ui/dashboardTheme';
import { FONT } from '@/ui/fonts';
import { withAlpha } from '@/widgets/color';

export default function CloneRoute() {
  const { dashId } = useLocalSearchParams<{ dashId: string }>();
  const { profile, editableDashIds } = useSession();
  if (!profile) return <Redirect href="/" />;
  const dash = profile.dashBoards.find((d) => String(d.id) === dashId);
  if (!dash) return <Text style={{ padding: 16 }}>{tp.notFound}</Text>;
  if (!isEditableDash(dash.id, editableDashIds)) return <Text style={{ padding: 16 }}>{te.notEditable}</Text>;
  return <CloneScreen key={dash.id} dash={dash} />;
}

function CloneScreen({ dash }: { dash: Dashboard }) {
  const { getCloneCode } = useSession();
  const theme = dashboardTheme(dash.theme);
  const ct: ControlTheme = { theme, accent: theme.accent };
  const { width } = useWindowDimensions();
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // One code per opening: every request stores a new copy on the server.
  useEffect(() => {
    let live = true;
    getCloneCode(dash.id)
      .then((c) => live && setCode(c))
      .catch((e: unknown) => live && setError(errorText(tp.cloneError, e)));
    return () => {
      live = false;
    };
  }, [getCloneCode, dash.id]);

  const muted = withAlpha(theme.text, 0.6);
  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.background }} contentContainerStyle={styles.content}>
      <Text style={[local.name, { color: theme.text }]}>{dash.name}</Text>
      {error && <Text style={styles.error}>{error}</Text>}
      {!code && !error && <ActivityIndicator color={theme.accent} style={{ marginVertical: 48 }} />}
      {code && (
        <>
          <View style={local.qr}>
            <QrCode value={code} size={Math.min(width - 32, 320)} />
          </View>
          <Text style={[styles.sectionTitle, { color: theme.accent }]}>{tp.cloneCode.toUpperCase()}</Text>
          <Text selectable style={[local.code, { color: theme.text }]}>
            {code}
          </Text>
          {Platform.OS !== 'web' && (
            <View style={styles.buttons}>
              <SmallButton icon="share-variant" label={tp.shareClone} onPress={() => void Share.share({ message: code })} ct={ct} />
            </View>
          )}
        </>
      )}
      <Text style={[styles.hint, { color: muted, marginTop: 12 }]}>{tp.cloneCodeHint}</Text>
      <Text style={[styles.hint, { color: muted }]}>{tp.cloneWarning}</Text>
    </ScrollView>
  );
}

const local = StyleSheet.create({
  name: { fontSize: 20, fontFamily: FONT.regular, marginBottom: 12 },
  qr: { alignItems: 'center', marginVertical: 8 },
  code: { fontSize: 15, fontFamily: Platform.select({ android: 'monospace', ios: 'Menlo', default: 'monospace' }), marginBottom: 4 },
});
