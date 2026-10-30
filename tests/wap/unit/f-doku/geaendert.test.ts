// @vitest-environment node
// F-DOKU, Befund SA-2-01 (spec-auditor-2): Beleg für R-4.6-67 unter der eigenen ID. Kriterium (requirements.md,
// Änderungsnotiz I2, Q-026): Nach dem ersten Stand setzt jede Bearbeitung eines Beso die Markierung «geändert»
// (`changed`), sie bleibt bis zum nächsten Stand. Je ein Fall Titel, Zeit, Zeitfenster, Status, Ort und Nummer («Tag
// neu nummerieren»); Befehl ohne Wertänderung oder an einem anderen Eintrag → unverändert; ohne Stand → false; Undo →
// alter Wert; neuer Stand → false; Blöcke nie automatisch; neu angelegter Beso nicht markiert (F-65 (f)).
// Nur über die öffentlichen Befehle; nur fiktive Daten.
import { applyPatches } from 'immer';
import { describe, expect, it } from 'vitest';
import {
  addTimeWindow,
  removeTimeWindow,
  renumberDay,
  updateTimeWindow,
} from '../../../../src/model/wap/commands/beso';
import type { CommandResult } from '../../../../src/model/wap/commands/command';
import { updateEntry } from '../../../../src/model/wap/commands/entries';
import { applyStand } from '../../../../src/model/wap/stand/stand';
import type { Beso, Id, Plan } from '../../../../src/model/wap/types';
import { add, besos, block, CTX, entry, kpPlan, MO } from '../../support/i5/plan';

interface Ausgang {
  readonly plan: Plan;
  /** Beso 0700 und 0730 (fiktiv «Visite 1», «Visite 2»). */
  readonly a: Id;
  readonly b: Id;
  readonly blockId: Id;
}

/** Plan mit zwei Beso und einem Block, danach Stand vom 20.09.2026. */
function mitStand(): Ausgang {
  const r = besos(kpPlan(1), 2);
  const bl = block(r.plan, 'Wache Ost');
  const plan = applyStand(bl.plan, { date: '2026-09-20' }, CTX).plan;
  return { plan, a: r.ids[0] as Id, b: r.ids[1] as Id, blockId: bl.id };
}

function beso(plan: Plan, id: Id): Beso {
  const e = entry(plan, id);
  if (e.type !== 'beso') throw new Error('kein Beso');
  return e;
}

function rueckgaengig(r: CommandResult): Plan {
  return applyPatches(r.plan, r.inversePatches as Parameters<typeof applyPatches>[1]);
}

function fenster(plan: Plan, id: Id): Id {
  const w = beso(plan, id).windows[0];
  if (w === undefined) throw new Error('kein Zeitfenster');
  return w.id;
}

describe('F-DOKU: Markierung «geändert» nach dem Stand (R-4.6-67, Q-026)', () => {
  it('[R-4.6-67] Ausgang: nach dem Stand sind beide Beso und der Block unmarkiert', () => {
    const { plan, a, b, blockId } = mitStand();
    expect(plan.stand).not.toBeNull();
    expect(beso(plan, a).changed).toBe(false);
    expect(beso(plan, b).changed).toBe(false);
    expect(entry(plan, blockId).changed).toBe(false);
  });

  it('[R-4.6-67] Titel geändert → changed true, der andere Beso bleibt false', () => {
    const { plan, a, b } = mitStand();
    const r = updateEntry(plan, a, 'beso', { title: [{ text: 'Visite neu', bold: false }] }, CTX);
    expect(beso(r.plan, a).changed).toBe(true);
    expect(beso(r.plan, b).changed).toBe(false);
  });

  it('[R-4.6-67] Zeit eines Zeitfensters geändert → changed true', () => {
    const { plan, a, b } = mitStand();
    const r = updateTimeWindow(
      plan,
      a,
      fenster(plan, a),
      { time: { form: 'point', at: 1000 } },
      CTX,
    );
    expect(beso(r.plan, a).windows[0]?.time).toEqual({ form: 'point', at: 1000 });
    expect(beso(r.plan, a).changed).toBe(true);
    expect(beso(r.plan, b).changed).toBe(false);
  });

  it('[R-4.6-67] Zeitfenster hinzugefügt bzw. wieder entfernt → changed true', () => {
    const { plan, a } = mitStand();
    const dazu = addTimeWindow(plan, a, { time: { form: 'point', at: 1100 } }, CTX);
    expect(beso(dazu.plan, a).windows).toHaveLength(2);
    expect(beso(dazu.plan, a).changed).toBe(true);
    // Entfernen an einem zweiten Beso, dem vorher ein Fenster ohne Stand-Wechsel hinzugefügt wurde: neuer Stand
    // dazwischen, damit nur das Entfernen die Markierung setzt.
    const neuerStand = applyStand(dazu.plan, { date: '2026-09-21' }, CTX).plan;
    expect(beso(neuerStand, a).changed).toBe(false);
    const zweites = beso(neuerStand, a).windows[1]?.id ?? '';
    const weg = removeTimeWindow(neuerStand, a, zweites, CTX);
    expect(beso(weg.plan, a).windows).toHaveLength(1);
    expect(beso(weg.plan, a).changed).toBe(true);
  });

  it('[R-4.6-67] Status geändert → changed true', () => {
    const { plan, a } = mitStand();
    expect(beso(plan, a).status).not.toBe('open');
    const r = updateEntry(plan, a, 'beso', { status: 'open' }, CTX);
    expect(beso(r.plan, a).status).toBe('open');
    expect(beso(r.plan, a).changed).toBe(true);
  });

  it('[R-4.6-67] Ort geändert → changed true', () => {
    const { plan, a } = mitStand();
    const r = updateEntry(plan, a, 'beso', { ort: 'Halle Nord' }, CTX);
    expect(beso(r.plan, a).ort).toBe('Halle Nord');
    expect(beso(r.plan, a).changed).toBe(true);
  });

  it('[R-4.6-67] Nummer durch «Tag neu nummerieren» geändert → changed true am Beso, dessen einzige Änderung die Nummer ist', () => {
    const { plan, a, b } = mitStand();
    const na = beso(plan, a).besoNumber;
    const nb = beso(plan, b).besoNumber;
    expect(na).not.toBeNull();
    expect(nb).not.toBeNull();
    expect(na).not.toBe(nb);
    // b vor a schieben (b ist damit selbst geändert), neuer Stand, dann neu nummerieren: a ändert nur die Nummer.
    const vorne = updateTimeWindow(
      plan,
      b,
      fenster(plan, b),
      { time: { form: 'point', at: 360 } },
      CTX,
    ).plan;
    const stand2 = applyStand(vorne, { date: '2026-09-21' }, CTX).plan;
    expect(beso(stand2, a).changed).toBe(false);
    expect(beso(stand2, b).changed).toBe(false);
    const r = renumberDay(stand2, MO, CTX);
    const nachher = beso(r.plan, a);
    expect(nachher.besoNumber).not.toBe(na);
    expect(nachher.title).toEqual(beso(stand2, a).title);
    expect(nachher.windows).toEqual(beso(stand2, a).windows);
    expect(nachher.changed).toBe(true);
  });

  it('[R-4.6-67] Befehl ohne Wertänderung → changed bleibt false', () => {
    const { plan, a } = mitStand();
    const vorher = beso(plan, a);
    const r = updateEntry(plan, a, 'beso', { ort: vorher.ort, status: vorher.status }, CTX);
    expect(beso(r.plan, a).changed).toBe(false);
  });

  it('[R-4.6-67] ohne Stand bleibt die Markierung false', () => {
    const r0 = besos(kpPlan(1), 1);
    const id = r0.ids[0] as Id;
    expect(r0.plan.stand).toBeNull();
    const r = updateEntry(r0.plan, id, 'beso', { ort: 'Halle Nord' }, CTX);
    expect(beso(r.plan, id).ort).toBe('Halle Nord');
    expect(beso(r.plan, id).changed).toBe(false);
  });

  it('[R-4.6-67] Undo nimmt Wert und Markierung zurück', () => {
    const { plan, a } = mitStand();
    const r = updateEntry(plan, a, 'beso', { ort: 'Halle Nord' }, CTX);
    expect(beso(r.plan, a).changed).toBe(true);
    const undo = rueckgaengig(r);
    expect(beso(undo, a).changed).toBe(false);
    expect(beso(undo, a).ort).toBe(beso(plan, a).ort);
  });

  it('[R-4.6-67] die Markierung bleibt über weitere Änderungen bis zum nächsten Stand; der neue Stand setzt sie zurück', () => {
    const { plan, a } = mitStand();
    const r1 = updateEntry(plan, a, 'beso', { ort: 'Halle Nord' }, CTX).plan;
    const r2 = updateEntry(
      r1,
      a,
      'beso',
      { title: [{ text: 'Visite neu', bold: false }] },
      CTX,
    ).plan;
    expect(beso(r2, a).changed).toBe(true);
    const stand = applyStand(r2, { date: '2026-10-01' }, CTX).plan;
    expect(beso(stand, a).changed).toBe(false);
    const wieder = updateEntry(stand, a, 'beso', { ort: 'Wiese' }, CTX).plan;
    expect(beso(wieder, a).changed).toBe(true);
  });

  it('[R-4.6-67] Blöcke werden nicht automatisch markiert; ein nach dem Stand neu angelegter Beso ebenfalls nicht', () => {
    const { plan, blockId } = mitStand();
    const r = updateEntry(plan, blockId, 'block', { ort: 'Halle Nord' }, CTX);
    const b = entry(r.plan, blockId);
    if (b.type !== 'block') throw new Error('kein Block');
    expect(b.ort).toBe('Halle Nord');
    expect(b.changed).toBe(false);
    const neu = add(plan, {
      type: 'beso',
      date: MO,
      title: [{ text: 'Nachzügler', bold: false }],
      windows: [{ time: { form: 'point', at: 1140 } }],
    });
    expect(beso(neu.plan, neu.id).changed).toBe(false);
  });
});
