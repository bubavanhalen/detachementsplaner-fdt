// @vitest-environment jsdom
// F-FIX Runde 5, Befund UX-AB-01 (SA-34-Nacharbeit): Zerlegung des Formtexts nach Beschrieb 8.2 Regel 12 und
// normalisierung.md 5.1 – Klammer = Ort, ausser Name oder Funktion (dann Ltg); «Ltg: …» = Ltg auch in der Klammer;
// eine Klammer über mehrere Läufe oder Zeilen bleibt ein Ausdruck; unsichere Zerlegungen (nur echte Zweifelsfälle)
// kommen in den Bericht. Fiktive Texte.
import { describe, expect, it } from 'vitest';
import { type FormTextContext, parseShapeText } from '../../../../src/io/wap-import/index';
import type { ShapeTextRun } from '../../../../src/io/xlsx-drawing/index';

type Run = { text: string; bold?: boolean };

function shape(lines: readonly (readonly Run[])[]): ShapeTextRun[] {
  const out: ShapeTextRun[] = [];
  lines.forEach((l, line) => {
    for (const r of l)
      out.push({
        paragraph: line,
        line,
        text: r.text,
        bold: r.bold ?? false,
        strike: false,
        color: null,
        sizePt: 8,
      });
  });
  return out;
}
const B = (text: string): Run => ({ text, bold: true });
const N = (text: string): Run => ({ text });

/** Wie beim Import über die Oberfläche: keine Personenliste, Funktionsliste der Kp-Vorlage. */
const ctx: FormTextContext = {
  persons: [],
  functionList: [
    { code: 'Zfhr', categoryId: 'c1', singleFunction: false },
    { code: 'Kp Kdt', categoryId: 'c1', singleFunction: false },
    { code: 'Kdt Stv', categoryId: 'c1', singleFunction: false },
    { code: 'Einh Fw', categoryId: 'c1', singleFunction: false },
    { code: 'Four', categoryId: 'c1', singleFunction: false },
  ],
  ltgInBlock: 'withOrt',
};
const parse = (lines: readonly (readonly Run[])[]) => parseShapeText(shape(lines), ctx);
const text = (runs: readonly { text: string }[]) => runs.map((r) => r.text).join('');

describe('F-FIX Runde 5: Klammern nach Regel 12 (UX-AB-01, R-8.2-29, R-8.2-30)', () => {
  it('[R-8.2-30] «(Ltg: …)» in der Titelzeile → Ltg, kein Ort', () => {
    const p = parse([[B('Wache '), N('(Ltg: Kp Kdt)')]]);
    expect(text(p.title)).toBe('Wache');
    expect(p).toMatchObject({ ltg: 'Kp Kdt', ort: '' });
  });

  it('[R-8.2-30] «(Ltg: …)» als eigene Zeile → Ltg, kein Ort', () => {
    const p = parse([[B('Wache')], [N('(Ltg: Zfhr)')]]);
    expect(p).toMatchObject({ ltg: 'Zfhr', ort: '' });
  });

  it('[R-8.2-29] Klammer über zwei fette Läufe der Titelzeile → ganzer Ausdruck als Ort, nichts geht verloren', () => {
    const p = parse([[B('Wache (Halle'), B(' Nord)')]]);
    expect(text(p.title)).toBe('Wache');
    expect(p.ort).toBe('Halle Nord');
  });

  it('[R-8.2-29] Klammer über mehrere Zeilen → ein Ort, kein Zusatz', () => {
    const p = parse([[B('Ausb Gr')], [N('(Halle,')], [N('Platz A,')], [N(' Platz B)')]]);
    expect(p).toMatchObject({ ort: 'Halle, Platz A, Platz B', supplement: '', ltg: '' });
  });

  it('[R-8.2-30] Grad allein in der Klammer («(Hptfw)») → Ltg, sicher', () => {
    const p = parse([[B('Wache')], [N('(Hptfw)')]]);
    expect(p).toMatchObject({ ltg: 'Hptfw', ort: '', uncertain: false });
  });

  it('[R-8.2-30][R-8.2-35] Funktionsbezeichnung ohne Einheit («(Kdt)», Teil von «Kp Kdt») → Ltg, im Bericht als unsicher', () => {
    const p = parse([[B('Wache')], [N('(Kdt)')]]);
    expect(p).toMatchObject({ ltg: 'Kdt', ort: '', uncertain: true });
    expect(p.uncertainReasons.join(' ')).toContain('Teil einer Funktion');
  });

  it('[R-8.2-30][R-8.2-35] Teil einer Funktion in der Klammer der Titelzeile («Wache (Kdt)») → Ltg, unsicher', () => {
    const p = parse([[B('Wache (Kdt)')]]);
    expect(text(p.title)).toBe('Wache');
    expect(p).toMatchObject({ ltg: 'Kdt', ort: '', uncertain: true });
  });

  it('[R-8.2-29] «(Ort: …)» → Ort ohne Bezeichnung', () => {
    const p = parse([[B('Wache')], [N('(Ort: Halle Nord)')]]);
    expect(p).toMatchObject({ ltg: '', ort: 'Halle Nord' });
  });

  it('[R-8.2-29] Nicht geschlossene Klammer bis zum Schluss: bleibt Zusatz', () => {
    const p = parse([[B('Wache')], [N('(Halle,')], [N('Platz A')]]);
    expect(p).toMatchObject({ ltg: '', ort: '', supplement: '(Halle, Platz A' });
  });

  it('[R-8.2-29] Zeile nur mit Satzzeichen: kein Name, bleibt Zusatz', () => {
    const p = parse([[B('Wache')], [N(',')]]);
    expect(p).toMatchObject({ ltg: '', supplement: ',' });
  });

  it('[R-8.2-30] Gegenprobe: Ort in der Klammer bleibt Ort, sicher', () => {
    const p = parse([[B('Wache')], [N('(Turnhalle)')]]);
    expect(p).toMatchObject({ ltg: '', ort: 'Turnhalle', uncertain: false });
  });
});

describe('F-FIX Runde 5: Unsicherheit nur bei echten Zweifelsfällen (UX-AB-01, R-8.2-35)', () => {
  it('[R-8.2-35] Zeile genau mit einer Funktion der Funktionsliste («Einh Fw») → Ltg, nicht unsicher', () => {
    const p = parse([[B('Wache')], [N('Einh Fw')], [N('(Turnhalle)')]]);
    expect(p).toMatchObject({ ltg: 'Einh Fw', ort: 'Turnhalle', uncertain: false });
  });

  it('[R-8.2-35] Zeile mit Grad und Name ohne Personenliste («Hptm Muster») → Ltg, weiter unsicher', () => {
    const p = parse([[B('Wache')], [N('Hptm Muster')]]);
    expect(p).toMatchObject({ ltg: 'Hptm Muster', uncertain: true });
  });
});
