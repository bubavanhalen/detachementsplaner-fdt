// @vitest-environment jsdom
// Paket E1-02e: Wappen-Leser der Seitenleiste (R-10-21; Vertrag E1-02e Notiz «Ausarbeitung Schritt 2» E4 «Wappen»,
// G2, J «Wappen-Leser (V07)»; V-02e-12). Lesbar ist ein PNG mit gültigem IHDR oder ein JPEG mit SOI und erstem
// SOFn aus C0–C3 oder C5–C7; sonst entfällt das Bild mit der Warnung `invalidImage`. Fiktive, zur Laufzeit
// erzeugte Bilder.
import { describe, expect, it } from 'vitest';
import { LAYOUT_WARNING_MESSAGES } from '../../../../src/model/wap/layout/page/errors';
import type { WeekPageLayout } from '../../../../src/model/wap/layout/page/types';
import type { ImageItem, PageModel } from '../../../../src/model/wap/layout/pageModel';
import type { ImageAsset, Plan } from '../../../../src/model/wap/types';
import { seite } from '../../support/page/seite';
import { KVK_WOCHE, kvk } from '../../support/page/varianten';
import {
  base64,
  jpegKopf,
  jpegOhneSof,
  pngAbgeschnitten,
  pngEinfarbig,
  pngIhdrGebrochen,
} from '../../support/page/wappen';

function mitWappen(asset: ImageAsset | null): Plan {
  return { ...kvk(), coatOfArms: asset };
}

function bilder(L: WeekPageLayout): ImageItem[] {
  return L.pages.flatMap((p: PageModel) =>
    p.items.filter((i): i is ImageItem => i.kind === 'image'),
  );
}

function bildWarnungen(L: WeekPageLayout) {
  return L.warnings.filter((w) => w.code === 'invalidImage');
}

describe('Wappen lesen (R-10-21, V07, V-02e-12)', () => {
  it('[R-10-21] PNG mit gültigem IHDR → ein ImageItem mit den dekodierten Bytes, Seitenverhältnis aus dem IHDR, keine Warnung', () => {
    const bytes = pngEinfarbig(200, 100);
    const L = seite(mitWappen({ mime: 'image/png', dataBase64: base64(bytes) }), KVK_WOCHE);
    const b = bilder(L);
    expect(b.length).toBe(1);
    const bild = b[0] as ImageItem;
    expect(bild.mime).toBe('image/png');
    expect(Array.from(bild.bytes)).toEqual(Array.from(bytes));
    expect(bild.rect.w / bild.rect.h).toBeCloseTo(2, 3);
    expect(['sidebar', 'legend', 'signature', 'sun']).toContain(bild.role);
    expect(bildWarnungen(L)).toEqual([]);
  });

  it('[R-10-21] JPEG-Köpfe mit SOF C0, C2, C7 → Bild mit Seitenverhältnis aus dem SOF (Breite 300, Höhe 100)', () => {
    for (const sof of [0xc0, 0xc2, 0xc7]) {
      const bytes = jpegKopf(sof, 300, 100);
      const L = seite(mitWappen({ mime: 'image/jpeg', dataBase64: base64(bytes) }), KVK_WOCHE);
      const b = bilder(L);
      expect(b.length, `SOF ${sof.toString(16)}`).toBe(1);
      const bild = b[0] as ImageItem;
      expect(bild.mime).toBe('image/jpeg');
      expect(Array.from(bild.bytes)).toEqual(Array.from(bytes));
      expect(bild.rect.w / bild.rect.h).toBeCloseTo(3, 3);
      expect(bildWarnungen(L)).toEqual([]);
    }
  });

  it('[R-10-21] JPEG mit SOF C9, CB, CF und JPEG ohne SOFn → kein Bild, genau eine Warnung «invalidImage» (Zeichen, Code und Element null)', () => {
    const faelle = [
      jpegKopf(0xc9, 30, 10),
      jpegKopf(0xcb, 30, 10),
      jpegKopf(0xcf, 30, 10),
      jpegOhneSof(),
    ];
    for (const bytes of faelle) {
      const L = seite(mitWappen({ mime: 'image/jpeg', dataBase64: base64(bytes) }), KVK_WOCHE);
      expect(bilder(L)).toEqual([]);
      const w = bildWarnungen(L);
      expect(w.length).toBe(1);
      expect(w[0]).toMatchObject({
        code: 'invalidImage',
        character: null,
        codePoint: null,
        item: null,
      });
    }
  });

  it('[R-10-21] PNG mit gebrochenem IHDR (Länge 8) oder abgeschnitten, PNG-Bytes als JPEG gemeldet, ungültiges Base64 → kein Bild, Warnung «invalidImage»', () => {
    const faelle: ImageAsset[] = [
      { mime: 'image/png', dataBase64: base64(pngIhdrGebrochen()) },
      { mime: 'image/png', dataBase64: base64(pngAbgeschnitten()) },
      { mime: 'image/jpeg', dataBase64: base64(pngEinfarbig(4, 4)) },
      { mime: 'image/png', dataBase64: '' },
    ];
    for (const a of faelle) {
      const L = seite(mitWappen(a), KVK_WOCHE);
      expect(bilder(L)).toEqual([]);
      expect(bildWarnungen(L).length).toBe(1);
    }
  });

  it('[R-10-21] ohne Wappen: kein Bild und keine Warnung; Meldungstext der Warnung «invalidImage» nach Abschnitt B', () => {
    const L = seite(mitWappen(null), KVK_WOCHE);
    expect(bilder(L)).toEqual([]);
    expect(bildWarnungen(L)).toEqual([]);
    expect(LAYOUT_WARNING_MESSAGES.invalidImage).toEqual({
      cause: 'Das Wappen des Plans ist kein lesbares PNG- oder JPEG-Bild.',
      nextStep: 'In den Plan-Einstellungen ein anderes Wappen wählen.',
    });
  });
});
