// @vitest-environment jsdom
// I4 (E1-08): Export der Listenansicht im Format der Soll-Listen (Vertrag E1-08 §2; normalisierung.md 2–7;
// R-6-16, R-6-40) und Import eines Kp-WAP im Vorjahresformat (R-8.2-36, F-54). Fiktive Daten.
import { describe, expect, it } from 'vitest';
import { updateEntry } from '../../../../src/model/wap/commands/entries';
import { LIST_CSV_HEADER, listCsv } from '../../../../src/model/wap/list/index';
import {
  besoBox,
  block,
  bold,
  emptyWeek,
  normal,
  WEEKEND,
} from '../../fixtures/import/kp-workbook';
import { compareWithAnhang, parseCsv } from '../../support/anhang-compare/compare';
import { blocks, ctx, importWeeks } from '../../unit/import/support';

function imported() {
  return importWeeks([
    emptyWeek({
      shapes: [
        block(0, [0, 2], '0800', '1200', [[bold('Ausbildung')], [normal('Zfhr (Halle; Platz)')]]),
        block(1, [1, 1], '1300', '1500', [[bold('Schiessen "scharf"')]]),
        besoBox(0, 4, '0900', 10),
      ],
      agenda: [{ day: 0, paragraphs: [[normal('10 0900: Besuch Werkstatt, Ort: Halle.')]] }],
      remarks: ['Bemerkung für die ganze Woche'],
    }),
  ]);
}

describe('Listen-Export', () => {
  it('[R-6-16] CSV nach normalisierung.md: Kopfzeile, «;», LF, Quoting; das Vergleichsskript liest ihn', () => {
    const { result } = imported();
    const csv = listCsv(result.plan, 'plan');
    expect(csv.startsWith(`${LIST_CSV_HEADER}\n`)).toBe(true);
    expect(csv.charCodeAt(0)).not.toBe(0xfeff);
    expect(csv.includes('\r')).toBe(false);
    expect(csv).toContain('"Halle; Platz"');
    expect(csv).toContain('"Schiessen ""scharf"""');
    const rows = parseCsv(csv);
    expect(rows.map((r) => r.Typ).sort()).toEqual(['Beso', 'Block', 'Block', 'MehrtagBemerkung']);
    const block1 = rows.find((r) => r.Titel === 'Ausbildung');
    expect(block1).toMatchObject({
      Woche: 'Wo1',
      Tag: 'Mo',
      Zeitform: 'von-bis',
      von: '0800',
      bis: '1200',
      Spalten: 'alle',
      Kategorie: 'Leitung Kp',
      Ltg: 'Zfhr',
      Status: 'bestätigt',
    });
    expect(rows.find((r) => r.Typ === 'Beso')).toMatchObject({
      Nr: '10',
      Spalten: 'Beso',
      von: '0900',
      Zeitform: 'Zeitpunkt',
    });
    // Der eigene Export ist gegen sich selbst zu 100 % korrekt erkannt.
    const self = compareWithAnhang(csv, csv);
    expect(self.correct).toBe(self.total);
    expect(self.exact).toBe(self.total);
  });

  it('[R-6-40] interne Notizen erscheinen nie im Export', () => {
    const { result } = imported();
    const [b] = blocks(result.plan);
    const noted = updateEntry(
      result.plan,
      b?.id ?? '',
      'block',
      { internalNote: 'KENNWORT-NOTIZ-4711' },
      ctx,
    ).plan;
    const csv = listCsv(noted, 'plan');
    expect(csv).not.toContain('KENNWORT-NOTIZ-4711');
    expect(csv).toContain('Ausbildung');
  });
});

describe('Vorjahresformat', () => {
  it('[R-8.2-36] andere Spaltennamen und andere Legende → Import ohne Abbruch; jede Form gezählt', () => {
    const o = importWeeks([
      emptyWeek({
        sheet: 'Woche 2',
        title: 'Fik Ustü Kp 98/7 Arbeitsplan Woche 2',
        beilage: 'Beilage 01-02 zum Befehl für den WK 2098',
        monday: '2098-10-06',
        stand: '2098-09-01',
        days: [
          { columns: ['Zug 1', 'Zug 2', 'Zug 3', 'Zug 4', 'Rapport', 'Bes'] },
          { columns: ['Zug 1', 'Zug 2', 'Zug 3', 'Zug 4', 'Rapport', 'Bes'] },
          { columns: ['Kader', 'Truppe', 'Rapport', 'Bes'] },
          WEEKEND,
          WEEKEND,
        ],
        legend: {
          'Leitung Kp': 'FFFF66',
          'Leitung Zfhr': 'FCE4D6',
          'Leitung Bat': 'BDD7EE',
          Extern: 'C0C0C0',
          'Ltg S2': 'F4B183',
        },
        shapes: [
          block(0, [0, 3], '0700', '1100', [[bold('Gefechtsausbildung')]], { fill: 'FCE4D6' }),
          block(2, [0, 1], '0800', '0930', [[bold('Theorie')]], { fill: 'FFFF66' }),
          { day: 1, cols: [0, 3], from: 600, to: 660, paragraphs: [], fill: 'AAAAAA' },
        ],
      }),
    ]);
    const plan = o.result.plan;
    expect(plan.weeks.map((w) => w.shortName)).toEqual(['Wo2']);
    expect(plan.service).toBe('WK 2098');
    const name = (id: string) => plan.legend.find((c) => c.id === id)?.name;
    expect(blocks(plan).map((b) => name(b.categoryId))).toEqual(['Ltg Zfhr', 'Ltg Kp']);
    for (const s of o.report.sheets) expect(s.shapesRead).toBe(s.assigned + s.unassigned);
    const unassigned = o.report.items.filter((i) => i.kind === 'unassignedShape');
    expect(unassigned.length).toBe(o.report.sheets[0]?.unassigned);
    // Wochenende fehlt im Kopf (nur fünf Tage): Sa und So ausgeblendet.
    expect(plan.weeks[0]?.days.map((d) => d.display)).toEqual([
      'full',
      'full',
      'full',
      'compact',
      'compact',
      'hidden',
      'hidden',
    ]);
  });
});
