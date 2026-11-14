// Settings of a project (editable projects only, editor/policy.ts): name, theme, notifications, start and stop,
// device list (with adding) and project deletion.
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BoolField, ChoiceField, Row, TextField, type ControlTheme } from '@/editor/controls';
import { isEditableDash } from '@/editor/policy';
import { te } from '@/editor/strings';
import type { Dashboard } from '@/model/profile';
import { tp } from '@/project/strings';
import { confirmDestructive, errorText, projectStyles as styles, SmallButton, useUnsavedGuard } from '@/project/ui';
import { useDeviceOnline } from '@/session/hooks';
import { useSession } from '@/session/SessionContext';
import { dashSettingsOf } from '@/session/SessionManager';
import { dashboardTheme, type DashboardTheme } from '@/ui/dashboardTheme';
import { FONT } from '@/ui/fonts';
import { withAlpha } from '@/widgets/color';

export default function ProjectSettingsRoute() {
  const { dashId } = useLocalSearchParams<{ dashId: string }>();
  const { profile, editableDashIds } = useSession();
  if (!profile) return <Redirect href="/" />;
  const dash = profile.dashBoards.find((d) => String(d.id) === dashId);
  if (!dash) return <Text style={{ padding: 16 }}>{tp.notFound}</Text>;
  if (!isEditableDash(dash.id, editableDashIds)) return <Text style={{ padding: 16 }}>{te.notEditable}</Text>;
  return <ProjectSettings key={dash.id} dash={dash} />;
}

function DeviceRow({ dash, deviceId, name, board, theme, onPress }: { dash: Dashboard; deviceId: number; name: string; board?: string; theme: DashboardTheme; onPress: () => void }) {
  const online = useDeviceOnline(dash.id, deviceId);
  return (
    <Pressable onPress={onPress} style={[local.deviceRow, { borderBottomColor: withAlpha(theme.text, 0.08) }]}>
      <View style={[local.dot, { backgroundColor: online ? theme.accent : withAlpha(theme.text, 0.35) }]} />
      <View style={{ flex: 1 }}>
        <Text style={[local.deviceName, { color: theme.text }]}>{name}</Text>
        <Text style={[local.deviceMeta, { color: withAlpha(theme.text, 0.6) }]}>
          {board ?? '—'} · {online ? tp.online : tp.offline}
        </Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={22} color={withAlpha(theme.text, 0.6)} />
    </Pressable>
  );
}

function ProjectSettings({ dash }: { dash: Dashboard }) {
  const { updateDashSettings, setDashActive, deleteDash } = useSession();
  const router = useRouter();
  const saved = dashSettingsOf(dash);
  const [draft, setDraft] = useState(saved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const leave = useUnsavedGuard(dirty);
  // Preview of the chosen theme.
  const theme = dashboardTheme(draft.theme);
  const ct: ControlTheme = { theme, accent: theme.accent };
  const sectionStyle = [styles.section, { borderBottomColor: withAlpha(theme.text, 0.1) }];

  // If the action closes the screen (returns true) the state is no longer touched: updating the header of a screen
  // already removed from the stack crashes react-native-screens (screen stack error).
  const run = async (action: () => Promise<boolean | void>, errorLabel: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    let left = false;
    try {
      left = (await action()) === true;
    } catch (e) {
      setError(errorText(errorLabel, e));
    }
    if (!left) setBusy(false);
  };

  const save = () =>
    run(async () => {
      await updateDashSettings(dash.id, { ...draft, name: draft.name.trim() || dash.name });
      leave();
      router.back();
      return true;
    }, tp.saveError);

  const togglePlay = () =>
    run(async () => {
      const devicesOnline = await setDashActive(dash.id, dash.isActive === false);
      if (!devicesOnline) setNotice(tp.noDeviceOnline);
    }, tp.playError);

  const askDelete = () =>
    confirmDestructive(tp.deleteProject, tp.deleteProjectConfirm(dash.name), tp.delete, () =>
      void run(async () => {
        await deleteDash(dash.id);
        leave();
        router.dismissTo('/projects');
        return true;
      }, tp.deleteError),
    );

  const active = dash.isActive !== false;
  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Stack.Screen
        options={{
          headerRight: () =>
            busy ? (
              <ActivityIndicator color="#1D1E22" />
            ) : (
              <Pressable onPress={() => void save()} disabled={!dirty} hitSlop={10}>
                <Text style={[styles.headerText, { opacity: dirty ? 1 : 0.4 }]}>{tp.save.toUpperCase()}</Text>
              </Pressable>
            ),
        }}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {error && <Text style={styles.error}>{error}</Text>}
        {notice && <Text style={[styles.hint, { color: theme.accent }]}>{notice}</Text>}
        <View style={sectionStyle}>
          <Row label={tp.projectName} ct={ct} column>
            <TextField value={draft.name} onChange={(name) => setDraft((d) => ({ ...d, name }))} ct={ct} />
          </Row>
          <Row label={tp.theme} ct={ct}>
            <ChoiceField
              title={tp.theme}
              value={draft.theme}
              options={[
                { value: 'Blynk', label: tp.themeDark },
                { value: 'BlynkLight', label: tp.themeLight },
              ]}
              onChange={(v) => setDraft((d) => ({ ...d, theme: String(v) }))}
              ct={ct}
            />
          </Row>
          <Row label={tp.notifyConnected} ct={ct}>
            <BoolField value={draft.isAppConnectedOn} onChange={(v) => setDraft((d) => ({ ...d, isAppConnectedOn: v }))} ct={ct} />
          </Row>
          <Text style={[styles.hint, { color: withAlpha(theme.text, 0.6) }]}>{tp.notifyConnectedHint}</Text>
          <Row label={tp.offlineNotifsOff} ct={ct}>
            <BoolField value={draft.isNotificationsOff} onChange={(v) => setDraft((d) => ({ ...d, isNotificationsOff: v }))} ct={ct} />
          </Row>
        </View>

        <View style={sectionStyle}>
          <View style={styles.buttons}>
            <SmallButton icon={active ? 'stop' : 'play'} label={active ? tp.stop : tp.play} onPress={() => void togglePlay()} ct={ct} disabled={busy} />
          </View>
        </View>

        <View style={sectionStyle}>
          <Text style={[styles.sectionTitle, { color: theme.accent }]}>{tp.devices.toUpperCase()}</Text>
          {(dash.devices ?? []).map((d) => (
            <DeviceRow
              key={d.id}
              dash={dash}
              deviceId={d.id}
              name={d.name}
              board={d.boardType}
              theme={theme}
              onPress={() => router.push(`/project/${dash.id}/device/${d.id}`)}
            />
          ))}
          <View style={styles.buttons}>
            <SmallButton icon="plus" label={tp.addDevice} onPress={() => router.push(`/project/${dash.id}/device/new`)} ct={ct} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.accent }]}>{tp.dangerZone.toUpperCase()}</Text>
          <View style={styles.buttons}>
            <SmallButton icon="delete-outline" label={tp.deleteProject} color="#D3435C" onPress={askDelete} ct={ct} disabled={busy} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const local = StyleSheet.create({
  deviceRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  dot: { width: 10, height: 10, borderRadius: 5 },
  deviceName: { fontSize: 17, fontFamily: FONT.regular },
  deviceMeta: { fontSize: 13, fontFamily: FONT.regular },
});
