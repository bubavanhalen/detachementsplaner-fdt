// @vitest-environment jsdom
// F-ABDECKUNG (FT-A-01): Import von Rapport-Paaren, Nebenspalte mit Rapporten, Kanten je Tag, Markern, Terminzellen
// und Beso-Sonderfällen (Beschrieb 8.2 Regeln 1, 3, 4, 6, 10, 11; normalisierung 5.3–5.7; Vertrag E1-08 §1a).
// Fiktive Arbeitsmappen.
import { describe, expect, it } from 'vitest';
import type { ImportOutcome, ImportReportKind } from '../../../../src/io/wap-import/index';
import type {
  DayRemark,
  Marker,
  MultiDayRemark,
  Plan,
  Rapport,
} from '../../../../src/model/wap/types';
import {
  besoBox,
  block,
  bold,
  emptyWeek,
  geometryOf,
  HEADER_ROW_EMU,
  minutes,
  normal,
  rawShape,
  yOf,
} from '../../fixtures/import/kp-workbook';
import { besos, entries, importWeeks } from '../import/support';
import { importEdited } from './support';

const ROT = 'C00000';
const AGENDA_ROW = 87; // 0-basierte Zeile unter dem Raster (Kopf 6 + Raster 80 + 1)
const g = geometryOf(emptyWeek());
const of = <T extends { type: string }>(plan: Plan, type: T['type']) =>
  entries(plan).filter((e) => e.type === type) as unknown as T[];
const items = (o: ImportOutcome, kind: ImportReportKind) =>
  o.report.items.filter((i) => i.kind === kind);
const balanced = (o: ImportOutcome) => {
  for (const s of o.report.sheets) expect(s.shapesRead).toBe(s.assigned + s.unassigned);
};
const colIds = (plan: Plan, day = 0) => {
  const setId = plan.weeks[0]?.days[day]?.columnSetId;
  return plan.columnSets.find((s) => s.id === setId)?.columns ?? [];
};

describe('F-ABDECKUNG Import: Rapport-Paare und Nebenspalte (normalisierung 5.4; Regel 6)', () => {
  it('[R-8.2-02] Rapport zuerst in der Planungsspalte, dann in der Rap-Spalte: ein Rapport, Zeit aus der Rap-Spalte, «auch in Spalten»', () => {
    const o = importWeeks([
      emptyWeek({
        shapes: [
          block(0, [0, 0], '1800', '1830', [[bold('KR')]]),
          block(0, [3, 3], '1800', '1900', [[bold('KR')]]),
        ],
      }),
    ]);
    const rs = of<Rapport>(o.result.plan, 'rapport');
    expect(rs).toHaveLength(1);
    expect(rs[0]).toMatchObject({
      code: 'KR',
      display: 'alsoInColumns',
      time: { form: 'range', from: 1080, to: 1140 },
      displayColumns: { kind: 'ids', ids: [colIds(o.result.plan)[0]?.id] },
    });
    balanced(o);
  });

  it('[R-8.2-15] Nebenspalte am Tag: Rapport in einer Planungsspalte behält seine Spalte (Indizes nach der neuen Spalte verschoben)', () => {
    const o = importWeeks([
      emptyWeek({
        shapes: [
          block(0, [4, 4], '1000', '1100', [[bold('In Beso fiktiv')]]),
          block(0, [2, 2], '1800', '1830', [[bold('DR')]]),
        ],
      }),
    ]);
    const cols = colIds(o.result.plan);
    expect(cols.map((c) => c.name)).toEqual(['Kdo', 'Alpha', 'Bravo', 'Det', 'Rap', 'Beso']);
    expect(of<Rapport>(o.result.plan, 'rapport')[0]).toMatchObject({
      code: 'DR',
      display: 'onlyInColumns',
      displayColumns: { kind: 'ids', ids: [cols[2]?.id] },
    });
  });
});

describe('F-ABDECKUNG Import: Blockkanten neben der 15-Min-Linie an zwei Tagen (Regel 4, R-8.2-11)', () => {
  it('[R-8.2-11] Sammeleinträge je Tag in Datumsreihenfolge, auch wenn der spätere Tag zuerst gezeichnet ist', () => {
    const at = (day: number, from: number) => ({
      day,
      cols: [0, 0] as const,
      from,
      to: from + 60,
      paragraphs: [[bold(`Kante ${String(day)}`)]],
    });
    const o = importWeeks([emptyWeek({ shapes: [at(2, 483), at(0, 483), at(0, 603)] })]);
    const grouped = items(o, 'edgeOffGridGrouped');
    expect(grouped.map((i) => i.date)).toEqual(['2099-10-05', '2099-10-07']);
    expect(grouped[0]?.message.cause).toBe(
      '4 Blockkanten 2–4 Min neben der 15-Min-Linie, auf 5 Min gerundet',
    );
  });
});

describe('F-ABDECKUNG Import: Marker (normalisierung 5.3)', () => {
  it('[R-4.6-15] Marker mit Linie über einen Teil der Planungsspalten → Marker über alle Planungsspalten (Entscheid Auftraggeber 21.10.2026), Zeit der Linie', () => {
    const o = importWeeks([
      emptyWeek({
        shapes: [
          block(0, [0, 1], '2100', '2100', [], { line: true }),
          block(0, [0, 0], '2100', '2110', [[normal('ABV')]]),
        ],
      }),
    ]);
    const [m] = of<Marker>(o.result.plan, 'marker');
    expect(m).toMatchObject({ kind: 'ABV', at: 1260, asFlatBlock: false });
    expect(m?.columns).toEqual({ kind: 'all' });
    balanced(o);
  });

  it('[R-4.6-15][FA-07] Beschriftung über der Linie → Zeit der Linie, nicht der Beschriftung', () => {
    // Soll (normalisierung 5.3): von = Zeit der Linie (2100). Bis F-FIX galt die 15-Min-Linie am oberen Rand der
    // Beschriftung (2050 → 2045), auch wenn eine Linienform zugeordnet war (Befund FA-07).
    const o = importWeeks([
      emptyWeek({
        shapes: [
          block(0, [0, 1], '2100', '2100', [], { line: true }),
          block(0, [0, 0], '2050', '2100', [[normal('ABV')]]),
        ],
      }),
    ]);
    const [m] = of<Marker>(o.result.plan, 'marker');
    expect(m).toMatchObject({ kind: 'ABV', at: 1260, asFlatBlock: false });
    expect(m?.columns.kind).toBe('all');
  });

  it('[R-4.6-15][FA-07] Linie schneidet die Beschriftung → ebenfalls Zeit der Linie', () => {
    // Gleiches Soll (normalisierung 5.3) mit der Linie 2130 mitten durch die Beschriftung 2118–2133; der obere Rand
    // der Beschriftung ergäbe 2115.
    const o = importWeeks([
      emptyWeek({
        shapes: [
          block(0, [0, 1], '2130', '2130', [], { line: true }),
          block(0, [0, 0], '2118', '2133', [[normal('HV')]]),
        ],
      }),
    ]);
    expect(of<Marker>(o.result.plan, 'marker')[0]).toMatchObject({ kind: 'HV', at: 1290 });
  });

  it('[R-4.6-15][FA-07] von der Beschriftung abgesetzte Linie → ebenfalls Zeit der Linie, Linie zugeordnet', () => {
    // Soll (normalisierung 5.3): von = Zeit der Linie, auch wenn die Beschriftung 2145–2200 15 Min neben der Linie 2130
    // liegt. Die Einschränkung aus F-FIX Runde 1 (Linie nur, wenn sie die Beschriftung berührt) entfällt, seit die
    // Lage einer Linienform aus ihrem Zeichnungsanker kommt (FD-03, R-8.2-44 = VQ-I2-01).
    const o = importWeeks([
      emptyWeek({
        shapes: [
          block(0, [0, 1], '2130', '2130', [], { line: true }),
          block(0, [0, 0], '2145', '2200', [[normal('HV')]]),
        ],
      }),
    ]);
    const [m] = of<Marker>(o.result.plan, 'marker');
    expect(m).toMatchObject({ kind: 'HV', at: 1290 });
    expect(m?.columns.kind).toBe('all');
    balanced(o);
  });

  it('[R-4.6-15] Zeit in der Beschriftung über 60 Min neben der Lage → Lage gilt (15-Min-Linie am oberen Rand)', () => {
    const o = importWeeks([
      emptyWeek({ shapes: [block(1, [0, 2], '2200', '2215', [[normal('HV 0600')]])] }),
    ]);
    expect(of<Marker>(o.result.plan, 'marker')[0]).toMatchObject({ kind: 'HV', at: 1320 });
  });

  it('[R-8.2-39] Beschriftung eines Markers ganz verdeckt → kein Marker, Bericht «verdeckt»', () => {
    const [x0] = g.colSpan(0, 0);
    const [, x1] = g.colSpan(0, 2);
    const o = importWeeks([
      emptyWeek({
        shapes: [block(0, [0, 2], '2200', '2215', [[normal('AV')]])],
        rawShapes: [
          rawShape(x0, yOf(minutes('2150')), x1, yOf(minutes('2230')), { fill: 'FFFFFF' }),
        ],
      }),
    ]);
    expect(of<Marker>(o.result.plan, 'marker')).toEqual([]);
    expect(items(o, 'hidden')).toHaveLength(1);
  });
});

describe('F-ABDECKUNG Import: Termine in Zellen und Textfeldern (Regel 1, CR-H-D-02)', () => {
  it('[R-8.2-04] Leeres Textfeld im Terminbereich: kein Eintrag, kein Bericht, zugeordnet', () => {
    const o = importWeeks([emptyWeek({ agenda: [{ day: 1, paragraphs: [] }] })]);
    expect(of<DayRemark>(o.result.plan, 'dayRemark')).toEqual([]);
    expect(o.report.items).toEqual([]);
    balanced(o);
  });

  it('[R-8.2-04] Zelle ohne Nummer → ganztägige Bemerkung am Tag der Spalte', () => {
    const o = importEdited([emptyWeek()], {
      cells: [{ row: AGENDA_ROW, col: g.dayStart[0] ?? 1, text: 'Retablierung fiktiv' }],
    });
    const [r] = of<DayRemark>(o.result.plan, 'dayRemark');
    expect(r).toMatchObject({
      date: '2099-10-05',
      text: 'Retablierung fiktiv',
      status: 'confirmed',
    });
  });

  it('[R-8.2-28] Nummerierter Termin in einer Zelle ohne Kästchen → Beso in der Beso-Spalte, Bericht «ohne Kästchen» ohne Form', () => {
    const o = importEdited([emptyWeek()], {
      cells: [{ row: AGENDA_ROW, col: g.dayStart[1] ?? 6, text: '21 1400: Besuch fiktiv.' }],
    });
    const [b] = besos(o.result.plan);
    expect(b).toMatchObject({ date: '2099-10-06', besoNumber: 21 });
    const t = items(o, 'textWithoutBox');
    expect(t).toHaveLength(1);
    expect(t[0]?.target.shapeIndex).toBeNull();
  });

  it('[R-8.2-04] Zelle unter einer deckenden Form wird nicht gelesen', () => {
    const [x0, x1] = g.colSpan(0, 0);
    const y0 = 6 * HEADER_ROW_EMU + (AGENDA_ROW - 6) * 95_250;
    const o = importEdited(
      [
        emptyWeek({
          rawShapes: [rawShape(x0 - 100, y0 - 1000, x1 + 100, y0 + 200_000, { fill: 'FFFFFF' })],
        }),
      ],
      { cells: [{ row: AGENDA_ROW, col: g.dayStart[0] ?? 1, text: 'Unter Form fiktiv' }] },
    );
    expect(of<DayRemark>(o.result.plan, 'dayRemark')).toEqual([]);
  });

  it('[R-8.2-27] Nummerierter Termin ohne Zeit mit Kästchen → ganztägige Bemerkung und Beso aus dem Kästchen', () => {
    const o = importWeeks([
      emptyWeek({
        shapes: [besoBox(0, 4, '0900', 15)],
        agenda: [{ day: 0, paragraphs: [[normal('15 Material fassen.')]] }],
      }),
    ]);
    expect(of<DayRemark>(o.result.plan, 'dayRemark').map((r) => r.text)).toEqual([
      'Material fassen.',
    ]);
    const [b] = besos(o.result.plan);
    expect(b).toMatchObject({ besoNumber: 15, title: [] });
    expect(b?.windows[0]?.time).toEqual({ form: 'range', from: 540, to: 570 });
    expect(items(o, 'numberedWithoutTime')).toHaveLength(1);
    expect(items(o, 'boxWithoutText')).toHaveLength(1);
  });

  it('[R-8.2-04] Kästchen an einem anderen Tag als der Termintext: Zeitfenster ohne Spalte am Tag des Texts', () => {
    const o = importWeeks([
      emptyWeek({
        shapes: [besoBox(1, 4, '0900', 10)],
        agenda: [{ day: 0, paragraphs: [[normal('10 0900: Besuch fiktiv.')]] }],
      }),
    ]);
    const [b] = besos(o.result.plan);
    expect(b).toMatchObject({ date: '2099-10-05', besoNumber: 10 });
    expect(b?.windows.map((w) => w.columnId)).toEqual([null]);
  });

  it('[R-8.2-25] Reihenfolge: «bis 1200» zählt mit seinem Ende, Fristen ohne Uhrzeit bleiben ausserhalb', () => {
    const o = importWeeks([
      emptyWeek({
        shapes: [besoBox(0, 4, '1100', 10), besoBox(0, 4, '1000', 11), besoBox(0, 4, '0700', 12)],
        agenda: [
          {
            day: 0,
            paragraphs: [
              [normal('10 bis 1200: Abgabe fiktiv.')],
              [normal('11 1000: Besuch fiktiv.')],
              [normal('12 bis 05.10.: Frist fiktiv.')],
            ],
          },
        ],
      }),
    ]);
    // Sortierzeiten: 11 → 1000, 10 → 1200 (Ende von «bis»); 12 (Frist ohne Uhrzeit) zählt nicht.
    const order = items(o, 'numberOrder');
    expect(order.map((i) => [i.besoNumber, i.message.cause])).toEqual([
      [11, 'Die Beso-Nummer 11 liegt nach der Sortierzeit vor 10; die Nummern bleiben.'],
    ]);
  });

  it('[R-8.2-26] Zwei Kästchen verschiedener Nummern übereinander mit gleicher Zeit → Bericht «Überlappung»', () => {
    const o = importWeeks([
      emptyWeek({
        shapes: [besoBox(0, 4, '0900', 10), besoBox(0, 4, '0915', 11)],
        agenda: [
          { day: 0, paragraphs: [[normal('10 0900: A fiktiv.')], [normal('11 0915: B fiktiv.')]] },
        ],
      }),
    ]);
    const ov = items(o, 'overlappingShapes');
    expect(ov.map((i) => i.message.cause)).toEqual([
      'Die Kästchen Nr 10 und 11 überlagern sich zeitlich.',
    ]);
    expect(ov[0]?.besoNumber).toBe(10);
  });
});

describe('F-ABDECKUNG Import: Bemerkungen in der Seitenleiste (Beschrieb 4.2; R-14.5-03)', () => {
  const sx0 = g.colX(g.sideCol);
  const sx1 = g.colX(g.sideCol + 3);
  const y = (r: number) => 6 * HEADER_ROW_EMU + (r - 6) * 95_250;

  it('[R-4.2-07] Aufzählung mit Folgezeilen: Zeile ohne Strich gehört zum vorherigen Punkt; Box ohne Überlauf ohne Bericht', () => {
    const o = importWeeks([
      emptyWeek({
        rawShapes: [
          rawShape(sx0, y(43), sx1, y(57), {
            fill: 'FFFFFF',
            paragraphs: [
              [bold('Bemerkungen (gelten durchgehend)')],
              [normal('- Punkt eins')],
              [normal('Fortsetzung eins')],
              [normal('• Punkt zwei')],
            ],
          }),
        ],
      }),
    ]);
    const rs = of<MultiDayRemark>(o.result.plan, 'multiDayRemark');
    expect(rs.map((r) => r.text)).toEqual(['Punkt eins Fortsetzung eins', 'Punkt zwei']);
    expect(items(o, 'overlappingShapes')).toEqual([]);
  });

  it('[R-14.5-03] Box zu niedrig für ihren Text (Überlauf) → Bericht «Überlappung» mit erster Bemerkung', () => {
    const o = importWeeks([
      emptyWeek({
        rawShapes: [
          rawShape(sx0, y(43), sx1, y(44), {
            fill: 'FFFFFF',
            paragraphs: [
              [bold('Bemerkungen')],
              [normal('- A fiktiv')],
              [normal('- B fiktiv')],
              [normal('- C fiktiv')],
            ],
          }),
        ],
      }),
    ]);
    const ov = items(o, 'overlappingShapes');
    expect(ov).toHaveLength(1);
    const first = of<MultiDayRemark>(o.result.plan, 'multiDayRemark')[0];
    expect(ov[0]?.target.entryId).toBe(first?.id);
  });

  it('[R-8.2-20] Sonnenzeit ohne Symbol daneben und Rahmen ohne Text: Zeit im Bericht, Rahmen zugeordnet', () => {
    const o = importWeeks([
      emptyWeek({
        rawShapes: [
          rawShape(sx0, y(70), sx1, y(72), { fill: null, paragraphs: [[normal('0715')]] }),
          rawShape(sx0, y(73), sx1, y(76), { fill: null }),
        ],
      }),
    ]);
    expect(o.result.plan.weeks[0]?.sunOverride).toEqual({ sunrise: null, sunset: null });
    expect(items(o, 'unassignedShape')).toHaveLength(1);
    balanced(o);
  });
});

describe('F-ABDECKUNG Import: Beso mit Zeitfenstern ohne passendes Kästchen (Regel 3)', () => {
  it('[R-8.2-09] Ein Kästchen, zwei Zeitfenster im Text: Kästchen nimmt das nähere, das andere bleibt ohne Spalte', () => {
    const o = importWeeks([
      emptyWeek({
        shapes: [besoBox(0, 2, '1300', 13)],
        agenda: [
          { day: 0, paragraphs: [[normal('13 Revision: 0900-1000 Zug 1, 1300-1400 Zug 2')]] },
        ],
      }),
    ]);
    const [b] = besos(o.result.plan);
    const bravo = colIds(o.result.plan)[2]?.id;
    expect(
      b?.windows.map((w) => [w.time.form === 'range' ? w.time.from : null, w.columnId]),
    ).toEqual([
      [780, bravo],
      [540, null],
    ]);
    expect(items(o, 'besoInPlanningColumn')).toHaveLength(1);
  });

  it('[R-8.2-05] Gestrichene Nummer in einer Rich-Text-Zeile eines Textfelds mit rotem Rest → gestrichen und geändert', () => {
    const o = importWeeks([
      emptyWeek({
        shapes: [besoBox(0, 4, '0900', 10)],
        agenda: [
          {
            day: 0,
            paragraphs: [
              [
                { text: '10', strike: true, color: ROT },
                { text: ' 0900: Neu.', color: ROT },
              ],
            ],
          },
        ],
      }),
    ]);
    expect(besos(o.result.plan)[0]).toMatchObject({ status: 'cancelled', changed: true });
    expect(items(o, 'changed')).toHaveLength(1);
  });
});
