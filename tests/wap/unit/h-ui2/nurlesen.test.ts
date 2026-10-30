// @vitest-environment jsdom
// H-UI2, niedriger Punkt aus dem ux-critic-Bericht Runde 1 (Beschrieb 5.7; UI-Richtlinie 11.4 «Zweiter Tab», 12):
// Der Hinweis «Nur lesen» nennt Ursache und nächsten Schritt. Nur fiktive Daten.
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I2Session } from '../../../../src/components/wap/i2/usePlan';

beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory());
  vi.stubGlobal('navigator', {});
  localStorage.clear();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('H-UI2 UX niedrig: «Nur lesen» mit nächstem Schritt', () => {
  it('[R-5.7-03] ohne Plansperre nennt der Hinweis Ursache und nächsten Schritt', async () => {
    const session = new I2Session('h-ui2-nur-lesen');
    await session.initialized;
    await session.create('Fiktiver Übungsplan', 'kp', '2026-09-28', 1);
    expect(session.state.readOnly).toBe(true);
    expect(session.state.readOnlyReason).toMatch(/^Nur lesen: .*Plansperre/);
    expect(session.state.readOnlyReason).toContain('Nächster Schritt');
  });
});
