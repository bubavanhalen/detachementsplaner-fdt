// @vitest-environment jsdom
// Spalten eines Tages (Vertrag E1-02a Abschnitt 3 derive/columns.ts, 8 P-7, P-11; Beschrieb 4.3, 4.4).
import { describe, expect, it } from 'vitest';
import { dayColumns, resolveColumns } from '../../../../src/model/wap/derive/columns';
import type { Plan } from '../../../../src/model/wap/types';
import {
  basePlan,
  days,
  expectModelError,
  setMitNebenspalte,
  setStufen,
  week,
} from '../../support/model/builders';

describe('dayColumns', () => {
  it('[R-4.3-01] Mo und Mi derselben Woche mit verschiedenen Spaltensätzen', () => {
    const plan = basePlan();
    expect(dayColumns(plan, 'w26', 'Mo').map((c) => c.name)).toEqual([
      'Kp Kdt',
      'Stv',
      'Zfhr',
      'Uof',
      'höh Uof',
      'Trp',
      'Rap',
      'Beso',
    ]);
    expect(dayColumns(plan, 'w26', 'Mi').map((c) => c.name)).toEqual([
      'Kdo',
      'Mö',
      'Sph',
      'Rap',
      'Beso',
    ]);
    expect(dayColumns(plan, 'w26', 'So').map((c) => c.name)).toEqual(['Kp', 'Rap', 'Beso']);
  });

  it('[R-4.4-09] ein Spaltensatz an drei Tagen: Umbenennen einer Spalte im Satz wirkt an allen drei Tagen', () => {
    const plan = basePlan();
    const renamed: Plan = {
      ...plan,
      columnSets: plan.columnSets.map((s) =>
        s.id === 's16'
          ? { ...s, columns: s.columns.map((c) => (c.id === 'c18' ? { ...c, name: 'Mö Zug' } : c)) }
          : s,
      ),
    };
    for (const d of ['Mi', 'Do', 'Fr'] as const) {
      expect(dayColumns(renamed, 'w26', d).map((c) => c.name)).toEqual([
        'Kdo',
        'Mö Zug',
        'Sph',
        'Rap',
        'Beso',
      ]);
    }
    expect(dayColumns(renamed, 'w26', 'Mo').map((c) => c.name)).not.toContain('Mö Zug');
  });

  it('[R-4.3-01] Tag ohne Spaltensatz oder mit unbekanntem Spaltensatz → keine Spalten (Befund, keine Ausnahme)', () => {
    const plan = basePlan({
      weeks: [
        week('w26', '2026-09-28', { days: days([null, 's999', 's7', 's7', 's7', 's7', 's7']) }),
      ],
    });
    expect(dayColumns(plan, 'w26', 'Mo')).toEqual([]);
    expect(dayColumns(plan, 'w26', 'Di')).toEqual([]);
    expect(dayColumns(plan, 'w26', 'Mi')).toHaveLength(8);
  });

  it('[R-4.3-01] unbekannte Woche → unknownWeek', () => {
    expectModelError(() => dayColumns(basePlan(), 'w99', 'Mo'), { code: 'unknownWeek' });
  });

  it('[R-4.4-01] Name und Gewicht der Spalte kommen aus dem Spaltensatz', () => {
    const plan = basePlan({
      weeks: [
        week('w26', '2026-09-28', {
          days: days(['s39', 's39', 's39', 's39', 's39', 's39', 's39']),
        }),
      ],
    });
    expect(dayColumns(plan, 'w26', 'Di').map((c) => [c.name, c.weight, c.kind])).toEqual([
      ['Zug 1', 'normal', 'planning'],
      ['Zug 2', 'normal', 'planning'],
      ['Det', 'narrow', 'secondary'],
      ['Rap', 'normal', 'rap'],
      ['Beso', 'normal', 'beso'],
    ]);
  });
});

describe('resolveColumns', () => {
  const stufen = setStufen().columns;
  const mitDet = setMitNebenspalte().columns;

  it('[R-4.4-05] «alle» umfasst alle Planungsspalten, ohne Nebenspalte, Rap- und Beso-Spalte', () => {
    expect(resolveColumns({ kind: 'all' }, mitDet).map((c) => c.id)).toEqual(['c40', 'c41']);
    expect(resolveColumns({ kind: 'all' }, stufen).map((c) => c.id)).toEqual([
      'c8',
      'c9',
      'c10',
      'c11',
      'c12',
      'c13',
    ]);
  });

  it('[R-4.4-05] Nebenspalte ist über ihre ID auswählbar', () => {
    expect(resolveColumns({ kind: 'ids', ids: ['c42'] }, mitDet).map((c) => c.name)).toEqual([
      'Det',
    ]);
  });

  it('[R-4.6-01] genannte Spalten in Anzeigereihenfolge; unbekannte IDs entfallen', () => {
    expect(
      resolveColumns({ kind: 'ids', ids: ['c12', 'c8', 'c77'] }, stufen).map((c) => c.id),
    ).toEqual(['c8', 'c12']);
    expect(resolveColumns({ kind: 'ids', ids: ['c77'] }, stufen)).toEqual([]);
  });

  it('[R-4.6-01] verknüpfte Teilblöcke: nicht benachbarte Spalten bleiben ein Eintrag mit beiden Spalten', () => {
    expect(resolveColumns({ kind: 'ids', ids: ['c8', 'c13'] }, stufen).map((c) => c.name)).toEqual([
      'Kp Kdt',
      'Trp',
    ]);
  });
});
