// Project clone codes (GET_CLONE_CODE / GET_PROJECT_BY_CLONE_CODE): reading a code typed or scanned, and the
// error texts. A code is a server token: 24 random bytes in URL-safe base64, 32 characters.
import { Command, ProtocolError, ResponseCode } from '@tinkerblink/protocol';
import { tp } from './strings';

const CODE = /[A-Za-z0-9_-]{32}/g;

/** The clone code in a text (typed, pasted or read from a QR code, also inside other text); null if there is none. */
export function cloneCodeFrom(text: string): string | null {
  const found = text.match(CODE);
  return found && found.length === 1 ? found[0] : null;
}

export function cloneErrorText(e: unknown): string {
  let reason = e instanceof Error ? e.message : String(e);
  if (e instanceof ProtocolError && e.command === Command.GET_PROJECT_BY_CLONE_CODE) {
    if (e.code === ResponseCode.SERVER_ERROR) reason = tp.cloneUnknownCode;
    else if (e.code === ResponseCode.ENERGY_LIMIT) reason = tp.cloneEnergy;
    else if (e.code === ResponseCode.QUOTA_LIMIT) reason = tp.cloneQuota;
  }
  return `${tp.cloneError}: ${reason}`;
}
