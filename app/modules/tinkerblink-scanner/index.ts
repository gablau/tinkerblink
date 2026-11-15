// QR code scanner (Android only: elsewhere the module is missing and isSupported is false). It uses ZXing
// (zxing-android-embedded, Apache-2.0), with no Google Play services. See android/src/main/java/app/tinkerblink/scanner.
import { requireOptionalNativeModule } from 'expo';

interface ScannerNative {
  scanQr(prompt: string): Promise<string | null>;
}

const native = requireOptionalNativeModule<ScannerNative>('TinkerBlinkScanner');

export const isSupported = native != null;

/** Opens the scanner screen; the text of the QR code, or null if the user goes back. */
export function scanQrCode(prompt: string): Promise<string | null> {
  return native ? native.scanQr(prompt) : Promise.resolve(null);
}
