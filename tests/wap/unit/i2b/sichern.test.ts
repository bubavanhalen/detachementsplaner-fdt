// @vitest-environment jsdom
// I2b-A A3 und Befund CS-I2-E2E-FLAKE-01: Speichern läuft im Hintergrund; «Plan-Datei sichern» ist dabei nie
// gesperrt und liefert den aktuellen Stand (reiht sich hinter das laufende Speichern ein). Nur fiktive Daten.
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I2Application } from '../../../../src/components/wap/i2/I2Application';
import { parsePlanFile } from '../../../../src/io/wap-plan/planFile';
import { openPlanStore } from '../../../../src/io/wap-plan/store';
import { setDayColumnSet } from '../../../../src/model/wap/commands/days';
import { createPlanFromTemplate } from '../../../../src/model/wap/factories';
import { builtInTemplates, kpTemplate } from '../../../../src/model/wap/template';

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

const downloads: Blob[] = [];

/** Wartezeit von findByRole und waitFor (F-FLAKY, FL-01): Schutz vor Hängern, keine Zeitanforderung. */
const WARTEN = { timeout: 30_000 } as const;

beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory());
  vi.stubGlobal('navigator', { locks: localLocks() });
  localStorage.clear();
  downloads.length = 0;
  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob: Blob | MediaSource) => {
    if (blob instanceof Blob) downloads.push(blob);
    return 'blob:lokal';
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('I2b Plan-Datei sichern während des Speicherns', () => {
  // F-FLAKY (FL-01): keine Zeitanforderung; Oberfläche in jsdom mit fake-indexeddb, ruhig unter 1 s, in der eigenen Suite
  // (4 Worker, ohne Fremdlast) über 5 s – Zeitlimit als Schutz vor Hängern statt der Vitest-Vorgabe 5 s; die Wartezeiten
  // von findByRole und waitFor (Vorgabe 1 s) ebenso.
  it('[R-5.6-01][R-5.5-07] bleibt während des Speicherns bedienbar und sichert den neuen Block mit', async () => {
    const store = await openPlanStore({ dbName: 'wap-planer' });
    const base = createPlanFromTemplate(kpTemplate(), {
      planId: 'fiktiv-sichern',
      startDate: '2026-09-28',
      weekCount: 1,
    });
    const week = base.weeks[0];
    const set = base.columnSets[0];
    if (week === undefined || set === undefined) throw new Error('Vorlage unvollständig');
    const plan = setDayColumnSet(
      { ...base, exerciseName: 'Fiktiver Sicherungsplan' },
      week.id,
      ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'],
      set.id,
      { templates: builtInTemplates() },
    ).plan;
    await store.create(plan, { now: () => new Date('2026-10-13T08:00:00Z') });
    store.close();
    render(createElement(I2Application));
    const newBlock = await screen.findByRole('button', { name: 'Neuer Block' }, WARTEN);
    await waitFor(() => expect(newBlock).toBeEnabled(), WARTEN);
    fireEvent.click(newBlock);
    const form = screen.getByRole('form', { name: 'Neuer Block' });
    fireEvent.change(screen.getByRole('textbox', { name: 'Titel' }), {
      target: { value: 'Sicherungsblock' },
    });
    fireEvent.submit(form);
    // Unmittelbar danach läuft das Speichern noch: der Knopf darf trotzdem nicht gesperrt sein.
    expect(screen.getByRole('status', { name: 'Speicher' })).toHaveTextContent('Speichern …');
    const save = screen.getByRole('button', { name: 'Plan-Datei sichern' });
    expect(save).toBeEnabled();
    await act(async () => {
      fireEvent.click(save);
    });
    await waitFor(() => expect(downloads).toHaveLength(1), WARTEN);
    const file = parsePlanFile(new Uint8Array(await (downloads[0] as Blob).arrayBuffer()));
    const titles = Object.values(file.plan.entries).flatMap((e) =>
      e.type === 'block' ? e.title.map((r) => r.text) : [],
    );
    expect(titles).toContain('Sicherungsblock');
  }, 120_000);
});
