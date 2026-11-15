// Certificate status of the server address, for the colored certificate button of the login (Android only).
// The check is a TLS handshake interrupted after the server certificate (modules/tinkerblink-tls): no login, so
// no acon/adis to the devices. It runs when the login is focused (also back from the certificate screen, after
// trusting or forgetting) and half a second after the address stops changing.
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { inspectCertificate, isSupported, type CertificateInfo } from '../../modules/tinkerblink-tls';
import { serverAddress } from './credentials';

/** ok: trusted by Android; trusted: trusted by the user; problem: refused; unknown: not checked or unreachable. */
export type CertificateLevel = 'ok' | 'trusted' | 'problem' | 'unknown';

const DEBOUNCE_MS = 500;

export function certificateLevel(info: CertificateInfo, now: number): CertificateLevel {
  const inDates = now >= info.notBefore && now <= info.notAfter;
  if (info.systemTrusted && info.hostnameMatches && inDates) return 'ok';
  if (info.pinned != null && info.pinned === info.sha256) return 'trusted';
  return 'problem';
}

export function useCertificateLevel(serverField: string, enabled: boolean): CertificateLevel {
  const address = enabled && isSupported ? serverAddress(serverField) : null;
  const host = address?.secure ? address.host : null;
  const port = address?.port ?? 0;
  const key = host ? `${host}:${port}` : null;
  const [result, setResult] = useState<{ key: string; level: CertificateLevel } | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!host || !key) return;
      let live = true;
      const timer = setTimeout(() => {
        inspectCertificate(host, port)
          .then((info) => live && setResult({ key, level: certificateLevel(info, Date.now()) }))
          .catch(() => live && setResult({ key, level: 'unknown' }));
      }, DEBOUNCE_MS);
      return () => {
        live = false;
        clearTimeout(timer);
      };
    }, [host, port, key]),
  );

  return key && result?.key === key ? result.level : 'unknown';
}
