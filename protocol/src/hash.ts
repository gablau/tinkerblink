import { sha256 } from '@noble/hashes/sha2.js';

const encoder = new TextEncoder();

/**
 * Hash della password come lo calcolano app e server (SHA256Util):
 * Base64( SHA-256( password || SHA-256(email in minuscolo) ) )
 */
export function passwordHash(password: string, email: string): string {
  const salt = sha256(encoder.encode(email.toLowerCase()));
  const pass = encoder.encode(password);
  const input = new Uint8Array(pass.length + salt.length);
  input.set(pass, 0);
  input.set(salt, pass.length);
  return toBase64(sha256(input));
}

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
