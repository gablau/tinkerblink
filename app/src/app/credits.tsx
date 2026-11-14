// Credits and licenses (list in src/credits.ts). Reachable from the login and from the project list.
import Constants from 'expo-constants';
import { Stack } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CREDIT_GROUPS, DISCLAIMER } from '@/credits';
import { t } from '@/i18n';
import { FONT } from '@/ui/fonts';
import { usePalette } from '@/ui/theme';

export default function CreditsScreen() {
  const palette = usePalette();
  const version = Constants.expoConfig?.version ?? '';
  return (
    <ScrollView style={{ backgroundColor: palette.background }} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: t.credits }} />
      <Text style={[styles.app, { color: palette.text }]}>
        {t.appTitle} {version}
      </Text>
      <Text style={[styles.disclaimer, { color: palette.muted }]}>{DISCLAIMER}</Text>
      {CREDIT_GROUPS.map((g) => (
        <View key={g.title} style={styles.group}>
          <Text style={[styles.groupTitle, { color: palette.accent }]}>{g.title.toUpperCase()}</Text>
          {g.items.map((c) => (
            <Pressable
              key={c.name}
              onPress={() => void Linking.openURL(c.url).catch(() => undefined)}
              style={({ pressed }) => [styles.item, { backgroundColor: palette.card, borderColor: palette.border, opacity: pressed ? 0.7 : 1 }]}
            >
              <View style={styles.itemHead}>
                <Text style={[styles.name, { color: palette.text }]}>{c.name}</Text>
                <Text style={[styles.license, { color: palette.accent, borderColor: palette.accent }]}>{c.license}</Text>
              </View>
              <Text style={[styles.author, { color: palette.muted }]}>{c.author}</Text>
              <Text style={[styles.use, { color: palette.text }]}>{c.use}</Text>
            </Pressable>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40, maxWidth: 640, width: '100%', alignSelf: 'center', gap: 8 },
  app: { fontSize: 22, fontFamily: FONT.medium },
  disclaimer: { fontSize: 13, fontFamily: FONT.regular, lineHeight: 18 },
  group: { marginTop: 16, gap: 8 },
  groupTitle: { fontSize: 13, fontFamily: FONT.medium, letterSpacing: 1 },
  item: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, padding: 12, gap: 2 },
  itemHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { fontSize: 16, fontFamily: FONT.medium, flexShrink: 1 },
  license: { fontSize: 11, fontFamily: FONT.medium, borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 1 },
  author: { fontSize: 13, fontFamily: FONT.regular },
  use: { fontSize: 13, fontFamily: FONT.regular, marginTop: 4 },
});
