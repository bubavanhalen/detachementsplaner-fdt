// @vitest-environment jsdom
// F-FIX Runde 6 nach code-reviewer-5: CR-5-01 (Regel 12 ohne Textverlust; Beschrieb 8.2 Regel 8 «nichts geht still
// verloren»), CR-5-02 (nur waagrechte Linien tragen einen Marker) und CR-5-04 (Inhalt nur in notTakenText, nicht in
// der Meldung; CR-D-2-04). Fiktive Texte und Arbeitsmappen.
import { describe, expect, it } from 'vitest';
import { type FormTextContext, parseShapeText } from '../../../../src/io/wap-import/index';
import type { ShapeTextRun } from '../../../../src/io/xlsx-drawing/index';
import type { Marker } from '../../../../src/model/wap/types';
import {
  block,
  COL_EMU,
  emptyWeek,
  geometryOf,
  HEADER_ROWS,
  MINUTE_EMU,
  minutes,
  normal,
  type WeekDef,
  yOf,
} from '../../fixtures/import/kp-workbook';
import { entries, importWeeks } from '../import/support';

type Run = { text: string; bold?: boolean };
function shape(lines: readonly (readonly Run[])[]): ShapeTextRun[] {
  return lines.flatMap((l, line) =>
    l.map((r) => ({
      paragraph: line,
      line,
      text: r.text,
      bold: r.bold ?? false,
      strike: false,
      color: null,
      sizePt: 8,
    })),
  );
}
const B = (text: string): Run => ({ text, bold: true });
const N = (text: string): Run => ({ text });
const ctxOf = (ltgInBlock: FormTextContext['ltgInBlock']): FormTextContext => ({
  persons: [],
  functionList: [
    { code: 'Kp Kdt', categoryId: 'c1', singleFunction: false },
    { code: 'Zfhr', categoryId: 'c1', singleFunction: false },
  ],
  ltgInBlock,
});

describe('F-FIX Runde 6: Regel 12 ohne Textverlust (CR-5-01, R-8.2-30, R-8.2-31)', () => {
  for (const mode of ['withOrt', 'ownLinePrefixed'] as const) {
    it(`[R-8.2-30][R-8.2-31] ${mode}: «Kurs (Ltg: Hptm Muster)» → Ltg aus der Klammer, «Kurs» bleibt im Zusatz`, () => {
      const p = parseShapeText(shape([[B('Ausb')], [N('Kurs (Ltg: Hptm Muster)')]]), ctxOf(mode));
      expect(p).toMatchObject({
        ltg: 'Hptm Muster',
        ort: '',
        supplement: 'Kurs',
        uncertain: false,
      });
    });

    it(`[R-8.2-30][R-8.2-31] ${mode}: leere Ltg-Klammer «Kurs (Ltg:)» → keine Ltg, die Zeile bleibt im Zusatz`, () => {
      const p = parseShapeText(shape([[B('Ausb')], [N('Kurs (Ltg:)')]]), ctxOf(mode));
      expect(p).toMatchObject({ ltg: '', ort: '', supplement: 'Kurs (Ltg:)' });
    });

    it(`[R-8.2-30][R-8.2-35] ${mode}: «Kurs (Hptm Muster)» → Ltg aus der Klammer, «Kurs» im Zusatz, als unsicher gemeldet`, () => {
      const p = parseShapeText(shape([[B('Ausb')], [N('Kurs (Hptm Muster)')]]), ctxOf(mode));
      expect(p).toMatchObject({ ltg: 'Hptm Muster', supplement: 'Kurs', uncertain: true });
    });
  }

  it('[R-8.2-38] Teilaufgabe: «Kurs (Ltg: Zfhr)» → Ltg der Teilaufgabe enthält «Zfhr», «Kurs» geht nicht verloren', () => {
    const p = parseShapeText(
      shape([[B('Teil A')], [N('Kurs (Ltg: Zfhr)')], [], [B('Teil B')], [N('(Halle)')]]),
      ctxOf('withOrt'),
    );
    expect(p.ltg.split(', ').sort()).toEqual(['Kurs', 'Zfhr']);
    expect(p.subtasks).toEqual([
      { title: [{ text: 'Teil B', bold: true }], ltg: '', ort: 'Halle' },
    ]);
  });
});

const g = geometryOf(emptyWeek());
const X0 = g.colX(g.dayStart[0] ?? 1) + 3000;
const X1 = g.colX((g.dayStart[0] ?? 1) + 2) - 3000;
function punkt(tag: 'from' | 'to', x: number, minute: number): string {
  const col = Math.floor(x / COL_EMU);
  const ab = minute - 240;
  const row = HEADER_ROWS + Math.floor(ab / 15);
  const rowOff = Math.round((ab % 15) * MINUTE_EMU);
  return `<xdr:${tag}><xdr:col>${col}</xdr:col><xdr:colOff>${Math.round(x - col * COL_EMU)}</xdr:colOff><xdr:row>${row}</xdr:row><xdr:rowOff>${rowOff}</xdr:rowOff></xdr:${tag}>`;
}
let id = 9100;
const cxn = (x: number, y: number, cx: number, cy: number): string =>
  `<xdr:cxnSp macro=""><xdr:nvCxnSpPr><xdr:cNvPr id="${id++}" name="Linie fiktiv"/><xdr:cNvCxnSpPr/></xdr:nvCxnSpPr><xdr:spPr><a:xfrm><a:off x="${x}" y="${Math.round(y)}"/><a:ext cx="${cx}" cy="${Math.round(cy)}"/></a:xfrm><a:prstGeom prst="line"><a:avLst/></a:prstGeom></xdr:spPr></xdr:cxnSp>`;
const waagrecht = `<xdr:twoCellAnchor>${punkt('from', X0, minutes('2100'))}${punkt('to', X1, minutes('2100'))}${cxn(X0, yOf(minutes('2100')), X1 - X0, 0)}<xdr:clientData/></xdr:twoCellAnchor>`;
const XV = Math.round((X0 + X1) / 2);
const senkrecht = `<xdr:twoCellAnchor>${punkt('from', XV, minutes('1800'))}${punkt('to', XV, minutes('2400') - 1)}${cxn(XV, yOf(minutes('1800')), 0, yOf(minutes('2400') - 1) - yOf(minutes('1800')))}<xdr:clientData/></xdr:twoCellAnchor>`;
const woche = (raw: readonly string[]): WeekDef =>
  emptyWeek({ shapes: [block(0, [0, 0], '2108', '2118', [[normal('ABV')]])], rawShapes: raw });
const marker = (w: WeekDef): Marker | undefined =>
  entries(importWeeks([w]).result.plan).find((e): e is Marker => e.type === 'marker');

describe('F-FIX Runde 6: nur waagrechte Linien tragen einen Marker (CR-5-02, R-8.2-44, R-4.6-15)', () => {
  it('[R-8.2-44][R-4.6-15] Senkrechte Linie mit Mitte 2100 neben der waagrechten Markerlinie: Marker wie ohne sie', () => {
    const nur = marker(woche([waagrecht]));
    const beide = marker(woche([waagrecht, senkrecht]));
    expect(nur).toMatchObject({ at: 1260, columns: { kind: 'all' } });
    expect(beide && { at: beide.at, columns: beide.columns }).toEqual(
      nur && { at: nur.at, columns: nur.columns },
    );
  });
});

describe('F-FIX Runde 6: Marker-Ort ohne Inhalt in Meldungen (CR-5-04, R-8.2-20)', () => {
  it('[R-8.2-20] Seit Gate B 14 b keine Meldung mehr: der Ort steht in der Art frei, in keinem Berichtseintrag', () => {
    // Gate B 28.10.2026, Entscheid 14 b: der Ort bleibt Teil der Beschriftung; damit entfällt die Meldung, und kein
    // Berichtseintrag trägt den Ort (CR-D-2-04 bleibt erfüllt).
    const o = importWeeks([
      emptyWeek({ shapes: [block(0, [0, 0], '0700', '0715', [[normal('AV (Halle Nord)')]])] }),
    ]);
    expect(o.report.items.filter((i) => i.kind === 'uncertainParse')).toEqual([]);
    for (const i of o.report.items) {
      expect(i.message.cause).not.toContain('Halle');
      expect(i.notTakenText ?? []).not.toContain('Halle Nord');
    }
  });
});
