// Login. Se ci sono credenziali salvate (solo Android), entra da solo.
import { Redirect } from 'expo-router';
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
import { DEFAULT_HOST, HOST_EXAMPLE, loadCredentials } from '@/session/credentials';
import { t } from '@/i18n';
import { FONT } from '@/ui/fonts';
import { useSession } from '@/session/SessionContext';
import { usePalette } from '@/ui/theme';

export default function LoginScreen() {
  const { status, error, profile, login } = useSession();
  const palette = usePalette();
  const [host, setHost] = useState(DEFAULT_HOST);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const autoTried = useRef(false);

  useEffect(() => {
    loadCredentials().then((c) => {
      if (c?.host) setHost(c.host);
      if (c?.email) setEmail(c.email);
      if (c?.password) setPassword(c.password);
      setLoaded(true);
      if (c?.host && c.email && c.password && !autoTried.current) {
        autoTried.current = true;
        void login({ host: c.host, email: c.email, password: c.password }, true);
      }
    });
  }, [login]);

  if (profile && status !== 'idle') return <Redirect href="/projects" />;

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
});
