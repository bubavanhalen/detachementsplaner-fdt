// @vitest-environment jsdom
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I2Session } from '../../../../src/components/wap/i2/usePlan';
import { openPlanStore } from '../../../../src/io/wap-plan/store';
import { createPlanFromTemplate } from '../../../../src/model/wap/factories';
import { rootReplaceResult } from '../../../../src/model/wap/history/history';
import { kpTemplate } from '../../../../src/model/wap/template';

function localLocks(): LockManager {
  const activeLocks = new Set<string>();
  return {
    request: async (name: string, _options: unknown, run: (lock: unknown) => Promise<unknown>) => {
      if (activeLocks.has(name)) return run(null);
      activeLocks.add(name);
      try {
        return await run({ name, mode: 'exclusive' });
      } finally {
        activeLocks.delete(name);
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
  await session.create('Fiktiver Übungsplan', 'kp', '2026-09-28', 2);
  return session;
}

function current(session: I2Session) {
  const loaded = session.state.loaded;
  if (!loaded) throw new Error('Fiktiver Testplan fehlt');
  return loaded;
}

describe('I2 Sitzung: öffentliche Speicherports', () => {
  it('[R-5.6-04][R-5.6-14] öffnet frisch die realistische Demo, nach Neuladen aber den gewählten eigenen Plan oder Belastungstest', async () => {
    const demos = ['realistisch', 'belastung'].map((planId) =>
      createPlanFromTemplate(kpTemplate(), {
        planId,
        startDate: '2026-09-28',
        weekCount: 1,
      }),
    );
    const first = new I2Session('i2-unit-demo-reload', demos);
    await first.initialized;
    expect(current(first).plan.id).toBe('realistisch');
    await first.create('Eigener fiktiver Plan', 'kp', '2026-09-28', 1);
    const ownId = current(first).plan.id;
    await first.command((plan) =>
      rootReplaceResult(plan, { ...plan, motto: 'Eigener Stand' }, 'Eigene Änderung'),
    );
    const ownReload = new I2Session('i2-unit-demo-reload', demos);
    await ownReload.initialized;
    expect(current(ownReload).plan.id).toBe(ownId);
    expect(current(ownReload).plan.motto).toBe('Eigener Stand');
    expect(current(ownReload).history.cursor).toBe(1);
    await first.select('belastung');
    const stressReload = new I2Session('i2-unit-demo-reload', demos);
    await stressReload.initialized;
    expect(current(stressReload).plan.id).toBe('belastung');
  });

  it('[R-5.6-04][R-5.6-14] führt gleichzeitige Befehle FIFO mit aktueller Revision aus und speichert die Historie', async () => {
    const session = await fresh('i2-unit-fifo');
    await Promise.all([
      session.command((plan) => rootReplaceResult(plan, { ...plan, motto: `${plan.motto}A` }, 'A')),
      session.command((plan) => rootReplaceResult(plan, { ...plan, motto: `${plan.motto}B` }, 'B')),
    ]);
    const store = await openPlanStore({ dbName: 'i2-unit-fifo' });
    const loaded = await store.load(current(session).plan.id);
    expect(loaded?.plan.motto).toBe('AB');
    expect(loaded?.revision).toBe(2);
    expect(loaded?.history.steps.map((step) => step.label)).toEqual(['A', 'B']);
    expect(session.state.loaded?.history).toEqual(loaded?.history);
    expect(
      loaded?.plan.weeks.every((week) => week.days.every((day) => day.columnSetId !== null)),
    ).toBe(true);
    await session.history(false);
    expect(session.state.loaded?.plan.motto).toBe('A');
    await session.history(true);
    expect(session.state.loaded?.plan.motto).toBe('AB');
    store.close();
  });

  it('[R-5.6-04][R-5.7-03] lässt einen zweiten Tab nur lesen, ohne seine Befehle zu speichern', async () => {
    const first = await fresh('i2-unit-lease');
    const second = new I2Session('i2-unit-lease');
    await second.initialized;
    expect(first.state.readOnly).toBe(false);
    expect(second.state.readOnly).toBe(true);
    await expect(
      second.command((plan) =>
        rootReplaceResult(plan, { ...plan, motto: 'verboten' }, 'Nicht schreiben'),
      ),
    ).rejects.toMatchObject({ code: 'readOnly' });
    expect(second.state.loaded?.plan.motto).toBe('');
    expect(first.state.loaded?.revision).toBe(0);
  });

  it('[R-5.6-04][R-5.7-03] behält eine abgelehnte Änderung als ungespeicherten Stand und verhindert nachfolgende Mutationen', async () => {
    const session = await fresh('i2-unit-conflict');
    const before = current(session);
    const other = await openPlanStore({ dbName: 'i2-unit-conflict' });
    await other.commit(
      before.plan.id,
      rootReplaceResult(before.plan, { ...before.plan, motto: 'Anderer Stand' }, 'Extern'),
      { now: () => new Date('2026-10-09T18:00:00Z') },
      { expectedRevision: before.revision },
    );
    await expect(
      session.command((plan) =>
        rootReplaceResult(plan, { ...plan, motto: 'Meine Änderung' }, 'Lokal'),
      ),
    ).rejects.toMatchObject({ code: 'conflict' });
    expect(session.state.pending?.plan.motto).toBe('Meine Änderung');
    expect(session.state.loaded?.revision).toBe(0);
    await expect(
      session.command((plan) => rootReplaceResult(plan, { ...plan, motto: 'Weiter' }, 'Weiter')),
    ).rejects.toMatchObject({ code: 'readOnly' });
    expect((await other.load(before.plan.id))?.plan.motto).toBe('Anderer Stand');
    other.close();
  });

  it('[R-5.7-03] sperrt Änderungen bei fehlender Plansperre verständlich', async () => {
    vi.stubGlobal('navigator', {});
    const session = await fresh('i2-unit-no-locks');
    expect(session.state.readOnly).toBe(true);
    expect(session.state.readOnlyReason).toContain('Plansperre');
    await expect(session.history(false)).rejects.toMatchObject({ code: 'readOnly' });
  });
});
