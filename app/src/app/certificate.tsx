// Server certificate, opened from the login when the connection failed on the certificate (Android only).
// Shows who it is issued to, by whom, the validity and the SHA-256 fingerprint, with what is wrong with it,
// and lets the user trust exactly this certificate for this server (modules/tinkerblink-tls).
import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  forgetCertificate,
  inspectCertificate,
  trustCertificate,
  type CertificateInfo,
} from '../../modules/tinkerblink-tls';
import { t } from '@/i18n';
import { serverAddress } from '@/session/credentials';
import { useSession } from '@/session/SessionContext';
import { FONT } from '@/ui/fonts';
import { usePalette } from '@/ui/theme';

interface Result {
  request: string;
  info?: CertificateInfo;
  error?: string;
  /** When the certificate was read: for "expired" / "not yet valid". */
  checkedAt: number;
}

/** "CN=example.com,O=Example" → "example.com" (or the whole name when there is no CN). */
function commonName(dn: string): string {
  return dn.match(/(?:^|,)\s*CN=((?:\\,|[^,])+)/)?.[1]?.replace(/\\,/g, ',') ?? dn;
}

/** "ab12…" → "AB:12:…" in four lines of eight bytes, easier to compare with openssl. */
function formatFingerprint(sha256: string): string {
  const pairs = sha256.toUpperCase().match(/.{2}/g) ?? [];
  return [0, 8, 16, 24].map((i) => pairs.slice(i, i + 8).join(':')).join('\n');
}

export default function CertificateScreen() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  // The server comes from the failed login, not from the URL: a deep link from another app or a web page
  // must not be able to propose a certificate to trust.
  const { showNotice, dismissError, certificateHost } = useSession();
  const address = certificateHost ? serverAddress(certificateHost) : null;
  const host = address?.secure ? address.host : null;
  const port = address?.port ?? 0;
  /** Bumped to read the certificate again (after "Stop trusting it"). */
  const [reload, setReload] = useState(0);
  const request = host ? `${host}:${port}#${reload}` : null;
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    if (!host || !request) return;
    let live = true;
    inspectCertificate(host, port)
      .then((info) => live && setResult({ request, info, checkedAt: Date.now() }))
      .catch((e: unknown) =>
        live && setResult({ request, error: `${t.certReadError}: ${e instanceof Error ? e.message : String(e)}`, checkedAt: Date.now() }),
      );
    return () => {
      live = false;
    };
  }, [host, port, request]);

  // A result of an earlier request (other server, before a reload) is not shown: still loading.
  const current = result?.request === request ? result : null;
  const info = current?.info ?? null;
  const error = host ? (current?.error ?? null) : address ? t.certNotSecure : t.certNoServer;
  const now = current?.checkedAt ?? 0;
  const problems = info
    ? [
        !info.systemTrusted && t.certNotTrusted,
        info.selfSigned && t.certSelfSigned,
        now > info.notAfter && t.certExpired,
        now < info.notBefore && t.certNotYetValid,
        !info.hostnameMatches && t.certOtherName,
      ].filter((p): p is string => Boolean(p))
    : [];
  const fine = info?.systemTrusted && info.hostnameMatches;
  const pinnedHere = info?.pinned != null && info.pinned === info.sha256;
  const changed = info?.pinned != null && info.pinned !== info.sha256;

  // A failure of the native module must not reach the event handler: in a release build it closes the app.
  const trust = () => {
    if (!info) return;
    try {
      trustCertificate(info.host, info.port, info.sha256);
    } catch (e) {
      showNotice(e instanceof Error ? e.message : String(e));
      return;
    }
    dismissError();
    showNotice(t.certTrustedNotice);
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };
  const forget = () => {
    if (!info) return;
    try {
      forgetCertificate(info.host, info.port);
    } catch (e) {
      showNotice(e instanceof Error ? e.message : String(e));
    }
    setReload((r) => r + 1);
  };

  /** "Label: value" on one line (wrapping only when the value is long). */
  const row = (label: string, value: string) => (
    <Text selectable style={[styles.value, { color: palette.text }]}>
      <Text style={{ color: palette.muted }}>{label}: </Text>
      {value}
    </Text>
  );

  return (
    <ScrollView
      style={{ backgroundColor: palette.background }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
    >
      <Stack.Screen options={{ title: t.certTitle }} />
      {!info && !error && (
        <View style={styles.loading}>
          <ActivityIndicator color={palette.accent} />
          <Text style={[styles.value, { color: palette.muted }]}>{t.certReading}</Text>
        </View>
      )}
      {error && <Text style={[styles.value, { color: palette.danger }]}>{error}</Text>}
      {info && (
        <>
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            {row(t.certServer, `${info.host}:${info.port}`)}
            {row(t.certSubject, commonName(info.subject))}
            {info.altNames.length > 0 && row(t.certNames, info.altNames.join(', '))}
            {row(t.certIssuer, commonName(info.issuer))}
            {row(t.certValidity, t.certValidRange(t.formatDateTime(new Date(info.notBefore)), t.formatDateTime(new Date(info.notAfter))))}
            <View style={styles.fingerprint}>
              <Text style={[styles.label, { color: palette.muted }]}>{t.certFingerprint}</Text>
              <Text selectable style={[styles.mono, { color: palette.text }]}>
                {formatFingerprint(info.sha256)}
              </Text>
            </View>
          </View>

          {changed && <Text style={[styles.alert, { color: palette.danger, borderColor: palette.danger }]}>{t.certChanged}</Text>}

          {problems.length > 0 && (
            <View style={styles.problems}>
              <Text style={[styles.label, { color: palette.muted }]}>{t.certProblems}</Text>
              {problems.map((p) => (
                <Text key={p} style={[styles.value, { color: palette.danger }]}>
                  • {p}
                </Text>
              ))}
              {info.systemError && <Text style={[styles.detail, { color: palette.muted }]}>{info.systemError}</Text>}
            </View>
          )}

          {fine && <Text style={[styles.value, { color: palette.accent }]}>{t.certSystemTrusted}</Text>}
          {pinnedHere && <Text style={[styles.value, { color: palette.accent }]}>{t.certAlreadyTrusted}</Text>}

          {!fine && !pinnedHere && (
            <>
              <Text style={[styles.warning, { color: palette.text }]}>{t.certWarning}</Text>
              <Pressable onPress={trust} style={[styles.button, { backgroundColor: palette.danger }]}>
                <Text style={styles.buttonText}>{t.certTrust}</Text>
              </Pressable>
            </>
          )}
          {info.pinned != null && (
            <Pressable onPress={forget} style={[styles.button, styles.outline, { borderColor: palette.border }]}>
              <Text style={[styles.outlineText, { color: palette.text }]}>{t.certForget}</Text>
            </Pressable>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, maxWidth: 640, width: '100%', alignSelf: 'center', gap: 12 },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, padding: 12, gap: 4 },
  fingerprint: { marginTop: 6, gap: 2 },
  label: { fontSize: 12, fontFamily: FONT.medium, letterSpacing: 0.5 },
  value: { fontSize: 15, fontFamily: FONT.regular },
  mono: { fontSize: 13, fontFamily: 'monospace' },
  detail: { fontSize: 12, fontFamily: FONT.regular },
  problems: { gap: 2 },
  alert: { fontSize: 15, fontFamily: FONT.medium, borderWidth: 1, borderRadius: 8, padding: 12 },
  warning: { fontSize: 14, fontFamily: FONT.regular, lineHeight: 20 },
  button: { borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontFamily: FONT.medium },
  outline: { borderWidth: 1 },
  outlineText: { fontSize: 16, fontFamily: FONT.medium },
});
