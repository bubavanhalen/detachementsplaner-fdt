// @vitest-environment jsdom
// Paket E1-02e: Textwarnungen der Seiten (R-14.3-02; Vertrag E1-02e Notiz «Ausarbeitung Schritt 2» G2, T-2,
// Änderungsnotiz E1-02c V15/V16). `textWarnings` geht alle TextItem in der Reihenfolge Seite, Element, Lauf,
// Codepunkt durch: gesperrter Codepunkt bzw. nicht NFC → `invalidCharacter`, fehlende Glyphe → `missingGlyph`, je
// (Code, Zeichen, entryId) einmal beim ersten Vorkommen. Ergänzt den PDF-Test in tests/wap/pdf/page/seite.test.ts.
// Fiktive Seitenmodelle und Pläne.
import { describe, expect, it } from 'vitest';
import { LAYOUT_WARNING_MESSAGES } from '../../../../src/model/wap/layout/page/errors';
import { textWarnings } from '../../../../src/model/wap/layout/page/warnings';
import type { PageItem, PageModel, TextItem } from '../../../../src/model/wap/layout/pageModel';
import { block, rt } from '../../support/model/builders';
import { seite } from '../../support/page/seite';
import { EINTAG, eintagPlan, KVK_WOCHE, MO } from '../../support/page/varianten';
import { base64, jpegOhneSof } from '../../support/page/wappen';

const SCHWARZ = { r: 0, g: 0, b: 0 };
/** Weiches Trennzeichen U+00AD und kombinierendes Trema U+0308 (als Code, sichtbar und nicht normalisiert). */
const SHY = String.fromCodePoint(0xad);
const TREMA = String.fromCodePoint(0x308);

function zeile(text: string | string[], entryId?: string): TextItem {
  const texte = typeof text === 'string' ? [text] : text;
  return {
    kind: 'text',
    role: entryId === undefined ? 'sidebar' : 'block',
    ...(entryId === undefined ? {} : { entryId }),
    x: 10,
    baselineY: 20,
    rotation: 0,
    sizePt: 5,
    runs: texte.map((t) => ({ text: t, weight: 'regular', color: SCHWARZ, strike: false })),
    frame: { x: 5, y: 10, w: 80, h: 20 },
  };
}

const rahmen: PageItem = {
  kind: 'rect',
  role: 'frame',
  rect: { x: 1, y: 1, w: 90, h: 90 },
  fill: null,
  stroke: { color: SCHWARZ, widthPt: 0.48, dash: null },
};

function seiteMit(items: PageItem[], kind: PageModel['kind'] = 'week'): PageModel {
  return { widthPt: 100, heightPt: 100, kind, items };
}

describe('textWarnings (R-14.3-02, G2, T-2)', () => {
  it('[R-14.3-02] gesperrter Codepunkt, zerlegtes «Ä» und fehlende Glyphe: je eine Warnung in Reihenfolge Seite, Element; je (Code, Zeichen, entryId) nur einmal', () => {
    const pages = [
      seiteMit([
        rahmen,
        zeile(`a${SHY}b`, 'e1'),
        zeile(`c${SHY}d`, 'e1'),
        zeile(SHY, 'e2'),
        zeile(`A${TREMA}`),
        zeile(['ok ', '✓✓']),
      ]),
      seiteMit(
        [zeile(`x${SHY}y`, 'e1'), zeile('fertig'), zeile('\u{1f600}', 'e3')],
        'continuation',
      ),
    ];
    expect(textWarnings(pages)).toEqual([
      {
        code: 'invalidCharacter',
        character: SHY,
        codePoint: 'U+00AD',
        entryId: 'e1',
        page: 0,
        item: 1,
      },
      {
        code: 'invalidCharacter',
        character: SHY,
        codePoint: 'U+00AD',
        entryId: 'e2',
        page: 0,
        item: 3,
      },
      {
        code: 'invalidCharacter',
        character: TREMA,
        codePoint: 'U+0308',
        entryId: null,
        page: 0,
        item: 4,
      },
      {
        code: 'missingGlyph',
        character: '✓',
        codePoint: 'U+2713',
        entryId: null,
        page: 0,
        item: 5,
      },
      {
        code: 'missingGlyph',
        character: '\u{1f600}',
        codePoint: 'U+1F600',
        entryId: 'e3',
        page: 1,
        item: 2,
      },
    ]);
  });

  it('[R-14.3-02] ohne auffällige Zeichen (auch «Ä» als U+00C4, Umlaute, «–», «…») keine Warnung; leere Seitenliste → []', () => {
    expect(textWarnings([])).toEqual([]);
    expect(
      textWarnings([
        seiteMit([rahmen, zeile(['Ä Öl über', ' – Ende…'], 'e1'), zeile('0700-0900')]),
      ]),
    ).toEqual([]);
  });

  it('[R-14.3-02] Meldungstexte der Warnungen nach Abschnitt B mit Platzhaltern {zeichen} und {code}', () => {
    expect(textWarnings([])).toEqual([]);
    expect(LAYOUT_WARNING_MESSAGES.missingGlyph).toEqual({
      cause:
        'Der Plan enthält das Zeichen «{zeichen}» ({code}), das die Schrift des WAP-Planers nicht darstellen kann.',
      nextStep: 'Das Zeichen im betroffenen Eintrag ersetzen; sonst kann kein PDF erzeugt werden.',
    });
    expect(LAYOUT_WARNING_MESSAGES.invalidCharacter).toEqual({
      cause: 'Der Plan enthält das Zeichen {code}, das im PDF anders erschiene als am Bildschirm.',
      nextStep: 'Das Zeichen im betroffenen Eintrag entfernen; sonst kann kein PDF erzeugt werden.',
    });
  });

  it('[R-14.3-02] layoutWeekPage: Warnung mit entryId des Blocks und Fundstelle des TextItem; invalidImage folgt den Textwarnungen', () => {
    const b = block('e10', 10, {
      date: MO,
      time: { form: 'range', from: 480, to: 720 },
      columns: { kind: 'ids', ids: [EINTAG.p1, EINTAG.p2] },
      title: rt('Kontrolle ✓ erledigt', true),
    });
    const plan = {
      ...eintagPlan([b]),
      coatOfArms: { mime: 'image/jpeg' as const, dataBase64: base64(jpegOhneSof()) },
    };
    const L = seite(plan, KVK_WOCHE);
    expect(L.warnings.map((w) => w.code)).toEqual(['missingGlyph', 'invalidImage']);
    const w = L.warnings[0];
    expect(w).toMatchObject({
      code: 'missingGlyph',
      character: '✓',
      codePoint: 'U+2713',
      entryId: 'e10',
    });
    const item = L.pages[w?.page ?? -1]?.items[w?.item ?? -1];
    expect(item?.kind).toBe('text');
    expect((item as TextItem).runs.map((r) => r.text).join('')).toContain('✓');
  });
});
