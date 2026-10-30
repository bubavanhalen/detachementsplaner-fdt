// @vitest-environment jsdom
// F-ABDECKUNG (FT-A-01): Sonderfälle des Imports (Beschrieb 8.2 Regeln 2, 5, 6, 10, 11, 12; normalisierung 5;
// Gate S A2): gestrichene Rapporte und Blöcke, Rapport nur mit Klammer, Nebenspalte mit Einträgen anderer Tage,
// verknüpfte Formen mit Bericht, Querbalken über die Wochen, Beso ohne Kästchen mit Status, Freitext-Titel,
// gemischte Zeitfenster, deckende und nicht deckende Formen, Bild und Wochenziele in der Seitenleiste. Fiktiv.
import { describe, expect, it } from 'vitest';
import type { ImportOutcome, ImportReportKind } from '../../../../src/io/wap-import/index';
import type {
  Beso,
  DayRemark,
  MultiDayRemark,
  Plan,
  Querbalken,
  Rapport,
} from '../../../../src/model/wap/types';
import {
  besoBox,
  block,
  bold,
  emptyWeek,
  geometryOf,
  HEADER_ROW_EMU,
  normal,
  rawShape,
  yOf,
} from '../../fixtures/import/kp-workbook';
import { besos, blocks, entries, importWeeks, titleOf } from '../import/support';
import { absAnchor } from '../xlsx-drawing/fixture';

const ROT = 'C00000';
const g = geometryOf(emptyWeek());
const of = <T extends { type: string }>(plan: Plan, type: T['type']) =>
  entries(plan).filter((e) => e.type === type) as unknown as T[];
const items = (o: ImportOutcome, kind: ImportReportKind) =>
  o.report.items.filter((i) => i.kind === kind);
const balanced = (o: ImportOutcome) => {
  for (const s of o.report.sheets) expect(s.shapesRead).toBe(s.assigned + s.unassigned);
};
const cols = (plan: Plan, day = 0) => {
  const setId = plan.weeks[0]?.days[day]?.columnSetId;
  return plan.columnSets.find((s) => s.id === setId)?.columns ?? [];
};
const struck = (text: string) => ({ text, bold: true, strike: true, color: ROT });
let picId = 5000;
/** Bild (xdr:pic) mit absolutem Anker. */
function pic(x0: number, y0: number, x1: number, y1: number): string {
  const id = picId++;
  return absAnchor(
    x0,
    y0,
    x1 - x0,
    y1 - y0,
    `<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${String(id)}" name="Bild ${String(id)}"/><xdr:cNvPicPr/></xdr:nvPicPr><xdr:blipFill/><xdr:spPr><a:xfrm><a:off x="${String(x0)}" y="${String(y0)}"/><a:ext cx="${String(x1 - x0)}" cy="${String(y1 - y0)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic>`,
  );
}

describe('F-ABDECKUNG Import: gestrichene Rapporte und Blöcke (Regel 2, R-8.2-05)', () => {
  it('[R-8.2-05] Rapport-Kürzel ganz rot durchgestrichen in der Rap-Spalte → Rapport gestrichen mit dem Kürzel', () => {
    const o = importWeeks([
      emptyWeek({ shapes: [block(0, [3, 3], '1800', '1830', [[struck('KR')]])] }),
    ]);
    const [r] = of<Rapport>(o.result.plan, 'rapport');
    expect(r).toMatchObject({ code: 'KR', status: 'cancelled' });
    expect(items(o, 'cancelled')).toHaveLength(1);
  });

  it('[R-8.2-05] Block ganz rot durchgestrichen → gestrichen, gestrichener Text vermerkt', () => {
    const o = importWeeks([
      emptyWeek({ shapes: [block(0, [0, 1], '0800', '0900', [[struck('Alt fiktiv')]])] }),
    ]);
    const [b] = blocks(o.result.plan);
    expect(b).toMatchObject({ status: 'cancelled', removedText: ['Alt fiktiv'] });
    expect(items(o, 'cancelled')).toHaveLength(1);
  });

  it('[R-8.2-35] Rapport in der Rap-Spalte nur mit Klammer → Kürzel = ganzer Text, unsicher', () => {
    const o = importWeeks([
      emptyWeek({ shapes: [block(0, [3, 3], '1900', '1930', [[bold('(Kdo)')]])] }),
    ]);
    expect(of<Rapport>(o.result.plan, 'rapport')[0]).toMatchObject({ code: '(Kdo)', ort: 'Kdo' });
    expect(items(o, 'uncertainParse').map((i) => i.message.cause)).toContain(
      'Ein Kästchen ohne Nummer in der Rap-Spalte am Mo 1900 wurde als Rapport übernommen; das Kürzel ist keines der Vorlage.',
    );
  });
});

describe('F-ABDECKUNG Import: Nebenspalte mit Einträgen anderer Art und Tage (Regel 6)', () => {
  it('[R-8.2-15] Nebenspalte am Mo: Blöcke «alle», Blöcke und Rapporte am Di und Rapport nur in Rap bleiben unverändert', () => {
    const o = importWeeks([
      emptyWeek({
        shapes: [
          block(0, [4, 4], '1000', '1100', [[bold('In Beso fiktiv')]]),
          block(0, [0, 2], '0800', '0900', [[bold('Alle Mo')]]),
          block(1, [1, 1], '0800', '0900', [[bold('Alpha Di')], [normal('ABV 2100')]]),
          block(1, [4, 4], '1300', '1400', [[bold('Beso Di fiktiv')], [normal('HV 1330')]]),
          block(0, [3, 3], '1800', '1830', [[bold('KR')]]),
          block(1, [0, 0], '1800', '1830', [[bold('DR')]]),
        ],
      }),
    ]);
    const mo = cols(o.result.plan, 0);
    const di = cols(o.result.plan, 1);
    expect(mo.map((c) => c.name)).toEqual(['Kdo', 'Alpha', 'Bravo', 'Det', 'Rap', 'Beso']);
    expect(di.map((c) => c.name)).toEqual(['Kdo', 'Alpha', 'Bravo', 'Det', 'Rap', 'Beso']);
    const bs = new Map(blocks(o.result.plan).map((b) => [titleOf(b), b]));
    expect(bs.get('Alle Mo')?.columns).toEqual({ kind: 'all' });
    expect(bs.get('Alpha Di')?.columns).toEqual({ kind: 'ids', ids: [di[1]?.id] });
    expect(bs.get('Beso Di fiktiv')?.columns).toEqual({ kind: 'ids', ids: [di[3]?.id] });
    const rs = new Map(of<Rapport>(o.result.plan, 'rapport').map((r) => [r.code, r]));
    expect(rs.get('KR')?.display).toBe('rapColumn');
    expect(rs.get('DR')?.displayColumns).toEqual({ kind: 'ids', ids: [di[0]?.id] });
    const markers = of<{ type: 'marker'; kind: string; columns: unknown }>(o.result.plan, 'marker');
    expect(markers.map((m) => [m.kind, m.columns])).toEqual([
      ['ABV', { kind: 'all' }],
      ['HV', { kind: 'all' }],
    ]);
  });
});

describe('F-ABDECKUNG Import: verknüpfte Formen mit Bericht (normalisierung 5.1, 5.4)', () => {
  it('[R-8.2-35] Verknüpfter Block mit unsicherer Zerlegung: ein Block, beide Berichte zeigen auf ihn', () => {
    const t = [[bold('Ausb (Halle) (Platz)')]];
    const o = importWeeks([
      emptyWeek({
        shapes: [block(0, [0, 0], '0800', '1000', t), block(0, [2, 2], '0800', '1000', t)],
      }),
    ]);
    const [b] = blocks(o.result.plan);
    expect(blocks(o.result.plan)).toHaveLength(1);
    const u = items(o, 'uncertainParse');
    expect(u).toHaveLength(2);
    expect(u.every((i) => i.target.entryId === b?.id)).toBe(true);
  });

  it('[R-8.2-02] Rapport mit Zeitpunkt im Text in Rap- und Planungsspalte → ein Rapport; Berichte zeigen auf ihn', () => {
    const o = importWeeks([
      emptyWeek({
        shapes: [
          block(0, [3, 3], '1800', '1830', [[bold('1800 KR (A) (B)')]]),
          block(0, [1, 1], '1800', '1830', [[bold('1800 KR (A) (B)')]]),
          block(1, [3, 3], '1800', '1830', [[bold('1800 KR')]]),
        ],
      }),
    ]);
    const rs = of<Rapport>(o.result.plan, 'rapport');
    expect(rs.map((r) => [r.date, r.display])).toEqual([
      ['2099-10-05', 'alsoInColumns'],
      ['2099-10-06', 'rapColumn'],
    ]);
    const u = items(o, 'uncertainParse');
    expect(u).toHaveLength(2);
    expect(u.every((i) => i.target.entryId === rs[0]?.id)).toBe(true);
  });
});

describe('F-ABDECKUNG Import: Querbalken über die Wochengrenze und Rand (R-4.6-10)', () => {
  it('[R-4.6-10] Gleicher Querbalken in zwei Blättern (Titel und Zeitraum gleich) → ein Eintrag für beide Wochen', () => {
    const titel = 'Messe 10.10.-13.10.2099';
    const sa = g.colSpan(5, 0)[0];
    const soEnde = g.colSpan(6, 1)[1];
    const mo = g.colSpan(0, 0)[0];
    const diEnde = g.colSpan(1, 4)[1];
    const band = (x0: number, x1: number) =>
      rawShape(x0 + 3000, yOf(245), x1 - 3000, yOf(295), { paragraphs: [[normal(titel)]] });
    const o = importWeeks([
      emptyWeek({ sheet: 'Wo 1', monday: '2099-10-05', rawShapes: [band(sa, soEnde)] }),
      emptyWeek({ sheet: 'Wo 2', monday: '2099-10-12', rawShapes: [band(mo, diEnde)] }),
    ]);
    const qs = of<Querbalken>(o.result.plan, 'querbalken');
    expect(qs).toHaveLength(1);
    expect(qs[0]).toMatchObject({ fromDate: '2099-10-10', toDate: '2099-10-13' });
    balanced(o);
  });

  it('[R-8.2-02] Querbalken ragt rechts über das Raster hinaus: bis zum letzten Tag', () => {
    const sa = g.colSpan(5, 0)[0];
    const aussen = g.colX(g.rightLabelCol) + 200_000;
    const o = importWeeks([
      emptyWeek({
        rawShapes: [
          rawShape(sa + 3000, yOf(245), aussen, yOf(295), {
            paragraphs: [[normal('Wochenende fiktiv')]],
          }),
        ],
      }),
    ]);
    expect(of<Querbalken>(o.result.plan, 'querbalken')[0]).toMatchObject({
      fromDate: '2099-10-10',
      toDate: '2099-10-11',
    });
  });
});

describe('F-ABDECKUNG Import: Beso ohne Kästchen und Sonderzeiten (normalisierung 5.5, Regel 10)', () => {
  it('[R-8.2-05][R-8.2-07] Termin ohne Kästchen: gestrichen, teilweise gestrichen bzw. rot → je ein Bericht', () => {
    const o = importWeeks([
      emptyWeek({
        agenda: [
          {
            day: 0,
            paragraphs: [
              [{ text: '10', strike: true, color: ROT }, normal(' 0900: Alt fiktiv.')],
              [
                normal('11 1000: Besuch '),
                { text: 'Werkhof', strike: true, color: ROT },
                normal(' Halle.'),
              ],
              [normal('12 1100: '), { text: 'Neu fiktiv.', color: ROT }],
            ],
          },
        ],
      }),
    ]);
    const bs = besos(o.result.plan);
    expect(bs.map((b) => [b.besoNumber, b.status, b.changed])).toEqual([
      [10, 'cancelled', false],
      [11, 'confirmed', false],
      [12, 'confirmed', true],
    ]);
    for (const k of ['cancelled', 'partlyCancelled', 'changed'] as const) {
      const r = items(o, k);
      expect(r).toHaveLength(1);
      expect(r[0]?.target.shapeIndex).toBeNull();
    }
    expect(items(o, 'textWithoutBox')).toHaveLength(3);
  });

  it('[R-8.2-34] Termin nur mit Feldern nach der Zeit: Titel des Beso = Freitext', () => {
    const o = importWeeks([
      emptyWeek({
        shapes: [besoBox(0, 4, '1400', 25)],
        agenda: [{ day: 0, paragraphs: [[normal('25 1400: Ltg: Zfhr.')]] }],
      }),
    ]);
    const [b] = besos(o.result.plan);
    expect(titleOf(b as Beso)).toBe('Ltg: Zfhr.');
    expect(b).toMatchObject({ ltg: 'Zfhr', agendaOverride: 'Ltg: Zfhr.' });
  });

  it('[R-8.2-25] Gleiche Zeit zweier Beso → kleinere Nummer zuerst, keine Meldung «Reihenfolge»', () => {
    const o = importWeeks([
      emptyWeek({
        shapes: [besoBox(1, 4, '0900', 20), besoBox(1, 2, '0900', 21)],
        agenda: [
          { day: 1, paragraphs: [[normal('20 0900: A fiktiv.')], [normal('21 0900: B fiktiv.')]] },
        ],
      }),
    ]);
    expect(besos(o.result.plan).map((b) => b.besoNumber)).toEqual([20, 21]);
    expect(items(o, 'numberOrder')).toEqual([]);
  });

  it('[R-8.2-08][FA-08] Kästchen 1300 nimmt das Zeitfenster «1300», nicht die Frist ohne Uhrzeit', () => {
    // Soll (Regel 3, normalisierung 5.5): das Kästchen gehört zum Zeitfenster mit der kleinsten Abweichung, hier
    // «1300 Zug»; die Frist ohne Uhrzeit hat keine Lage. Bis F-FIX galt die Abweichung einer Frist ohne Uhrzeit als 0
    // (startOf → null → Zeit des Kästchens), das Kästchen nahm die Frist (Befund FA-08).
    const o = importWeeks([
      emptyWeek({
        shapes: [besoBox(0, 2, '1300', 13)],
        agenda: [{ day: 0, paragraphs: [[normal('13 Abgabe: bis 05.10., 1300 Zug fiktiv')]] }],
      }),
    ]);
    const [b] = besos(o.result.plan);
    const bravo = cols(o.result.plan)[2]?.id;
    expect(b?.windows).toHaveLength(2);
    expect(b?.windows.find((w) => w.time.form === 'point')).toMatchObject({
      time: { form: 'point', at: 780 },
      columnId: bravo,
    });
    expect(b?.windows.find((w) => w.time.form === 'deadline')?.columnId).toBeNull();
    expect(items(o, 'boxTimeDeviation')).toEqual([]);
  });

  it('[R-8.2-08][FA-08] Kästchen weit neben jedem Zeitfenster mit Uhrzeit → Frist ohne Uhrzeit, keine Abweichungsmeldung', () => {
    // Grenze der Behebung: passt kein Zeitfenster mit Uhrzeit (Abweichung über 15 Min), nimmt das Kästchen wie
    // bisher die Frist ohne Uhrzeit.
    const o = importWeeks([
      emptyWeek({
        shapes: [besoBox(0, 2, '0800', 13)],
        agenda: [{ day: 0, paragraphs: [[normal('13 Abgabe: bis 05.10., 1300 Zug fiktiv')]] }],
      }),
    ]);
    const [b] = besos(o.result.plan);
    expect(b?.windows.find((w) => w.time.form === 'deadline')?.columnId).toBe(
      cols(o.result.plan)[2]?.id,
    );
    expect(items(o, 'boxTimeDeviation')).toEqual([]);
  });
});

describe('F-ABDECKUNG Import: deckende und nicht deckende Formen (R-8.2-42)', () => {
  const [x0] = g.colSpan(0, 0);
  const [, x1] = g.colSpan(0, 2);
  const unter = block(0, [0, 2], '0800', '1000', [[bold('Unten fiktiv')]]);

  it('[R-8.2-42] Später gezeichnete Linie und Form ohne Breite verdecken nicht', () => {
    const o = importWeeks([
      emptyWeek({
        shapes: [unter, block(0, [0, 2], '0900', '0900', [], { line: true })],
        rawShapes: [rawShape(x0 + 50_000, yOf(470), x0 + 50_000, yOf(610), { fill: 'FFFFFF' })],
      }),
    ]);
    expect(blocks(o.result.plan).map(titleOf)).toEqual(['Unten fiktiv']);
    expect(items(o, 'hidden')).toEqual([]);
    expect(items(o, 'partlyHidden')).toEqual([]);
  });

  it('[R-8.2-42] Später gezeichneter deckender Verlauf über dem Block verdeckt ihn', () => {
    const o = importWeeks([
      emptyWeek({
        shapes: [unter],
        rawShapes: [
          rawShape(x0 - 1000, yOf(470), x1 + 1000, yOf(610), { gradient: ['FFFFFF', 'FFFFFF'] }),
        ],
      }),
    ]);
    expect(blocks(o.result.plan)).toEqual([]);
    expect(items(o, 'hidden')).toHaveLength(1);
  });

  it('[R-8.2-42] Später gezeichnetes Bild über dem Block verdeckt ihn', () => {
    const o = importWeeks([
      emptyWeek({ shapes: [unter], rawShapes: [pic(x0 - 1000, yOf(470), x1 + 1000, yOf(610))] }),
    ]);
    expect(blocks(o.result.plan)).toEqual([]);
    expect(items(o, 'hidden')).toHaveLength(1);
  });
});

describe('F-ABDECKUNG Import: Seitenleiste – Bild, Wochenziele, Bemerkung nur Strich (R-8.2-20)', () => {
  const sx0 = g.colX(g.sideCol);
  const sx1 = g.colX(g.sideCol + 3);
  const y = (r: number) => 6 * HEADER_ROW_EMU + (r - 6) * 95_250;

  it('[R-8.2-20] Bild in der Seitenleiste → Bericht «Bild … nicht übernommen» mit nächstem Schritt', () => {
    const o = importWeeks([emptyWeek({ rawShapes: [pic(sx0, y(66), sx1, y(70))] })]);
    const u = items(o, 'unassignedShape');
    expect(u.map((i) => i.message)).toEqual([
      {
        cause: 'Ein Bild in der Seitenleiste (z.B. Wappen) wurde nicht übernommen.',
        nextStep: 'Diese Angaben in den Plan-Einstellungen erfassen.',
      },
    ]);
    balanced(o);
  });

  it('[R-4.2-04] Textfeld mit Überschrift «Wochenziele», Leerzeilen und reinen Strichen: nur die Ziele', () => {
    const o = importWeeks([
      emptyWeek({
        rawShapes: [
          rawShape(sx0, y(7), sx1, y(30), {
            fill: null,
            paragraphs: [
              [bold('Wochenziele')],
              [normal('- Ziel A fiktiv')],
              [],
              [normal('-')],
              [normal('• Ziel B fiktiv')],
            ],
          }),
        ],
      }),
    ]);
    expect(o.result.plan.weeks[0]?.weekGoals.map((x) => x.text)).toEqual([
      'Ziel A fiktiv',
      'Ziel B fiktiv',
    ]);
  });

  it('[R-4.2-07] Bemerkungen-Box mit einer Zeile nur aus einem Strich: keine leere Bemerkung', () => {
    const o = importWeeks([
      emptyWeek({
        rawShapes: [
          rawShape(sx0, y(43), sx1, y(57), {
            fill: 'FFFFFF',
            paragraphs: [
              [bold('Bemerkungen')],
              [normal('- ')],
              [normal('-')],
              [normal('- Gilt fiktiv')],
            ],
          }),
        ],
      }),
    ]);
    expect(of<MultiDayRemark>(o.result.plan, 'multiDayRemark').map((r) => r.text)).toEqual([
      'Gilt fiktiv',
    ]);
  });

  it('[R-8.2-04] Termin-Textfeld beginnt links neben dem Raster: Tag nach der Mitte des Felds', () => {
    const [mx0, mx1] = [g.colSpan(0, 0)[0], g.colSpan(0, 4)[1]];
    const yA = yOf(1440) + 120_000;
    const o = importWeeks([
      emptyWeek({
        rawShapes: [
          rawShape(mx0 - 600_000, yA, mx1, yA + 400_000, {
            fill: null,
            paragraphs: [[normal('Bemerkung links fiktiv')]],
          }),
        ],
      }),
    ]);
    expect(of<DayRemark>(o.result.plan, 'dayRemark').map((r) => [r.date, r.text])).toEqual([
      ['2099-10-05', 'Bemerkung links fiktiv'],
    ]);
  });

  it('[R-8.2-04] Terminzeile nur aus gestrichenem Text ohne Nummer wird übergangen', () => {
    const o = importWeeks([
      emptyWeek({
        agenda: [
          {
            day: 0,
            paragraphs: [
              [{ text: 'Weg fiktiv', strike: true, color: ROT }],
              [normal('Bleibt fiktiv.')],
            ],
          },
        ],
      }),
    ]);
    expect(of<DayRemark>(o.result.plan, 'dayRemark').map((r) => r.text)).toEqual([
      'Bleibt fiktiv.',
    ]);
  });
});
