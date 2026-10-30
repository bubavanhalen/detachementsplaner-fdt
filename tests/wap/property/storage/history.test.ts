// @vitest-environment jsdom
// Paket E1-04: Eigenschaften der reinen Historie über zufällige Folgen aus Schritt, Undo und Redo (Vertrag
// docs/wap-planer/plan/vertraege/E1-04.md, Notiz «Ausarbeitung Schritt 2» Abschnitte B2–B4, L R-5.6-15 Nr 2;
// AR0-45, AR0-48). Fester Startwert (ADR-010 §4.5). Vergleich mit einem Modell nach B2: seq = nextSeq, Redo-Zweig
// verworfen, Kürzen auf HISTORY_LIMIT. Schritte ohne Patches (das Ergebnis von pushStep hängt nur von seq und
// cursor ab, I1 Nr 11).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  EMPTY_HISTORY,
  HISTORY_LIMIT,
  type HistoryState,
  isStepApplied,
  pushStep,
  redo,
  undo,
} from '../../../../src/model/wap/history/history';
import { planA } from '../../support/storage/plaene';

const STORAGE_SEED = 20261007;
const OPTIONEN = { seed: STORAGE_SEED, numRuns: 25 } as const;

type Aktion = 'schritt' | 'undo' | 'redo';

/**
 * Folgen mit überwiegend neuen Schritten und mindestens 250 Aktionen, damit das Kürzen (> 200 Schritte) vorkommt.
 * Ohne Mindestlänge erzeugt fast-check mit der Grundgrösse nur kurze Folgen, und Undo mit neuem Schritt verwirft;
 * mit diesen Gewichten kürzen die meisten Läufe, und alle verwerfen (TR-E104-10). Der Test prüft beides.
 */
const folge = fc.array(
  fc.oneof(
    { weight: 16, arbitrary: fc.constant<Aktion>('schritt') },
    { weight: 2, arbitrary: fc.constant<Aktion>('undo') },
    { weight: 1, arbitrary: fc.constant<Aktion>('redo') },
  ),
  { minLength: 250, maxLength: 400 },
);

interface Modell {
  seqs: number[];
  cursor: number;
  nextSeq: number;
  truncatedThroughSeq: number;
}

describe('Historie (Eigenschaften)', () => {
  it('[R-5.6-15] beliebige Folgen: Zustand wie Modell B2–B4, seq streng steigend und nie doppelt, höchstens 200 Schritte, isStepApplied wie Modell', () => {
    const plan = planA();
    let laeufe = 0;
    let laeufeMitKuerzen = 0;
    let laeufeMitVerwerfen = 0;
    fc.assert(
      fc.property(folge, (aktionen) => {
        laeufe += 1;
        let gekuerztImLauf = false;
        let verworfenImLauf = false;
        let h: HistoryState = EMPTY_HISTORY;
        const m: Modell = { seqs: [], cursor: 0, nextSeq: 1, truncatedThroughSeq: 0 };
        const vergeben = new Set<number>();
        for (const a of aktionen) {
          if (a === 'schritt') {
            const c = pushStep(h, {
              label: 'Schritt (fiktiv)',
              at: '2026-10-07T12:00:00.000Z',
              patches: [],
              inversePatches: [],
            });
            const verworfen = m.seqs.slice(m.cursor);
            const liste = [...m.seqs.slice(0, m.cursor), m.nextSeq];
            const gekuerzt =
              liste.length > HISTORY_LIMIT ? liste.slice(0, liste.length - HISTORY_LIMIT) : [];
            expect(c.seq).toBe(m.nextSeq);
            expect(vergeben.has(c.seq)).toBe(false);
            vergeben.add(c.seq);
            expect(c.discardedSeqs).toEqual(verworfen);
            expect(c.truncatedSeqs).toEqual(gekuerzt);
            if (gekuerzt.length > 0) gekuerztImLauf = true;
            if (verworfen.length > 0) verworfenImLauf = true;
            m.seqs = liste.slice(gekuerzt.length);
            m.cursor = m.seqs.length;
            m.nextSeq += 1;
            if (gekuerzt.length > 0) m.truncatedThroughSeq = gekuerzt[gekuerzt.length - 1] ?? 0;
            h = c.history;
          } else if (a === 'undo') {
            const u = undo(plan, h);
            if (m.cursor === 0) {
              expect(u).toBeNull();
            } else {
              expect(u?.step.seq).toBe(m.seqs[m.cursor - 1]);
              m.cursor -= 1;
              if (u !== null) h = u.history;
            }
          } else {
            const w = redo(plan, h);
            if (m.cursor === m.seqs.length) {
              expect(w).toBeNull();
            } else {
              expect(w?.step.seq).toBe(m.seqs[m.cursor]);
              m.cursor += 1;
              if (w !== null) h = w.history;
            }
          }
          expect(h.steps.map((s) => s.seq)).toEqual(m.seqs);
          expect(h.cursor).toBe(m.cursor);
          expect(h.nextSeq).toBe(m.nextSeq);
          expect(h.truncatedThroughSeq).toBe(m.truncatedThroughSeq);
          expect(h.steps.length).toBeLessThanOrEqual(HISTORY_LIMIT);
        }
        const angewendet = new Set(m.seqs.slice(0, m.cursor));
        for (let s = 0; s <= m.nextSeq; s++) {
          const soll = s === 0 || s <= m.truncatedThroughSeq || angewendet.has(s);
          expect(isStepApplied(h, s)).toBe(soll);
        }
        if (gekuerztImLauf) laeufeMitKuerzen += 1;
        if (verworfenImLauf) laeufeMitVerwerfen += 1;
      }),
      OPTIONEN,
    );
    expect(laeufe).toBe(OPTIONEN.numRuns);
    expect(laeufeMitKuerzen, 'Läufe mit Kürzen über 200 Schritte').toBeGreaterThan(0);
    expect(laeufeMitVerwerfen, 'Läufe mit verworfenem Redo-Zweig').toBeGreaterThan(0);
  });
});
