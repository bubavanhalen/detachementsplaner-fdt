// @vitest-environment jsdom
// I4 (E1-08): Import-Regeln 2–7, 10 und 11 aus Beschrieb 8.2 an fiktiven Arbeitsmappen (Vertrag E1-08 §1).
import { describe, expect, it } from 'vitest';
import { moveEntries } from '../../../../src/model/wap/commands/entries';
import { dayColumns } from '../../../../src/model/wap/derive/columns';
import {
  besoBox,
  block,
  bold,
  emptyWeek,
  KP_DAY,
  KP_DAY_GAP,
  minutes,
  normal,
  WEEKEND,
} from '../../fixtures/import/kp-workbook';
import { besos, blocks, ctx, entries, importWeeks, kinds, titleOf } from './support';

const RED = 'FF0000';

describe('Regel 2: rot und rot durchgestrichen', () => {
  it('[R-8.2-05] rot durchgestrichene Nummer → ganzer Beso gestrichen', () => {
    const o = importWeeks([
      emptyWeek({
        shapes: [besoBox(0, 4, '0900', 13)],
        agenda: [
          {
            day: 0,
            paragraphs: [[{ text: '13', strike: true, color: RED }, normal(' 0900: Alte Übung.')]],
          },
        ],
      }),
    ]);
    const [b] = besos(o.result.plan);
    expect(b?.status).toBe('cancelled');
    expect(b?.besoNumber).toBe(13);
    expect(kinds(o)).toContain('cancelled');
  });

  it('[R-8.2-06] nur ein Teil rot durchgestrichen → gültiger Text ohne den Teil, Teil vermerkt', () => {
    const o = importWeeks([
      emptyWeek({
        shapes: [
          block(0, [0, 2], '0800', '1000', [
            [bold('Ausbildung')],
            [normal('Einh Fw ('), { text: 'Halle', strike: true, color: RED }, normal('Wiese)')],
          ]),
        ],
      }),
    ]);
    const [b] = blocks(o.result.plan);
    expect(b?.status).toBe('confirmed');
    expect(b?.ort).toBe('Wiese');
    expect(b?.removedText).toEqual(['Halle']);
    expect(kinds(o)).toContain('partlyCancelled');
  });

  it('[R-8.2-07] roter Titel → Markierung «geändert», Text bleibt gültig', () => {
    const o = importWeeks([
      emptyWeek({
        shapes: [
          block(1, [0, 0], '1300', '1500', [[{ text: 'Schiessen', bold: true, color: RED }]]),
        ],
      }),
    ]);
    const [b] = blocks(o.result.plan);
    expect(b?.changed).toBe(true);
    expect(b?.status).toBe('confirmed');
    expect(titleOf(b ?? { title: [] })).toBe('Schiessen');
  });
});

describe('Regel 3: Zeit eines Beso', () => {
  it('[R-8.2-08] Termintext 0830-0900 hat Vorrang vor dem Kästchen auf 0800', () => {
    const o = importWeeks([
      emptyWeek({
        shapes: [besoBox(0, 4, '0800', 10)],
        agenda: [{ day: 0, paragraphs: [[normal('10 0830-0900: Kontrolle Fahrzeuge.')]] }],
      }),
    ]);
    expect(besos(o.result.plan)[0]?.windows[0]?.time).toEqual({
      form: 'range',
      from: 510,
      to: 540,
    });
  });

  it('[R-8.2-09] 20 Min Abweichung → Bericht; 15 Min → kein Bericht', () => {
    const o = importWeeks([
      emptyWeek({
        shapes: [besoBox(0, 4, '0810', 10), besoBox(1, 4, '0815', 20)],
        agenda: [
          { day: 0, paragraphs: [[normal('10 0830: Eins.')]] },
          { day: 1, paragraphs: [[normal('20 0830: Zwei.')]] },
        ],
      }),
    ]);
    const deviations = o.report.items.filter((i) => i.kind === 'boxTimeDeviation');
    expect(deviations.map((d) => d.besoNumber)).toEqual([10]);
  });
});

describe('Regel 4: Blockkanten', () => {
  it('[R-8.2-10] Kante 0807 → 0805, 0808 → 0810', () => {
    const o = importWeeks([
      emptyWeek({
        shapes: [
          {
            day: 0,
            cols: [0, 0],
            from: minutes('0807'),
            to: minutes('0900'),
            paragraphs: [[bold('A')]],
          },
          {
            day: 0,
            cols: [1, 1],
            from: minutes('0808'),
            to: minutes('0900'),
            paragraphs: [[bold('B')]],
          },
        ],
      }),
    ]);
    const froms = blocks(o.result.plan).map((b) => (b.time.form === 'range' ? b.time.from : -1));
    expect(froms).toEqual([485, 490]);
  });

  it('[R-8.2-11] 0802 nichts; 0803/0804 ein Sammeleintrag; 0805/0806 je einzeln; Beso-Kanten nie', () => {
    const shape = (day: number, col: number, from: string, title: string) => ({
      day,
      cols: [col, col] as const,
      from: minutes(from),
      to: minutes('1000'),
      paragraphs: [[bold(title)]],
    });
    const o = importWeeks([
      emptyWeek({
        shapes: [
          shape(0, 0, '0802', 'A'),
          shape(0, 1, '0803', 'B'),
          shape(0, 2, '0804', 'C'),
          shape(1, 0, '0805', 'D'),
          shape(1, 1, '0806', 'E'),
          {
            day: 2,
            cols: [0, 0],
            from: minutes('0803'),
            to: minutes('0927'),
            paragraphs: [[bold('F')]],
          },
          { ...besoBox(3, 4, '0803', 40) },
        ],
        agenda: [{ day: 3, paragraphs: [[normal('40 0800: Kästchen.')]] }],
      }),
      emptyWeek({
        sheet: 'Wo 2',
        title: 'Inf Fik Kp 99/9 Arbeitsplan Woche 2',
        monday: '2099-10-12',
        shapes: [shape(0, 0, '0803', 'G')],
      }),
    ]);
    const grouped = o.report.items.filter((i) => i.kind === 'edgeOffGridGrouped');
    const single = o.report.items.filter((i) => i.kind === 'edgeOffGrid');
    const byDate = Object.fromEntries(grouped.map((g) => [g.date, g.group]));
    expect(byDate['2099-10-05']?.count).toBe(2);
    expect(byDate['2099-10-05']?.members).toHaveLength(2);
    // Ein Block mit beiden Kanten 2–4 Min daneben zählt zweimal, steht einmal unter den Betroffenen.
    expect(byDate['2099-10-07']).toEqual({ count: 2, members: [expect.any(String)] });
    // Gleiche Lage auf einem zweiten Blatt → eigener Sammeleintrag.
    expect(byDate['2099-10-12']?.count).toBe(1);
    expect(single.map((s) => s.date)).toEqual(['2099-10-06', '2099-10-06']);
    expect(single.every((s) => s.target.entryId !== null && s.group === null)).toBe(true);
    // Beso-Kanten ergeben keine Meldung nach Regel 4 (Do).
    expect(o.report.items.some((i) => i.date === '2099-10-08' && i.kind.startsWith('edge'))).toBe(
      false,
    );
  });
});

describe('Regel 5: Farben', () => {
  it('[R-8.2-12] RGB-, Design- und halbtransparente Farbe → richtige Kategorie', () => {
    const o = importWeeks([
      emptyWeek({
        shapes: [
          block(0, [0, 0], '0800', '0900', [[bold('Rgb')]], { fill: 'FDE9D9' }),
          block(0, [1, 1], '0800', '0900', [[bold('Alpha')]], { fill: 'FFCC66', alpha: 0.5 }),
          block(0, [2, 2], '0800', '0900', [[bold('Design')]], { scheme: 'bg1' }),
        ],
      }),
    ]);
    const plan = o.result.plan;
    const name = (id: string) => plan.legend.find((c) => c.id === id)?.name;
    const [rgb, alpha, design] = blocks(plan);
    expect(name(rgb?.categoryId ?? '')).toBe('Ltg Zfhr');
    // FFCC66 zu 50 % auf Weiss = FFE5B2 → nächste Legendenfarbe Ltg S2 (FFCC99)? Nein: Ltg Zfhr FDEADA.
    expect(['Ltg Zfhr', 'Ltg S2']).toContain(name(alpha?.categoryId ?? ''));
    expect(name(design?.categoryId ?? '')).toBe('neutral');
  });

  it('[R-8.2-13] Verlauf gelb → hellblau = gemeinsame Leitung Ltg Kp und Ltg Bat', () => {
    const o = importWeeks([
      emptyWeek({
        shapes: [
          block(0, [0, 2], '0800', '1000', [[bold('WEME')]], { gradient: ['FFFF99', 'CCECFF'] }),
        ],
      }),
    ]);
    const plan = o.result.plan;
    const [b] = blocks(plan);
    const name = (id: string | null | undefined) => plan.legend.find((c) => c.id === id)?.name;
    expect([name(b?.categoryId), name(b?.secondCategoryId)].sort()).toEqual(['Ltg Bat', 'Ltg Kp']);
  });

  it('[R-8.2-14] Farbe ausserhalb der Toleranz → Bericht mit Sprung', () => {
    const o = importWeeks([
      emptyWeek({
        shapes: [block(0, [0, 2], '0800', '1000', [[bold('Lila')]], { fill: '7030A0' })],
      }),
    ]);
    const item = o.report.items.find((i) => i.kind === 'unclearColor');
    expect(item?.target.entryId).toBe(blocks(o.result.plan)[0]?.id);
    expect(item?.weekId).toBe(o.result.plan.weeks[0]?.id);
  });
});

describe('Regel 6 und 7: Rap-, Beso- und Zwischenspalten', () => {
  it('[R-8.2-15] Form ohne Nummer ganz in der Beso-Spalte → Block der neuen Nebenspalte «Det», Bericht', () => {
    const o = importWeeks([
      emptyWeek({ shapes: [block(0, [4, 4], '0800', '1200', [[bold('Mun Fsg Det')]])] }),
    ]);
    const plan = o.result.plan;
    const week = plan.weeks[0];
    const cols = week === undefined ? [] : dayColumns(plan, week.id, 'Mo');
    const det = cols.find((c) => c.kind === 'secondary');
    expect(det?.name).toBe('Det');
    const [b] = blocks(plan);
    expect(b?.columns).toEqual({ kind: 'ids', ids: [det?.id] });
    expect(kinds(o)).toContain('secondaryColumnCreated');
  });

  it('[R-8.2-16] Form ragt teilweise in die Rap-Spalte → auf Planungsspalten gekürzt, Bericht', () => {
    const o = importWeeks([
      emptyWeek({ shapes: [block(0, [1, 3], '0800', '1000', [[bold('Breit')]])] }),
    ]);
    const plan = o.result.plan;
    const week = plan.weeks[0];
    const cols = week === undefined ? [] : dayColumns(plan, week.id, 'Mo');
    const [b] = blocks(plan);
    expect(b?.columns).toEqual({ kind: 'ids', ids: [cols[1]?.id, cols[2]?.id] });
    expect(kinds(o)).toContain('truncatedToPlanning');
  });

  it('[R-8.2-17] nummeriertes Kästchen in der Rap-Spalte → Zeitfenster der Beso-Spalte, Bericht', () => {
    const o = importWeeks([
      emptyWeek({
        shapes: [besoBox(2, 3, '1000', 32)],
        agenda: [{ day: 2, paragraphs: [[normal('32 1000: Besuch.')]] }],
      }),
    ]);
    expect(besos(o.result.plan)[0]?.windows[0]?.columnId).toBeNull();
    expect(o.report.items.find((i) => i.kind === 'besoInRapColumn')?.besoNumber).toBe(32);
  });

  it('[R-8.2-18] nummeriertes Kästchen in einer Planungsspalte → Zeitfenster dieser Spalte, Bericht', () => {
    const o = importWeeks([
      emptyWeek({
        shapes: [besoBox(0, 1, '0900', 13)],
        agenda: [{ day: 0, paragraphs: [[normal('13 0900: Vorrevision.')]] }],
      }),
    ]);
    const plan = o.result.plan;
    const week = plan.weeks[0];
    const cols = week === undefined ? [] : dayColumns(plan, week.id, 'Mo');
    expect(besos(plan)[0]?.windows[0]?.columnId).toBe(cols[1]?.id);
    expect(kinds(o)).toContain('besoInPlanningColumn');
  });

  it('[R-8.2-19] unbeschriftete Zwischenspalte → der linken Nachbarspalte zugeschlagen, Bericht', () => {
    const o = importWeeks([
      emptyWeek({
        days: [KP_DAY_GAP, KP_DAY, KP_DAY, KP_DAY, KP_DAY, WEEKEND, WEEKEND],
        shapes: [block(0, [2, 3], '0800', '1000', [[bold('Bis in die Lücke')]])],
      }),
    ]);
    const plan = o.result.plan;
    const week = plan.weeks[0];
    const cols = week === undefined ? [] : dayColumns(plan, week.id, 'Mo');
    expect(cols.map((c) => c.name)).toEqual(['Kdo', 'Alpha', 'Bravo', 'Rap', 'Beso']);
    expect(blocks(plan)[0]?.columns).toEqual({ kind: 'ids', ids: [cols[2]?.id] });
    expect(o.report.items.filter((i) => i.kind === 'gapColumnMerged').map((i) => i.date)).toEqual([
      '2099-10-05',
    ]);
  });
});

describe('Regel 10 und 11', () => {
  it('[R-8.2-23] importierte Beso-Nummern bleiben beim Verschieben fixiert', () => {
    const o = importWeeks([
      emptyWeek({
        shapes: [besoBox(0, 4, '0900', 11), besoBox(0, 4, '1400', 12)],
        agenda: [{ day: 0, paragraphs: [[normal('11 0900: Eins.')], [normal('12 1400: Zwei.')]] }],
      }),
    ]);
    const plan = o.result.plan;
    const [first] = besos(plan);
    const moved = moveEntries(plan, [first?.id ?? ''], { deltaMinutes: 360 }, ctx).plan;
    expect(
      besos(moved)
        .map((b) => b.besoNumber)
        .sort(),
    ).toEqual([11, 12]);
    expect(besos(moved).find((b) => b.id === first?.id)?.besoNumber).toBe(11);
  });

  it('[R-8.2-25] Nummern 13 (bis 1200) vor 14 (1130) bleiben, Bericht', () => {
    const o = importWeeks([
      emptyWeek({
        shapes: [besoBox(0, 4, '1130', 13), besoBox(0, 4, '1130', 14, { fraction: [0.5, 1] })],
        agenda: [
          { day: 0, paragraphs: [[normal('13 bis 1200: Abgabe.')], [normal('14 1130: Besuch.')]] },
        ],
      }),
    ]);
    expect(besos(o.result.plan).map((b) => b.besoNumber)).toEqual([13, 14]);
    const order = o.report.items.filter((i) => i.kind === 'numberOrder');
    expect(order).toHaveLength(1);
    expect(order[0]?.message.cause).toMatch(/14.*13/);
  });

  it('[R-8.2-26] zwei überlagerte Kästchen und ein Textfeld über der Legende → zwei Berichtseinträge', () => {
    const o = importWeeks([
      emptyWeek({
        shapes: [
          besoBox(4, 4, '1000', 52, { fraction: [0, 0.5] }),
          besoBox(4, 4, '1015', 53, { fraction: [0.5, 1] }),
        ],
        agenda: [{ day: 4, paragraphs: [[normal('52 1000: Eins.')], [normal('53 1015: Zwei.')]] }],
        remarks: ['Bemerkung über der Legende'],
        remarksOverLegend: true,
      }),
    ]);
    const overlaps = o.report.items.filter((i) => i.kind === 'overlappingShapes');
    expect(overlaps).toHaveLength(2);
    expect(overlaps.map((i) => i.besoNumber)).toContain(52);
  });

  it('[R-8.2-27] nummerierter Termin «51 Text» ohne Zeit → ganztägige Bemerkung, Bericht', () => {
    const o = importWeeks([
      emptyWeek({
        agenda: [{ day: 4, paragraphs: [[normal('51 Fahrzeuge waschen nach Bedarf.')]] }],
      }),
    ]);
    const remark = entries(o.result.plan).find((e) => e.type === 'dayRemark');
    expect(remark?.type === 'dayRemark' && remark.text).toBe('Fahrzeuge waschen nach Bedarf.');
    expect(o.report.items.find((i) => i.kind === 'numberedWithoutTime')?.besoNumber).toBe(51);
    expect(besos(o.result.plan)).toHaveLength(0);
  });

  it('[R-8.2-28] Kästchen ohne Termintext und Termintext ohne Kästchen → je ein Berichtseintrag', () => {
    const o = importWeeks([
      emptyWeek({
        shapes: [besoBox(1, 4, '1330', 21)],
        agenda: [{ day: 1, paragraphs: [[normal('20 1000: Ohne Kästchen.')]] }],
      }),
    ]);
    const k = kinds(o);
    expect(k).toContain('boxWithoutText');
    expect(k).toContain('textWithoutBox');
    const [b20, b21] = besos(o.result.plan).sort(
      (a, b) => (a.besoNumber ?? 0) - (b.besoNumber ?? 0),
    );
    expect(b20?.windows[0]?.columnId).toBeNull();
    expect(b21?.title).toEqual([]);
    expect(b21?.windows[0]?.time).toEqual({ form: 'range', from: 810, to: 840 });
  });
});
