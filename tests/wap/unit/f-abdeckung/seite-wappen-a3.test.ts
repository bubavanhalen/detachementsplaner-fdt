// @vitest-environment node
// F-ABDECKUNG (FT-A-01): Seitenkomposition in Fehler- und Grenzfällen (Vertrag E1-02e Notiz «Ausarbeitung Schritt 2»
// E4 Wappen-Leser V07, G2 Textwarnungen; Vertrag E1-10 Abschnitt 1 A3): unlesbare Wappen in allen Formen ergeben
// genau eine Warnung invalidImage und kein Bild; lesbare Wappen ein Bild; A3 skaliert jedes Element gleich.
// Fiktive Bilder, zur Laufzeit erzeugt.
import { describe, expect, it } from 'vitest';
import { setDayDisplay } from '../../../../src/model/wap/commands/days';
import {
  A3_PAPER,
  a3,
  layoutSidebar,
  layoutWeekPage,
  type PageContext,
  pageFrame,
  pageGeometryFor,
} from '../../../../src/model/wap/layout/page';
import { builtInTemplates, templateById } from '../../../../src/model/wap/template';
import type { ImageAsset, Plan } from '../../../../src/model/wap/types';
import { pageOptions } from '../../support/i3/seite';
import { add, block, CTX, kpPlan, MO } from '../../support/i5/plan';
import { base64, jpegKopf, pngEinfarbig } from '../../support/page/wappen';

const wk = (plan: Plan) => plan.weeks[0]?.id ?? '';
const layout = (plan: Plan) => layoutWeekPage(plan, wk(plan), pageOptions());

function mitWappen(asset: ImageAsset | null): Plan {
  return { ...kpPlan(1), coatOfArms: asset };
}
const png = (bytes: Uint8Array): ImageAsset => ({ mime: 'image/png', dataBase64: base64(bytes) });
const jpeg = (bytes: Uint8Array): ImageAsset => ({ mime: 'image/jpeg', dataBase64: base64(bytes) });

function ergebnis(asset: ImageAsset): { bilder: number; invalidImage: number } {
  const l = layout(mitWappen(asset));
  return {
    bilder: l.pages.flatMap((p) => p.items).filter((i) => i.kind === 'image').length,
    invalidImage: l.warnings.filter((w) => w.code === 'invalidImage').length,
  };
}
const LESBAR = { bilder: 1, invalidImage: 0 };
const UNLESBAR = { bilder: 0, invalidImage: 1 };

/** JPEG aus Segmenten: SOI, dann die angegebenen Bytes. */
const jpegAus = (...teile: number[][]): Uint8Array =>
  Uint8Array.from([0xff, 0xd8, ...teile.flat()]);
const seg = (marker: number, daten: number[]): number[] => {
  const l = daten.length + 2;
  return [0xff, marker, l >> 8, l & 0xff, ...daten];
};
const sof = (marker: number, w: number, h: number): number[] =>
  seg(marker, [8, h >> 8, h & 0xff, w >> 8, w & 0xff, 1, 1, 0x11, 0]);

describe('F-ABDECKUNG Wappen: Base64 (V07)', () => {
  it('[R-10-21] Base64 mit Zeilenumbrüchen und Leerraum ist lesbar', () => {
    const b64 = base64(pngEinfarbig(4, 2)).replace(/(.{16})/g, '$1\r\n ');
    expect(ergebnis({ mime: 'image/png', dataBase64: b64 })).toEqual(LESBAR);
  });

  it('[R-10-21] Fehlerpfad: Länge nicht durch 4 teilbar, fremdes Zeichen, nicht kanonische Endbits, leer → invalidImage', () => {
    const gut = base64(pngEinfarbig(4, 2));
    expect(ergebnis({ mime: 'image/png', dataBase64: gut.slice(0, -1) })).toEqual(UNLESBAR);
    expect(ergebnis({ mime: 'image/png', dataBase64: `*${gut.slice(1)}` })).toEqual(UNLESBAR);
    // «QR==» kodiert 0x45 mit gesetzten Restbits (kanonisch wäre «RQ==»).
    expect(ergebnis({ mime: 'image/png', dataBase64: 'QR==' })).toEqual(UNLESBAR);
    expect(ergebnis({ mime: 'image/png', dataBase64: '' })).toEqual(UNLESBAR);
    // «=» mitten im Text ist kein Alphabetzeichen.
    expect(
      ergebnis({ mime: 'image/png', dataBase64: `${gut.slice(0, 4)}=A==${gut.slice(8)}` }),
    ).toEqual(UNLESBAR);
  });

  it('[R-10-21] Auffüllung mit einem und zwei «=»: Länge des PNG unverändert lesbar', () => {
    // 31 bzw. 32 Bytes ergeben Auffüllung 2 bzw. 1 (PNG mit angehängten Nullbytes bleibt lesbar).
    for (const extra of [0, 1, 2]) {
      const bytes = Uint8Array.from([...pngEinfarbig(2, 2), ...new Array<number>(extra).fill(0)]);
      expect(ergebnis(png(bytes))).toEqual(LESBAR);
    }
  });
});

describe('F-ABDECKUNG Wappen: PNG und JPEG (V07)', () => {
  it('[R-10-21] PNG: falsche Signatur, Breite 0, zu kurz → invalidImage; als JPEG deklariertes PNG ebenso', () => {
    const ok = pngEinfarbig(4, 2);
    const falsch = Uint8Array.from(ok);
    falsch[1] = 0x51;
    expect(ergebnis(png(falsch))).toEqual(UNLESBAR);
    const breite0 = Uint8Array.from(ok);
    breite0.set([0, 0, 0, 0], 16);
    expect(ergebnis(png(breite0))).toEqual(UNLESBAR);
    expect(ergebnis(png(ok.subarray(0, 28)))).toEqual(UNLESBAR);
    expect(ergebnis(jpeg(ok))).toEqual(UNLESBAR);
  });

  it('[R-10-21] JPEG: Füllbytes 0xFF vor dem Marker und Marker ohne Länge (RST, TEM) werden übergangen', () => {
    const bytes = jpegAus(
      [0xff, 0xff, 0xd0],
      [0xff, 0x01],
      seg(0xe0, [1, 2, 3]),
      sof(0xc0, 40, 30),
    );
    expect(ergebnis(jpeg(bytes))).toEqual(LESBAR);
  });

  it('[R-10-21] JPEG: lesbare SOFn C1, C2, C3, C5, C6, C7 → Bild', () => {
    for (const m of [0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7])
      expect(ergebnis(jpeg(jpegKopf(m, 40, 30)))).toEqual(LESBAR);
  });

  it('[R-10-21] JPEG: arithmetische SOFn (C9, CA, CB, CD, CE, CF) → invalidImage; DHT/JPG/DAC sind keine SOFn', () => {
    for (const m of [0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf])
      expect(ergebnis(jpeg(jpegKopf(m, 40, 30)))).toEqual(UNLESBAR);
    // C4, C8, CC vor dem SOF0 werden übersprungen wie andere Segmente.
    const bytes = jpegAus(seg(0xc4, [0, 1]), seg(0xc8, [0]), seg(0xcc, [0, 0]), sof(0xc0, 40, 30));
    expect(ergebnis(jpeg(bytes))).toEqual(LESBAR);
  });

  it('[R-10-21] JPEG Fehlerpfade: kein SOI, kein Marker, EOI/SOS vor SOFn, Länge < 2, Länge über das Ende, SOF zu kurz, Masse 0', () => {
    const faelle: Uint8Array[] = [
      Uint8Array.from([0x00, 0xd8, ...sof(0xc0, 4, 4)]),
      jpegAus([0x00, 0xc0]),
      jpegAus([0xff, 0xd9]),
      jpegAus([0xff, 0xda, 0, 2]),
      jpegAus([0xff, 0xe0, 0, 1]),
      jpegAus([0xff, 0xe0, 0, 40, 1, 2]),
      jpegAus(seg(0xc0, [8, 0, 4])),
      jpegAus(sof(0xc0, 0, 30)),
      jpegAus(sof(0xc0, 40, 0)),
      jpegAus([0xff]),
    ];
    for (const f of faelle) expect(ergebnis(jpeg(f))).toEqual(UNLESBAR);
  });

  it('[R-10-21] Ohne Wappen: weder Bild noch Warnung', () => {
    const l = layout(mitWappen(null));
    expect(l.warnings.filter((w) => w.code === 'invalidImage')).toEqual([]);
    expect(l.pages.flatMap((p) => p.items).filter((i) => i.kind === 'image')).toEqual([]);
  });
});

describe('F-ABDECKUNG A3 (Vertrag E1-10 Abschnitt 1)', () => {
  it('[R-10-04] A3: Seitengrösse 1190,55 × 841,89; jedes Element um denselben Faktor skaliert, Texte und Umbrüche gleich', () => {
    let plan = mitWappen(png(pngEinfarbig(4, 2)));
    plan = { ...plan, sunLocation: 'St. Gallen' };
    plan = block(plan, 'Ausb Mö').plan;
    const a4 = layout(plan);
    const gross = a3(a4);
    expect(gross.pages).toHaveLength(a4.pages.length);
    const k = A3_PAPER.widthPt / (a4.pages[0]?.widthPt ?? 1);
    expect(k).toBeCloseTo(Math.SQRT2, 2);
    const kinds = new Set<string>();
    gross.pages.forEach((p, pi) => {
      expect([p.widthPt, p.heightPt]).toEqual([1190.55, 841.89]);
      const alt = a4.pages[pi];
      if (alt === undefined) throw new Error('Seite fehlt');
      expect(p.items).toHaveLength(alt.items.length);
      p.items.forEach((it, ii) => {
        const vorher = alt.items[ii];
        if (vorher === undefined || vorher.kind !== it.kind) throw new Error('Element fehlt');
        kinds.add(it.kind);
        switch (it.kind) {
          case 'text':
            if (vorher.kind !== 'text') break;
            expect(it.runs).toEqual(vorher.runs);
            expect(it.sizePt).toBeCloseTo(vorher.sizePt * k, 6);
            expect(it.x).toBeCloseTo(vorher.x * k, 6);
            expect(it.frame.w).toBeCloseTo(vorher.frame.w * k, 6);
            break;
          case 'rect':
          case 'image':
            if (vorher.kind !== it.kind) break;
            expect(it.rect.h).toBeCloseTo(vorher.rect.h * k, 6);
            break;
          case 'line':
            if (vorher.kind !== 'line') break;
            expect(it.y2).toBeCloseTo(vorher.y2 * k, 6);
            expect(it.stroke.widthPt).toBeCloseTo(vorher.stroke.widthPt * k, 6);
            break;
          case 'path':
            if (vorher.kind !== 'path') break;
            expect(it.d.match(/-?\d+(?:\.\d+)?/g)?.length).toBe(
              vorher.d.match(/-?\d+(?:\.\d+)?/g)?.length,
            );
            break;
        }
      });
    });
    expect([...kinds].sort()).toEqual(['image', 'line', 'path', 'rect', 'text']);
    // Rückfallereignisse und Raster bleiben (gleiche Umbrüche).
    expect(gross.fallbacks).toEqual(a4.fallbacks);
    expect(gross.grid).toBe(a4.grid);
  });

  it('[R-10-04] A3 Pfaddaten: Zahlen ohne Exponent, höchstens 4 Nachkommastellen, «-0» wird «0», gestrichelte Linien skaliert', () => {
    const seite = {
      pages: [
        {
          widthPt: A3_PAPER.widthPt / 2,
          heightPt: 1,
          kind: 'week',
          items: [
            {
              kind: 'path',
              role: 'x',
              d: 'M 1 -0.00001 L .5 2.25 Z',
              fill: null,
              stroke: { widthPt: 1, color: { r: 0, g: 0, b: 0 }, dash: [1, 2] },
            },
            {
              kind: 'rect',
              role: 'y',
              rect: { x: 1, y: 2, w: 3, h: 4 },
              fill: null,
              stroke: null,
            },
            {
              kind: 'path',
              role: 'z',
              d: 'M 0.33333 0',
              fill: null,
              stroke: null,
            },
          ],
        },
      ],
      fallbacks: [],
    } as unknown as Parameters<typeof a3>[0];
    const [p0] = a3(seite).pages;
    const [pfad, rechteck, pfad2] = p0?.items ?? [];
    expect(pfad).toMatchObject({ d: 'M 2 0 L 1 4.5 Z', stroke: { widthPt: 2, dash: [2, 4] } });
    expect(rechteck).toMatchObject({ rect: { x: 2, y: 4, w: 6, h: 8 }, stroke: null });
    expect(pfad2).toMatchObject({ d: 'M 0.6667 0', stroke: null });
  });
});

describe('F-ABDECKUNG Textwarnungen (G2, R-14.3-02)', () => {
  it('[R-14.3-02] Zeichen, das nicht in NFC steht (Ångström-Zeichen U+212B), ergibt invalidCharacter mit Codepunkt', () => {
    const plan = block(kpPlan(1), 'Mass Å').plan;
    const w = layout(plan).warnings.filter((x) => x.code === 'invalidCharacter');
    expect(w.map((x) => [x.character, x.codePoint])).toContainEqual(['Å', 'U+212B']);
  });

  it('[R-14.3-02] Kombinierendes Zeichen (Kategorie M) ergibt invalidCharacter für das Zeichen selbst', () => {
    const plan = block(kpPlan(1), 'Café').plan;
    const w = layout(plan).warnings.filter((x) => x.code === 'invalidCharacter');
    expect(w.map((x) => x.codePoint)).toContain('U+0301');
  });
});

/** Fiktiver Text aus n Wörtern (übervoll für jede Region). */
const uebervoll = (n: number): string =>
  Array.from({ length: n }, (_, i) => `Wort${String(i)}`).join(' ');
const texteDerSeite = (plan: Plan, seite: number): string =>
  (layout(plan).pages[seite]?.items ?? [])
    .flatMap((i) => (i.kind === 'text' ? [i.runs.map((r) => r.text).join('')] : []))
    .join(' | ');

describe('F-ABDECKUNG Rückfallregel: eine Einheit grösser als eine ganze Seite (R-10-42, R-10-43)', () => {
  it('[R-10-42][R-10-43] Terminbereich: übervolle Bemerkung → Fortsetzungsseite; auf ihr mit «…» gekürzt; der nächste Termin folgt auf der dritten Seite', () => {
    let plan = kpPlan(1);
    const lang = add(plan, { type: 'dayRemark', date: MO, text: uebervoll(1500) });
    plan = add(lang.plan, { type: 'dayRemark', date: MO, text: 'Nachher fiktiv' }).plan;
    const l = layout(plan);
    expect(l.pages.map((p) => p.kind)).toEqual(['week', 'continuation', 'continuation']);
    expect(l.fallbacks.map((e) => [e.kind, e.region, e.entryId])).toEqual([
      ['continuationPage', 'agenda', lang.id],
      ['ellipsis', 'agenda', lang.id],
    ]);
    expect(texteDerSeite(plan, 1)).toContain('…');
    expect(texteDerSeite(plan, 1)).toContain('Fortsetzung – KVK');
    expect(texteDerSeite(plan, 2)).toContain('Nachher fiktiv');
    expect(texteDerSeite(plan, 0)).not.toContain('Nachher fiktiv');
  });

  it('[R-10-42][R-10-43] Seitenleiste: übervolles Wochenziel, Bereitschaftstext bzw. Bemerkung → Fortsetzung und «…» mit Feld', () => {
    const base = kpPlan(1);
    const w = base.weeks[0];
    if (w === undefined) throw new Error('Woche fehlt');
    const ziel: Plan = {
      ...base,
      weeks: [{ ...w, weekGoals: [{ id: 'g1', text: uebervoll(1500), group: null }] }],
    };
    const bereit: Plan = { ...base, weeks: [{ ...w, heightenedReadiness: uebervoll(1500) }] };
    const bem = add(base, {
      type: 'multiDayRemark',
      text: uebervoll(1500),
      scope: { kind: 'plan' },
    });
    const ev = (p: Plan) => layout(p).fallbacks.map((e) => [e.kind, e.region, e.field, e.entryId]);
    expect(ev(ziel)).toEqual([
      ['continuationPage', 'sidebar', 'goal', null],
      ['ellipsis', 'sidebar', 'goal', null],
    ]);
    expect(ev(bereit)).toEqual([
      ['continuationPage', 'sidebar', 'readiness', null],
      ['ellipsis', 'sidebar', 'readiness', null],
    ]);
    expect(ev(bem.plan)).toEqual([
      ['continuationPage', 'sidebar', 'remark', bem.id],
      ['ellipsis', 'sidebar', 'remark', bem.id],
    ]);
    for (const p of [ziel, bereit, bem.plan]) {
      expect(layout(p).pages).toHaveLength(2);
      expect(texteDerSeite(p, 1)).toContain('…');
    }
  });
});

describe('F-ABDECKUNG Kopf und Raster in Grenzfällen', () => {
  it('[R-10-43] Überlange Kopfangaben: Titel, Beilage, Klassifizierung und Einheit je mit «…» gekürzt, je ein Ereignis', () => {
    const lang = uebervoll(200);
    const plan: Plan = {
      ...kpPlan(1),
      unit: lang,
      exerciseName: lang,
      beilage: lang,
      classification: lang,
    };
    const ev = layout(plan).fallbacks.filter((e) => e.region === 'header');
    expect(ev.map((e) => [e.kind, e.field])).toEqual([
      ['ellipsis', 'title'],
      ['ellipsis', 'beilage'],
      ['ellipsis', 'classification'],
      ['ellipsis', 'unit'],
    ]);
  });

  it('[R-4.3-04] Grenzfall: alle sieben Tage ausgeblendet → eine Seite ohne Tagesspalten, ohne Rückfallereignis', () => {
    const base = kpPlan(1);
    const plan = setDayDisplay(
      base,
      wk(base),
      ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'],
      'hidden',
      CTX,
    ).plan;
    const l = layout(plan);
    expect(l.pages).toHaveLength(1);
    expect(l.grid.days).toEqual([]);
    expect(l.fallbacks).toEqual([]);
    expect(texteDerSeite(plan, 0)).not.toMatch(/Mo 28\.09\./);
  });
});

describe('F-ABDECKUNG Seitenleiste einzeln (layoutSidebar, Vertrag E1-02e Abschnitt B)', () => {
  function kontext(plan: Plan): PageContext {
    const week = plan.weeks[0];
    if (week === undefined) throw new Error('Woche fehlt');
    const template = templateById(plan.templateId, builtInTemplates());
    const geometry = pageGeometryFor(template.pageGeometryId);
    return {
      plan,
      week,
      template,
      geometry,
      frame: pageFrame(geometry, plan, week.id, template),
      options: pageOptions(),
    };
  }
  const bilder = (plan: Plan) =>
    layoutSidebar(kontext(plan))
      .parts.flatMap((p) => p.items)
      .filter((i) => i.kind === 'image').length;

  it('[R-10-21] layoutSidebar dekodiert das Wappen selbst: lesbar → ein Bild, unlesbar oder ohne → keines', () => {
    expect(bilder(mitWappen(png(pngEinfarbig(4, 2))))).toBe(1);
    expect(bilder(mitWappen({ mime: 'image/png', dataBase64: 'QR==' }))).toBe(0);
    expect(bilder(mitWappen(null))).toBe(0);
  });
});
