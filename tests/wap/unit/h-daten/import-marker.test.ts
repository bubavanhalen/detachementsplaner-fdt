// @vitest-environment jsdom
// H-DATEN (Härtung vor Gate B): Marker-Zeile in einem Block, der ganz in der Rap- oder Beso-Spalte liegt
// (CR-H-D-06). Beschrieb 8.2 Regel 6 und 8; R-8.2-15, R-8.2-20. Fiktive Arbeitsmappen.
import { describe, expect, it } from 'vitest';
import { parsePlanFile, serializePlanFile } from '../../../../src/io/wap-plan/planFile';
import { dayColumns } from '../../../../src/model/wap/derive/columns';
import type { Marker } from '../../../../src/model/wap/types';
import { block, bold, emptyWeek, normal } from '../../fixtures/import/kp-workbook';
import { blocks, entries, importWeeks, kinds } from '../import/support';

describe('CR-H-D-06: Marker im Block der Nebenspalte', () => {
  // Entscheid Auftraggeber 21.10.2026: Marker gelten immer über alle Planungsspalten; der Block bleibt in seiner
  // Nebenspalte, der Marker aus seiner Zeile gilt über alle Spalten.
  it('[R-8.2-15] Block ganz in der Beso-Spalte mit «ABV 2100»: Block in der Nebenspalte, Marker über alle Spalten', () => {
    const o = importWeeks([
      emptyWeek({
        shapes: [block(0, [4, 4], '1900', '2130', [[bold('Fiktive Wache')], [normal('ABV 2100')]])],
      }),
    ]);
    const plan = o.result.plan;
    const markers = entries(plan).filter((e): e is Marker => e.type === 'marker');
    const [b] = blocks(plan);
    expect(kinds(o)).toContain('secondaryColumnCreated');
    expect(markers).toHaveLength(1);
    const week = plan.weeks[0];
    const secondary = (week === undefined ? [] : dayColumns(plan, week.id, 'Mo')).find(
      (c) => c.kind === 'secondary',
    );
    expect(b?.columns).toEqual({ kind: 'ids', ids: [secondary?.id] });
    expect(markers[0]?.columns).toEqual({ kind: 'all' });
  });

  it('[R-8.2-15] Marker aus Blöcken in Planungs- und Nebenspalte am selben Tag: beide über alle Spalten', () => {
    const o = importWeeks([
      emptyWeek({
        shapes: [
          block(0, [4, 4], '1900', '2130', [[bold('Fiktive Wache')], [normal('ABV 2100')]]),
          block(0, [1, 1], '0600', '0800', [[bold('Fiktiver Dienst')], [normal('HV 0700')]]),
        ],
      }),
    ]);
    const plan = o.result.plan;
    const ms = entries(plan).filter((e): e is Marker => e.type === 'marker');
    const bs = blocks(plan);
    expect(ms).toHaveLength(2);
    for (const m of ms) {
      const b = bs.find((x) => x.time.form === 'range' && x.time.from <= m.at && m.at <= x.time.to);
      expect(b).toBeDefined();
      expect(m.columns).toEqual({ kind: 'all' });
    }
  });
});

// Befund visual-qa Härtung 1 (c): Linie mit Beschriftung → Marker als Linie; Kästchen mit Marker-Text und eigener
// Höhe (z.B. «ABV 2330», 30 Min über zwei Spalten) → Marker als flacher Block mit dieser Dauer (Beschrieb 4.6,
// R-4.6-15). Eine kleine Beschriftung ohne Linienform bleibt Beschriftung einer Linie.
describe('Marker: Linie oder flacher Block', () => {
  const markersOf = (shapes: Parameters<typeof emptyWeek>[0]) =>
    entries(importWeeks([emptyWeek(shapes)]).result.plan).filter(
      (e): e is Marker => e.type === 'marker',
    );

  it('[R-4.6-15] Beschriftung «AV» mit Linienform → Marker als Linie', () => {
    const [m] = markersOf({
      shapes: [
        block(0, [0, 2], '0700', '0700', [], { line: true }),
        block(0, [0, 0], '0700', '0715', [[bold('AV')]]),
      ],
    });
    expect(m?.asFlatBlock).toBe(false);
    expect(m?.flatBlockMinutes).toBeUndefined();
  });

  it('[R-4.6-15] Kästchen «ABV 2330» über zwei Spalten, 30 Min hoch, ohne Linie → flacher Block mit 30 Min', () => {
    const [m] = markersOf({ shapes: [block(1, [0, 1], '2330', '2400', [[bold('ABV 2330')]])] });
    expect(m?.at).toBe(1410);
    expect(m?.asFlatBlock).toBe(true);
    expect(m?.flatBlockMinutes).toBe(30);
  });

  it('[R-4.6-15] kleine Beschriftung «ABV 2200» (15 Min) ohne Linienform → Marker als Linie', () => {
    const [m] = markersOf({
      shapes: [block(2, [0, 1], '2200', '2215', [[bold('ABV 2200')]])],
    });
    expect(m?.asFlatBlock).toBe(false);
    expect(m?.columns).toEqual({ kind: 'all' });
  });

  it('[R-4.6-15] eine Linie über zwei Tage trägt die Marker beider Tage', () => {
    const ms = markersOf({
      shapes: [
        { day: 0, cols: [0, 9], from: 420, to: 420, line: true },
        block(0, [0, 0], '0700', '0715', [[bold('AV')]]),
        block(1, [0, 0], '0700', '0715', [[bold('AV')]]),
      ],
    });
    expect(ms).toHaveLength(2);
    expect(ms.every((m) => !m.asFlatBlock)).toBe(true);
  });

  it('[R-4.6-15] Dauer des flachen Blocks bleibt beim Sichern und Öffnen der Plan-Datei erhalten', () => {
    const plan = importWeeks([
      emptyWeek({ shapes: [block(1, [0, 1], '2330', '2400', [[bold('ABV 2330')]])] }),
    ]).result.plan;
    const bytes = serializePlanFile(
      { plan, revision: 1, modifiedAt: '2099-10-14T08:00:00.000Z', stands: [] },
      { now: () => new Date('2099-10-14T08:00:00Z') },
    );
    const [m] = entries(parsePlanFile(bytes).plan).filter((e): e is Marker => e.type === 'marker');
    expect(m?.flatBlockMinutes).toBe(30);
  });
});
