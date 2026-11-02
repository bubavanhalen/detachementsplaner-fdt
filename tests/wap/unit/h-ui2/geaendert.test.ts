// @vitest-environment node
// H-UI2, Befund SA-H-09 (Katalog R-4.6-67 nach Q-026; Beschrieb 4.6 Status «bis zum nächsten Stand»; F-65 (f)): Nach
// dem ersten Stand setzt jede inhaltliche Änderung eines Beso die Markierung «geändert»; Befehle ohne Wertänderung oder
// an anderen Einträgen, Pläne ohne Stand, neu angelegte Beso und Blöcke bleiben unmarkiert; Rückgängig nimmt die
// Markierung mit zurück; der nächste Stand setzt sie zurück. Nur fiktive Daten.
import { applyPatches } from 'immer';
import { describe, expect, it } from 'vitest';
import {
  addTimeWindow,
  renumberDay,
  updateTimeWindow,
} from '../../../../src/model/wap/commands/beso';
import { updateEntry } from '../../../../src/model/wap/commands/entries';
import { applyStand } from '../../../../src/model/wap/stand/stand';
import type { Beso, Id, Plan } from '../../../../src/model/wap/types';
import { add, besos, block, CTX, entry, kpPlan, MO } from '../../support/i5/plan';

function mitStand(): { plan: Plan; a: Id; b: Id; blockId: Id } {
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

describe('H-UI2 SA-H-09: Markierung «geändert» nach dem Stand (R-4.6-67, Q-026)', () => {
  it('[R-4.6-33] Titel, Zeit, Zeitfenster, Status, Ort und Nummer eines Beso geändert → changed true', () => {
    const { plan, a } = mitStand();
    expect(beso(plan, a).changed).toBe(false);
    const titel = updateEntry(plan, a, 'beso', { title: [{ text: 'Neu', bold: false }] }, CTX);
    expect(beso(titel.plan, a).changed).toBe(true);
    const status = updateEntry(plan, a, 'beso', { status: 'open' }, CTX);
    expect(beso(status.plan, a).changed).toBe(true);
    const ort = updateEntry(plan, a, 'beso', { ort: 'Halle' }, CTX);
    expect(beso(ort.plan, a).changed).toBe(true);
    const w = beso(plan, a).windows[0]?.id ?? '';
    const zeit = updateTimeWindow(plan, a, w, { time: { form: 'point', at: 1000 } }, CTX);
    expect(beso(zeit.plan, a).changed).toBe(true);
    const fenster = addTimeWindow(plan, a, { time: { form: 'point', at: 1100 } }, CTX);
    expect(beso(fenster.plan, a).changed).toBe(true);
    // Nummer: «Tag neu nummerieren» nach dem Verschieben vor den anderen Beso.
    const vorne = updateTimeWindow(plan, a, w, { time: { form: 'point', at: 600 } }, CTX).plan;
    const b2 = beso(vorne, a);
    const nummer = renumberDay(vorne, MO, CTX);
    if (beso(nummer.plan, a).besoNumber !== b2.besoNumber)
      expect(beso(nummer.plan, a).changed).toBe(true);
  });

  it('[R-4.6-33] ohne Wertänderung, an einem anderen Eintrag, ohne Stand, neu angelegt oder Block → unverändert', () => {
    const { plan, a, b, blockId } = mitStand();
    const gleich = updateEntry(plan, a, 'beso', { ort: beso(plan, a).ort }, CTX);
    expect(beso(gleich.plan, a).changed).toBe(false);
    const anderer = updateEntry(plan, a, 'beso', { ort: 'Halle' }, CTX);
    expect(beso(anderer.plan, b).changed).toBe(false);
    const blockNeu = updateEntry(plan, blockId, 'block', { ort: 'Halle' }, CTX);
    expect(entry(blockNeu.plan, blockId).changed).toBe(false);
    const neu = add(plan, {
      type: 'beso',
      date: MO,
      title: [{ text: 'Nachzügler', bold: false }],
      windows: [{ time: { form: 'point', at: 1140 } }],
    });
    expect(beso(neu.plan, neu.id).changed).toBe(false);
    // Ohne Stand bleibt alles unmarkiert.
    const ohne = besos(kpPlan(1), 1);
    const id = ohne.ids[0] as Id;
    const r = updateEntry(ohne.plan, id, 'beso', { ort: 'Halle' }, CTX);
    expect(beso(r.plan, id).changed).toBe(false);
  });

  it('[R-4.6-33] Rückgängig nimmt die Markierung mit dem Wert zurück; der nächste Stand setzt sie zurück', () => {
    const { plan, a } = mitStand();
    const r = updateEntry(plan, a, 'beso', { ort: 'Halle' }, CTX);
    expect(beso(r.plan, a).changed).toBe(true);
    const undo = applyPatches(r.plan, r.inversePatches as Parameters<typeof applyPatches>[1]);
    expect(beso(undo, a).changed).toBe(false);
    expect(beso(undo, a).ort).toBe(beso(plan, a).ort);
    const stand = applyStand(r.plan, { date: '2026-10-01' }, CTX);
    expect(beso(stand.plan, a).changed).toBe(false);
    // Ein zweites Mal geändert nach dem neuen Stand: wieder markiert.
    const wieder = updateEntry(stand.plan, a, 'beso', { ort: 'Wiese' }, CTX);
    expect(beso(wieder.plan, a).changed).toBe(true);
  });
});
