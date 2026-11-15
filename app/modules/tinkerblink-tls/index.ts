// Server certificates trusted by the user (Android only: elsewhere the module is missing and isSupported is
// false). See android/src/main/java/app/tinkerblink/tls.
import { requireOptionalNativeModule } from 'expo';

export interface CertificateInfo {
  host: string;
  port: number;
  /** SHA-256 of the server certificate (DER), lowercase hex. */
  sha256: string;
  /** RFC 2253 distinguished names, e.g. "CN=example.com,O=Example". */
  subject: string;
  issuer: string;
  altNames: string[];
  notBefore: number;
  notAfter: number;
  selfSigned: boolean;
  chainLength: number;
  /** Trusted by Android (system CAs and the bundled Let's Encrypt roots). */
  systemTrusted: boolean;
  systemError: string | null;
  hostnameMatches: boolean;
  /** Fingerprint trusted earlier for this host and port, if any. */
  pinned: string | null;
}

interface TlsNative {
  install(): void;
  trusted(): Record<string, string>;
  trust(host: string, port: number, sha256: string): void;
  forget(host: string, port: number): void;
  inspect(host: string, port: number): Promise<CertificateInfo>;
}

const native = requireOptionalNativeModule<TlsNative>('TinkerBlinkTls');

export const isSupported = native != null;

// Before the first connection: the trust manager must be in the React Native clients.
native?.install();

export function inspectCertificate(host: string, port: number): Promise<CertificateInfo> {
  if (!native) return Promise.reject(new Error('Not supported on this platform'));
  return native.inspect(host, port);
}

export function trustCertificate(host: string, port: number, sha256: string): void {
  native?.trust(host, port, sha256);
}

export function forgetCertificate(host: string, port: number): void {
  native?.forget(host, port);
}
