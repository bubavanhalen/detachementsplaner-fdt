// @vitest-environment jsdom
// Spalten mitnehmen, relative Lage, Spaltensatz ändern (Vertrag E1-03 Abschnitt 2b; Änderungsnotiz V01, V09f;
// Orchestrator O-1; Beschrieb 4.4, 5.1, 5.2; F-48; Vorschlag V-03-6).
import { describe, expect, it } from 'vitest';
import {
  carryColumnId,
  carryColumnSelection,
  relativeColumns,
  updateColumnSet,
} from '../../../../src/model/wap/commands/columns';
import { createEntry } from '../../../../src/model/wap/commands/entries';
import { dayColumns } from '../../../../src/model/wap/derive/columns';
import type { ColumnSet, Plan } from '../../../../src/model/wap/types';
import {
  besoUm,
  ctx,
  DI,
  eintrag,
  expectCommandError,
  expectKeineWirkung,
  expectProgrammfehler,
  fenster,
  MI,
  MO,
  planMit,
  run,
  satz,
} from '../../support/commands/helpers';
import {
  beso,
  block,
  CAT,
  col,
  days,
  rt,
  setMiFr,
  setMitNebenspalte,
  setStufen,
  setWochenende,
  week,
} from '../../support/model/builders';

const SPH = satz('sSph', 'Woche mit Sph Det 1–3', [
  { id: 'cS1', name: 'SERVIZIO' },
  { id: 'cS2', name: 'COBRA 10' },
  { id: 'cS3', name: 'Sph Det 1' },
  { id: 'cS4', name: 'Sph Det 2' },
  { id: 'cS5', name: 'Sph Det 3' },
]);
const FH = satz('sFH', 'Woche mit FALCON/HAWK', [
  { id: 'cF1', name: 'SERVIZIO' },
  { id: 'cF2', name: 'COBRA 10' },
  { id: 'cF3', name: 'COBRA 20' },
  { id: 'cF4', name: 'FALCON' },
  { id: 'cF5', name: 'HAWK' },
]);
/** Quelle für die relative Lage: eine normale Planungsspalte (z_q = 2, S_q = 2; Änderungsnotiz V01). */
const EINZEL = satz('sQ', 'Einzeln', [{ id: 'cQ1', name: 'Alpha' }]);
/** Ziel V01: schmal, schmal, breit (z = 1, 3, 7; S = 5). */
const SSB = satz('sT', 'Schmal schmal breit', [
  { id: 'cT1', name: 'X', weight: 'narrow' },
  { id: 'cT2', name: 'Y', weight: 'narrow' },
  { id: 'cT3', name: 'Z', weight: 'wide' },
]);
/** Ziel: breit, schmal, schmal (z = 3, 7, 9; S = 5). */
const BSS = satz('sU', 'Breit schmal schmal', [
  { id: 'cU1', name: 'X', weight: 'wide' },
  { id: 'cU2', name: 'Y', weight: 'narrow' },
  { id: 'cU3', name: 'Z', weight: 'narrow' },
]);
/** Quelle: zwei normale Planungsspalten; Rap und Beso dürfen nicht mitzählen. */
const ZWEI = satz('sZ', 'Zwei', [
  { id: 'cZ1', name: 'Eins' },
  { id: 'cZ2', name: 'Zwei' },
]);
/** Ziel: drei normale Planungsspalten. */
const DREI = satz('sD', 'Drei', [
  { id: 'cD1', name: 'A' },
  { id: 'cD2', name: 'B' },
  { id: 'cD3', name: 'C' },
]);
/** Ziel: vier normale Planungsspalten. */
const VIER = satz('sV', 'Vier', [
  { id: 'cV1', name: 'A' },
  { id: 'cV2', name: 'B' },
  { id: 'cV3', name: 'C' },
  { id: 'cV4', name: 'D' },
]);
/** Quelle: normale Planungsspalte und breite Nebenspalte (Nebenspalte zählt 1). */
const MIT_NEBEN = satz('sN', 'Mit Nebenspalte', [
  { id: 'cN1', name: 'Zug' },
  { id: 'cN2', name: 'Det', kind: 'secondary', weight: 'wide' },
]);
/** Ziel mit Nebenspalte gleichen Namens «Det». */
const ZIEL_DET = satz('sM', 'Ziel mit Det', [
  { id: 'cM1', name: 'Kp' },
  { id: 'cM2', name: 'Det', kind: 'secondary', weight: 'narrow' },
]);

function plan(sets: readonly ColumnSet[] = []): Plan {
  return planMit([], {
    columnSets: [setStufen(), setMiFr(), setWochenende(), setMitNebenspalte(), SPH, FH, ...sets],
  });
}

function ids(cols: readonly { readonly id: string }[]): string[] {
  return cols.map((c) => c.id);
}

describe('carryColumnSelection und carryColumnId', () => {
  it('[R-5.1-19] «alle Spalten» bleibt «alle Spalten»', () => {
    expect(carryColumnSelection(plan(), { kind: 'all' }, setWochenende().columns)).toEqual({
      kind: 'all',
    });
  });

  it('[R-5.1-17] gleicher Name im Zielsatz → dessen ID; Ergebnis in Anzeigereihenfolge des Ziels', () => {
    expect(carryColumnSelection(plan(), { kind: 'ids', ids: ['cS2'] }, FH.columns)).toEqual({
      kind: 'ids',
      ids: ['cF2'],
    });
    expect(carryColumnSelection(plan(), { kind: 'ids', ids: ['cS2', 'cS1'] }, FH.columns)).toEqual({
      kind: 'ids',
      ids: ['cF1', 'cF2'],
    });
  });

  it('[R-5.1-17] ID im Zielsatz vorhanden → bleibt', () => {
    expect(
      carryColumnSelection(plan(), { kind: 'ids', ids: ['c9', 'c8'] }, setStufen().columns),
    ).toEqual({
      kind: 'ids',
      ids: ['c8', 'c9'],
    });
  });

  it('[R-5.1-17] Nebenspalte gleichen Namens wird ebenfalls gefunden', () => {
    const p = plan([MIT_NEBEN, ZIEL_DET]);
    expect(carryColumnSelection(p, { kind: 'ids', ids: ['cN2'] }, ZIEL_DET.columns)).toEqual({
      kind: 'ids',
      ids: ['cM2'],
    });
  });

  it('[R-5.1-18] ohne gleichnamige Spalte bleibt die ID (fehlt im Satz, Grundlage P1); vorhandene zuerst, fehlende in Eingabereihenfolge', () => {
    expect(carryColumnSelection(plan(), { kind: 'ids', ids: ['cS4'] }, FH.columns)).toEqual({
      kind: 'ids',
      ids: ['cS4'],
    });
    expect(
      carryColumnSelection(plan(), { kind: 'ids', ids: ['cS5', 'cS4', 'cS2'] }, FH.columns),
    ).toEqual({ kind: 'ids', ids: ['cF2', 'cS5', 'cS4'] });
  });

  it('[R-5.1-17] (Orchestrator a) Eingabereihenfolge: über den Namen zugeordnetes Ziel wird nicht ein zweites Mal aufgenommen', () => {
    // cS2 (COBRA 10) zuerst → cF2; danach cF2 direkt: schon gewählt → nur einmal
    expect(carryColumnSelection(plan(), { kind: 'ids', ids: ['cS2', 'cF2'] }, FH.columns)).toEqual({
      kind: 'ids',
      ids: ['cF2'],
    });
  });

  it('[R-5.1-18] (Orchestrator a) direkt übernommenes Ziel zuerst: gleichnamige Quelle findet kein freies Ziel und bleibt als fehlende ID', () => {
    expect(carryColumnSelection(plan(), { kind: 'ids', ids: ['cF2', 'cS2'] }, FH.columns)).toEqual({
      kind: 'ids',
      ids: ['cF2', 'cS2'],
    });
    expect(carryColumnSelection(plan(), { kind: 'ids', ids: ['cF2', 'cF2'] }, FH.columns)).toEqual({
      kind: 'ids',
      ids: ['cF2'],
    });
  });

  it('[R-5.1-17] carryColumnId: null bleibt null, gleicher Name → Ziel-ID, vorhanden bleibt, sonst ID bleibt', () => {
    const p = plan();
    expect(carryColumnId(p, null, FH.columns)).toBeNull();
    expect(carryColumnId(p, 'cS2', FH.columns)).toBe('cF2');
    expect(carryColumnId(p, 'cF3', FH.columns)).toBe('cF3');
    expect(carryColumnId(p, 'cS4', FH.columns)).toBe('cS4');
  });
});

describe('relativeColumns (F-48, V-03-6, Änderungsnotiz V01, O-1)', () => {
  it('[R-5.1-18] (V01) Gleichstand wird exakt erkannt und geht an die linke Spalte: [schmal, schmal, breit] → zweite', () => {
    // d = |2·5 − z·2| = 8, 4, 4 → Gleichstand zwischen 2. und 3. → die linke (2.); Fliesskomma wählte die 3.
    expect(
      ids(relativeColumns(plan([EINZEL, SSB]), { kind: 'ids', ids: ['cQ1'] }, SSB.columns)),
    ).toEqual(['cT2']);
  });

  it('[R-5.1-18] (V01) Gleichstand: [breit, schmal, schmal] → erste (breite) Spalte', () => {
    // d = |2·5 − z·2| = 4, 4, 8 → Gleichstand zwischen 1. und 2. → die linke
    expect(
      ids(relativeColumns(plan([EINZEL, BSS]), { kind: 'ids', ids: ['cQ1'] }, BSS.columns)),
    ).toEqual(['cU1']);
  });

  it('[R-5.1-18] (V-03-6) Rap- und Beso-Spalte zählen nicht zur Breite', () => {
    // Quelle 2. von 2 normalen: z = 6, S = 4; Ziel 3 normale: d = 28, 12, 4 → 3. Spalte
    expect(
      ids(relativeColumns(plan([ZWEI, DREI]), { kind: 'ids', ids: ['cZ2'] }, DREI.columns)),
    ).toEqual(['cD3']);
  });

  it('[R-5.1-18] Nebenspalte zählt 1, unabhängig von ihrem Gewicht', () => {
    // Quelle Nebenspalte: z = 5, S = 3; Ziel 4 normale: d = 34, 22, 10, 2 → 4. Spalte (mit Gewicht 3 wäre es die 3.)
    expect(
      ids(relativeColumns(plan([MIT_NEBEN, VIER]), { kind: 'ids', ids: ['cN2'] }, VIER.columns)),
    ).toEqual(['cV4']);
  });

  it('[R-5.1-18] Wo 2 Mo (Sph Det 1–3) → Mi (FALCON/HAWK): Sph Det 2 liegt an der Stelle von FALCON', () => {
    expect(ids(relativeColumns(plan(), { kind: 'ids', ids: ['cS4'] }, FH.columns))).toEqual([
      'cF4',
    ]);
  });

  it('[R-5.1-18] vorhandene IDs bleiben; fehlende nehmen die nächste noch nicht gewählte Spalte; Anzeigereihenfolge', () => {
    // cT2 vorhanden und gewählt; cQ1 (Gleichstand 2./3.) → 2. ist gewählt → 3.
    expect(
      ids(relativeColumns(plan([EINZEL, SSB]), { kind: 'ids', ids: ['cT2', 'cQ1'] }, SSB.columns)),
    ).toEqual(['cT2', 'cT3']);
    expect(ids(relativeColumns(plan(), { kind: 'ids', ids: ['cF2', 'cF1'] }, FH.columns))).toEqual([
      'cF1',
      'cF2',
    ]);
  });

  it('[R-5.1-18] gleiche Spaltenzahl, soweit vorhanden: sind alle gewählt, entfällt die übrige', () => {
    expect(
      ids(relativeColumns(plan(), { kind: 'ids', ids: ['c8', 'c9'] }, setWochenende().columns)),
    ).toEqual(['c23']);
  });

  it('[R-5.1-18] (O-1) ID ohne Spaltensatz (aus dem Satz entfernt) entfällt', () => {
    expect(
      ids(relativeColumns(plan(), { kind: 'ids', ids: ['c999'] }, setWochenende().columns)),
    ).toEqual([]);
    expect(
      ids(relativeColumns(plan(), { kind: 'ids', ids: ['c23', 'c999'] }, setWochenende().columns)),
    ).toEqual(['c23']);
  });

  it('[R-5.1-19] «alle Spalten» → alle Planungsspalten des Ziels, ohne Nebenspalte', () => {
    expect(ids(relativeColumns(plan(), { kind: 'all' }, setMitNebenspalte().columns))).toEqual([
      'c40',
      'c41',
    ]);
  });
});

describe('updateColumnSet', () => {
  it('[R-5.2-08] Spalte eingefügt → bestehende Einträge in denselben Spalten; IDs stabil; neue ID aus nextId', () => {
    const p = planMit([
      block('e1', 1, { date: MO, columns: { kind: 'ids', ids: ['c10'] } }),
      beso('e2', 2, {
        date: DI,
        besoNumber: 20,
        windows: [fenster('t2', { form: 'point', at: 600 }, { columnId: 'c11' })],
      }),
    ]);
    const r = run(p, (q) =>
      updateColumnSet(
        q,
        's7',
        { op: 'add', index: 2, column: { name: ' Det 2 ', kind: 'planning' } },
        ctx,
      ),
    );
    const s7 = r.plan.columnSets.find((s) => s.id === 's7') as ColumnSet;
    expect(ids(s7.columns)).toEqual(['c8', 'c9', 'c100', 'c10', 'c11', 'c12', 'c13', 'c14', 'c15']);
    expect(s7.columns[2]).toEqual({
      id: 'c100',
      name: 'Det 2',
      kind: 'planning',
      weight: 'normal',
      labelOrientation: 'horizontal',
      defaultCategoryId: null,
      origin: 'manual',
    });
    expect(r.plan.entries).toEqual(p.entries);
    expect(r.plan.nextId).toBe(101);
    expect(r.label).toBe('Spaltensatz «KVK Stufen» geändert');
    expect(r.affectedEntryIds).toEqual([]);
    // s7 gilt Mo und Di in drei Wochen
    expect(r.affectedDates).toEqual([
      MO,
      DI,
      '2026-10-05',
      '2026-10-06',
      '2026-10-12',
      '2026-10-13',
    ]);
  });

  it('[R-5.2-08] Nebenspalte mit Gewicht und Beschriftung hinzufügen', () => {
    const p = planMit([]);
    const r = run(p, (q) =>
      updateColumnSet(
        q,
        's16',
        {
          op: 'add',
          index: 3,
          column: {
            name: 'Det',
            kind: 'secondary',
            weight: 'narrow',
            labelOrientation: 'vertical',
            defaultCategoryId: CAT.extern,
          },
        },
        ctx,
      ),
    );
    const s16 = r.plan.columnSets.find((s) => s.id === 's16') as ColumnSet;
    expect(s16.columns[3]).toMatchObject({
      id: 'c100',
      name: 'Det',
      kind: 'secondary',
      weight: 'narrow',
      labelOrientation: 'vertical',
      defaultCategoryId: CAT.extern,
    });
  });

  it('[R-5.2-08] Fehler beim Hinzufügen: leerer Name, unbekannte Kategorie, ungültiger Satz, Index ausserhalb', () => {
    const p = planMit([]);
    expectCommandError(
      p,
      (q) =>
        updateColumnSet(
          q,
          's7',
          { op: 'add', index: 1, column: { name: '   ', kind: 'planning' } },
          ctx,
        ),
      {
        code: 'invalidColumnSet',
        field: 'name',
      },
    );
    expectCommandError(
      p,
      (q) =>
        updateColumnSet(
          q,
          's7',
          {
            op: 'add',
            index: 1,
            column: { name: 'Neu', kind: 'planning', defaultCategoryId: 'k99' },
          },
          ctx,
        ),
      { code: 'invalidColumnSet', field: 'defaultCategoryId' },
    );
    // Planungsspalte nach der Beso-Spalte verletzt die Reihenfolge (Befund columnOrder bei columns[8])
    expectCommandError(
      p,
      (q) =>
        updateColumnSet(
          q,
          's7',
          { op: 'add', index: 8, column: { name: 'Neu', kind: 'planning' } },
          ctx,
        ),
      {
        code: 'invalidColumnSet',
        field: 'columns[8]',
      },
    );
    for (const index of [9, -1, 1.5]) {
      expectProgrammfehler(
        p,
        (q) =>
          updateColumnSet(
            q,
            's7',
            { op: 'add', index, column: { name: 'Neu', kind: 'planning' } },
            ctx,
          ),
        RangeError,
      );
    }
  });

  it('[R-4.4-03] Standard-Kategorie einer Spalte setzen: Zfhr-Spalte → Ltg Zfhr; ein neuer Block dort erhält sie', () => {
    const p = planMit([]);
    const r = run(p, (q) =>
      updateColumnSet(
        q,
        's7',
        { op: 'update', columnId: 'c10', changes: { defaultCategoryId: CAT.zfhr } },
        ctx,
      ),
    );
    const s7 = r.plan.columnSets.find((s) => s.id === 's7') as ColumnSet;
    expect(s7.columns.find((c) => c.id === 'c10')).toEqual(
      col('c10', 'Zfhr', 'planning', { defaultCategoryId: CAT.zfhr }),
    );
    const b = run(r.plan, (q) =>
      createEntry(
        q,
        {
          type: 'block',
          date: MO,
          time: { form: 'point', at: 600 },
          columns: { kind: 'ids', ids: ['c10'] },
          title: rt('Zfhr Rap'),
        },
        ctx,
      ),
    );
    expect(eintrag(b.plan, b.entryId)).toMatchObject({ categoryId: CAT.zfhr });
  });

  it('[R-4.4-03] (V09f) Standard-Kategorie nicht in der Legende oder Name leer → invalidColumnSet; null ist erlaubt', () => {
    const p = planMit([], {
      columnSets: [
        {
          ...setStufen(),
          columns: setStufen().columns.map((c) =>
            c.id === 'c10' ? { ...c, defaultCategoryId: CAT.zfhr } : c,
          ),
        },
        setMiFr(),
        setWochenende(),
      ],
    });
    expectCommandError(
      p,
      (q) =>
        updateColumnSet(
          q,
          's7',
          { op: 'update', columnId: 'c10', changes: { defaultCategoryId: 'k99' } },
          ctx,
        ),
      { code: 'invalidColumnSet', field: 'defaultCategoryId' },
    );
    expectCommandError(
      p,
      (q) =>
        updateColumnSet(q, 's7', { op: 'update', columnId: 'c10', changes: { name: ' ' } }, ctx),
      {
        code: 'invalidColumnSet',
        field: 'name',
      },
    );
    const r = run(p, (q) =>
      updateColumnSet(
        q,
        's7',
        { op: 'update', columnId: 'c10', changes: { defaultCategoryId: null } },
        ctx,
      ),
    );
    expect(r.plan.columnSets[0]?.columns[2]?.defaultCategoryId).toBeNull();
  });

  it('[R-5.2-08] Spalte umbenennen: ID bleibt, Einträge bleiben; gleicher Name → ohne Wirkung', () => {
    const p = planMit([block('e1', 1, { date: MO, columns: { kind: 'ids', ids: ['c10'] } })]);
    const r = run(p, (q) =>
      updateColumnSet(
        q,
        's7',
        { op: 'update', columnId: 'c10', changes: { name: ' Zugführer ', weight: 'wide' } },
        ctx,
      ),
    );
    const c10 = r.plan.columnSets[0]?.columns.find((c) => c.id === 'c10');
    expect(c10).toMatchObject({ name: 'Zugführer', weight: 'wide' });
    expect(r.plan.entries).toEqual(p.entries);
    expect(r.label).toBe('Spaltensatz «KVK Stufen» geändert');
    expectKeineWirkung(
      p,
      updateColumnSet(p, 's7', { op: 'update', columnId: 'c10', changes: { name: 'Zfhr' } }, ctx),
    );
  });

  it('[R-5.2-09] Spalte HAWK entfernt → Einträge vorhanden und unverändert, ihre Spalten-ID fehlt im Satz (Grundlage P1)', () => {
    const p = planMit(
      [
        block('e1', 1, { date: DI, columns: { kind: 'ids', ids: ['cF5'] } }),
        beso('e2', 2, {
          date: DI,
          besoNumber: 20,
          windows: [fenster('t2', { form: 'point', at: 600 }, { columnId: 'cF5' })],
        }),
      ],
      {
        columnSets: [setStufen(), setMiFr(), setWochenende(), FH],
        weeks: [
          week('w26', MO, { days: days(['s7', 'sFH', 's16', 's16', 's16', 's22', 's22']) }),
          week('w27', '2026-10-05'),
        ],
      },
    );
    const r = run(p, (q) => updateColumnSet(q, 'sFH', { op: 'remove', columnId: 'cF5' }, ctx));
    expect(r.plan.entries).toEqual(p.entries);
    expect(Object.keys(r.plan.entries)).toHaveLength(2);
    expect(ids(dayColumns(r.plan, 'w26', 'Di'))).not.toContain('cF5');
    expect(
      ids(relativeColumns(r.plan, { kind: 'ids', ids: ['cF5'] }, dayColumns(r.plan, 'w26', 'Di'))),
    ).toEqual([]);
    expect(r.affectedDates).toEqual([DI]);
  });

  it('[R-5.2-09] Rap-Spalte entfernen ergibt einen ungültigen Satz → invalidColumnSet (Befundfeld)', () => {
    expectCommandError(
      planMit([]),
      (q) => updateColumnSet(q, 's7', { op: 'remove', columnId: 'c14' }, ctx),
      {
        code: 'invalidColumnSet',
        field: 'columns',
      },
    );
  });

  it('[R-5.2-08] Fehler: unbekannter Satz → unknownColumnSet; unbekannte Spalte → unknownColumn (columnId)', () => {
    const p = planMit([besoUm('e1', 1, MI, 480, 30)]);
    expectCommandError(
      p,
      (q) => updateColumnSet(q, 's99', { op: 'remove', columnId: 'c10' }, ctx),
      {
        code: 'unknownColumnSet',
      },
    );
    expectCommandError(p, (q) => updateColumnSet(q, 's7', { op: 'remove', columnId: 'c99' }, ctx), {
      code: 'unknownColumn',
      field: 'columnId',
    });
    expectCommandError(
      p,
      (q) =>
        updateColumnSet(q, 's7', { op: 'update', columnId: 'c17', changes: { name: 'X' } }, ctx),
      {
        code: 'unknownColumn',
        field: 'columnId',
      },
    );
  });
});
