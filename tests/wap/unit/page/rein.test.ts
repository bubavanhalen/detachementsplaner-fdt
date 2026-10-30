// @vitest-environment jsdom
// Paket E1-02e: Seitenkomposition rein und deterministisch (Leitplanke 2, R-L-02 aus E1-02d; Vertrag E1-02e Notiz
// «Ausarbeitung Schritt 2» G1, J «Zusätzlich ohne eigene Zeile»). Die Tests tragen zusätzlich R-10-06, weil sie
// den Seitenaufbau als Ganzes prüfen und in der Rot-Phase am Stub scheitern (ADR-010 §3.3). Pseudonymisierte
// KVK-Fixture, synthetischer Plan und zufällige fiktive Wochen mit festem Startwert.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { WeekPageLayout } from '../../../../src/model/wap/layout/page/types';
import type { Plan } from '../../../../src/model/wap/types';
import { farbWoche, PAGE_SEED } from '../../support/arbitraries/page';
import { roundTrip } from '../../support/model/builders';
import { seite } from '../../support/page/seite';
import { KVK_WOCHE, kvk, kvkPlus } from '../../support/page/varianten';
import { syntheticPlan } from '../../support/synthetic-plan';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const LAYOUT_DIR = join(REPO, 'src', 'model', 'wap', 'layout');
const PAGE_DIR = join(LAYOUT_DIR, 'page');

function dateien(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? dateien(p) : /\.(ts|tsx|js|mjs)$/.test(n) ? [p] : [];
  });
}

/** Muster aus Vertrag E1-02d V09 (gelten nach G1 auch für page/**). */
const MUSTER_E102D: readonly RegExp[] = [
  /Math\.random/,
  /\bDate\b/,
  /\bperformance\b/,
  /\bcrypto\b/,
  /\bdocument\b/,
  /\bwindow\b/,
  /\bconsole\b/,
];
/** Zusätzliche Muster nach G1 (V26): eigene Dekodierung ohne atob, btoa, Buffer. */
const MUSTER_E102E: readonly RegExp[] = [/\batob\b/, /\bbtoa\b/, /\bBuffer\b/];

const treffer = (text: string, muster: readonly RegExp[]): number =>
  text.split(/\r?\n/).filter((z) => muster.some((m) => m.test(z))).length;

/** Struktur ohne Bildbytes-Klassen, damit `toEqual` Uint8Array inhaltlich vergleicht. */
function zweimal(plan: Plan, weekId: string): [WeekPageLayout, WeekPageLayout] {
  const vorher = roundTrip(plan);
  const a = seite(plan, weekId);
  const b = seite(plan, weekId);
  expect(plan, 'Eingabe unverändert').toEqual(vorher);
  return [a, b];
}

describe('Determinismus der Seite (R-L-02, G1)', () => {
  it('[R-10-06][R-L-02] KVK und KVK+: zwei Aufrufe von layoutWeekPage strukturell gleich, die eingefrorene Eingabe bleibt unverändert', () => {
    for (const p of [kvk(), kvkPlus()]) {
      const [a, b] = zweimal(p, KVK_WOCHE);
      expect(b).toEqual(a);
      expect(a.pages.length).toBeGreaterThan(0);
    }
    const eingefroren = Object.freeze(kvk());
    expect(() => seite(eingefroren, KVK_WOCHE)).not.toThrow();
  });

  it('[R-10-06][R-L-02] synthetischer Plan (4 Wochen, fester Startwert): jede Woche zweimal gleich', () => {
    const plan = syntheticPlan();
    for (const w of plan.weeks) {
      const [a, b] = zweimal(plan, w.id);
      expect(b, w.id).toEqual(a);
    }
  });

  it('[R-10-06][R-L-02] zufällige Wochen mit Zielen, Bemerkungen und Bereitschaft: zwei Aufrufe gleich, Eingabe unverändert', () => {
    fc.assert(
      fc.property(farbWoche(), (w) => {
        const [a, b] = zweimal(w.plan, 'w26');
        expect(b).toEqual(a);
      }),
      { seed: PAGE_SEED, numRuns: 20, includeErrorInReport: true },
    );
  });

  it('[R-10-06][R-L-02] Aufgebotsart wird nie gelesen: Plan.service «KVK», «WK» oder leer ergibt dieselbe Seite', () => {
    const p = kvk();
    const basis = seite({ ...p, service: '' }, KVK_WOCHE);
    expect(seite({ ...p, service: 'KVK' }, KVK_WOCHE)).toEqual(basis);
    expect(seite({ ...p, service: 'WK' }, KVK_WOCHE)).toEqual(basis);
  });

  it('[R-10-06][R-L-02] (G1, V26) Quelltexte unter layout/page/**: weder Uhr, Zufall, DOM, Konsole (Muster E1-02d V09) noch atob, btoa, Buffer; die Prüfung erkennt die Muster', () => {
    expect(seite(kvk(), KVK_WOCHE)).toEqual(seite(kvk(), KVK_WOCHE));
    expect(treffer('atob(x)\nconst y = btoa(z);\nBuffer.from(a)', MUSTER_E102E)).toBe(3);
    expect(treffer('const atobX = 1; // Buffers, Puffer', MUSTER_E102E)).toBe(0);
    expect(treffer('Date.now()\nwindow.x\nconsole.log(1)', MUSTER_E102D)).toBe(3);
    const liste = dateien(PAGE_DIR);
    const rel = liste.map((p) => relative(LAYOUT_DIR, p).replace(/\\/g, '/'));
    for (const n of [
      'types',
      'errors',
      'geometry',
      'geometryKp',
      'texts',
      'header',
      'gridChrome',
      'agenda',
      'sidebar',
      'warnings',
      'compose',
      'a3',
      'index',
    ]) {
      expect(rel).toContain(`page/${n}.ts`);
    }
    const funde = liste.flatMap((p) => {
      const t = readFileSync(p, 'utf8');
      const n = treffer(t, [...MUSTER_E102D, ...MUSTER_E102E]);
      return n === 0 ? [] : [`${relative(LAYOUT_DIR, p)}: ${n}`];
    });
    expect(funde).toEqual([]);
  });
});
