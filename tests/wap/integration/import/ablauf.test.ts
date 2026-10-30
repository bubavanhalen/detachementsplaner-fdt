// @vitest-environment jsdom
// I4 (E1-08): Ablauf runImport mit echtem Speicher auf fake-indexeddb (Vertrag E1-08 §1, §3; ADR-006 Punkt 2a;
// ADR-008 3a; Beschrieb 8.2 Regel 9, 10; 5.6 Punkt 2 und 6). Fiktive Arbeitsmappen, fiktive Renderer.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ImportError, runImport } from '../../../../src/io/wap-import/index';
import type { PlanStore } from '../../../../src/io/wap-plan/store';
import { kpTemplate } from '../../../../src/model/wap/template';
import type { Plan } from '../../../../src/model/wap/types';
import {
  besoBox,
  block,
  bold,
  buildKpWorkbook,
  emptyWeek,
  normal,
} from '../../fixtures/import/kp-workbook';
import { neueFabrik, oeffnen } from '../../support/storage/datenbank';
import { TestUhr } from '../../support/storage/uhr';
import { ctx, freshPlan } from '../../unit/import/support';

const uhr = () => new TestUhr('2099-10-01T12:00:00.000Z');
const renderer = {
  week: async (_p: Plan, weekId: string, _title: string) =>
    new TextEncoder().encode(`PDF ${weekId}`),
  plan: async (_p: Plan, _title: string) => new TextEncoder().encode('PDF Plan'),
};
const options = (plan: Plan) => ({
  template: kpTemplate(),
  persons: [],
  functionList: plan.functionList,
});

function mappe(): Uint8Array {
  return buildKpWorkbook([
    emptyWeek({
      shapes: [
        block(0, [0, 2], '0800', '1200', [[bold('Ausbildung')], [normal('Zfhr (Halle)')]]),
        besoBox(0, 4, '0900', 10),
      ],
      agenda: [{ day: 0, paragraphs: [[normal('10 0900: Besuch Werkstatt.')]] }],
    }),
  ]);
}

async function bereit(): Promise<{ store: PlanStore; plan: Plan }> {
  const store = await oeffnen(neueFabrik());
  const plan = freshPlan();
  await store.create(plan, uhr());
  return { store, plan };
}

describe('runImport', () => {
  it('[R-5.6-05][R-5.6-14] Wiederherstellungspunkt vor dem Import; ein Undo-Schritt, Undo und Redo; Bericht folgt', async () => {
    const { store, plan } = await bereit();
    const bytes = mappe();
    const out = await runImport(
      store,
      plan.id,
      bytes,
      'fiktiv.xlsx',
      options(plan),
      renderer,
      uhr(),
      { ctx },
    );
    const points = await store.listRestorePoints(plan.id);
    const point = points.find((p) => p.reason === 'import');
    expect(point).toBeDefined();
    expect(point?.entryCount).toBe(0);
    const loaded = await store.load(plan.id);
    expect(loaded?.history.steps).toHaveLength(1);
    expect(Object.keys(loaded?.plan.entries ?? {}).length).toBeGreaterThan(0);
    expect((await store.importReports(plan.id))[0]?.report).toEqual(out.report);
    const undone = await store.undo(plan.id, uhr());
    expect(Object.keys(undone?.plan.entries ?? {})).toHaveLength(0);
    expect(await store.importReports(plan.id)).toHaveLength(0);
    expect((await store.standRecords(plan.id)).every((r) => !r.visible)).toBe(true);
    const redone = await store.redo(plan.id, uhr());
    expect(Object.keys(redone?.plan.entries ?? {}).length).toBeGreaterThan(0);
    expect(await store.importReports(plan.id)).toHaveLength(1);
  });

  it('[R-8.2-24] erster Stand mit dem Stand-Datum der Datei, Stand-PDF gespeichert', async () => {
    const { store, plan } = await bereit();
    await runImport(store, plan.id, mappe(), 'fiktiv.xlsx', options(plan), renderer, uhr(), {
      ctx,
    });
    const loaded = await store.load(plan.id);
    expect(loaded?.plan.stand).toEqual({ date: '2099-09-17', version: 1 });
    const records = await store.standRecords(plan.id);
    expect(records).toHaveLength(1);
    expect(records[0]?.date).toBe('2099-09-17');
    expect([...(records[0]?.pdfs.keys() ?? [])]).toEqual([loaded?.plan.weeks[0]?.id, 'plan']);
  });

  it('[R-8.2-22] die Eingabe-Bytes bleiben unverändert (SHA-256 vorher = nachher)', async () => {
    const { store, plan } = await bereit();
    const bytes = mappe();
    const before = createHash('sha256').update(bytes).digest('hex');
    await runImport(store, plan.id, bytes, 'fiktiv.xlsx', options(plan), renderer, uhr(), { ctx });
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(before);
  });

  it('[R-5.6-05] Änderung während des Imports geht nicht verloren: Konflikt, kein Import', async () => {
    const { store, plan } = await bereit();
    let changed = false;
    const slow = {
      ...renderer,
      plan: async (p: Plan, title: string) => {
        if (!changed) {
          changed = true;
          const fresh = await store.load(plan.id);
          if (fresh !== null)
            await store.commit(plan.id, { ...renamePlan(fresh.plan), label: 'Name' }, uhr(), {
              expectedRevision: fresh.revision,
            });
        }
        return renderer.plan(p, title);
      },
    };
    await expect(
      runImport(store, plan.id, mappe(), 'fiktiv.xlsx', options(plan), slow, uhr(), { ctx }),
    ).rejects.toMatchObject({ code: 'conflict' });
    const loaded = await store.load(plan.id);
    expect(Object.keys(loaded?.plan.entries ?? {})).toHaveLength(0);
    expect(loaded?.plan.exerciseName).toBe('Geändert');
    expect(await store.importReports(plan.id)).toHaveLength(0);
  });

  it('[R-5.6-05] Abbruch vor dem Schreiben (auch bei hängendem Renderer) → aborted, nichts geschrieben', async () => {
    const { store, plan } = await bereit();
    const controller = new AbortController();
    const hanging = {
      week: () => {
        controller.abort();
        return new Promise<Uint8Array>(() => {});
      },
      plan: renderer.plan,
    };
    const run = runImport(store, plan.id, mappe(), 'fiktiv.xlsx', options(plan), hanging, uhr(), {
      ctx,
      signal: controller.signal,
    });
    await expect(run).rejects.toBeInstanceOf(ImportError);
    await expect(run).rejects.toMatchObject({ code: 'aborted' });
    expect(
      (await store.listRestorePoints(plan.id)).filter((p) => p.reason === 'import'),
    ).toHaveLength(0);
    expect((await store.load(plan.id))?.history.steps).toHaveLength(0);
  });

  it('[R-5.6-05] Lesefehler werden ImportError mit Meldung, nichts geschrieben', async () => {
    const { store, plan } = await bereit();
    await expect(
      runImport(
        store,
        plan.id,
        new Uint8Array([1, 2, 3, 4]),
        'kaputt.xlsx',
        options(plan),
        renderer,
        uhr(),
        { ctx },
      ),
    ).rejects.toMatchObject({ code: 'notXlsx' });
    expect((await store.load(plan.id))?.history.steps).toHaveLength(0);
  });
});

/** Fiktive Änderung des Plans durch «einen anderen Ablauf» während des Imports. */
function renamePlan(p: Plan) {
  const plan: Plan = { ...p, exerciseName: 'Geändert' };
  return {
    plan,
    patches: [{ op: 'replace' as const, path: ['exerciseName'], value: 'Geändert' }],
    inversePatches: [{ op: 'replace' as const, path: ['exerciseName'], value: p.exerciseName }],
    affectedDates: [],
    affectedEntryIds: [],
  };
}
