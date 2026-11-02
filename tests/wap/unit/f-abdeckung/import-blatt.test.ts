// @vitest-environment jsdom
// F-ABDECKUNG (FT-A-01): Auswertung eines Blatts beim Excel-Import in Grenz- und Fehlerfällen (Beschrieb 8.2 Regeln
// 1–12; normalisierung.md 5, 6, 7; Gate S A2; Vertrag E1-08): Querbalken, Rapporte, Blöcke in Rap-/Beso-Spalte,
// verknüpfte Formen, Linien und Marker, Beso mit Frist und mehreren Zeitfenstern, Farben, Status, Seitenleiste,
// Formen ausserhalb des Rasters, Berichtseinträge mit Ursache und nächstem Schritt. Fiktive Arbeitsmappen.
import { describe, expect, it } from 'vitest';
import type { ImportOutcome, ImportReportKind } from '../../../../src/io/wap-import/index';
import type {
  Beso,
  MultiDayRemark,
  Plan,
  Querbalken,
  Rapport,
} from '../../../../src/model/wap/types';
import {
  besoBox,
  block,
  bold,
  COL_EMU,
  emptyWeek,
  geometryOf,
  HEADER_ROW_EMU,
  minutes,
  normal,
  rawShape,
  type ShapeDef,
  type WeekDef,
  yOf,
} from '../../fixtures/import/kp-workbook';
import { besos, blocks, entries, importWeeks, titleOf } from '../import/support';

const ROT = 'C00000';
const typed = <T extends { type: string }>(plan: Plan, type: T['type']): T[] =>
  entries(plan).filter((e): e is never => e.type === type) as unknown as T[];
const items = (o: ImportOutcome, kind: ImportReportKind) =>
  o.report.items.filter((i) => i.kind === kind);
const one = (o: ImportOutcome, kind: ImportReportKind) => {
  const list = items(o, kind);
  expect(list, `Bericht ${kind}`).toHaveLength(1);
  const i = list[0];
  if (i === undefined) throw new Error('Bericht fehlt');
  expect(i.message.cause.length).toBeGreaterThan(10);
  expect(i.message.nextStep.length).toBeGreaterThan(5);
  return i;
};
const balanced = (o: ImportOutcome) => {
  for (const s of o.report.sheets) expect(s.shapesRead).toBe(s.assigned + s.unassigned);
};
const imp = (over: Partial<WeekDef>) => importWeeks([emptyWeek(over)]);
/** Form im Band oberhalb 0500 (Querbalken), Tage d0–d1, Spalten ganz. */
const band = (d0: number, d1: number, text: string, extra: Partial<ShapeDef> = {}): ShapeDef[] => {
  const w = emptyWeek();
  const last = (w.days[d1]?.columns.length ?? 1) - 1;
  return [
    {
      day: d0,
      from: 245,
      to: 295,
      paragraphs: [[normal(text)]],
      ...extra,
      // Breite über mehrere Tage: Spalte des letzten Tags relativ zum ersten Tag.
      cols: [0, colsBetween(w, d0, d1) + last],
    },
  ];
};
function colsBetween(w: WeekDef, d0: number, d1: number): number {
  let n = 0;
  for (let d = d0; d < d1; d++) n += w.days[d]?.columns.length ?? 0;
  return n;
}

describe('F-ABDECKUNG Import: Querbalken im Band (F-02, B-F-06; normalisierung 5.2)', () => {
  it('[R-8.2-02][R-4.6-10] Zeitraum im Titel über die gezeichneten Tage hinaus gilt; Kategorie nach Füllung', () => {
    const o = imp({ shapes: band(1, 3, 'Messe 05.10.-11.10.2099') });
    const [q] = typed<Querbalken>(o.result.plan, 'querbalken');
    expect(q).toMatchObject({ fromDate: '2099-10-05', toDate: '2099-10-11', status: 'confirmed' });
    expect(titleOf(q as Querbalken)).toBe('Messe 05.10.-11.10.2099');
    expect(q?.categoryId).toBe(o.result.plan.legend.find((c) => c.name === 'Ltg Kp')?.id);
    balanced(o);
  });

  it('[R-8.2-02] Zeitraum im Titel nur über einen Teil der gezeichneten Tage: die Lage bleibt massgebend (N-15)', () => {
    const o = imp({ shapes: band(1, 3, 'Messe 07.10.-07.10.') });
    expect(typed<Querbalken>(o.result.plan, 'querbalken')[0]).toMatchObject({
      fromDate: '2099-10-06',
      toDate: '2099-10-08',
    });
  });

  it('[R-8.2-02] Ohne Zeitraum im Titel: von/bis aus der Lage; ohne Füllung keine Kategorie', () => {
    const o = imp({ shapes: band(0, 1, 'Wache fiktiv', { fill: null }) });
    expect(typed<Querbalken>(o.result.plan, 'querbalken')[0]).toMatchObject({
      fromDate: '2099-10-05',
      toDate: '2099-10-06',
      categoryId: null,
    });
  });

  it('[R-8.2-05] Querbalken rot durchgestrichen → gestrichen, Bericht «gestrichen»', () => {
    const o = imp({
      shapes: band(0, 0, 'x', { paragraphs: [[{ text: 'Alt fiktiv', strike: true, color: ROT }]] }),
    });
    expect(typed<Querbalken>(o.result.plan, 'querbalken')[0]?.status).toBe('cancelled');
    expect(one(o, 'cancelled').message.cause).toBe(
      'Ein rot durchgestrichener Eintrag wurde als gestrichen übernommen.',
    );
  });

  it('[R-8.2-39] Querbalken ganz verdeckt (später gezeichnete gefüllte Form) → kein Eintrag, Bericht «verdeckt»', () => {
    const g = geometryOf(emptyWeek());
    const [x0] = g.colSpan(0, 0);
    const [, x1] = g.colSpan(0, 4);
    const o = imp({
      shapes: band(0, 0, 'Verdeckt fiktiv'),
      rawShapes: [rawShape(x0, yOf(240), x1, yOf(300), { fill: 'FFFFFF' })],
    });
    expect(typed<Querbalken>(o.result.plan, 'querbalken')).toEqual([]);
    expect(one(o, 'hidden').message.cause).toBe(
      'Eine Form am Mo (0405–0455) ist von anderen Formen ganz verdeckt und wurde nicht übernommen.',
    );
  });
});

describe('F-ABDECKUNG Import: Rapporte (normalisierung 5.4; Regel 6)', () => {
  it('[R-8.2-02] Kürzel der Vorlage am Titelanfang in der Rap-Spalte: Rapport mit Zeit aus dem Text, Ort aus der Klammer', () => {
    const o = imp({ shapes: [block(0, [3, 3], '1800', '1830', [[bold('1800 KR (Kdo Pos)')]])] });
    const [r] = typed<Rapport>(o.result.plan, 'rapport');
    expect(r).toMatchObject({
      code: 'KR',
      time: { form: 'point', at: 1080 },
      ort: 'Kdo Pos',
      display: 'rapColumn',
    });
  });

  it('[R-8.2-02] Rapport mit Zeitspanne im Text; Rapport ohne Füllung erhält die Standardkategorie Ltg Kp', () => {
    const o = imp({
      shapes: [block(0, [3, 3], '1700', '1800', [[bold('1700-1745 DR')]], { fill: null })],
    });
    const [r] = typed<Rapport>(o.result.plan, 'rapport');
    expect(r?.time).toEqual({ form: 'range', from: 1020, to: 1065 });
    expect(r?.categoryId).toBe(o.result.plan.legend.find((c) => c.name === 'Ltg Kp')?.id);
  });

  it('[R-8.2-35] Kästchen ohne Nummer ganz in der Rap-Spalte mit unbekanntem Kürzel → Rapport, unsicher im Bericht', () => {
    const o = imp({ shapes: [block(0, [3, 3], '1900', '1930', [[bold('XR')]])] });
    const [r] = typed<Rapport>(o.result.plan, 'rapport');
    expect(r).toMatchObject({ code: 'XR', time: { form: 'range', from: 1140, to: 1170 } });
    const u = one(o, 'uncertainParse');
    expect(u.message.cause).toBe(
      'Ein Kästchen ohne Nummer in der Rap-Spalte am Mo 1900 wurde als Rapport übernommen; das Kürzel ist keines der Vorlage.',
    );
    expect(u.target.entryId).toBe(r?.id);
  });

  it('[R-8.2-06] Rapport mit rot durchgestrichenem Teil: Kürzel bleibt, Teil vermerkt, Bericht «Teil gestrichen»', () => {
    const o = imp({
      shapes: [
        block(0, [3, 3], '1800', '1830', [
          [bold('KR '), { text: '(Alt fiktiv)', bold: true, strike: true, color: ROT }],
        ]),
      ],
    });
    expect(typed<Rapport>(o.result.plan, 'rapport')[0]).toMatchObject({
      code: 'KR',
      status: 'confirmed',
      ort: '',
      removedText: ['(Alt fiktiv)'],
    });
    expect(one(o, 'partlyCancelled').message.cause).toBe(
      'Ein rot durchgestrichener Textteil wurde entfernt und als gestrichener Teil vermerkt.',
    );
  });
});

describe('F-ABDECKUNG Import: Blöcke an Rap- und Beso-Spalte (Regel 6, normalisierung 7)', () => {
  it('[R-8.2-16] Form ragt in die Beso-Spalte: auf die Planungsspalten gekürzt, Meldung nennt «Beso»', () => {
    const o = imp({ shapes: [block(0, [2, 4], '0800', '0900', [[bold('Ausb fiktiv')]])] });
    const [b] = blocks(o.result.plan);
    expect(b?.columns).toMatchObject({ kind: 'ids' });
    expect(one(o, 'truncatedToPlanning').message.cause).toBe(
      'Eine Form am Mo 0800 ragt in die Beso-Spalte; sie wurde auf die Planungsspalten gekürzt.',
    );
  });

  it('[R-8.2-15] Form ganz in der Rap-Spalte ohne Kürzel, aber in Rap und Beso → Nebenspalte «Det», Meldung nennt «Beso»', () => {
    const o = imp({ shapes: [block(0, [3, 4], '1000', '1100', [[bold('Fahrdienst fiktiv')]])] });
    const [b] = blocks(o.result.plan);
    expect(b).toBeDefined();
    expect(one(o, 'secondaryColumnCreated').message.cause).toBe(
      'Eine Form ohne Nummer liegt am Mo 1000 ganz in der Beso-Spalte; sie wurde ein Block der Nebenspalte «Det».',
    );
  });

  it('[R-8.2-20] Form ohne Text im Raster → nicht übernommen, Bericht mit Tag und Zeit', () => {
    const o = imp({ shapes: [block(1, [0, 0], '0800', '0900', [])] });
    expect(blocks(o.result.plan)).toEqual([]);
    expect(one(o, 'unassignedShape').message.cause).toBe(
      'Eine Form ohne Text am Di (0800–0900) wurde nicht übernommen.',
    );
    balanced(o);
  });

  it('[R-8.2-20] Linie ohne Beschriftung → nicht übernommen, Bericht mit Tag und Zeit', () => {
    const o = imp({ shapes: [block(2, [0, 2], '1200', '1200', [], { line: true })] });
    // Meldetext seit F-FIX Runde 5 (UX-AB-16) mit Ursache «Art nicht bestimmbar».
    expect(one(o, 'unassignedShape').message.cause).toBe(
      'Eine Linie ohne Beschriftung am Mi bei 1200 wurde nicht übernommen; ohne Beschriftung ist die Art des Markers nicht bestimmbar.',
    );
  });

  it('[R-8.2-20] Form links neben dem Raster bzw. unter keinem Tag → «ausserhalb des Rasters»', () => {
    const o = imp({
      rawShapes: [
        rawShape(10_000, yOf(minutes('1000')), COL_EMU - 300_000, yOf(minutes('1100')), {
          paragraphs: [[normal('Notiz fiktiv')]],
        }),
      ],
    });
    expect(one(o, 'unassignedShape').message.cause).toBe(
      'Eine Form ausserhalb des Rasters wurde keinem Eintrag zugeordnet.',
    );
    balanced(o);
  });
});

describe('F-ABDECKUNG Import: verknüpfte Formen (normalisierung 5.1, N-17/N-18)', () => {
  it('[R-8.2-02] Gleicher Text und gleiche Zeit in Spalte 1 und 3 (Aussparung) → ein Block mit beiden Spalten', () => {
    const o = imp({
      shapes: [
        block(0, [0, 0], '0800', '1000', [[bold('Ausb verknüpft')]]),
        block(0, [2, 2], '0800', '1000', [[bold('Ausb verknüpft')]]),
      ],
    });
    const bs = blocks(o.result.plan);
    expect(bs).toHaveLength(1);
    const cols = o.result.plan.columnSets.flatMap((s) => s.columns);
    const names =
      bs[0]?.columns.kind === 'ids'
        ? bs[0].columns.ids.map((id) => cols.find((c) => c.id === id)?.name)
        : [];
    expect(names).toEqual(['Kdo', 'Bravo']);
    balanced(o);
  });

  it('[R-8.2-02] Gleicher Block in allen Planungsspalten als zwei Formen → ein Block «alle»', () => {
    const o = imp({
      shapes: [
        block(0, [0, 1], '0800', '1000', [[bold('Ausb ganz')]]),
        block(0, [2, 2], '0800', '1000', [[bold('Ausb ganz')]]),
      ],
    });
    const bs = blocks(o.result.plan);
    expect(bs).toHaveLength(1);
    expect(bs[0]?.columns).toEqual({ kind: 'all' });
  });
});

describe('F-ABDECKUNG Import: Farben (Regel 5, F-31)', () => {
  it('[R-8.2-13] Verlauf mit zwei gleichen Legendenfarben (Ltg Zfhr) → eine Kategorie ohne zweite, kein Bericht', () => {
    const o = imp({
      shapes: [
        block(0, [0, 0], '0800', '0900', [[bold('Verlauf gleich')]], {
          gradient: ['FDEADA', 'FDEADA'],
        }),
      ],
    });
    const [b] = blocks(o.result.plan);
    expect(b?.categoryId).toBe(o.result.plan.legend.find((c) => c.name === 'Ltg Zfhr')?.id);
    expect(b?.secondCategoryId).toBeNull();
    expect(items(o, 'unclearColor')).toEqual([]);
  });

  it('[R-8.2-13][FA-05] Verlauf in genau der Farbe Ltg Kp → Ltg Kp ohne Bericht «Farbe unklar»', () => {
    // Soll (F-31): Bericht nur bei ΔE > 10 oder zu naher zweiter Farbe; FFFF99 ist genau die Legendenfarbe Ltg Kp.
    // Bis F-FIX galt ein Verlauf, dessen Kategorie zufällig der Rückfall Ltg Kp ist, als unklar (Befund FA-05).
    const o = imp({
      shapes: [
        block(0, [0, 0], '0800', '0900', [[bold('Verlauf Kp')]], {
          gradient: ['FFFF99', 'FFFF99'],
        }),
      ],
    });
    expect(blocks(o.result.plan)[0]?.categoryId).toBe(
      o.result.plan.legend.find((c) => c.name === 'Ltg Kp')?.id,
    );
    expect(blocks(o.result.plan)[0]?.secondCategoryId).toBeNull();
    expect(items(o, 'unclearColor')).toEqual([]);
  });

  it('[R-8.2-14] Verlauf aus zwei fremden Farben → Rückfall Ltg Kp, Bericht «Farbe unklar»', () => {
    const o = imp({
      shapes: [
        block(0, [0, 0], '0800', '0900', [[bold('Verlauf fremd')]], {
          gradient: ['00FF00', '0000FF'],
        }),
      ],
    });
    const [b] = blocks(o.result.plan);
    expect(b?.categoryId).toBe(o.result.plan.legend.find((c) => c.name === 'Ltg Kp')?.id);
    expect(one(o, 'unclearColor').message.cause).toBe(
      'Die Füllfarbe einer Form am Mo 0800 passt zu keiner Legendenfarbe eindeutig; übernommen wurde die nächste.',
    );
  });

  it('[R-8.2-12] Block ohne Füllung → neutral', () => {
    const o = imp({
      shapes: [block(0, [0, 0], '0800', '0900', [[bold('Ohne Füllung')]], { fill: null })],
    });
    expect(blocks(o.result.plan)[0]?.categoryId).toBe(
      o.result.plan.legend.find((c) => c.neutral)?.id,
    );
  });
});

describe('F-ABDECKUNG Import: Status und Teilaufgaben (Regel 2, 12)', () => {
  it('[R-8.2-07] Roter Text im Block → «geändert», Bericht «geändert»', () => {
    const o = imp({
      shapes: [
        block(0, [0, 0], '0800', '0900', [[{ text: 'Neu fiktiv', bold: true, color: ROT }]]),
      ],
    });
    expect(blocks(o.result.plan)[0]?.changed).toBe(true);
    expect(one(o, 'changed').message.cause).toBe(
      'Roter Text wurde als «geändert seit letztem Stand» übernommen.',
    );
  });

  it('[R-8.2-35] Unsicher zerlegter Formtext (zwei Klammern) → Bericht mit Grund', () => {
    const o = imp({ shapes: [block(0, [0, 0], '0800', '0900', [[bold('Ausb (Halle) (Platz)')]])] });
    expect(one(o, 'uncertainParse').message.cause).toBe(
      'Der Text einer Form am Mo 0800 wurde unsicher zerlegt (mehrere Klammern als Ort).',
    );
  });

  it('[R-8.2-02] Offenes Ende (gewellter Rand) → Block mit offenem Ende', () => {
    const o = imp({
      shapes: [block(0, [0, 0], '1900', '2100', [[bold('Ausgang')]], { geometry: 'wave' })],
    });
    expect(blocks(o.result.plan)[0]?.openEnd).toBe(true);
  });
});

describe('F-ABDECKUNG Import: Beso (normalisierung 5.5; Regeln 3, 6, 11)', () => {
  it('[R-8.2-04] Frist «bis dd.mm.» → Beso am Datum der Frist, Zeitform Frist', () => {
    const o = imp({
      shapes: [besoBox(0, 4, '0800', 10)],
      agenda: [{ day: 0, paragraphs: [[normal('10 bis 07.10.: Unterlagen abgeben.')]] }],
    });
    const [b] = besos(o.result.plan);
    expect(b).toMatchObject({ date: '2099-10-07', besoNumber: 10 });
    expect(b?.windows[0]?.time).toEqual({ form: 'deadline' });
  });

  it('[R-8.2-04] Mehrere Zeitfenster im Text, zwei Kästchen: jedes Kästchen nimmt das nächste Zeitfenster; drittes ohne Kästchen bleibt', () => {
    const o = imp({
      shapes: [besoBox(0, 4, '0900', 13), besoBox(0, 4, '1300', 13)],
      agenda: [
        {
          day: 0,
          paragraphs: [[normal('13 Revision: 0900-1000 Zug 1, 1300-1400 Zug 2, 1500-1600 Zug 3')]],
        },
      ],
    });
    const [b] = besos(o.result.plan);
    expect(b?.windows.map((w) => [w.time, w.supplement, w.columnId === null])).toEqual([
      [{ form: 'range', from: 540, to: 600 }, 'Zug 1', true],
      [{ form: 'range', from: 780, to: 840 }, 'Zug 2', true],
      [{ form: 'range', from: 900, to: 960 }, 'Zug 3', true],
    ]);
    expect(titleOf(b as Beso)).toBe('Revision');
  });

  it('[R-8.2-34] Termintext als Freitext mit Zeit im Text → Beso mit Freitext-Titel und eigener Terminzeile', () => {
    const o = imp({
      shapes: [besoBox(0, 4, '1000', 12)],
      agenda: [{ day: 0, paragraphs: [[normal('12 Material um 1000 fassen')]] }],
    });
    const [b] = besos(o.result.plan);
    expect(titleOf(b as Beso)).toBe('Material um 1000 fassen');
    expect(b?.agendaOverride).toBe('Material um 1000 fassen');
    expect(b?.windows[0]?.time).toEqual({ form: 'point', at: 600 });
  });

  it('[R-8.2-28] Kästchen ohne Termintext: Zeit aus den Kanten, leerer Titel, Bericht «Kästchen ohne Termintext»', () => {
    const o = imp({ shapes: [besoBox(1, 4, '1400', 21)] });
    const [b] = besos(o.result.plan);
    expect(b?.windows[0]?.time).toEqual({ form: 'range', from: 840, to: 870 });
    expect(b?.title).toEqual([]);
    expect(one(o, 'boxWithoutText').message.cause).toBe(
      'Zum Kästchen Nr 21 gibt es keinen Termintext; der Beso hat einen leeren Titel.',
    );
  });

  it('[R-8.2-39] Beso-Kästchen ganz verdeckt → kein Kästchen; Termintext bleibt mit Bericht «ohne Kästchen»', () => {
    const g = geometryOf(emptyWeek());
    const [x0, x1] = g.colSpan(0, 4);
    const o = imp({
      shapes: [besoBox(0, 4, '0900', 10)],
      agenda: [{ day: 0, paragraphs: [[normal('10 0900: Besuch fiktiv.')]] }],
      rawShapes: [rawShape(x0 - 1000, yOf(530), x1 + 1000, yOf(580), { fill: 'FFFFFF' })],
    });
    expect(items(o, 'hidden')).toHaveLength(1);
    expect(one(o, 'textWithoutBox').message.cause).toBe(
      'Zum Termin Nr 10 gibt es kein Kästchen im Raster; das Kästchen liegt jetzt in der Beso-Spalte.',
    );
    expect(besos(o.result.plan)[0]?.windows[0]?.columnId).toBeNull();
  });

  it('[R-8.2-05][R-8.2-06] Nur die Nummer rot durchgestrichen → Beso gestrichen; ein Teil gestrichen → Teil vermerkt', () => {
    const o = imp({
      shapes: [besoBox(0, 4, '0900', 10), besoBox(0, 4, '1000', 11)],
      agenda: [
        {
          day: 0,
          paragraphs: [
            [{ text: '10', strike: true, color: ROT }, normal(' 0900: Alt.')],
            [
              normal('11 1000: Besuch '),
              { text: 'Werkhof', strike: true, color: ROT },
              normal(' Halle.'),
            ],
          ],
        },
      ],
    });
    const [a, b] = besos(o.result.plan);
    expect(a).toMatchObject({ besoNumber: 10, status: 'cancelled' });
    expect(b).toMatchObject({ besoNumber: 11, status: 'confirmed', removedText: ['Werkhof'] });
    expect(titleOf(b as Beso)).toBe('Besuch Halle');
    expect(items(o, 'cancelled')).toHaveLength(1);
    expect(items(o, 'partlyCancelled')).toHaveLength(1);
  });

  it('[R-8.2-05][FA-04] ganze Terminzeile samt Nummer rot durchgestrichen → ein Beso, gestrichen, mit Zeit und Titel', () => {
    // Soll (Beschrieb 8.2 Regel 2, R-8.2-05; normalisierung 5.9 «Nummer bzw. ganzer Text rot durchgestrichen →
    // gestrichen»): ein Beso, Status gestrichen; der gestrichene Text bleibt Inhalt des gestrichenen Eintrags. Bis
    // F-FIX galt die gestrichene Zeit als fehlend: ein bestätigter Beso ohne Titel und eine leere gestrichene
    // ganztägige Bemerkung, dazu «Termin ohne Zeit» und «Kästchen ohne Termintext» (Befund FA-04).
    const o = imp({
      shapes: [besoBox(0, 4, '0900', 10)],
      agenda: [
        { day: 0, paragraphs: [[{ text: '10 0900: Alt fiktiv.', strike: true, color: ROT }]] },
      ],
    });
    const bs = besos(o.result.plan);
    expect(bs).toHaveLength(1);
    const [b] = bs;
    expect(b).toMatchObject({ besoNumber: 10, status: 'cancelled', removedText: [] });
    expect(titleOf(b as Beso)).toBe('Alt fiktiv');
    expect(b?.windows.map((w) => w.time)).toEqual([{ form: 'point', at: 540 }]);
    expect(entries(o.result.plan).filter((e) => e.type === 'dayRemark')).toEqual([]);
    expect(o.report.items.map((i) => i.kind)).toEqual(['cancelled']);
  });

  it('[R-8.2-05][FA-04] Nummer und Zeit rot durchgestrichen in getrennten Läufen → ebenfalls ein gestrichener Beso', () => {
    // Gleiches Soll wie oben, wenn Excel die gestrichene Zeile in mehrere Läufe teilt.
    const o = imp({
      shapes: [besoBox(0, 4, '0900', 10)],
      agenda: [
        {
          day: 0,
          paragraphs: [
            [
              { text: '10 ', strike: true, color: ROT },
              { text: '0900: Alt fiktiv.', strike: true, color: ROT },
            ],
          ],
        },
      ],
    });
    const bs = besos(o.result.plan);
    expect(bs).toHaveLength(1);
    expect(bs[0]).toMatchObject({ besoNumber: 10, status: 'cancelled', removedText: [] });
    expect(titleOf(bs[0] as Beso)).toBe('Alt fiktiv');
    expect(o.report.items.map((i) => i.kind)).toEqual(['cancelled']);
  });
});

describe('F-ABDECKUNG Import: Seitenleiste (Regel 8.2 Zweck; R-8.2-20)', () => {
  it('[R-8.2-20] Bemerkungen mit Aufzählung: Zeilen ohne Strich gehören zum vorherigen Punkt', () => {
    const o = imp({ remarks: ['Punkt eins', 'Punkt zwei'], rawShapes: [] });
    const rs = typed<MultiDayRemark>(o.result.plan, 'multiDayRemark');
    expect(rs.map((r) => r.text)).toEqual(['Punkt eins', 'Punkt zwei']);
  });

  it('[R-4.2-07][FA-03] Bemerkungen, die sich nur in der Anzahl «s» unterscheiden, bleiben zwei Bemerkungen', () => {
    // Soll (Beschrieb 4.2, R-4.2-07): nur gleiche Bemerkungen sind ein Eintrag; «Kasse offen» und «Kase offen» sind
    // zwei Bemerkungen. Bis F-FIX ersetzte die Signatur in assemble.ts mit /s+/g den Buchstaben «s» statt Leerraum;
    // die zweite Bemerkung ging verloren (Befund FA-03, Datenverlust).
    const o = importWeeks([
      emptyWeek({ sheet: 'Wo 1', monday: '2099-10-05', remarks: ['Kasse offen'] }),
      emptyWeek({ sheet: 'Wo 2', monday: '2099-10-12', remarks: ['Kase offen'] }),
    ]);
    const rs = typed<MultiDayRemark>(o.result.plan, 'multiDayRemark');
    expect(rs.map((r) => r.text)).toEqual(['Kasse offen', 'Kase offen']);
  });

  it('[R-8.2-20] Erhöhte Bereitschaft, Sonnenzeiten mit Symbol, Motto; Bild und unbekanntes Feld im Bericht', () => {
    const g = geometryOf(emptyWeek());
    const sx0 = g.colX(g.sideCol);
    const sx1 = g.colX(g.sideCol + 3);
    const y = (r: number) => 6 * HEADER_ROW_EMU + r * 95_250;
    const o = imp({
      rawShapes: [
        rawShape(sx0, y(20), sx1, y(23), {
          fill: null,
          paragraphs: [[normal('Erhöhte Bereitschaft')], [normal('Pikett Zug fiktiv')]],
        }),
        rawShape(sx0, y(70), sx0 + 200_000, y(72), { geometry: 'sun' }),
        rawShape(sx0 + 250_000, y(70), sx1, y(72), { fill: null, paragraphs: [[normal('0712')]] }),
        rawShape(sx0, y(73), sx0 + 200_000, y(75), { geometry: 'moon' }),
        rawShape(sx0 + 250_000, y(73), sx1, y(75), { fill: null, paragraphs: [[normal('19:03')]] }),
        rawShape(sx0, y(78), sx1, y(80), { fill: null, paragraphs: [[normal('VORWÄRTS FIKTIV')]] }),
        rawShape(sx0, y(81), sx1, y(82), {
          fill: null,
          paragraphs: [[normal('Unterschrift fiktiv')]],
        }),
      ],
    });
    const w = o.result.plan.weeks[0];
    expect(w?.heightenedReadiness).toBe('Pikett Zug fiktiv');
    expect(w?.sunOverride).toEqual({ sunrise: 430, sunset: 1145 });
    expect(o.result.plan.motto).toBe('VORWÄRTS FIKTIV');
    expect(one(o, 'unassignedShape').message.cause).toBe(
      'Ein Feld der Seitenleiste (z.B. Unterschrift, Motto oder Sonnenzeiten) wurde nicht übernommen.',
    );
    balanced(o);
  });
});

describe('F-ABDECKUNG Import: Kopf und Blätter (R-8.2-01)', () => {
  it('[R-8.2-01] Kurzname aus dem Blattnamen «Woche 2» → «Wo2»; Bezeichnung aus dem Titel', () => {
    const o = importWeeks([
      emptyWeek({ sheet: 'Woche 2', title: 'Inf Fik Kp 99/9 Arbeitsplan FDT Woche 2' }),
    ]);
    expect(o.result.plan.weeks[0]).toMatchObject({ shortName: 'Wo2', label: 'FDT Woche 2' });
    expect(o.result.plan.unit).toBe('Inf Fik Kp 99/9');
  });

  it('[R-8.2-01] Blattname ohne Wochennummer: Kurzname ohne Leerraum, höchstens 12 Zeichen', () => {
    const o = importWeeks([emptyWeek({ sheet: 'KVK Kader Vorkurs' })]);
    expect(o.result.plan.weeks[0]?.shortName).toBe('KVKKaderVork');
  });

  it('[R-8.2-01] Dienst aus der Beilage («FDT 2099»); Wochen in Datumsreihenfolge, auch wenn die Blätter anders liegen', () => {
    const o = importWeeks([
      emptyWeek({ sheet: 'Wo 2', monday: '2099-10-12' }),
      emptyWeek({ sheet: 'Wo 1', monday: '2099-10-05' }),
    ]);
    expect(o.result.plan.service).toBe('FDT 2099');
    expect(o.result.plan.weeks.map((w) => w.shortName)).toEqual(['Wo1', 'Wo2']);
  });
});
