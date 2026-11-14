// Login. With saved credentials (Android only) it logs in by itself.
import { Link, Redirect } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SplashView } from '@/components/SplashView';
import { DEFAULT_HOST, HOST_EXAMPLE, loadCredentials } from '@/session/credentials';
import { t } from '@/i18n';
import { FONT } from '@/ui/fonts';
import { useSession } from '@/session/SessionContext';
import { usePalette } from '@/ui/theme';

/** After this time, if the automatic login has not answered yet, the login form is shown. */
const SPLASH_PATIENCE_MS = 8000;

export default function LoginScreen() {
  const { status, error, profile, login } = useSession();
  const palette = usePalette();
  const [host, setHost] = useState(DEFAULT_HOST);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [loaded, setLoaded] = useState(false);
  /** null until we know whether credentials are saved; true = automatic login in progress. */
  const [autoLogin, setAutoLogin] = useState<boolean | null>(null);
  const autoTried = useRef(false);

  useEffect(() => {
    loadCredentials().then((c) => {
      if (c?.host) setHost(c.host);
      if (c?.email) setEmail(c.email);
      if (c?.password) setPassword(c.password);
      setLoaded(true);
      const auto = Boolean(c?.host && c.email && c.password) && !autoTried.current;
      setAutoLogin(auto);
      if (auto && c?.host && c.email && c.password) {
        autoTried.current = true;
        void login({ host: c.host, email: c.email, password: c.password }, true);
      }
    });
  }, [login]);

  // During the automatic login a copy of the splash (SplashView) replaces the form: the app goes from the splash
  // straight to the projects. The native splash closes as soon as the copy is there, and they look the same (in the
  // dev build the native one disappears earlier, while Metro loads the JavaScript). If the server does not answer
  // within SPLASH_PATIENCE_MS the form is shown anyway, with the spinner.
  const waiting = autoLogin === null || (autoLogin && (status === 'idle' || status === 'connecting'));
  const [patient, setPatient] = useState(true);
  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => undefined);
    const timer = setTimeout(() => setPatient(false), SPLASH_PATIENCE_MS);
    return () => clearTimeout(timer);
  }, []);

  if (profile && status !== 'idle') return <Redirect href="/projects" />;
  if (waiting && patient) return <SplashView />;

  const busy = status === 'connecting';
  const canSubmit = loaded && !busy && host.trim() !== '' && email.trim() !== '' && password !== '';
  const inputStyle = [styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.card }];

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.center}>
        <View style={styles.form}>
          <Text style={[styles.title, { color: palette.text }]}>{t.appTitle}</Text>
          <Text style={[styles.subtitle, { color: palette.muted }]}>{t.loginSubtitle}</Text>

          <Text style={[styles.fieldLabel, { color: palette.muted }]}>{t.server}</Text>
          <TextInput
            style={inputStyle}
            value={host}
            onChangeText={setHost}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder={HOST_EXAMPLE}
            placeholderTextColor={palette.muted}
          />

          <Text style={[styles.fieldLabel, { color: palette.muted }]}>{t.email}</Text>
          <TextInput
            style={inputStyle}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="username"
          />

          <Text style={[styles.fieldLabel, { color: palette.muted }]}>{t.password}</Text>
          <TextInput
            style={inputStyle}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            textContentType="password"
            onSubmitEditing={() => canSubmit && void login({ host, email, password }, remember)}
          />

          {Platform.OS !== 'web' && (
            <View style={styles.row}>
              <Text style={[styles.text, { color: palette.text }]}>{t.rememberPassword}</Text>
              <Switch value={remember} onValueChange={setRemember} />
            </View>
          )}

          {error && status === 'error' && <Text style={[styles.error, { color: palette.danger }]}>{error}</Text>}

          <Pressable
            disabled={!canSubmit}
            onPress={() => void login({ host, email, password }, remember)}
            style={[styles.button, { backgroundColor: palette.accent, opacity: canSubmit ? 1 : 0.5 }]}
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t.logIn}</Text>}
          </Pressable>
          <Link href="/credits" style={[styles.credits, { color: palette.muted }]}>
            {t.credits}
          </Link>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  form: { width: '100%', maxWidth: 420, gap: 6 },
  title: { fontSize: 32, fontFamily: FONT.regular },
  subtitle: { fontSize: 16, marginBottom: 16, fontFamily: FONT.regular },
  fieldLabel: { fontSize: 13, marginTop: 8, fontFamily: FONT.regular },
  text: { fontFamily: FONT.regular, fontSize: 15 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, fontFamily: FONT.regular },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  error: { marginTop: 8, fontFamily: FONT.regular },
  button: { marginTop: 20, borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 17, fontFamily: FONT.medium },
  credits: { marginTop: 16, textAlign: 'center', fontSize: 14, fontFamily: FONT.regular, textDecorationLine: 'underline' },
});
