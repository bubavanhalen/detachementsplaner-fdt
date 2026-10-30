// @vitest-environment jsdom
// I2b-A A3: Sofort angezeigte Änderungen gehen beim Neuladen mitten im Speichern nicht verloren
// (Vorauslaufprotokoll im lokalen Speicher des Browsers). Nur fiktive Daten.
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I2Session } from '../../../../src/components/wap/i2/usePlan';
import { openPlanStore } from '../../../../src/io/wap-plan/store';
import { createPlanFromTemplate } from '../../../../src/model/wap/factories';
import { rootReplaceResult } from '../../../../src/model/wap/history/history';
import { kpTemplate } from '../../../../src/model/wap/template';

function localLocks(): LockManager {
  const active = new Set<string>();
  return {
    request: async (name: string, _options: unknown, run: (lock: unknown) => Promise<unknown>) => {
      if (active.has(name)) return run(null);
      active.add(name);
      try {
        return await run({ name, mode: 'exclusive' });
      } finally {
        active.delete(name);
      }
    },
  } as unknown as LockManager;
}

beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory());
  vi.stubGlobal('navigator', { locks: localLocks() });
  localStorage.clear();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

async function fresh(dbName: string) {
  const session = new I2Session(dbName);
  await session.initialized;
  await session.create('Fiktiver Protokollplan', 'kp', '2026-09-28', 1);
  return session;
}

describe('I2b Vorauslaufprotokoll', () => {
  it('[R-5.6-01][R-5.6-16] zeigt sofort an, protokolliert synchron und räumt nach dem Speichern auf', async () => {
    const session = await fresh('i2b-journal-live');
    const pending = session.command((plan) =>
      rootReplaceResult(plan, { ...plan, motto: 'Sofort' }, 'Sofort'),
    );
    expect(session.state.optimistic?.motto).toBe('Sofort');
    expect(localStorage.getItem('i2b-journal-live:journal')).toContain('Sofort');
    await pending;
    expect(session.state.loaded?.plan.motto).toBe('Sofort');
    expect(localStorage.getItem('i2b-journal-live:journal')).toBeNull();
  });

  it('[R-5.6-01][R-5.6-16] trägt einen angezeigten, aber nicht gespeicherten Befehl nach dem Neuladen nach; Undo bleibt möglich', async () => {
    const store = await openPlanStore({ dbName: 'i2b-journal-replay' });
    const plan = createPlanFromTemplate(kpTemplate(), {
      planId: 'fiktiv-protokoll',
      startDate: '2026-09-28',
      weekCount: 1,
    });
    await store.create(plan, { now: () => new Date('2026-10-13T08:00:00Z') });
    const loaded = await store.load(plan.id);
    store.close();
    if (!loaded) throw new Error('Fiktiver Plan fehlt');
    const result = rootReplaceResult(
      loaded.plan,
      { ...loaded.plan, motto: 'Nachgetragen' },
      'Nachtrag',
    );
    const entry = {
      planId: plan.id,
      baseRevision: loaded.revision,
      label: result.label,
      patches: result.patches,
      inversePatches: result.inversePatches,
      affectedDates: result.affectedDates,
      affectedEntryIds: result.affectedEntryIds,
    };
    const stale = { ...entry, baseRevision: loaded.revision - 1, label: 'Veraltet' };
    localStorage.setItem('i2b-journal-replay:journal', JSON.stringify([stale, entry]));
    const reloaded = new I2Session('i2b-journal-replay');
    await reloaded.initialized;
    expect(reloaded.state.readOnly).toBe(false);
    expect(reloaded.state.loaded?.plan.motto).toBe('Nachgetragen');
    expect(reloaded.state.loaded?.history.steps.map((s) => s.label)).toEqual(['Nachtrag']);
    expect(localStorage.getItem('i2b-journal-replay:journal')).toBeNull();
    await reloaded.history(false);
    expect(reloaded.state.loaded?.plan.motto).toBe('');
    const check = await openPlanStore({ dbName: 'i2b-journal-replay' });
    expect((await check.load(plan.id))?.history.cursor).toBe(0);
    check.close();
  });
});
