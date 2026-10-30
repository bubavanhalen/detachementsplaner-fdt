// @vitest-environment node
// Paket H-LAYOUT, Befund SA-H-01 (R-10-48, R-10-43, R-7-11): Eigenschaft – zufällige Blöcke mit Teilaufgaben haben
// keinen Text ausserhalb ihres Rahmens; jeder Wegfall (Teilaufgabe gekürzt/entfallen, «…») ist ein P8, und ohne
// Rückfallereignis stehen alle Teilaufgabentitel vollständig im Text. Fester Startwert (ADR-010 §5), fiktive Daten.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { runChecks } from '../../../../src/model/wap/checks/run';
import { layoutWeekPage } from '../../../../src/model/wap/layout/page/compose';
import { builtInTemplates, kpTemplate } from '../../../../src/model/wap/template';
import type { Plan } from '../../../../src/model/wap/types';
import { einTeil, lege, MO, rasterPlan, STD, texte, zeilenText } from '../../support/grid/build';
import {
  blockMitTeilaufgaben,
  TEILAUFGABEN_SEED,
  teilaufgabeArb,
} from '../../support/model/teilaufgaben';

const OPTS = { paper: 'A4' as const, showStatus: true, templates: builtInTemplates() };
const MIN = kpTemplate().fontSizes.min;

const fall = fc.record({
  subtasks: fc.array(teilaufgabeArb, { minLength: 1, maxLength: 4 }),
  dauer: fc.integer({ min: 2, max: 40 }).map((n) => n * 15),
  spalten: fc.constantFrom([STD.p1], [STD.p1, STD.p2], [STD.p1, STD.p2, STD.p3]),
});

describe('Eigenschaft Teilaufgaben im Rahmen und P8 (R-10-48, R-10-43)', () => {
  it('[R-10-48][R-10-43] zufällige Blöcke: Text im Rahmen, Mindestgrösse; Rückfall ⇔ P8 des Blocks; ohne Rückfall alle Titel vollständig', () => {
    fc.assert(
      fc.property(fall, ({ subtasks, dauer, spalten }) => {
        const b = blockMitTeilaufgaben('e1', 1, subtasks, {
          date: MO,
          time: { form: 'range', from: 480, to: 480 + dauer },
          columns: { kind: 'ids', ids: spalten },
        });
        const plan: Plan = rasterPlan({ entries: [b] });
        const L = lege(plan);
        const r = einTeil(L, 'e1', 'block').rect;
        const zeilen = texte(L, 'e1');
        for (const z of zeilen) {
          expect(z.frame.x).toBeGreaterThanOrEqual(r.x - 1e-6);
          expect(z.frame.y).toBeGreaterThanOrEqual(r.y - 1e-6);
          expect(z.frame.x + z.frame.w).toBeLessThanOrEqual(r.x + r.w + 1e-6);
          expect(z.frame.y + z.frame.h).toBeLessThanOrEqual(r.y + r.h + 1e-6);
          expect(z.sizePt).toBeGreaterThanOrEqual(MIN);
        }
        const ereignis = L.fallbacks.some((e) => e.entryId === 'e1');
        const p8 = runChecks({ plan, layoutFor: (id) => layoutWeekPage(plan, id, OPTS) }).some(
          (f) => f.rule === 'P8' && f.entryId === 'e1',
        );
        const seite = layoutWeekPage(plan, 'w26', OPTS);
        expect(p8).toBe(seite.fallbacks.some((e) => e.entryId === 'e1'));
        if (!ereignis) {
          const text = zeilen.map(zeilenText).join(' ').replace(/-\s/g, '').replace(/\s+/g, '');
          for (const t of subtasks) {
            const titel = t.title
              .map((x) => x.text)
              .join('')
              .replace(/\s+/g, '');
            expect(text).toContain(titel);
          }
        }
      }),
      { seed: TEILAUFGABEN_SEED, numRuns: 60 },
    );
  });
});
