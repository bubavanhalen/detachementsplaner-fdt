import type { FontWeight } from '../../model/wap/layout/text/types';
import boldDataUrl from './Arimo-Bold.ttf?inline';
import regularDataUrl from './Arimo-Regular.ttf?inline';

/** Data-URLs der Schriftdateien im Bundle (Vite `?inline`, Base64; Vertrag E1-02b Abschnitt 1, P-3). */
const DATA_URLS: { readonly [W in FontWeight]: string } = {
  regular: regularDataUrl,
  bold: boldDataUrl,
};

const decoded: { [W in FontWeight]?: Uint8Array } = {};

/** Base64-Teil einer Data-URL in Bytes. */
function decodeDataUrl(dataUrl: string): Uint8Array {
  const binary = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Bytes der gebündelten Schriftdatei (`Arimo-Regular.ttf` bzw. `Arimo-Bold.ttf`), synchron aus dem Bundle
 * (Vite `?inline`). Jeder Aufruf liefert eine neue Kopie; ihr SHA-256 entspricht Vertrag E1-02b Abschnitt 1.
 */
export function fontBytes(weight: FontWeight): Uint8Array {
  const bytes = decoded[weight] ?? decodeDataUrl(DATA_URLS[weight]);
  decoded[weight] = bytes;
  return bytes.slice();
}
