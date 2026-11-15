// Connection errors in plain words. The transport only says "WebSocket error: <platform message>": on Android
// the message is the OkHttp/Java exception (e.g. "CertPathValidatorException: Trust anchor for certification
// path not found."), in Node the error code, in the browser nothing (browsers never tell why a WebSocket failed).
// The platform cannot tell a self-signed certificate from an unknown CA: both are "not trusted".
import { Platform } from 'react-native';
import { t } from '@/i18n';

type Kind = 'expired' | 'hostname' | 'untrusted' | 'tls' | 'cleartext' | 'dns' | 'refused' | 'timeout' | 'network';

// Order matters: an expired certificate is also reported as a CertPathValidatorException.
const RULES: [Kind, RegExp][] = [
  [
    'expired',
    /CertificateExpired|CertificateNotYetValid|certificate (has )?expired|CERT_HAS_EXPIRED|CERT_NOT_YET_VALID|timestamp check failed|Chain validation failed/i,
  ],
  ['hostname', /Hostname .* not verified|ERR_TLS_CERT_ALTNAME_INVALID|does not match|doesn't match|altnames/i],
  [
    'untrusted',
    /Trust anchor for certification path not found|unable to find valid certification path|CertPathValidator|self[- ]signed|unable to verify|unknown ca|UNABLE_TO_GET_ISSUER/i,
  ],
  ['cleartext', /CLEARTEXT communication/i],
  ['tls', /SSLHandshakeException|SSLProtocolException|SSLException|handshake|ssl|tls/i],
  ['dns', /Unable to resolve host|UnknownHost|ENOTFOUND|EAI_AGAIN|No address associated/i],
  ['refused', /ECONNREFUSED|Connection refused|Failed to connect/i],
  ['timeout', /timeout|timed out|ETIMEDOUT/i],
  ['network', /Network is unreachable|ENETUNREACH|Software caused connection abort|ECONNRESET|Connection reset/i],
];

const TEXT: Record<Kind, () => string> = {
  expired: () => t.connCertExpired,
  hostname: () => t.connCertHostname,
  untrusted: () => t.connCertUntrusted,
  tls: () => t.connTls,
  cleartext: () => t.connCleartext,
  dns: () => t.connDns,
  refused: () => t.connRefused,
  timeout: () => t.connTimeout,
  network: () => t.connNetwork,
};

function kindOf(message: string): Kind | undefined {
  const detail = message.replace(/^WebSocket error:?\s*/, '').trim();
  return RULES.find(([, re]) => re.test(detail))?.[0];
}

/** The server certificate was refused (untrusted, expired, other name): the user can look at it and trust it. */
export function isCertificateError(message: string): boolean {
  const kind = kindOf(message);
  return kind === 'untrusted' || kind === 'expired' || kind === 'hostname';
}

/** Plain description of a connection error, followed by the technical detail when there is one. */
export function describeConnectionError(message: string): string {
  const detail = message.replace(/^WebSocket error:?\s*/, '').trim();
  if (!detail) return Platform.OS === 'web' ? t.connFailedWeb : t.connFailed;
  const kind = kindOf(detail);
  return kind ? `${TEXT[kind]()}\n(${detail})` : message;
}
