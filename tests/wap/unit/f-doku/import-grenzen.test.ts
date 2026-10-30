// @vitest-environment jsdom
// F-DOKU, Auflagen des test-reviewer-2 (TR-2-02, TR-2-03, TR-2-05, TR-2-07, TR-2-08): Grenzwerte des Imports an der
// Grenze geprüft, je ein Wert knapp innerhalb und knapp ausserhalb, und Prüfungen, die die Namen der F-ABDECKUNG-
// Tests versprechen. Beschrieb 8.2 Regeln 3, 6, 7; normalisierung 5.3, 5.5, 7; R-4.2-07; F-FIX FA-03, FA-07, FA-08.
// Die Tests töten die Handmutanten D, E und F aus `.qa/haertung/tr2/mut/` (Beleg lokal). Fiktive Arbeitsmappen.
import { describe, expect, it } from 'vitest';
import type { ImportOutcome, ImportReportKind } from '../../../../src/io/wap-import/index';
import type { Marker, MultiDayRemark, Plan } from '../../../../src/model/wap/types';
import { besoBox, block, bold, emptyWeek, normal } from '../../fixtures/import/kp-workbook';
import { importEdited } from '../f-abdeckung/support';
import { besos, blocks, entries, importWeeks } from '../import/support';

const of = <T extends { type: string }>(plan: Plan, type: T['type']) =>
  entries(plan).filter((e) => e.type === type) as unknown as T[];
const items = (o: ImportOutcome, kind: ImportReportKind) =>
  o.report.items.filter((i) => i.kind === kind);
const columnsOfMonday = (plan: Plan) => {
  const setId = plan.weeks[0]?.days[0]?.columnSetId;
  return plan.columnSets.find((s) => s.id === setId)?.columns ?? [];
};

/**
 * Marker «HV» mit Beschriftung `von`–`bis` (Mo, Spalte Kdo) und einer Linienform um `linie` über Kdo und Alpha. Die
 * Markerzeit wird danach auf 5 Min gerundet (R-8.2-10); die Fälle sind so gewählt, dass Zeit der Linie und Zeit aus
 * dem oberen Rand der Beschriftung (15-Min-Linie) auch nach der Rundung verschieden sind.
 */
function marker(von: string, bis: string, linie: string): Marker {
  const o = importWeeks([
    emptyWeek({
      shapes: [
        block(0, [0, 1], linie, linie, [], { line: true }),
        block(0, [0, 0], von, bis, [[normal('HV')]]),
      ],
    }),
  ]);
  const ms = of<Marker>(o.result.plan, 'marker');
  expect(ms).toHaveLength(1);
  const m = ms[0];
  if (m === undefined) throw new Error('Marker fehlt');
  // Entscheid Auftraggeber 21.10.2026: Marker gelten immer über alle Planungsspalten, auch wenn die Linie nur
  // einen Teil der Spalten deckt. Die Zuordnung der Linie zeigt sich an der Zeit (Prüfungen unten).
  expect(m.columns.kind).toBe('all');
  return m;
}

describe('F-DOKU TR-2-02: Markerzeit aus der zugeordneten Linie, auch neben der Beschriftung (FA-07, nach FD-03)', () => {
  // Seit F-FIX Runde 2 (FD-03, R-8.2-44: Lage der Linie aus dem Zeichnungsanker) gilt die Linie ohne die frühere
  // Einschränkung «berührt die Beschriftung ±2 Min»; die Zeit wird auf 5 Min gerundet (R-8.2-10).
  // Beschriftung 2152–2207 (oberer Rand → 15-Min-Linie 2200).
  it('[R-8.2-02] Linie 2 Min über der Beschriftung (2150) → Zeit der Linie 2150', () => {
    expect(marker('2152', '2207', '2150').at).toBe(21 * 60 + 50);
  });

  it('[R-8.2-02] Linie 3 Min über der Beschriftung (2149) → Zeit der Linie (gerundet 2150)', () => {
    expect(marker('2152', '2207', '2149').at).toBe(21 * 60 + 50);
  });

  // Beschriftung 2145–2200 (oberer Rand → 2145).
  it('[R-8.2-02] Linie 2 Min unter der Beschriftung (2202) → Zeit der Linie (gerundet 2200)', () => {
    expect(marker('2145', '2200', '2202').at).toBe(22 * 60);
  });

  it('[R-8.2-02] Linie 3 Min unter der Beschriftung (2203) → Zeit der Linie (gerundet 2205)', () => {
    expect(marker('2145', '2200', '2203').at).toBe(22 * 60 + 5);
  });
});

/** Kästchen Nr 13 am Mo in Bravo bei `kaestchen`; Termintext mit Frist ohne Uhrzeit und Zeitfenster 1300. */
function fristOderFenster(kaestchen: string): ImportOutcome {
  return importWeeks([
    emptyWeek({
      shapes: [besoBox(0, 2, kaestchen, 13)],
      agenda: [{ day: 0, paragraphs: [[normal('13 Abgabe: bis 05.10., 1300 Zug fiktiv')]] }],
    }),
  ]);
}

function spalteVon(o: ImportOutcome, form: 'point' | 'deadline'): string | null | undefined {
  const [b] = besos(o.result.plan);
  expect(b?.windows).toHaveLength(2);
  return b?.windows.find((w) => w.time.form === form)?.columnId;
}

describe('F-DOKU TR-2-03: Zeitfenster mit Uhrzeit geht der Frist ohne Uhrzeit nur bis 15 Min vor (FA-08)', () => {
  it('[R-8.2-08][R-8.2-09] Kästchen 15 Min vor dem Zeitfenster (1245) → Zeitfenster 1300, kein Bericht «Abweichung»', () => {
    const o = fristOderFenster('1245');
    const bravo = columnsOfMonday(o.result.plan)[2]?.id;
    expect(spalteVon(o, 'point')).toBe(bravo);
    expect(spalteVon(o, 'deadline')).toBeNull();
    expect(items(o, 'boxTimeDeviation')).toEqual([]);
  });

  it('[R-8.2-08][R-8.2-09] Kästchen 15 Min nach dem Zeitfenster (1315) → Zeitfenster 1300', () => {
    const o = fristOderFenster('1315');
    expect(spalteVon(o, 'point')).toBe(columnsOfMonday(o.result.plan)[2]?.id);
    expect(spalteVon(o, 'deadline')).toBeNull();
    expect(items(o, 'boxTimeDeviation')).toEqual([]);
  });

  it('[R-8.2-08][R-8.2-09] Kästchen 16 Min vor bzw. nach dem Zeitfenster (1244, 1316) → Frist ohne Uhrzeit', () => {
    for (const k of ['1244', '1316']) {
      const o = fristOderFenster(k);
      expect(spalteVon(o, 'deadline'), k).toBe(columnsOfMonday(o.result.plan)[2]?.id);
      expect(spalteVon(o, 'point'), k).toBeNull();
      expect(items(o, 'boxTimeDeviation'), k).toEqual([]);
    }
  });
});

describe('F-DOKU TR-2-08: planweite Bemerkung mit abweichendem Leerraum ist eine Bemerkung (FA-03)', () => {
  it('[R-4.2-07] doppeltes Leerzeichen, Leerzeichen am Ende, Tabulator und geschütztes Leerzeichen → genau eine Bemerkung', () => {
    const varianten = ['Kasse  offen ', 'Kasse\toffen', 'Kasse offen'];
    const o = importWeeks([
      emptyWeek({ sheet: 'Wo 1', monday: '2099-10-05', remarks: ['Kasse offen'] }),
      ...varianten.map((r, i) =>
        emptyWeek({
          sheet: `Wo ${String(i + 2)}`,
          monday: `2099-10-${String(12 + 7 * i)}`,
          remarks: [r],
        }),
      ),
    ]);
    const rs = of<MultiDayRemark>(o.result.plan, 'multiDayRemark');
    expect(rs.map((r) => r.text)).toEqual(['Kasse offen']);
  });

  it('[R-4.2-07] Gegenfall: anderer Text mit gleichem Leerraum bleibt eine eigene Bemerkung', () => {
    const o = importWeeks([
      emptyWeek({ sheet: 'Wo 1', monday: '2099-10-05', remarks: ['Kasse offen'] }),
      emptyWeek({ sheet: 'Wo 2', monday: '2099-10-12', remarks: ['Kasse  zu'] }),
    ]);
    const rs = of<MultiDayRemark>(o.result.plan, 'multiDayRemark');
    expect(rs).toHaveLength(2);
  });
});

describe('F-DOKU TR-2-05: Spaltengewicht an den Grenzen 70 % und 145 % der üblichen Breite', () => {
  // Übliche Breite 12 Zeichen; Kdo (Spalte 1) wird verändert. 8,3 bzw. 8,4 Zeichen liegen um 70 %, 17,2 bzw. 17,4 um
  // 145 % (nach der Umrechnung Zeichen → EMU des Lesemoduls).
  const gewicht = (zeichen: number) =>
    columnsOfMonday(importEdited([emptyWeek()], { widths: { 1: zeichen } }).result.plan)[0]?.weight;

  it('[R-4.4-01] knapp unter 70 % → schmal, knapp darüber → normal', () => {
    expect(gewicht(8.3)).toBe('narrow');
    expect(gewicht(8.4)).toBe('normal');
  });

  it('[R-4.4-01] knapp unter 145 % → normal, knapp darüber → breit', () => {
    expect(gewicht(17.2)).toBe('normal');
    expect(gewicht(17.4)).toBe('wide');
  });
});

describe('F-DOKU TR-2-07: Prüfungen, die die Namen der F-ABDECKUNG-Tests versprechen', () => {
  it('[R-8.2-16] Form ragt in die Beso-Spalte → Block genau in der Planungsspalte «Bravo» (gekürzte Spalten)', () => {
    const o = importWeeks([
      emptyWeek({ shapes: [block(0, [2, 4], '0800', '0900', [[bold('Ausb fiktiv')]])] }),
    ]);
    const cols = columnsOfMonday(o.result.plan);
    expect(cols.map((c) => c.name)).toEqual(['Kdo', 'Alpha', 'Bravo', 'Rap', 'Beso']);
    expect(blocks(o.result.plan)[0]?.columns).toEqual({ kind: 'ids', ids: [cols[2]?.id] });
  });

  it('[R-8.2-15] Form ganz in Rap und Beso ohne Kürzel → Block genau in der neuen Nebenspalte «Det»', () => {
    const o = importWeeks([
      emptyWeek({ shapes: [block(0, [3, 4], '1000', '1100', [[bold('Fahrdienst fiktiv')]])] }),
    ]);
    const cols = columnsOfMonday(o.result.plan);
    expect(cols.map((c) => [c.name, c.kind])).toEqual([
      ['Kdo', 'planning'],
      ['Alpha', 'planning'],
      ['Bravo', 'planning'],
      ['Det', 'secondary'],
      ['Rap', 'rap'],
      ['Beso', 'beso'],
    ]);
    expect(blocks(o.result.plan)[0]?.columns).toEqual({ kind: 'ids', ids: [cols[3]?.id] });
  });

  it('[R-8.2-01] Titel ohne «Arbeitsplan» → Einheit leer, Bezeichnung = Blattname; Gegenfall mit «Arbeitsplan» → Einheit gesetzt', () => {
    const ohne = importEdited([emptyWeek({ sheet: 'Wo 1', title: 'Wochenplan fiktiv' })], {});
    expect(ohne.result.plan.unit).toBe('');
    expect(ohne.result.plan.weeks[0]?.label).toBe('Wo 1');
    const mit = importEdited([emptyWeek({ sheet: 'Wo 1' })], {});
    expect(mit.result.plan.unit).toBe('Inf Fik Kp 99/9');
  });
});
