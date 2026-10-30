// @vitest-environment jsdom
// Paket E1-02d: Layout-Schicht rein und deterministisch (Leitplanke 2, R-L-02; Vertrag E1-02d Abschnitt 2f «Rein»,
// «Reihenfolge der items», «entries», «fallbacks»; Änderungsnotiz V09). Pseudonymisierte KVK-Fixture, synthetischer
// Plan (E1-02a) und zufällige fiktive Wochen mit festem Startwert. KVK/WK: nie automatisch (AGENTS.md).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { GridLayout } from '../../../../src/model/wap/layout/grid/types';
import type { Plan } from '../../../../src/model/wap/types';
import { GRID_SEED, zufallsWoche } from '../../support/arbitraries/grid';
import { itemsVon, lege, MO, rasterPlan, STD, texte, WOCHE } from '../../support/grid/build';
import {
  beso,
  block,
  marker,
  querbalken,
  rapport,
  roundTrip,
  rt,
  win,
} from '../../support/model/builders';
import { loadKvkPlan } from '../../support/model/kvk-fixture';
import { syntheticPlan } from '../../support/synthetic-plan';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const LAYOUT_DIR = join(REPO, 'src', 'model', 'wap', 'layout');

function dateien(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? dateien(p) : /\.(ts|tsx|js|mjs)$/.test(n) ? [p] : [];
  });
}

/** Muster aus Vertrag E1-02d Notiz V09: Math.random sowie mit Wortgrenzen Date, performance, crypto, document, window, console. */
const MUSTER: readonly RegExp[] = [
  /Math\.random/,
  /\bDate\b/,
  /\bperformance\b/,
  /\bcrypto\b/,
  /\bdocument\b/,
  /\bwindow\b/,
  /\bconsole\b/,
];
const treffer = (text: string): number =>
  text.split(/\r?\n/).filter((z) => MUSTER.some((m) => m.test(z))).length;

function zweimal(plan: Plan, opts: Parameters<typeof lege>[1]): [GridLayout, GridLayout] {
  const vorher = roundTrip(plan);
  const a = lege(plan, opts);
  const b = lege(plan, opts);
  expect(plan, 'Eingabe unverändert').toEqual(vorher);
  return [a, b];
}

describe('Determinismus (R-L-02)', () => {
  it('[R-L-02] KVK-Fixture: zwei Aufrufe strukturell gleich, Eingabe unverändert', () => {
    const kvk = loadKvkPlan();
    const [a, b] = zweimal(kvk, { W: 652.51 });
    expect(b).toEqual(a);
    expect(a.entries.length).toBeGreaterThan(0);
    expect(a.items.length).toBeGreaterThan(0);
  });

  it('[R-L-02] synthetischer Plan (4 Wochen, fester Startwert): jede Woche zweimal gleich, Eingabe unverändert', () => {
    const plan = syntheticPlan();
    expect(plan.weeks).toHaveLength(4);
    for (const w of plan.weeks) {
      const [a, b] = zweimal(plan, { W: 652.51, weekId: w.id });
      expect(b, w.id).toEqual(a);
    }
  });

  it('[R-L-02] zufällige Pläne: zwei Aufrufe strukturell gleich, Eingabe unverändert', () => {
    fc.assert(
      fc.property(zufallsWoche(), (w) => {
        const [a, b] = zweimal(w.plan, { W: w.raster.W, ppm: w.raster.ppm });
        expect(b).toEqual(a);
      }),
      { seed: GRID_SEED, numRuns: 40 },
    );
  });

  it('[R-L-02] Aufgebotsart wird nie gelesen: Plan.service «KVK», «WK» oder leer ergibt dasselbe Layout', () => {
    const kvk = loadKvkPlan();
    const L = (service: string) => lege({ ...kvk, service }, { W: 652.51 });
    const basis = L('');
    expect(L('KVK')).toEqual(basis);
    expect(L('WK')).toEqual(basis);
  });

  it('[R-L-02] (V09) Musterprüfung der Quelltexte unter src/model/wap/layout/**: 0 Treffer; die Prüfung erkennt die Muster', () => {
    // Zuerst ein Lauf der Schicht selbst (gleiche Eingabe → gleiches Ergebnis).
    const kvk = loadKvkPlan();
    expect(lege(kvk, { W: 652.51 })).toEqual(lege(kvk, { W: 652.51 }));
    // Die Muster greifen, ohne IsoDate, windowId oder «Datei» zu treffen.
    expect(treffer('const t = Date.now();\nwindow.x = 1;\nconsole.log(1);\nMath.random();')).toBe(
      4,
    );
    expect(treffer('performance.now()\ncrypto.randomUUID()\ndocument.body')).toBe(3);
    expect(treffer('type IsoDate = string;\nconst windowId = 1; // Datei, Dates, documents')).toBe(
      0,
    );
    const liste = dateien(LAYOUT_DIR);
    const rel = liste.map((p) => relative(LAYOUT_DIR, p).replace(/\\/g, '/'));
    expect(rel).toContain('grid/layout.ts');
    expect(rel).toContain('grid/geometry.ts');
    expect(rel).toContain('entries/besoBox.ts');
    expect(rel).toContain('entries/fill.ts');
    const funde = liste.flatMap((p) => {
      const n = treffer(readFileSync(p, 'utf8'));
      return n === 0 ? [] : [`${relative(LAYOUT_DIR, p)}: ${n}`];
    });
    expect(funde).toEqual([]);
  });
});

describe('Feste Reihenfolgen (2f)', () => {
  const plan = () =>
    rasterPlan({
      entries: [
        block('b1', 1, {
          date: MO,
          columns: { kind: 'ids', ids: [STD.p1] },
          time: { form: 'range', from: 540, to: 600 },
          title: rt('Spät'),
        }),
        block('b2', 2, {
          date: MO,
          columns: { kind: 'ids', ids: [STD.p2] },
          time: { form: 'range', from: 480, to: 540 },
          title: rt('Früh'),
        }),
        rapport('r', 3, { date: MO, time: { form: 'point', at: 600 } }),
        beso('s', 4, { date: MO, windows: [win('ts', { time: { form: 'point', at: 660 } })] }),
        querbalken('q', 5, { fromDate: MO, toDate: MO }),
        marker('m', 6, { date: MO, at: 720, columns: { kind: 'ids', ids: [STD.p3] } }),
      ],
    });

  it('[R-L-02] items: Querbalken, Blöcke, Rapport-Kästchen, Beso-Kästchen, Marker; Blöcke nach gezeichnetem Beginn', () => {
    const L = lege(plan());
    const folge = L.items.map((i) => i.entryId);
    const erste = (id: string) => folge.indexOf(id);
    const letzte = (id: string) => folge.lastIndexOf(id);
    expect(L.items.every((i) => i.entryId !== undefined)).toBe(true);
    const reihe = ['q', 'b2', 'b1', 'r', 's', 'm'];
    for (const id of reihe) expect(erste(id), id).toBeGreaterThanOrEqual(0);
    for (let k = 1; k < reihe.length; k++) {
      expect(letzte(reihe[k - 1] as string), `${reihe[k - 1]} vor ${reihe[k]}`).toBeLessThan(
        erste(reihe[k] as string),
      );
    }
    expect(itemsVon(L, 'q').every((i) => i.role === 'querbalken')).toBe(true);
    expect(itemsVon(L, 'r').every((i) => i.role === 'rapport')).toBe(true);
    expect(itemsVon(L, 's').every((i) => i.role === 'besoBox')).toBe(true);
    expect(itemsVon(L, 'm').every((i) => i.role === 'marker')).toBe(true);
  });

  it('[R-L-02] je Teilstück Fläche und Rahmen vor seinem Text; entries nach Erfassung', () => {
    const L = lege(plan());
    for (const id of ['b1', 'b2', 'r', 's', 'q']) {
      const items = itemsVon(L, id);
      const iRect = items.findIndex((i) => i.kind === 'rect');
      const iText = items.findIndex((i) => i.kind === 'text');
      expect(iRect, id).toBeGreaterThanOrEqual(0);
      expect(iText, id).toBeGreaterThan(iRect);
      expect(texte(L, id).length, id).toBeGreaterThan(0);
    }
    expect(L.entries.map((e) => e.entryId)).toEqual(['b1', 'b2', 'r', 's', 'q', 'm']);
  });

  it('[R-L-02] fallbacks: zuerst die Band-Ereignisse, dann je Textträger in Zeichenreihenfolge', () => {
    const p = rasterPlan({
      entries: [
        block('b1', 1, {
          date: MO,
          columns: { kind: 'ids', ids: [STD.p1] },
          time: { form: 'range', from: 480, to: 510 },
          title: rt('Gefechtsausbildung im Zug', true),
          textDirection: 'horizontal',
        }),
        querbalken('q1', 2, { fromDate: MO, toDate: MO }),
        querbalken('q2', 3, { fromDate: MO, toDate: MO }),
        querbalken('q3', 4, { fromDate: MO, toDate: MO }),
      ],
    });
    const L = lege(p);
    expect(L.fallbacks.map((f) => [f.kind, f.entryId, f.region])).toEqual([
      ['bandOverflow', 'q3', 'band'],
      ['ellipsis', 'b1', 'block'],
    ]);
    expect(L.fallbacks.every((f) => f.weekId === WOCHE)).toBe(true);
  });
});
