// Impostazioni di un widget (fase 1 dell'editor). Si lavora su una bozza, copia del JSON del profilo: "Salva"
// invia il widget completo con UPDATE_WIDGET (round-trip, i campi non toccati restano com'erano). Uscire
// non salva: si salva solo con il pulsante; uscendo con modifiche si chiede conferma.
import { Stack, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScrollLockContext } from '@/components/scrollLock';
import type { Dashboard, PinType, Widget } from '@/model/profile';
import { useSession } from '@/session/SessionContext';
import { dashboardTheme } from '@/ui/dashboardTheme';
import { FONT } from '@/ui/fonts';
import { withAlpha } from '@/widgets/color';
import { BoolField, ChoiceField, ColorField, LabelsField, NumberField, PinField, RangeField, Row, TextField, type ControlTheme } from './controls';
import { pinsForWidget } from './boards/boards';
import { editorSections, withCurrent, type Field } from './fields';
import { findFreeSpot, sameGrid } from './layoutRules';
import { PeriodsField, TabsField, TimeOfDayField } from './moreFields';
import { MultiPinField } from './multiPin';
import { usedPins } from './pinUsage';
import { StreamsField } from './streams';
import { te } from './strings';

const copy = (w: Widget): Widget => JSON.parse(JSON.stringify(w)) as Widget;

function typeName(type: string): string {
  return type
    .toLowerCase()
    .split('_')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}

function confirmDiscard(onDiscard: () => void): void {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(te.unsaved)) onDiscard();
    return;
  }
  Alert.alert(te.unsaved, undefined, [
    { text: te.keepEditing, style: 'cancel' },
    { text: te.discard, style: 'destructive', onPress: onDiscard },
  ]);
}

export function WidgetEditor({ dash, widget }: { dash: Dashboard; widget: Widget }) {
  const { updateWidget } = useSession();
  const router = useRouter();
  const navigation = useNavigation();
  const theme = dashboardTheme(dash.theme);
  const ct: ControlTheme = { theme, accent: theme.accent };
  const [draft, setDraft] = useState<Widget>(() => copy(widget));
  const [saving, setSaving] = useState(false);
  // Bloccato mentre si trascina uno stream del SuperChart (vedi components/scrollLock.ts).
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const lockScroll = useCallback((locked: boolean) => setScrollEnabled(!locked), []);
  const [error, setError] = useState<string | null>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(widget);
  const tabsWidget = dash.widgets.find((w) => w.type === 'TABS');
  const tabs = Array.isArray(tabsWidget?.tabs) ? (tabsWidget.tabs as { label?: string }[]) : [];
  const leaving = useRef(false);

  useEffect(
    () =>
      navigation.addListener('beforeRemove', (e) => {
        if (!dirty || leaving.current) return;
        e.preventDefault();
        confirmDiscard(() => {
          leaving.current = true;
          navigation.dispatch(e.data.action);
        });
      }),
    [navigation, dirty],
  );

  const set = (patch: Partial<Widget>) => setDraft((d) => ({ ...d, ...patch, ...('color' in patch ? { isDefaultColor: false } : {}) }));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateWidget(dash.id, draft);
      leaving.current = true;
      router.back();
    } catch (e) {
      setError(`${te.saveError}: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  };

  const render = (f: Field, i: number) => {
    switch (f.kind) {
      case 'text':
        return (
          <Row key={i} label={f.label} ct={ct} column={f.secret || f.multiline}>
            <TextField
              value={typeof draft[f.key] === 'string' ? (draft[f.key] as string) : ''}
              onChange={(v) => set({ [f.key]: v })}
              secret={f.secret}
              multiline={f.multiline}
              ct={ct}
            />
          </Row>
        );
      case 'number':
        return (
          <Row key={i} label={f.label} ct={ct}>
            <NumberField value={draft[f.key] as number | undefined} integer={f.integer} onChange={(v) => set({ [f.key]: v })} ct={ct} />
          </Row>
        );
      case 'bool':
        return (
          <Row key={i} label={f.label} ct={ct}>
            <BoolField value={(draft[f.key] === true) !== (f.invert === true)} onChange={(v) => set({ [f.key]: v !== (f.invert === true) })} ct={ct} />
          </Row>
        );
      case 'choice': {
        const options = f.key === 'frequency' ? withCurrent(f.options, draft[f.key]) : f.options;
        return (
          <Row key={i} label={f.label} ct={ct}>
            <ChoiceField title={f.label} value={draft[f.key]} options={options} onChange={(v) => set({ [f.key]: v })} ct={ct} />
          </Row>
        );
      }
      case 'color':
        return (
          <Row key={i} label={f.label} ct={ct} column>
            <ColorField value={draft.color} gradients={f.gradients} onChange={(v) => set({ color: v })} ct={ct} />
          </Row>
        );
      case 'pin':
        return (
          <Row key={i} label={f.label} ct={ct} column>
            <PinField
              deviceId={draft.deviceId ?? 0}
              pinType={draft.pinType}
              pin={draft.pin}
              devices={dash.devices ?? []}
              pins={pinsForWidget(widget.type, dash.devices?.find((d) => d.id === (draft.deviceId ?? 0))?.boardType)}
              used={usedPins(dash, widget, draft.deviceId ?? 0)}
              ct={ct}
              onChange={({ deviceId, pinType, pin }) =>
                setDraft((d) => {
                  const next: Widget = { ...d, deviceId, pin };
                  if (pinType) next.pinType = pinType as PinType;
                  else delete next.pinType;
                  return next;
                })
              }
            />
          </Row>
        );
      case 'range':
        return (
          <Row key={i} label={f.label} ct={ct} column>
            <RangeField min={draft.min} max={draft.max} onChange={(v) => set(v)} ct={ct} />
          </Row>
        );
      case 'labels':
        return (
          <Row key={i} label={f.label} ct={ct} column>
            <LabelsField value={Array.isArray(draft[f.key]) ? (draft[f.key] as string[]) : []} onChange={(v) => set({ [f.key]: v })} ct={ct} />
          </Row>
        );
      case 'multipin':
        return (
          <Row key={i} label={f.label} ct={ct} column>
            <MultiPinField config={f.config} widget={widget} draft={draft} setDraft={setDraft} dash={dash} ct={ct} />
          </Row>
        );
      case 'time':
        return (
          <Row key={i} label={f.label} ct={ct}>
            <TimeOfDayField value={draft[f.key]} onChange={(v) => set({ [f.key]: v })} ct={ct} />
          </Row>
        );
      case 'periods':
        return (
          <Row key={i} label={f.label} ct={ct} column>
            <PeriodsField value={draft[f.key]} onChange={(v) => set({ [f.key]: v })} ct={ct} />
          </Row>
        );
      case 'streams':
        return (
          <Row key={i} label={f.label} ct={ct} column>
            <StreamsField widget={widget} draft={draft} setDraft={setDraft} dash={dash} ct={ct} />
          </Row>
        );
      case 'tabs':
        return (
          <Row key={i} label={f.label} ct={ct} column>
            <TabsField draft={draft} widgets={dash.widgets} onChange={(tabs) => set({ tabs })} ct={ct} />
          </Row>
        );
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Stack.Screen
        options={{
          title: typeName(widget.type),
          headerRight: () =>
            saving ? (
              <ActivityIndicator color="#1D1E22" />
            ) : (
              <Pressable onPress={save} disabled={!dirty} hitSlop={10}>
                <Text style={[styles.save, { opacity: dirty ? 1 : 0.4 }]}>{te.save.toUpperCase()}</Text>
              </Pressable>
            ),
        }}
      />
      <ScrollLockContext.Provider value={lockScroll}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" scrollEnabled={scrollEnabled}>
        {error && <Text style={styles.error}>{error}</Text>}
        {editorSections(draft).map((s, si) => (
          <View key={si} style={[styles.section, { borderBottomColor: withAlpha(theme.text, 0.1) }]}>
            {s.title && <Text style={[styles.sectionTitle, { color: theme.accent }]}>{s.title.toUpperCase()}</Text>}
            {s.fields.map((f, fi) => (f.when && !f.when(draft) ? null : render(f, fi)))}
          </View>
        ))}
        {tabs.length > 1 && widget.type !== 'TABS' && (
          <View style={styles.section}>
            <Row label={te.tab} ct={ct}>
              <ChoiceField
                title={te.tab}
                value={draft.tabId ?? 0}
                options={tabs.map((tab, i) => ({ value: i, label: tab.label ?? String(i + 1) }))}
                onChange={(v) => {
                  const tabId = v as number;
                  if (tabId === (widget.tabId ?? 0)) {
                    set({ tabId, x: widget.x, y: widget.y });
                    return;
                  }
                  // Nella scheda di arrivo il widget va nel primo posto libero (riga 0 = barra delle schede).
                  const spot = findFreeSpot(draft.width, draft.height, sameGrid(dash.widgets, widget, true, tabId), 1);
                  set({ tabId, x: spot.x, y: spot.y });
                }}
                ct={ct}
              />
            </Row>
          </View>
        )}
      </ScrollView>
      </ScrollLockContext.Provider>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 48, maxWidth: 640, width: '100%', alignSelf: 'center' },
  section: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  sectionTitle: { fontSize: 13, fontFamily: FONT.medium, letterSpacing: 1, marginTop: 8 },
  save: { fontSize: 16, fontFamily: FONT.medium, color: '#1D1E22', paddingHorizontal: 4 },
  error: { color: '#D3435C', fontFamily: FONT.regular, marginBottom: 8 },
});
