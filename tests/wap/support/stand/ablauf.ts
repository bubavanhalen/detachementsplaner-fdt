// Abläufe für die Tests von Paket E1-05 (Vertrag docs/wap-planer/plan/vertraege/E1-05.md, Notiz «Ausarbeitung
// Schritt 2» Abschnitte C, G, H): Prüf-Plan P mit fiktivem Inhalt in jeder Woche, Double mit P, Aufruf von
// setNewStand mit Kontext und Uhr, Aufzeichnungen mit vorgegebenen Feldern, gewöhnliche Änderungen über das
// Double. Keine E1-05-Logik. Alle Inhalte sind fiktiv.

import {
  type SetNewStandOptions,
  type SetNewStandResult,
  type StandRecord,
  setNewStand,
} from '../../../../src/io/wap-plan/standStore';
import { type CommandResult, command } from '../../../../src/model/wap/commands/command';
import { updateEntry } from '../../../../src/model/wap/commands/entries';
import type { StandInput } from '../../../../src/model/wap/stand/stand';
import type { Id, IsoDate, Plan } from '../../../../src/model/wap/types';
import { StandStoreDouble } from './double';
import {
  bemerkung,
  beso,
  block,
  clock,
  ctx,
  DATUM,
  mitEintraegen,
  PLAN_ID,
  pruefPlan,
  querbalken,
  rapport,
  tagesBemerkung,
} from './plan';
import type { PruefRenderer } from './renderer';

/** P mit fiktivem Inhalt in jeder Woche (Block, Beso, Querbalken über die Wochengrenze, Rapport, Bemerkungen). */
export function planMitInhalt(): Plan {
  const p = pruefPlan();
  return mitEintraegen(p, [
    block(p, 'e101', DATUM, 'Ausbildung KVK (fiktiv)'),
    beso(p, 'e102', DATUM, 'Besprechung Muster (fiktiv)', 40),
    block(p, 'e111', '2026-09-22', 'Schiessen Wo1 (fiktiv)'),
    rapport(p, 'e121', '2026-09-29', 'KR'),
    tagesBemerkung('e131', '2026-10-06', 'Bemerkung Wo3 (fiktiv)'),
    querbalken('e141', '2026-09-19', '2026-09-22', 'Verlegung (fiktiv)'),
    bemerkung('e151', { kind: 'plan' }, 'Planbemerkung (fiktiv)'),
  ]);
}

/** Double mit dem Plan unter PLAN_ID (Revision 0). */
export function neuerStore(plan: Plan = planMitInhalt()): StandStoreDouble {
  return new StandStoreDouble(PLAN_ID, plan);
}

/** setNewStand mit Kontext, fester Uhr und optional signal/onWriting (C1). */
export function setzen(
  store: StandStoreDouble,
  render: PruefRenderer,
  input: StandInput = { date: DATUM },
  opts: Omit<SetNewStandOptions, 'ctx'> = {},
): Promise<SetNewStandResult> {
  return setNewStand(store, PLAN_ID, input, render, clock, { ctx, ...opts });
}

/** Befehl «Titel des Blocks ändern» (E1-03 updateEntry) für store.aendern. */
export function titelAendern(id: Id, text: string): (plan: Plan) => CommandResult {
  return (plan) => updateEntry(plan, id, 'block', { title: [{ text, bold: false }] }, ctx);
}

/** Befehl «Rapport-Kürzel ändern». */
export function kuerzelAendern(id: Id, code: string): (plan: Plan) => CommandResult {
  return (plan) => updateEntry(plan, id, 'rapport', { code }, ctx);
}

/** Befehl «Text einer Tagesbemerkung ändern». */
export function bemerkungAendern(id: Id, text: string): (plan: Plan) => CommandResult {
  return (plan) => updateEntry(plan, id, 'dayRemark', { text }, ctx);
}

/** Befehl «Status setzen» (z.B. gestrichen). */
export function statusSetzen(
  id: Id,
  status: 'confirmed' | 'cancelled',
): (plan: Plan) => CommandResult {
  return (plan) => updateEntry(plan, id, 'block', { status }, ctx);
}

/** Gewöhnliche Änderung ohne Eintrag (Motto), als Schritt im Double. */
export function mottoAendern(text: string): (plan: Plan) => CommandResult {
  return (plan) =>
    command(
      plan,
      `Motto «${text}»`,
      (d) => {
        d.motto = text;
      },
      ctx,
    );
}

/** n gewöhnliche Schritte im Double; liefert ihre seq in Reihenfolge. */
export function schritte(store: StandStoreDouble, n: number): number[] {
  return Array.from(
    { length: n },
    (_, i) => store.aendern(PLAN_ID, mottoAendern(`M${String(i + 1)}`)).seq,
  );
}

/** Bytes, die sich je Aufzeichnung und Schlüssel unterscheiden (für abgelegte Aufzeichnungen). */
export function bytesFuer(recordId: string, schluessel: string): Uint8Array {
  // Uint8Array.from: Uint8Array des Test-Realms (TextEncoder liefert unter jsdom ein fremdes Realm, TR-E105-01).
  return Uint8Array.from(new TextEncoder().encode(`${recordId}/${schluessel}`));
}

/** Aufzeichnung mit vorgegebenen Feldern; Plan = P mit dem Stand der Aufzeichnung; pdfs für alle Ziele. */
export function aufzeichnung(
  over: Partial<StandRecord> & {
    readonly recordId: string;
    readonly standId: string;
    readonly seq: number;
    readonly date?: IsoDate;
    readonly version?: number;
    readonly ohne?: readonly string[];
  },
): StandRecord {
  const date = over.date ?? DATUM;
  const version = over.version ?? 1;
  const p = { ...pruefPlan(), stand: { date, version } };
  const schluessel = [...p.weeks.map((w) => w.id), 'plan'].filter(
    (k) => !(over.ohne ?? []).includes(k),
  );
  const { ohne: _ohne, ...rest } = over;
  return {
    planId: PLAN_ID,
    plan: p,
    pdfs: new Map(schluessel.map((k) => [k, bytesFuer(over.recordId, k)])),
    hiddenBySeq: null,
    standsSameDay: 1,
    ...rest,
    date,
    version,
  };
}

/** Ergebnis von `p` oder 'zeitlimit' nach `ms` (damit ein hängender Ablauf als Assertion scheitert). */
export async function mitZeitlimit<T>(p: Promise<T>, ms = 2000): Promise<T | 'zeitlimit'> {
  let id: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<'zeitlimit'>((r) => {
    id = setTimeout(() => r('zeitlimit'), ms);
  });
  try {
    return await Promise.race([p, limit]);
  } finally {
    if (id !== undefined) clearTimeout(id);
  }
}
