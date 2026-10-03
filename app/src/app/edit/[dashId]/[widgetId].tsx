// Editor: impostazioni di un widget. Solo per le dashboard ammesse (editor/policy.ts).
import { Redirect, useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native';
import { isEditableDash } from '@/editor/policy';
import { te } from '@/editor/strings';
import { WidgetEditor } from '@/editor/WidgetEditor';
import { t } from '@/i18n';
import { useSession } from '@/session/SessionContext';

export default function WidgetEditScreen() {
  const { dashId, widgetId } = useLocalSearchParams<{ dashId: string; widgetId: string }>();
  const { profile } = useSession();
  if (!profile) return <Redirect href="/" />;
  const dash = profile.dashBoards.find((d) => String(d.id) === dashId);
  const widget = dash?.widgets.find((w) => String(w.id) === widgetId);
  if (!dash || !widget) return <Text style={{ padding: 16 }}>{t.dashboardNotFound}</Text>;
  if (!isEditableDash(dash.id)) return <Text style={{ padding: 16 }}>{te.notEditable}</Text>;
  return <WidgetEditor key={`${dash.id}-${widget.id}`} dash={dash} widget={widget} />;
}
