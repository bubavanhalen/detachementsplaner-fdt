// @vitest-environment jsdom
// Paket E1-04: reine Historie (Vertrag docs/wap-planer/plan/vertraege/E1-04.md, Notiz «Ausarbeitung Schritt 2»
// Abschnitte B1–B6, L R-5.6-15 Nr 1–3; Beschrieb 5.6 Punkt 6; ADR-006 Punkt 1, 2d; AR0-41, AR0-45, AR0-48).
// Schritte aus echten Befehlen (E1-03 updateEntry). Alle Inhalte fiktiv.
import { describe, expect, it } from 'vitest';
import type { CommandResult } from '../../../../src/model/wap/commands/command';
import {
  cutHistory,
  EMPTY_HISTORY,
  HISTORY_LIMIT,
  type HistoryState,
  type HistoryStep,
  isRecordVisible,
  isStepApplied,
  pushStep,
  redo,
  undo,
} from '../../../../src/model/wap/history/history';
import type { Plan } from '../../../../src/model/wap/types';
import { motto, planA, titel } from '../../support/storage/plaene';
import { gleich, vorhanden } from '../../support/storage/pruefen';

const AT = '2026-10-07T12:00:00.000Z';

function schritt(r: CommandResult): Omit<HistoryStep, 'seq'> {
  return { label: r.label, at: AT, patches: r.patches, inversePatches: r.inversePatches };
}

/** Schritt ohne Patches für Tabellenfälle (Ergebnis von pushStep hängt nur von seq und cursor ab, I1 Nr 11). */
function leer(seq: number): HistoryStep {
  return { seq, label: `Schritt ${String(seq)}`, at: AT, patches: [], inversePatches: [] };
}

describe('Historie (rein)', () => {
  it('[R-5.6-15] 210 Änderungen → 200 Schritte; 200 × Undo stellt den Plan nach Änderung 10 her, das 201. Undo liefert null, 200 × Redo den Plan nach Änderung 210', () => {
    let plan: Plan = planA();
    let h: HistoryState = EMPTY_HISTORY;
    const plaene: Plan[] = [plan];
    for (let i = 1; i <= 210; i++) {
      const r = titel('e101', `Titel ${String(i)} (fiktiv)`)(plan);
      const c = pushStep(h, schritt(r));
      expect(c.seq).toBe(i);
      if (i === 201) expect(c.truncatedSeqs).toEqual([1]);
      if (i === 202) expect(c.truncatedSeqs).toEqual([2]);
      if (i <= 200) expect(c.truncatedSeqs).toEqual([]);
      expect(c.discardedSeqs).toEqual([]);
      h = c.history;
      plan = r.plan;
      plaene.push(plan);
    }
    expect(HISTORY_LIMIT).toBe(200);
    expect(h.steps).toHaveLength(200);
    expect(h.cursor).toBe(200);
    expect(h.nextSeq).toBe(211);
    expect(h.truncatedThroughSeq).toBe(10);
    expect(h.steps.map((s) => s.seq)).toEqual(Array.from({ length: 200 }, (_, i) => i + 11));

    for (let i = 0; i < 200; i++) {
      const u = vorhanden(undo(plan, h), `Undo ${String(i + 1)}`);
      plan = u.plan;
      h = u.history;
    }
    gleich(plan, plaene[10], 'Plan nach 200 × Undo = Plan nach Änderung 10');
    expect(h.cursor).toBe(0);
    expect(undo(plan, h)).toBeNull();

    for (let i = 0; i < 200; i++) {
      const w = vorhanden(redo(plan, h), `Redo ${String(i + 1)}`);
      plan = w.plan;
      h = w.history;
    }
    gleich(plan, plaene[210], 'Plan nach 200 × Redo = Plan nach Änderung 210');
    expect(redo(plan, h)).toBeNull();
  });

  it('[R-5.6-15] seq beginnt bei 1; neuer Schritt nach 2 × Undo verwirft den Redo-Zweig [2, 3] und erhält seq 4', () => {
    const p0 = planA();
    const [r1, r2, r3, r4] = [motto('M1'), motto('M2'), motto('M3'), motto('M4')];
    const c1 = pushStep(EMPTY_HISTORY, schritt(r1(p0)));
    expect(c1.seq).toBe(1);
    expect(EMPTY_HISTORY).toEqual({ steps: [], cursor: 0, nextSeq: 1, truncatedThroughSeq: 0 });
    const p1 = r1(p0).plan;
    const c2 = pushStep(c1.history, schritt(r2(p1)));
    const p2 = r2(p1).plan;
    const c3 = pushStep(c2.history, schritt(r3(p2)));
    const p3 = r3(p2).plan;
    expect([c2.seq, c3.seq]).toEqual([2, 3]);

    const u1 = vorhanden(undo(p3, c3.history));
    gleich(u1.plan, p2);
    expect(u1.step.seq).toBe(3);
    const u2 = vorhanden(undo(u1.plan, u1.history));
    gleich(u2.plan, p1);
    expect(u2.step.seq).toBe(2);
    expect(u2.history.cursor).toBe(1);
    expect(u2.history.steps.map((s) => s.seq)).toEqual([1, 2, 3]);

    const vorher = structuredClone(u2.history);
    const c4 = pushStep(u2.history, schritt(r4(u2.plan)));
    expect(c4.seq).toBe(4);
    expect(c4.discardedSeqs).toEqual([2, 3]);
    expect(c4.truncatedSeqs).toEqual([]);
    expect(c4.history.steps.map((s) => s.seq)).toEqual([1, 4]);
    expect(c4.history.cursor).toBe(2);
    expect(c4.history.nextSeq).toBe(5);
    expect(c4.history.truncatedThroughSeq).toBe(0);
    expect(c4.history.steps[1]?.label).toBe(r4(u2.plan).label);
    expect(c4.history.steps[1]?.at).toBe(AT);
    expect(u2.history, 'pushStep verändert seine Eingabe nicht').toEqual(vorher);
    expect(redo(u2.plan, c4.history), 'nach dem Verwerfen kein Redo').toBeNull();
  });

  it('[R-5.6-15] nextSeq steigt streng, keine seq doppelt, auch nach Kürzen und Verwerfen', () => {
    let h: HistoryState = EMPTY_HISTORY;
    const vergeben: number[] = [];
    let mitVerwerfen = 0;
    // 260 Durchläufe, davon 37 mit Rücksprung: Jeder Rücksprung verwirft einen Schritt, die Liste erreicht also
    // 223 Schritte und wird gekürzt (B2 kürzt erst über 200; TR-E104-01).
    for (let i = 0; i < 260; i++) {
      // Jeder 7. Schritt nach einem Rücksprung (cursor − 1), damit Verwerfen und Kürzen zusammen vorkommen.
      if (i % 7 === 6 && h.cursor > 0) h = { ...h, cursor: h.cursor - 1 };
      const davor = h.nextSeq;
      const c = pushStep(h, leer(0));
      if (c.discardedSeqs.length > 0) mitVerwerfen += 1;
      expect(c.seq).toBe(davor);
      expect(c.history.nextSeq).toBe(davor + 1);
      expect(c.history.steps.at(-1)?.seq).toBe(davor);
      expect(c.history.steps.length).toBeLessThanOrEqual(HISTORY_LIMIT);
      expect(c.history.cursor).toBe(c.history.steps.length);
      const seqs = c.history.steps.map((s) => s.seq);
      expect(seqs).toEqual([...seqs].sort((a, b) => a - b));
      expect(new Set(seqs).size).toBe(seqs.length);
      expect(c.history.truncatedThroughSeq).toBeGreaterThanOrEqual(h.truncatedThroughSeq);
      for (const t of c.truncatedSeqs) expect(t).toBeLessThanOrEqual(c.history.truncatedThroughSeq);
      vergeben.push(c.seq);
      h = c.history;
    }
    expect(new Set(vergeben).size).toBe(vergeben.length);
    expect(h.truncatedThroughSeq, 'gekürzt').toBeGreaterThan(0);
    expect(mitVerwerfen, 'verworfen (je Rücksprung einmal)').toBe(37);
  });

  it('[R-5.6-15] Tabelle isStepApplied: seq 0, gekürzt, angewendet, rückgängig gemacht, verworfen, unbekannt', () => {
    // Schritte 11, 12, 14 gespeichert; 13 verworfen; 1–10 gekürzt; Zeiger 2 → 14 ist rückgängig gemacht.
    const h: HistoryState = {
      steps: [leer(11), leer(12), leer(14)],
      cursor: 2,
      nextSeq: 15,
      truncatedThroughSeq: 10,
    };
    const faelle: [number, boolean, string][] = [
      [0, true, 'seq 0 (ungekoppelt)'],
      [1, true, 'gekürzt'],
      [10, true, 'gekürzt (Grenze)'],
      [11, true, 'angewendet'],
      [12, true, 'angewendet (letzter)'],
      [13, false, 'verworfen'],
      [14, false, 'rückgängig gemacht'],
      [15, false, 'unbekannt (nextSeq)'],
      [99, false, 'unbekannt'],
    ];
    for (const [seq, soll, was] of faelle) expect(isStepApplied(h, seq), was).toBe(soll);
    expect(isStepApplied(EMPTY_HISTORY, 0)).toBe(true);
    expect(isStepApplied(EMPTY_HISTORY, 1)).toBe(false);
  });

  it('[R-5.6-15] Tabelle isRecordVisible: Kopplung und Ausblendung nach AR0-45', () => {
    const h: HistoryState = {
      steps: [leer(11), leer(12), leer(14)],
      cursor: 2,
      nextSeq: 15,
      truncatedThroughSeq: 10,
    };
    const faelle: [number, number | null, boolean, string][] = [
      [0, null, true, 'seq 0, nicht ausgeblendet'],
      [11, null, true, 'angewendet, nicht ausgeblendet'],
      [14, null, false, 'Schritt rückgängig gemacht'],
      [13, null, false, 'Schritt verworfen'],
      [5, null, true, 'Schritt gekürzt'],
      [11, 12, false, 'ausgeblendet durch angewendeten Schritt'],
      [11, 14, true, 'ausblendender Schritt rückgängig gemacht'],
      [0, 13, true, 'ausblendender Schritt verworfen'],
      [0, 9, false, 'ausblendender Schritt gekürzt (endgültig ausgeblendet)'],
      [14, 12, false, 'beides: nicht angewendet und ausgeblendet'],
    ];
    for (const [seq, hiddenBySeq, soll, was] of faelle) {
      expect(isRecordVisible(h, { seq, hiddenBySeq }), was).toBe(soll);
    }
  });

  it('[R-5.6-15] cutHistory (B6): Redo-Zweig verworfen, angewendete Schritte gekürzt, nextSeq bleibt', () => {
    const h: HistoryState = {
      steps: [leer(11), leer(12), leer(14)],
      cursor: 2,
      nextSeq: 15,
      truncatedThroughSeq: 10,
    };
    const vorher = structuredClone(h);
    const c = cutHistory(h);
    expect(c.discardedSeqs).toEqual([14]);
    expect(c.truncatedSeqs).toEqual([11, 12]);
    expect(c.history).toEqual({ steps: [], cursor: 0, nextSeq: 15, truncatedThroughSeq: 12 });
    expect(h, 'cutHistory verändert seine Eingabe nicht').toEqual(vorher);

    const ohneAngewendete = cutHistory({
      steps: [leer(11)],
      cursor: 0,
      nextSeq: 12,
      truncatedThroughSeq: 10,
    });
    expect(ohneAngewendete.discardedSeqs).toEqual([11]);
    expect(ohneAngewendete.truncatedSeqs).toEqual([]);
    expect(ohneAngewendete.history).toEqual({
      steps: [],
      cursor: 0,
      nextSeq: 12,
      truncatedThroughSeq: 10,
    });
    expect(cutHistory(EMPTY_HISTORY).history).toEqual(EMPTY_HISTORY);
  });

  it('[R-5.6-15] undo und redo (B4): null an den Rändern, Eingaben unverändert, Schritt im Ergebnis', () => {
    const p0 = planA();
    const r = titel('e101', 'Neu (fiktiv)')(p0);
    expect(undo(p0, EMPTY_HISTORY)).toBeNull();
    expect(redo(p0, EMPTY_HISTORY)).toBeNull();
    const c = pushStep(EMPTY_HISTORY, schritt(r));
    expect(redo(r.plan, c.history)).toBeNull();
    const hVorher = structuredClone(c.history);
    const u = vorhanden(undo(r.plan, c.history));
    gleich(u.plan, p0);
    expect(u.history.cursor).toBe(0);
    expect(u.history.nextSeq).toBe(2);
    expect(u.step.seq).toBe(1);
    expect(u.step.label).toBe(r.label);
    expect(c.history).toEqual(hVorher);
    const w = vorhanden(redo(u.plan, u.history));
    gleich(w.plan, r.plan);
    expect(w.history.cursor).toBe(1);
    expect(w.step.seq).toBe(1);
  });
});
