// JSON-Form eines Seitenmodells für Kindprozesse und die Harness im Browser (Paket E1-02c; Vertrag E1-02c
// P-14, V14). Einzige Abweichung vom Seitenmodell: Bildbytes als Base64. Läuft in Node und im Browser
// (atob/btoa), nur Typimporte aus src/.
import type { ImageItem, PageItem, PageModel } from '../../../../../src/model/wap/layout/pageModel';

export type ItemJson =
  | Exclude<PageItem, ImageItem>
  | (Omit<ImageItem, 'bytes'> & { bytes64: string });

export interface SeiteJson {
  readonly widthPt: number;
  readonly heightPt: number;
  readonly kind: PageModel['kind'];
  readonly items: readonly ItemJson[];
}

export function zuBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

export function ausBase64(text: string): Uint8Array {
  const s = atob(text);
  const aus = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) aus[i] = s.charCodeAt(i);
  return aus;
}

export function zuJson(seite: PageModel): SeiteJson {
  return {
    widthPt: seite.widthPt,
    heightPt: seite.heightPt,
    kind: seite.kind,
    items: seite.items.map((it): ItemJson => {
      if (it.kind !== 'image') return it;
      const { bytes, ...rest } = it;
      return { ...rest, bytes64: zuBase64(bytes) };
    }),
  };
}

export function ausJson(seite: SeiteJson): PageModel {
  return {
    widthPt: seite.widthPt,
    heightPt: seite.heightPt,
    kind: seite.kind,
    items: seite.items.map((it): PageItem => {
      if (it.kind !== 'image') return it;
      const { bytes64, ...rest } = it;
      return { ...rest, bytes: ausBase64(bytes64) };
    }),
  };
}
