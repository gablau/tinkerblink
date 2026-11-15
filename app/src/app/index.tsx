// Login. With saved credentials (Android only) it logs in by itself.
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Link, Redirect, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { isSupported as tlsSupported } from '../../modules/tinkerblink-tls';
import { SplashView } from '@/components/SplashView';
import { DEFAULT_HOST, HOST_EXAMPLE, loadCredentials, serverAddress } from '@/session/credentials';
import { useCertificateLevel, type CertificateLevel } from '@/session/useCertificateLevel';
import { t } from '@/i18n';
import { FONT } from '@/ui/fonts';
import { useSession } from '@/session/SessionContext';
import { usePalette } from '@/ui/theme';

/** After this time, if the automatic login has not answered yet, the login form is shown. */
const SPLASH_PATIENCE_MS = 8000;

/** Amber of the certificate button when the user trusted the certificate (not in the palette). */
const TRUSTED_AMBER = '#E0A100';

export default function LoginScreen() {
  const { status, error, certificateError, profile, login, selectCertificateHost } = useSession();
  const palette = usePalette();
  const [host, setHost] = useState(DEFAULT_HOST);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [loaded, setLoaded] = useState(false);
  /** null until we know whether credentials are saved; true = automatic login in progress. */
  const [autoLogin, setAutoLogin] = useState<boolean | null>(null);
  const autoTried = useRef(false);
  // "Next" on the keyboard: server → email → password → log in.
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

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

  const leaving = Boolean(profile && status !== 'idle');
  // Checked only while the form is visible (not during the automatic login).
  const certLevel = useCertificateLevel(host, !leaving && !(waiting && patient));

  if (leaving) return <Redirect href="/projects" />;
  if (waiting && patient) return <SplashView />;

  const busy = status === 'connecting';
  /** Certificate button next to the server: Android only, for TLS addresses. */
  const canShowCertificate = tlsSupported && host.trim() !== '' && serverAddress(host)?.secure === true;
  const showCertificate = () => {
    selectCertificateHost(host);
    router.push('/certificate');
  };
  const certColor: Record<CertificateLevel, string> = {
    ok: palette.accent,
    trusted: TRUSTED_AMBER,
    problem: palette.danger,
    unknown: palette.muted,
  };
  const certLabel: Record<CertificateLevel, string> = {
    ok: t.certLevelOk,
    trusted: t.certLevelTrusted,
    problem: t.certLevelProblem,
    unknown: t.certShow,
  };
  const canSubmit = loaded && !busy && host.trim() !== '' && email.trim() !== '' && password !== '';
  const inputStyle = [styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.card }];

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.background }]}>
      {/* With the keyboard open the form scrolls above it (Android too: edge-to-edge does not resize the window). */}
      <KeyboardAvoidingView behavior="padding" style={styles.screen}>
        <ScrollView contentContainerStyle={styles.center} keyboardShouldPersistTaps="handled">
          <View style={styles.form}>
            <Text style={[styles.title, { color: palette.text }]}>{t.appTitle}</Text>
            <Text style={[styles.subtitle, { color: palette.muted }]}>{t.loginSubtitle}</Text>

            <Text style={[styles.fieldLabel, { color: palette.muted }]}>{t.server}</Text>
            <View style={styles.serverRow}>
              <TextInput
                style={[inputStyle, styles.serverInput]}
                value={host}
                onChangeText={setHost}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                placeholder={HOST_EXAMPLE}
                placeholderTextColor={palette.muted}
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => emailRef.current?.focus()}
              />
              {canShowCertificate && (
                <Pressable
                  onPress={showCertificate}
                  accessibilityLabel={certLabel[certLevel]}
                  hitSlop={4}
                  style={({ pressed }) => [
                    styles.certButton,
                    { borderColor: palette.border, backgroundColor: palette.card, opacity: pressed ? 0.6 : 1 },
                  ]}
                >
                  <MaterialCommunityIcons name="certificate-outline" size={24} color={certColor[certLevel]} />
                </Pressable>
              )}
            </View>

            <Text style={[styles.fieldLabel, { color: palette.muted }]}>{t.email}</Text>
            <TextInput
              ref={emailRef}
              style={inputStyle}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              textContentType="username"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />

            <Text style={[styles.fieldLabel, { color: palette.muted }]}>{t.password}</Text>
            <TextInput
              ref={passwordRef}
              style={inputStyle}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={() => canSubmit && void login({ host, email, password }, remember)}
            />

            {Platform.OS !== 'web' && (
              <View style={styles.row}>
                <Text style={[styles.text, { color: palette.text }]}>{t.rememberPassword}</Text>
                <Switch value={remember} onValueChange={setRemember} />
              </View>
            )}

            {error && status === 'error' && <Text style={[styles.error, { color: palette.danger }]}>{error}</Text>}
            {status === 'error' && certificateError && tlsSupported && (
              <Pressable onPress={showCertificate} hitSlop={8}>
                <Text style={[styles.certLink, { color: palette.accent }]}>{t.certShow}</Text>
              </Pressable>
            )}

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
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  form: { width: '100%', maxWidth: 420, gap: 6 },
  title: { fontSize: 32, fontFamily: FONT.regular },
  subtitle: { fontSize: 16, marginBottom: 16, fontFamily: FONT.regular },
  fieldLabel: { fontSize: 13, marginTop: 8, fontFamily: FONT.regular },
  text: { fontFamily: FONT.regular, fontSize: 15 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, fontFamily: FONT.regular },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  error: { marginTop: 8, fontFamily: FONT.regular },
  serverRow: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
  serverInput: { flex: 1 },
  certButton: { width: 48, borderWidth: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  certLink: { marginTop: 8, fontFamily: FONT.medium, fontSize: 15, textDecorationLine: 'underline' },
  button: { marginTop: 20, borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 17, fontFamily: FONT.medium },
  credits: { marginTop: 16, textAlign: 'center', fontSize: 14, fontFamily: FONT.regular, textDecorationLine: 'underline' },
});
