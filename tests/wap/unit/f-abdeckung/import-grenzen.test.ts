// @vitest-environment jsdom
// F-ABDECKUNG (FT-A-01): Grenzfälle des Imports an Kopf, Legende, Seitenleiste, Zellen des Terminbereichs und Stufe
// (Beschrieb 8.2 Regeln 1, 5, 6, 7, 12; normalisierung 5.6, 5.7, 7; Vertrag E1-08 §1): Blatt ohne Beilage,
// Tag nur mit Rap und Beso, weisses Legendenfeld, Plan ohne neutrale Kategorie und ohne «Ltg Kp», fehlende
// Kopfzellen der Seitenleiste, verbundene Zellen und Zeilenumbrüche im Terminbereich, Bat-Stufe. Fiktive Mappen.
import { describe, expect, it } from 'vitest';
import type { ImportOutcome } from '../../../../src/io/wap-import/index';
import { kpTemplate } from '../../../../src/model/wap/template';
import type { DayRemark, MultiDayRemark, Plan, Querbalken } from '../../../../src/model/wap/types';
import {
  block,
  bold,
  emptyWeek,
  geometryOf,
  KP_DAY,
  normal,
  rawShape,
  WEEKEND,
  yOf,
} from '../../fixtures/import/kp-workbook';
import { blocks, entries } from '../import/support';
import { colName, importEdited } from './support';

const g = geometryOf(emptyWeek());
const AGENDA_ROW = 87;
const of = <T extends { type: string }>(plan: Plan, type: T['type']) =>
  entries(plan).filter((e) => e.type === type) as unknown as T[];
const kinds = (o: ImportOutcome) => o.report.items.map((i) => i.kind);
const ref = (row: number, col: number) => `${colName(col)}${String(row + 1)}`;

describe('F-ABDECKUNG Import: Kopf ohne Beilage, Tag nur mit Rap und Beso (R-8.2-01, R-8.2-19)', () => {
  it('[R-8.2-01] Titel ohne Beilage-Zeile: Beilage und Dienst leer, Einheit aus dem Titel', () => {
    const o = importEdited([emptyWeek({ beilage: '' })], {});
    expect(o.result.plan).toMatchObject({ beilage: '', service: '', unit: 'Inf Fik Kp 99/9' });
  });

  it('[R-8.2-19] Sonntag nur mit Rap- und Beso-Spalte: Spaltensatz ohne Planungsspalte, Reihenfolge Rap, Beso', () => {
    const days = [KP_DAY, KP_DAY, KP_DAY, KP_DAY, KP_DAY, WEEKEND, { columns: ['Rap', 'Beso'] }];
    const o = importEdited([emptyWeek({ days })], {});
    const so = o.result.plan.weeks[0]?.days[6];
    const set = o.result.plan.columnSets.find((s) => s.id === so?.columnSetId);
    expect(set?.columns.map((c) => [c.name, c.kind])).toEqual([
      ['Rap', 'rap'],
      ['Beso', 'beso'],
    ]);
    // Spaltensatz nur an einem Tag: Name mit diesem Tag.
    expect(set?.name).toBe('Wo1 So');
  });

  it('[R-8.2-12] Weisses Legendenfeld neben der Beschriftung zählt nicht; die Vorlagenfarbe bleibt Kandidat', () => {
    const o = importEdited(
      [
        emptyWeek({
          legend: { Extern: 'FFFFFF' },
          shapes: [block(0, [0, 0], '0800', '0900', [[bold('Grau')]], { fill: 'BFBFBF' })],
        }),
      ],
      {},
    );
    expect(blocks(o.result.plan)[0]?.categoryId).toBe(
      o.result.plan.legend.find((c) => c.name === 'Extern')?.id,
    );
  });
});

describe('F-ABDECKUNG Import: Ziel-Plan ohne neutrale Kategorie bzw. ohne «Ltg Kp» (Regel 5)', () => {
  it('[R-8.2-12] Ohne neutrale Kategorie: Block ohne Füllung erhält die Rückfallkategorie Ltg Kp', () => {
    const o = importEdited(
      [
        emptyWeek({
          shapes: [block(0, [0, 0], '0800', '0900', [[bold('Ohne Füllung')]], { fill: null })],
        }),
      ],
      {},
      { target: (p) => ({ ...p, legend: p.legend.filter((c) => !c.neutral) }) },
    );
    expect(blocks(o.result.plan)[0]?.categoryId).toBe(
      o.result.plan.legend.find((c) => c.name === 'Ltg Kp')?.id,
    );
  });

  it('[R-8.2-14] Ohne «Ltg Kp» und ohne neutrale: Rückfall ist die erste Kategorie der Legende', () => {
    const o = importEdited(
      [
        emptyWeek({
          shapes: [block(0, [0, 0], '0800', '0900', [[bold('Ohne Füllung')]], { fill: null })],
        }),
      ],
      {},
      {
        target: (p) => ({
          ...p,
          legend: p.legend.filter((c) => !c.neutral && c.name !== 'Ltg Kp'),
        }),
      },
    );
    expect(blocks(o.result.plan)[0]?.categoryId).toBe(o.result.plan.legend[0]?.id);
  });
});

describe('F-ABDECKUNG Import: Seitenleiste ohne Kopfzellen (R-8.2-20)', () => {
  it('[R-8.2-20] Ohne Zelle «Legende»: Bemerkungszellen bis zum Ende der Seitenleiste; Box über der Legende ohne Bericht', () => {
    const SIDE = g.sideCol;
    const o = importEdited([emptyWeek({ remarks: ['Box fiktiv'], remarksOverLegend: true })], {
      replace: [['>Legende<', '><']],
      cells: [
        { row: 70, col: SIDE, text: '4' },
        { row: 70, col: SIDE + 1, text: 'Späte Zellbemerkung fiktiv' },
      ],
    });
    const rs = of<MultiDayRemark>(o.result.plan, 'multiDayRemark');
    expect(rs.map((r) => r.text)).toContain('Späte Zellbemerkung fiktiv');
    expect(kinds(o)).not.toContain('overlappingShapes');
  });

  it('[R-8.2-20] Ohne Zellen «Wochenziele» und «Bemerkungen»: Textfeld ohne Überschrift nicht erkannt, aber im Bericht (nichts geht still verloren)', () => {
    const o = importEdited([emptyWeek({ goals: ['Ziel fiktiv'] })], {
      replace: [
        ['>Wochenziele<', '><'],
        ['>Bemerkungen<', '><'],
      ],
    });
    expect(o.result.plan.weeks[0]?.weekGoals).toEqual([]);
    expect(of<MultiDayRemark>(o.result.plan, 'multiDayRemark')).toEqual([]);
    expect(kinds(o)).toEqual(['unassignedShape']);
    for (const s of o.report.sheets) expect(s.shapesRead).toBe(s.assigned + s.unassigned);
  });
});

describe('F-ABDECKUNG Import: Zellen im Terminbereich (Regel 1, CR-H-D-02)', () => {
  it('[R-8.2-04] Verbundene Zelle ab Spalte A: Tag nach der Mitte; Zelle innerhalb der Verbindung wird nicht doppelt gelesen', () => {
    const o = importEdited([emptyWeek()], {
      merges: [`${ref(AGENDA_ROW, 0)}:${ref(AGENDA_ROW, 2)}`],
      cells: [
        { row: AGENDA_ROW, col: 0, text: 'Verbunden fiktiv' },
        { row: AGENDA_ROW, col: 1, text: 'Darunter fiktiv' },
      ],
    });
    expect(of<DayRemark>(o.result.plan, 'dayRemark').map((r) => [r.date, r.text])).toEqual([
      ['2099-10-05', 'Verbunden fiktiv'],
    ]);
  });

  it('[R-8.2-04] Zwei Zellen derselben Zeile am selben Tag: von links nach rechts; Leerzeilen in der Zelle entfallen', () => {
    const mo = g.dayStart[0] ?? 1;
    const o = importEdited([emptyWeek()], {
      cells: [
        { row: AGENDA_ROW, col: mo + 2, text: 'Rechts fiktiv.' },
        { row: AGENDA_ROW, col: mo, text: 'Links fiktiv.\n\nZweite Zeile fiktiv.' },
      ],
    });
    expect(of<DayRemark>(o.result.plan, 'dayRemark').map((r) => r.text)).toEqual([
      'Links fiktiv.',
      'Zweite Zeile fiktiv.',
      'Rechts fiktiv.',
    ]);
  });

  it('[R-8.2-27] Nummerierter Termin ohne Zeit in einer Zelle → ganztägige Bemerkung ohne Form, Bericht', () => {
    const o = importEdited([emptyWeek()], {
      cells: [{ row: AGENDA_ROW, col: g.dayStart[3] ?? 16, text: '45 Material fassen fiktiv.' }],
    });
    const [r] = of<DayRemark>(o.result.plan, 'dayRemark');
    expect(r).toMatchObject({ date: '2099-10-08', text: 'Material fassen fiktiv.' });
    const n = o.report.items.find((i) => i.kind === 'numberedWithoutTime');
    expect(n?.target.shapeIndex).toBeNull();
    expect(n?.besoNumber).toBe(45);
  });
});

describe('F-ABDECKUNG Import: Querbalken links über das Raster und ungültiger Zeitraum (normalisierung 5.2)', () => {
  it('[R-8.2-02] Querbalken beginnt links neben dem Raster: ab dem ersten Tag; ungültiges Enddatum im Titel → Lage gilt', () => {
    const [, x1] = g.colSpan(0, 4);
    const o = importEdited(
      [
        emptyWeek({
          rawShapes: [
            rawShape(g.colX(0) + 400_000, yOf(245), x1 - 3000, yOf(295), {
              paragraphs: [[normal('Wache 01.10.-32.10.')]],
            }),
          ],
        }),
      ],
      {},
    );
    expect(of<Querbalken>(o.result.plan, 'querbalken')[0]).toMatchObject({
      fromDate: '2099-10-05',
      toDate: '2099-10-05',
    });
  });
});

describe('F-ABDECKUNG Import: andere Stufe als Kp (normalisierung 5.7, 7)', () => {
  it('[R-8.2-15] Stufe ohne «Det»: Nebenspalte heisst «Stab 2»; Bemerkungen gelten je Woche, nicht für den Plan', () => {
    const bat = { ...kpTemplate(), id: 'bat' };
    const o = importEdited(
      [
        emptyWeek({
          remarks: ['Woche fiktiv'],
          shapes: [block(0, [4, 4], '1000', '1100', [[bold('In Beso fiktiv')]])],
        }),
      ],
      {},
      { target: (p) => ({ ...p, templateId: 'bat' }), template: bat },
    );
    const m = o.report.items.find((i) => i.kind === 'secondaryColumnCreated');
    expect(m?.message.cause).toBe(
      'Eine Form ohne Nummer liegt am Mo 1000 ganz in der Beso-Spalte; sie wurde ein Block der Nebenspalte «Stab 2».',
    );
    const [r] = of<MultiDayRemark>(o.result.plan, 'multiDayRemark');
    expect(r?.scope).toEqual({ kind: 'week', weekId: o.result.plan.weeks[0]?.id });
  });
});
