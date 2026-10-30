// @vitest-environment jsdom
// Paket E1-02c: Adapter fontkit 2 → pdf-lib (Vertrag E1-02c §2.2; Präzisierungen P-2, P-3, P-5; Änderungsnotiz
// Vertragsprüfung V02, V10; ADR-005 Option B). Geprüft mit dem echten Modul fontkit 2.0.4 und den gebündelten
// Arimo-Dateien; Orakel ist fontkit selbst (glyphForCodePoint der cmap, Teilmenge mit encode()).
import * as fontkit from 'fontkit';
import { describe, expect, it } from 'vitest';
import { fontBytes } from '../../../../src/assets/wap-fonts/index';
import {
  createFontkitAdapter,
  type FontkitModule,
} from '../../../../src/io/wap-pdf/fontkitAdapter';
import type { FontWeight } from '../../../../src/model/wap/layout/text/types';

const SCHNITTE: readonly FontWeight[] = ['regular', 'bold'];

/** Rohe fontkit-Schrift (ohne Adapter) als Orakel. */
function roh(weight: FontWeight): fontkit.FontkitFont {
  return fontkit.create(fontBytes(weight));
}

/** Adapter-Schrift (Schnittstelle von pdf-lib). */
function adaptiert(weight: FontWeight) {
  return createFontkitAdapter(fontkit).create(fontBytes(weight));
}

function cps(s: string): number[] {
  return Array.from(s, (c) => c.codePointAt(0) as number);
}

/** Die 27 Codepunkte aus dem Spike (P-3), die fontkit-layout durch die Leerzeichen-Glyphe ersetzt. */
const UNSICHTBAR = [
  0x034f,
  ...[0x200b, 0x200c, 0x200d, 0x200e, 0x200f],
  ...[0x202a, 0x202b, 0x202c, 0x202d, 0x202e],
  ...[0x2060, 0x2061, 0x2062, 0x2063, 0x2064],
  ...[0x2066, 0x2067, 0x2068, 0x2069, 0x206a, 0x206b, 0x206c, 0x206d, 0x206e, 0x206f],
  0xfeff,
];

/** Geteilte Glyphen von Arimo: Zweitcodepunkt → Hauptcodepunkt (Vertragsprüfung V02). */
const GETEILT: readonly (readonly [number, number])[] = [
  [0x00ad, 0x002d],
  [0x037e, 0x003b],
  [0x04d8, 0x018f],
  [0x04d9, 0x0259],
  [0x202f, 0x2009],
  [0x2215, 0x2044],
  [0xf001, 0xfb01],
  [0xf002, 0xfb02],
];

/** Wartet, bis ein Ereignis 'end' oder 'error' eingetroffen ist, und danach noch einige Takte. */
async function abwarten(ereignisse: readonly string[]): Promise<void> {
  for (let i = 0; i < 200 && !ereignisse.some((e) => e === 'end' || e === 'error'); i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
}

/** Strom von encodeStream mit allen drei Ereignissen (pdf-lib typisiert nur data und end). */
interface Strom {
  on(ereignis: 'data' | 'end' | 'error', fn: (wert?: unknown) => void): Strom;
}

describe('createFontkitAdapter: Erzeugen (P-2)', () => {
  it('[R-10-36] (P-2) wirft nie, auch nicht mit einem Modul, dessen create wirft; der Fehler kommt erst aus create', () => {
    const kaputt: FontkitModule = Object.freeze({
      create(): fontkit.FontkitFont {
        throw new Error('fiktiv: unlesbare Schrift');
      },
    });
    let adapter: ReturnType<typeof createFontkitAdapter> | undefined;
    expect(() => {
      adapter = createFontkitAdapter(kaputt);
    }).not.toThrow();
    expect(typeof adapter?.create).toBe('function');
    expect(() => adapter?.create(new Uint8Array([1, 2, 3]))).toThrow('fiktiv: unlesbare Schrift');
  });

  it('[R-10-36] (P-2) das übergebene Modul bleibt unverändert: Eigenschaften gleich, rohe Schriften verhalten sich wie vorher', () => {
    const namen = Object.getOwnPropertyNames(fontkit);
    const vorher = namen.map((n) => (fontkit as unknown as Record<string, unknown>)[n]);
    const rohVorher = roh('regular');
    const idsVorher = UNSICHTBAR.map(
      (cp) => rohVorher.layout(String.fromCodePoint(cp)).glyphs[0]?.id,
    );
    const encodeStreamVorher = typeof (
      rohVorher.createSubset() as unknown as Record<string, unknown>
    ).encodeStream;

    const adapter = createFontkitAdapter(fontkit);
    const schrift = adapter.create(fontBytes('regular'));
    schrift.layout('Übung «Muster» 0700');
    schrift.createSubset().encodeStream();

    expect(Object.getOwnPropertyNames(fontkit)).toEqual(namen);
    namen.forEach((n, i) => {
      expect(Object.is((fontkit as unknown as Record<string, unknown>)[n], vorher[i])).toBe(true);
    });
    const rohNachher = roh('regular');
    expect(
      UNSICHTBAR.map((cp) => rohNachher.layout(String.fromCodePoint(cp)).glyphs[0]?.id),
    ).toEqual(idsVorher);
    expect(
      typeof (rohNachher.createSubset() as unknown as Record<string, unknown>).encodeStream,
    ).toBe(encodeStreamVorher);
  });

  it('[R-10-36] (P-2) übrige Felder der Schrift wie bei fontkit (unitsPerEm, postscriptName, characterSet, ascent, descent)', () => {
    for (const w of SCHNITTE) {
      const a = adaptiert(w);
      const r = roh(w) as unknown as Record<string, unknown>;
      expect(a.unitsPerEm).toBe(r.unitsPerEm);
      expect(a.postscriptName).toBe(r.postscriptName);
      expect(a.characterSet).toEqual(r.characterSet);
      expect(a.ascent).toBe(r.ascent);
      expect(a.descent).toBe(r.descent);
      expect(a.bbox).toEqual(r.bbox);
    }
  });
});

describe('createFontkitAdapter: layout je Codepunkt über die cmap (P-3)', () => {
  it('[R-10-36] (P-3) je Codepunkt genau eine Glyphe mit id und advanceWidth von glyphForCodePoint (Umlaute, Satzzeichen, Leerzeichen)', () => {
    const probe = 'Übung KVK: Äpfel, Öl, Süd – «Fassung» ’ß’ é à 0700-1200 €';
    for (const w of SCHNITTE) {
      const a = adaptiert(w);
      const r = roh(w);
      const glyphen = a.layout(probe).glyphs;
      expect(glyphen.map((g) => g.id)).toEqual(cps(probe).map((cp) => r.glyphForCodePoint(cp).id));
      expect(glyphen.map((g) => g.advanceWidth)).toEqual(
        cps(probe).map((cp) => r.glyphForCodePoint(cp).advanceWidth),
      );
    }
  });

  it('[R-10-36] (P-3) die 27 unsichtbaren Codepunkte aus dem Spike erhalten ihre cmap-Glyphe, nicht die Leerzeichen-Glyphe', () => {
    for (const w of SCHNITTE) {
      const a = adaptiert(w);
      const r = roh(w);
      for (const cp of UNSICHTBAR) {
        const g = a.layout(`a${String.fromCodePoint(cp)}b`).glyphs;
        expect(g, `U+${cp.toString(16)}`).toHaveLength(3);
        expect(g[1]?.id, `U+${cp.toString(16)}`).toBe(r.glyphForCodePoint(cp).id);
        expect(g[1]?.advanceWidth, `U+${cp.toString(16)}`).toBe(
          r.glyphForCodePoint(cp).advanceWidth,
        );
      }
    }
  });

  it('[R-10-36] (P-3) keine Ligatur, keine Zerlegung, keine Zusammensetzung: «fi», «ffl», «A»+U+0308, «Ä» je Codepunkt eine Glyphe', () => {
    for (const w of SCHNITTE) {
      const a = adaptiert(w);
      const r = roh(w);
      for (const s of ['fi', 'ffl', 'A\u0308', 'Ä', 'i\u0307', 'ﬁ']) {
        expect(
          a.layout(s).glyphs.map((g) => g.id),
          s,
        ).toEqual(cps(s).map((cp) => r.glyphForCodePoint(cp).id));
      }
    }
  });

  it('[R-10-36] (P-3) angeforderte Merkmale (liga, dlig, kern, ccmp) werden nicht ausgewertet', () => {
    const a = adaptiert('regular');
    const r = roh('regular');
    const s = 'Tfi AVA Wo\u0308';
    const erwartet = cps(s).map((cp) => r.glyphForCodePoint(cp).id);
    expect(a.layout(s, ['liga', 'dlig', 'kern', 'ccmp']).glyphs.map((g) => g.id)).toEqual(erwartet);
    expect(a.layout(s, { liga: true, dlig: true, kern: true }).glyphs.map((g) => g.id)).toEqual(
      erwartet,
    );
    expect(a.layout(s).glyphs.map((g) => g.advanceWidth)).toEqual(
      cps(s).map((cp) => r.glyphForCodePoint(cp).advanceWidth),
    );
  });

  it('[R-10-36] (P-3) Zeichen ausserhalb der Ebene 0 ergeben genau eine Glyphe; Zeichen ohne Glyphe ergeben .notdef (id 0)', () => {
    const a = adaptiert('regular');
    const g = a.layout('a\u{1F600}✓b').glyphs;
    expect(g).toHaveLength(4);
    expect(g[1]?.id).toBe(0);
    expect(g[2]?.id).toBe(0);
    expect(g[0]?.id).toBe(roh('regular').glyphForCodePoint(0x61).id);
  });

  it('[R-10-36] (P-3) leerer Text ergibt keine Glyphe', () => {
    expect(adaptiert('bold').layout('').glyphs).toEqual([]);
  });
});

describe('createFontkitAdapter: geteilte Glyphen (V02)', () => {
  it('[R-10-05][R-10-36] (V02) Haupt- und Zweitcodepunkt ergeben codePoints = [Hauptcodepunkt], in beiden Schnitten', () => {
    for (const w of SCHNITTE) {
      const a = adaptiert(w);
      for (const [zweit, haupt] of GETEILT) {
        const name = `${w} U+${zweit.toString(16)}`;
        expect(a.layout(String.fromCodePoint(zweit)).glyphs[0]?.codePoints, name).toEqual([haupt]);
        expect(a.layout(String.fromCodePoint(haupt)).glyphs[0]?.codePoints, name).toEqual([haupt]);
      }
    }
  });

  it('[R-10-05][R-10-36] (V02) unabhängig von der Reihenfolge früherer Aufrufe und der Reihenfolge im Text', () => {
    for (const w of SCHNITTE) {
      const erst = adaptiert(w);
      erst.layout(';');
      const a1 = erst.layout('x\u037Ey').glyphs[1]?.codePoints;
      const zweit = adaptiert(w);
      zweit.layout('\u037E');
      const a2 = zweit.layout('a;b').glyphs[1]?.codePoints;
      const gemischt = adaptiert(w)
        .layout('\u202F\u2009\u2009\u202F')
        .glyphs.map((g) => g.codePoints);
      expect(a1).toEqual([0x3b]);
      expect(a2).toEqual([0x3b]);
      expect(gemischt).toEqual([[0x2009], [0x2009], [0x2009], [0x2009]]);
    }
  });

  it('[R-10-36] (V02) übrige Glyphen: codePoints = [Codepunkt]', () => {
    const a = adaptiert('regular');
    const s = 'Aä«-;\u2009';
    expect(a.layout(s).glyphs.map((g) => g.codePoints)).toEqual(cps(s).map((cp) => [cp]));
  });
});

describe('createFontkitAdapter: Teilmenge mit encodeStream (P-5, V10)', () => {
  it('[R-10-36] (P-5, V10) genau einmal data mit den Bytes von encode() und danach genau einmal end; on gibt den Strom zurück', async () => {
    const text = 'Übung KVK «Fassung» 0700';
    const a = adaptiert('regular');
    const teil = a.createSubset();
    const r = roh('regular');
    const orakel = r.createSubset();
    for (const cp of cps(text)) {
      teil.includeGlyph(a.glyphForCodePoint(cp));
      orakel.includeGlyph(r.glyphForCodePoint(cp).id);
    }
    const strom = teil.encodeStream() as unknown as Strom;
    const ereignisse: string[] = [];
    const daten: Uint8Array[] = [];
    expect(
      strom.on('data', (d) => {
        ereignisse.push('data');
        daten.push(d as Uint8Array);
      }),
    ).toBe(strom);
    expect(strom.on('end', () => ereignisse.push('end'))).toBe(strom);
    expect(strom.on('error', () => ereignisse.push('error'))).toBe(strom);
    expect(ereignisse).toEqual([]);
    await abwarten(ereignisse);
    expect(ereignisse).toEqual(['data', 'end']);
    expect(Array.from(daten[0] ?? [])).toEqual(Array.from(orakel.encode()));
  });

  it('[R-10-36] (V10) nie synchron: zwischen dem Anmelden von data und end trifft kein Ereignis ein; beide Empfänger erhalten ihr Ereignis', async () => {
    const a = adaptiert('bold');
    const teil = a.createSubset();
    teil.includeGlyph(a.glyphForCodePoint(0x41));
    const strom = teil.encodeStream() as unknown as Strom;
    const ereignisse: string[] = [];
    strom.on('data', () => ereignisse.push('data'));
    expect(ereignisse).toEqual([]);
    strom.on('end', () => ereignisse.push('end'));
    await abwarten(ereignisse);
    expect(ereignisse).toEqual(['data', 'end']);
  });

  it('[R-10-36] (V10) wirft encode(), meldet der Strom genau einmal error und weder data noch end', async () => {
    const fehler = new Error('fiktiv: Teilmenge nicht kodierbar');
    const glyphe: fontkit.FontkitGlyph = { id: 1, advanceWidth: 500, codePoints: [0x41] };
    const schrift: fontkit.FontkitFont = {
      postscriptName: 'Fiktiv',
      unitsPerEm: 1000,
      characterSet: [0x41],
      glyphForCodePoint: () => glyphe,
      layout: () => ({ glyphs: [glyphe] }),
      createSubset: () => ({
        includeGlyph: () => 1,
        encode: () => {
          throw fehler;
        },
      }),
    };
    const modul: FontkitModule = { create: () => schrift };
    const teil = createFontkitAdapter(modul)
      .create(new Uint8Array([0]))
      .createSubset();
    teil.includeGlyph(1);
    const strom = teil.encodeStream() as unknown as Strom;
    const ereignisse: string[] = [];
    let erhalten: unknown;
    strom.on('data', () => ereignisse.push('data'));
    strom.on('end', () => ereignisse.push('end'));
    strom.on('error', (e) => {
      ereignisse.push('error');
      erhalten = e;
    });
    expect(ereignisse).toEqual([]);
    await abwarten(ereignisse);
    expect(ereignisse).toEqual(['error']);
    expect(erhalten).toBe(fehler);
  });
});
