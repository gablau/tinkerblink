import { sha256 } from '@noble/hashes/sha2.js';
import { strToU8 } from 'fflate';

/**
 * Hash della password come lo calcolano app e server (SHA256Util):
 * Base64( SHA-256( password || SHA-256(email in minuscolo) ) )
 */
export function passwordHash(password: string, email: string): string {
  const salt = sha256(strToU8(email.toLowerCase()));
  const pass = strToU8(password);
  const input = new Uint8Array(pass.length + salt.length);
  input.set(pass, 0);
  input.set(salt, pass.length);
  return toBase64(sha256(input));
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Base64 standard con padding, senza dipendere da btoa/Buffer. */
function toBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]!;
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out += B64[b0 >> 2]!;
    out += B64[((b0 & 3) << 4) | ((b1 ?? 0) >> 4)]!;
    out += b1 === undefined ? '=' : B64[((b1 & 15) << 2) | ((b2 ?? 0) >> 6)]!;
    out += b2 === undefined ? '=' : B64[b2 & 63]!;
  }
  return out;
}
