// @vitest-environment node
// Paket E1-02l R3 (R-14.3-04; Auftraggeber 09.10.2026): Überlappungen semantisch geprüft. Gewollt sind nur
// Beso-Kästchen über Blöcken, Marker über Einträgen und Beschriftungsträger über Blöcken (Beschrieb 4.6); jede andere
// Überdeckung von Flächen, jeder Text über Text, jeder verdeckte und jeder auf fremder Fläche liegende Text ist ein
// Fehler. Zufällige fiktive Wochen (fester Startwert, ADR-010 §5), der synthetische Belastungsplan und die
// realistischen Demowochen (pseudonymisierte KVK-Fixture, fiktive FDT-Woche); dazu Gegenproben des Klassifizierers.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { PageItem, PageModel, TextItem } from '../../../../src/model/wap/layout/pageModel';
import type { Plan } from '../../../../src/model/wap/types';
import { createE102lDemoPlans } from '../../../wap-e2e/e1-02l/support/demo';
import { farbWoche, PAGE_RUNS, PAGE_SEED } from '../../support/arbitraries/page';
import { klassifiziere } from '../../support/e1-02l/ueberlappung';
import { seite } from '../../support/page/seite';
import { syntheticPlan } from '../../support/synthetic-plan';

const OPT = { seed: PAGE_SEED + 102, numRuns: PAGE_RUNS, includeErrorInReport: true } as const;

function text(t: TextItem): string {
  return t.runs.map((r) => r.text).join('');
}

/** Rollen, deren Text nie gekürzt wird (R1, R2). */
const NIE_GEKUERZT = new Set(['columnHeader', 'rapport', 'besoBox']);

function pruefe(plan: Plan, weekId: string): { fehler: string[]; gewollt: number } {
  const L = seite(plan, weekId);
  const page = L.pages[0] as PageModel;
  const k = klassifiziere(page);
  const fehler = k.fehler.map((f) => `${f.art}: ${f.text}`);
  for (const it of page.items) {
    if (it.kind === 'text' && NIE_GEKUERZT.has(it.role) && text(it).includes('…')) {
      // Rapport-Kästchen und Rapport-Block tragen die Rolle 'rapport' bzw. 'block'; Blocktitel dürfen gekürzt werden.
      fehler.push(`gekürzt (${it.role}): «${text(it)}»`);
    }
  }
  return { fehler, gewollt: k.gewollt.length };
}

describe('Überlappungen klassifiziert (R-14.3-04)', () => {
  it('[R-14.3-04] zufällige Wochen: keine fehlerhafte Überlappung, kein «…» in Spaltenköpfen, Rapportkürzeln und Beso-Nummern', () => {
    fc.assert(
      fc.property(farbWoche(), (w) => {
        expect(pruefe(w.plan, 'w26').fehler).toEqual([]);
      }),
      OPT,
    );
  });

  it('[R-14.3-04] synthetischer Belastungsplan (4 Wochen): keine Fehler; gewollte Überdeckungen kommen vor', () => {
    const plan = syntheticPlan();
    let gewollt = 0;
    for (const week of plan.weeks) {
      const r = pruefe(plan, week.id);
      expect(r.fehler, week.id).toEqual([]);
      gewollt += r.gewollt;
    }
    expect(gewollt).toBeGreaterThan(0);
  });

  it('[R-14.3-04] realistische Demowochen (KVK, FDT): keine Fehler und kein «…» in Köpfen, Rapporten, Beso', () => {
    const [real] = createE102lDemoPlans();
    const plan = real as Plan;
    for (const week of plan.weeks) expect(pruefe(plan, week.id).fehler, week.id).toEqual([]);
  });
});

/** Seite mit einem Block, einem Beso darüber und einem Text. */
function grundseite(): PageItem[] {
  const fill = { r: 255, g: 255, b: 153 };
  const black = { r: 0, g: 0, b: 0 };
  const stroke = { color: black, widthPt: 0.48, dash: null };
  const zeile = (
    x: number,
    y: number,
    s: string,
    entryId: string,
    role: TextItem['role'],
  ): TextItem => ({
    kind: 'text',
    role,
    entryId,
    x,
    baselineY: y,
    rotation: 0,
    sizePt: 5,
    runs: [{ text: s, weight: 'regular', color: black, strike: false }],
    frame: { x, y: y - 5, w: 30, h: 7 },
  });
  return [
    {
      kind: 'rect',
      role: 'block',
      entryId: 'b1',
      rect: { x: 10, y: 10, w: 40, h: 40 },
      fill,
      stroke,
    },
    zeile(12, 20, 'Ausbildung', 'b1', 'block'),
    {
      kind: 'rect',
      role: 'besoBox',
      entryId: 'z1',
      rect: { x: 30, y: 35, w: 15, h: 10 },
      fill,
      stroke,
    },
    zeile(32, 42, '12', 'z1', 'besoBox'),
  ];
}

function modell(items: PageItem[]): PageModel {
  return { widthPt: 100, heightPt: 100, kind: 'week', items };
}

describe('Gegenproben des Klassifizierers (R-14.3-04)', () => {
  it('[R-14.3-04] Beso über Block ohne Textschnitt: gewollt, kein Fehler', () => {
    const k = klassifiziere(modell(grundseite()));
    expect(k.fehler).toEqual([]);
    expect(k.gewollt.map((g) => g.art)).toEqual(['besoUeberBlock']);
  });

  it('[R-14.3-04] Text über Text, verdeckter Text und Block über Block werden als Fehler erkannt', () => {
    const items = grundseite();
    const t = items[1] as TextItem;
    const doppelt = modell([...items, { ...t, entryId: 'b9', x: t.x + 1 }]);
    expect(klassifiziere(doppelt).fehler.some((f) => f.art === 'textUeberText')).toBe(true);
    const verdeckt = modell([
      ...items,
      {
        kind: 'rect',
        role: 'rapport',
        entryId: 'r1',
        rect: { x: 11, y: 14, w: 20, h: 8 },
        fill: { r: 1, g: 2, b: 3 },
        stroke: null,
      },
    ]);
    expect(klassifiziere(verdeckt).fehler.some((f) => f.art === 'textVerdeckt')).toBe(true);
    const bloecke = modell([
      ...items,
      {
        kind: 'rect',
        role: 'block',
        entryId: 'b2',
        rect: { x: 40, y: 60, w: 20, h: 20 },
        fill: { r: 9, g: 9, b: 9 },
        stroke: null,
      },
      {
        kind: 'rect',
        role: 'block',
        entryId: 'b3',
        rect: { x: 50, y: 70, w: 20, h: 20 },
        fill: { r: 9, g: 9, b: 9 },
        stroke: null,
      },
    ]);
    expect(klassifiziere(bloecke).fehler.some((f) => f.art === 'flaecheUeberFlaeche')).toBe(true);
  });

  it('[R-14.3-04] Text auf fremder Fläche ohne eigenen Träger wird als Fehler erkannt', () => {
    const items = grundseite();
    const fremd: TextItem = { ...(items[3] as TextItem), entryId: 'z2', x: 14, baselineY: 46 };
    const k = klassifiziere(modell([...items.slice(0, 2), fremd]));
    expect(k.fehler.some((f) => f.art === 'textAufFremderFlaeche')).toBe(true);
  });
});
