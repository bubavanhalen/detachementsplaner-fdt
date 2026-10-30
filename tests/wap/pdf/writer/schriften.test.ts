// @vitest-environment jsdom
// Paket E1-02c: PDF-Schreiber – Schrift serifenlos und eingebettet (R-10-36; Vertrag E1-02c §2.3 Nr 6, §2.4,
// §5; Präzisierungen P-5, P-6, P-7; V-02c-1; Änderungsnotiz Vertragsprüfung V07, V12, Runde 2 V20). Arimo
// Regular bzw. Bold als Teilmenge, Type0/CIDFontType2 mit FontFile2 und ToUnicode, Präfix nach festem
// Algorithmus; Zeichen ohne Glyphe → missingGlyph mit verbindlicher Meldung.
import { describe, expect, it } from 'vitest';
import { PdfWriteError, writePdf } from '../../../../src/io/wap-pdf/writer';
import { WapError } from '../../../../src/model/wap/errors';
import { LINE_EXCLUDED_CODEPOINTS } from '../../../../src/model/wap/layout/pageModel';
import { fontMetrics } from '../../../../src/model/wap/layout/text/metrics';
import { readPdf } from '../../support/pdf/read';
import { codepunkteVon, erwarteterPraefix } from './support/praefix';
import { anzahlName, baseFonts, fontNames } from './support/roh';
import { ablehnung, pdfMitArtefakt } from './support/schreiben';
import { fett, lauf, seite, text, zeile } from './support/seiten';

const NAME = /^[A-Z]{6}\+Arimo(-Bold)?$/;

const MISSING_NEXT = 'Das Zeichen im betroffenen Eintrag ersetzen und das PDF erneut erzeugen.';

function missingCause(zeichen: string, code: string): string {
  return `Der Plan enthält das Zeichen «${zeichen}» (${code}), das die Schrift des WAP-Planers nicht darstellen kann.`;
}

function gesperrt(cp: number): boolean {
  return LINE_EXCLUDED_CODEPOINTS.some(([a, b]) => cp >= a && cp <= b);
}

/** Erste n Zeichen mit Glyphe in beiden Schnitten, ohne Leerraum, gesperrte und kombinierende Zeichen. */
function zeichenMitGlyphe(n: number): string[] {
  const m = fontMetrics();
  const aus: string[] = [];
  for (let cp = 0x21; cp < 0x3000 && aus.length < n; cp++) {
    const z = String.fromCodePoint(cp);
    if (m.advance(cp, 'regular') === null || m.advance(cp, 'bold') === null) continue;
    if (gesperrt(cp) || /\s|\p{M}/u.test(z) || z.normalize('NFC') !== z) continue;
    aus.push(z);
  }
  return aus;
}

describe('writePdf: eingebettete Schriften (Vertrag §2.3 Nr 6)', () => {
  it('[R-10-36] zwei Schnitte: beide eingebettet, Subtyp CIDFontType2, Namen Arimo und Arimo-Bold, ToUnicode', async () => {
    const info = await readPdf(
      await pdfMitArtefakt('schriften-beide', [
        seite([text(100, 100, 'Normal Übung'), text(100, 120, 'Fett Übung', { weight: 'bold' })]),
      ]),
    );
    expect(info.fonts.map((f) => f.name).sort()).toEqual(['Arimo', 'Arimo-Bold']);
    for (const f of info.fonts) {
      expect(f.embedded, f.name).toBe(true);
      expect(f.subtype, f.name).toBe('CIDFontType2');
      expect(f.toUnicode, f.name).toBe(true);
    }
  });

  it('[R-10-36] nur verwendete Schnitte: nur regular bzw. nur bold ergibt genau eine Schrift', async () => {
    const nurRegular = await readPdf(
      await pdfMitArtefakt('schrift-regular', [seite([text(100, 100, 'Nur normal')])]),
    );
    expect(nurRegular.fonts.map((f) => f.name)).toEqual(['Arimo']);
    const nurBold = await pdfMitArtefakt('schrift-bold', [
      seite([
        text(100, 100, 'Nur fett', { weight: 'bold' }),
        zeile({ x: 1, baselineY: 2, runs: [lauf('')] }),
      ]),
    ]);
    expect((await readPdf(nurBold)).fonts.map((f) => f.name)).toEqual(['Arimo-Bold']);
    expect(anzahlName(nurBold, 'FontFile2')).toBe(1);
  });

  it('[R-10-36] ohne Text keine Schrift im PDF', async () => {
    const info = await readPdf(
      await pdfMitArtefakt('ohne-schrift', [
        seite([zeile({ x: 10, baselineY: 20, runs: [lauf(''), fett('')] })]),
      ]),
    );
    expect(info.fonts).toEqual([]);
  });

  it('[R-10-36] Rohdaten: Type0 mit CIDFontType2, FontFile2 und ToUnicode je Schnitt; Rohnamen ^[A-Z]{6}\\+Arimo(-Bold)?$', async () => {
    const bytes = await pdfMitArtefakt('schriften-roh', [
      seite([text(100, 100, 'Alpha'), text(100, 120, 'Beta', { weight: 'bold' })]),
    ]);
    expect(anzahlName(bytes, 'CIDFontType2')).toBe(2);
    expect(anzahlName(bytes, 'FontFile2')).toBe(2);
    expect(anzahlName(bytes, 'ToUnicode')).toBe(2);
    expect(anzahlName(bytes, 'Type0')).toBe(2);
    const namen = baseFonts(bytes);
    expect(namen.length).toBeGreaterThanOrEqual(2);
    for (const n of [...namen, ...fontNames(bytes)]) expect(n).toMatch(NAME);
    expect(new Set(namen.map((n) => n.slice(7)))).toEqual(new Set(['Arimo', 'Arimo-Bold']));
  });

  it('[R-10-36] (P-6) Präfix = sechs Buchstaben aus der Codepunktmenge aller gezeichneten Läufe des Schnitts im Dokument', async () => {
    const regular = ['Übung KVK', 'Mo 0700', 'zweite Seite'];
    const bold = ['FALCON', 'HAWK 1'];
    const bytes = await pdfMitArtefakt('praefix', [
      seite([
        zeile({ x: 50, baselineY: 50, runs: [lauf(regular[0] ?? ''), fett(bold[0] ?? '')] }),
        zeile({ x: 50, baselineY: 80, runs: [lauf(regular[1] ?? ''), lauf('')] }),
      ]),
      seite([zeile({ x: 50, baselineY: 50, runs: [fett(bold[1] ?? ''), lauf(regular[2] ?? '')] })]),
    ]);
    const namen = new Set(baseFonts(bytes));
    expect(namen).toContain(`${erwarteterPraefix(codepunkteVon(regular))}+Arimo`);
    expect(namen).toContain(`${erwarteterPraefix(codepunkteVon(bold))}+Arimo-Bold`);
  });

  it('[R-10-36] (P-5) Teilmenge: eine Seite mit 120 verschiedenen Zeichen je Schnitt ergibt weniger als 60 000 Byte', async () => {
    const zeichen = zeichenMitGlyphe(120);
    expect(zeichen).toHaveLength(120);
    const zeilen = [0, 1, 2, 3].map((i) => zeichen.slice(i * 30, i * 30 + 30).join(''));
    const bytes = await pdfMitArtefakt('teilmenge-groesse', [
      seite([
        ...zeilen.map((z, i) => text(40, 60 + i * 20, z, { sizePt: 8 })),
        ...zeilen.map((z, i) => text(40, 200 + i * 20, z, { sizePt: 8, weight: 'bold' })),
      ]),
    ]);
    expect(bytes.length).toBeLessThan(60_000);
    const info = await readPdf(bytes);
    expect(info.texts.map((t) => t.text)).toEqual([...zeilen, ...zeilen]);
  });
});

describe('writePdf: Zeichen ohne Glyphe (V-02c-1, P-7, V07, V20)', () => {
  it('[R-10-36] (V-02c-1, V20) U+2713 ergibt missingGlyph mit genau der verbindlichen Meldung und Fundstelle', async () => {
    expect(fontMetrics().advance(0x2713, 'regular')).toBeNull();
    const e = await ablehnung(
      writePdf({
        pages: [
          seite([text(10, 10, 'erste Seite')]),
          seite([text(10, 10, 'ok'), text(10, 30, 'Haken ✓ gesetzt')]),
        ],
        title: 'Fiktiv',
      }),
    );
    expect(e).toBeInstanceOf(PdfWriteError);
    expect(e).toBeInstanceOf(WapError);
    const f = e as PdfWriteError;
    expect(f.code).toBe('missingGlyph');
    expect(f.pageIndex).toBe(1);
    expect(f.itemIndex).toBe(1);
    expect(f.character).toBe('✓');
    expect(f.userMessage.cause).toBe(
      'Der Plan enthält das Zeichen «✓» (U+2713), das die Schrift des WAP-Planers nicht darstellen kann.',
    );
    expect(f.userMessage.nextStep).toBe(MISSING_NEXT);
    expect(f.message).toBe(f.userMessage.cause);
  });

  it('[R-10-36] (V20) U+1F600 ergibt den Code «U+1F600»; das Zeichen ist der ganze Codepunkt', async () => {
    const e = (await ablehnung(
      writePdf({ pages: [seite([text(10, 10, 'Lachen \u{1F600}')])], title: 'Fiktiv' }),
    )) as PdfWriteError;
    expect(e).toBeInstanceOf(PdfWriteError);
    expect(e.code).toBe('missingGlyph');
    expect(e.character).toBe('\u{1F600}');
    expect(e.userMessage.cause).toBe(missingCause('\u{1F600}', 'U+1F600'));
  });

  it('[R-10-36] (V07) Code mit mindestens vier Stellen: U+0378 (nicht belegt) ergibt «U+0378»', async () => {
    expect(fontMetrics().advance(0x0378, 'regular')).toBeNull();
    const e = (await ablehnung(
      writePdf({ pages: [seite([text(10, 10, 'x\u0378y')])], title: 'Fiktiv' }),
    )) as PdfWriteError;
    expect(e).toBeInstanceOf(PdfWriteError);
    expect(e.code).toBe('missingGlyph');
    expect(e.userMessage.cause).toBe(missingCause('\u0378', 'U+0378'));
  });

  it('[R-10-36] (P-7) character = erstes Zeichen ohne Glyphe im Lauf; Fundstelle = erstes Element in Seiten- und Elementreihenfolge', async () => {
    const e = (await ablehnung(
      writePdf({
        pages: [
          seite([
            text(10, 10, 'gut'),
            zeile({ x: 10, baselineY: 30, runs: [lauf('a'), lauf('b✓c\u{1F600}')] }),
            text(10, 50, '\u{1F600}'),
          ]),
        ],
        title: 'Fiktiv',
      }),
    )) as PdfWriteError;
    expect(e).toBeInstanceOf(PdfWriteError);
    expect([e.code, e.pageIndex, e.itemIndex, e.character]).toEqual(['missingGlyph', 0, 1, '✓']);
  });

  it('[R-10-36] (P-7) auch im fetten Schnitt und in einem gedrehten Lauf: missingGlyph mit Zeichen und Fundstelle', async () => {
    const e = (await ablehnung(
      writePdf({
        pages: [
          seite([
            zeile({ x: 10, baselineY: 10, rotation: 90, runs: [lauf('ok'), fett('fett ✓')] }),
          ]),
        ],
        title: 'Fiktiv',
      }),
    )) as PdfWriteError;
    expect(e).toBeInstanceOf(PdfWriteError);
    expect([e.code, e.pageIndex, e.itemIndex, e.character]).toEqual(['missingGlyph', 0, 0, '✓']);
    expect(e.userMessage.cause).toBe(missingCause('✓', 'U+2713'));
  });
});
