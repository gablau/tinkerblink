// New project: name, first device (board and connection) and theme.
// The server generates the device token; after creation the dashboard opens with the project settings on top,
// where the token can be seen and shared.
import { Redirect, Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { ChoiceField, Row, TextField, type ControlTheme } from '@/editor/controls';
import { DEFAULT_BOARD, DEFAULT_CONNECTION } from '@/project/boardTypes';
import { tp } from '@/project/strings';
import { DeviceFields, errorText, projectStyles as styles } from '@/project/ui';
import { useSession } from '@/session/SessionContext';
import type { NewDevice } from '@/session/SessionManager';
import { dashboardTheme } from '@/ui/dashboardTheme';
import { withAlpha } from '@/widgets/color';

export default function NewProjectScreen() {
  const { profile, createProject } = useSession();
  const router = useRouter();
  const [name, setName] = useState('');
  const [themeName, setThemeName] = useState('Blynk');
  const [device, setDevice] = useState<NewDevice>({ name: '', boardType: DEFAULT_BOARD, connectionType: DEFAULT_CONNECTION });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const theme = dashboardTheme(themeName);
  const ct: ControlTheme = { theme, accent: theme.accent };
  if (!profile) return <Redirect href="/" />;

  const create = async () => {
    setBusy(true);
    setError(null);
    // Empty names = "New Project" / "New Device"; the device takes the project name.
    const projectName = name.trim() || tp.defaultProjectName;
    const deviceName = device.name.trim() || name.trim() || tp.defaultDeviceName;
    try {
      const id = await createProject({ name: projectName, theme: themeName, device: { ...device, name: deviceName } });
      router.replace(`/dashboard/${id}`);
      router.push(`/project/${id}`);
    } catch (e) {
      setError(errorText(tp.createError, e));
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Stack.Screen
        options={{
          headerRight: () =>
            busy ? (
              <ActivityIndicator color="#1D1E22" />
            ) : (
              <Pressable onPress={() => void create()} hitSlop={10}>
                <Text style={styles.headerText}>{tp.create.toUpperCase()}</Text>
              </Pressable>
            ),
        }}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {error && <Text style={styles.error}>{error}</Text>}
        <View style={[styles.section, { borderBottomColor: withAlpha(theme.text, 0.1) }]}>
          <Row label={tp.projectName} ct={ct} column>
            <TextField value={name} onChange={setName} placeholder={tp.defaultProjectName} ct={ct} />
          </Row>
        </View>
        <View style={[styles.section, { borderBottomColor: withAlpha(theme.text, 0.1) }]}>
          <Text style={[styles.sectionTitle, { color: theme.accent }]}>{tp.device.toUpperCase()}</Text>
          <DeviceFields value={device} onChange={setDevice} ct={ct} />
        </View>
        <View style={styles.section}>
          <Row label={tp.theme} ct={ct}>
            <ChoiceField
              title={tp.theme}
              value={themeName}
              options={[
                { value: 'Blynk', label: tp.themeDark },
                { value: 'BlynkLight', label: tp.themeLight },
              ]}
              onChange={(v) => setThemeName(String(v))}
              ct={ct}
            />
          </Row>
        </View>
      </ScrollView>
    </View>
  );
}
