// Testhilfen für Teilaufgaben eines Blocks (Paket E1-02h, Vertrag docs/wap-planer/plan/vertraege/E1-02h.md
// Abschnitt 1, 4a, 8; Gate S A1; R-4.6-63 bis R-4.6-66). Fiktive Builder als Literale (ohne Produktcode) und
// fast-check-Arbitraries für Folgen von Teilaufgaben-Befehlen mit festem Startwert (ADR-010 §5).
// E1-02i darf diese Datei nach dem Freeze importieren (nicht ändern). Alle Inhalte sind fiktiv; Titel aus dem
// Gate-S-Wortlaut («Fsg Mat», «Fsg Fz», «Fahrer Rep anschl Vs Ukft»), Ltg als Funktionskürzel oder Pseudonym.
import fc from 'fast-check';
import type { CommandResult } from '../../../../src/model/wap/commands/command';
import {
  addSubtask,
  moveSubtask,
  removeSubtask,
  type SubtaskChanges,
  updateSubtask,
} from '../../../../src/model/wap/commands/subtasks';
import type { Block, Entry, Id, Plan, RichText, Subtask } from '../../../../src/model/wap/types';
import { ctx } from '../commands/helpers';
import { basePlan, block, rapport, rt, withEntries } from './builders';

/** Fester Startwert der Eigenschaftstests zu Teilaufgaben. */
export const TEILAUFGABEN_SEED = 20261006;

/** Läufe je Eigenschaft (begrenzt, ADR-010 §4.5 Punkt 2). */
export const TEILAUFGABEN_RUNS = 120;

/** Teilaufgabe als Literal; Titel als Text (normal) oder als Rich Text; Ltg und Ort '' = leer (K-2). */
export function teilaufgabe(title: string | RichText, ltg = '', ort = ''): Subtask {
  return { title: typeof title === 'string' ? rt(title) : title, ltg, ort };
}

/** «Fsg Fz»: Titel aus Fett- und Normallauf, mit Ltg und Ort. */
export function fsgFz(): Subtask {
  return {
    title: [
      { text: 'Fsg', bold: true },
      { text: ' Fz', bold: false },
    ],
    ltg: 'Zfhr',
    ort: 'Halle 3',
  };
}

/** «Fahrer Rep anschl Vs Ukft»: ohne Ltg und ohne Ort (Q-045 (g)). */
export function fahrerRep(): Subtask {
  return teilaufgabe('Fahrer Rep anschl Vs Ukft');
}

/** Zwei Teilaufgaben wie im Gate-S-Beispiel: eine mit Ltg und Ort, eine ohne. */
export function zweiTeilaufgaben(): Subtask[] {
  return [fsgFz(), fahrerRep()];
}

/** Block «Fsg Mat» (fett) mit Teilaufgaben; Standard: die zwei Teilaufgaben aus `zweiTeilaufgaben`. */
export function blockMitTeilaufgaben(
  id: Id,
  seq: number,
  subtasks: readonly Subtask[] = zweiTeilaufgaben(),
  over: Partial<Block> = {},
): Block {
  return block(id, seq, { title: rt('Fsg Mat', true), ltg: 'Kp Kdt', ...over, subtasks });
}

/** Eintrag mit einem beliebigen Wert in einem Feld (zur Laufzeit trotz Typ, z.B. `subtasks` an einem Beso). */
export function mitFeld<T extends Entry>(e: T, key: string, value: unknown): T {
  return { ...e, [key]: value } as T;
}

/** Schlüssel einer Teilaufgabe, sortiert (Schreibregel K-2: genau title, ltg, ort). */
export function schluessel(s: object): readonly string[] {
  return Object.keys(s).sort();
}

/** Teilaufgaben eines Blocks im Plan; `undefined`, wenn das Feld fehlt oder der Eintrag kein Block ist. */
export function teilaufgabenVon(plan: Plan, id: Id): readonly Subtask[] | undefined {
  const e = plan.entries[id];
  return e?.type === 'block' ? e.subtasks : undefined;
}

/** true, wenn der Eintrag die eigene Eigenschaft `subtasks` hat (auch mit Wert undefined). */
export function hatTeilaufgabenFeld(plan: Plan, id: Id): boolean {
  const e = plan.entries[id];
  return e !== undefined && Object.hasOwn(e, 'subtasks');
}

// ---------------------------------------------------------------------------------------------------------
// Fiktiver Plan und Folgen von Teilaufgaben-Befehlen (Vertrag Abschnitt 4a; R-4.6-63 Nr 8, R-4.6-66 Nr 6)
// ---------------------------------------------------------------------------------------------------------

/** Blöcke des Plans für die Eigenschaftstests. */
export const FOLGE_BLOECKE: readonly Id[] = ['e1', 'e2', 'e3'];

/**
 * Fiktiver Plan: e1 Mo ohne Teilaufgaben, e2 Di mit zwei Teilaufgaben, e3 Mi 2200–0100 (über Mitternacht)
 * mit einer Teilaufgabe, dazu ein Rapport e4.
 */
export function teilaufgabenPlan(): Plan {
  return withEntries(basePlan({ nextSeq: 50 }), [
    block('e1', 1, { date: '2026-09-28', title: rt('Fsg Mat', true), ltg: 'Kp Kdt' }),
    blockMitTeilaufgaben('e2', 2, zweiTeilaufgaben(), { date: '2026-09-29' }),
    blockMitTeilaufgaben('e3', 3, [teilaufgabe('Wache Ablösung', 'Hptm Muster A', 'Tor Nord')], {
      date: '2026-09-30',
      time: { form: 'range', from: 1320, to: 1500 },
      columns: { kind: 'ids', ids: ['c17'] },
    }),
    rapport('e4', 4, { date: '2026-09-29' }),
  ]);
}

/** Titel einer Teilaufgabe: 1–4 fiktive Wörter, als ein oder zwei Läufe (fett/normal), nie leer. */
export const teilaufgabenTitel: fc.Arbitrary<RichText> = fc
  .tuple(
    fc.array(
      fc.constantFrom('Fsg', 'Fz', 'Mat', 'Rep', 'Ukft', 'Vs', 'anschl', 'Fahrer', 'Zug 1'),
      {
        minLength: 1,
        maxLength: 4,
      },
    ),
    fc.boolean(),
    fc.boolean(),
  )
  .map(([woerter, fettZuerst, geteilt]): RichText => {
    const [erstes, ...rest] = woerter;
    if (!geteilt || rest.length === 0) return [{ text: woerter.join(' '), bold: fettZuerst }];
    return [
      { text: erstes ?? 'Fsg', bold: fettZuerst },
      { text: ` ${rest.join(' ')}`, bold: !fettZuerst },
    ];
  });

export const teilaufgabenLtg: fc.Arbitrary<string> = fc.constantFrom(
  '',
  'Zfhr',
  'Kp Kdt',
  'Hptm Muster A',
);
export const teilaufgabenOrt: fc.Arbitrary<string> = fc.constantFrom('', 'Halle 3', 'Rayon Nord');

/** Gültige Teilaufgabe (Titel nicht leer). */
export const teilaufgabeArb: fc.Arbitrary<Subtask> = fc.record({
  title: teilaufgabenTitel,
  ltg: teilaufgabenLtg,
  ort: teilaufgabenOrt,
});

/** Aktion auf den Teilaufgaben eines Blocks; Stellen werden beim Ausführen modulo Anzahl genommen. */
export type TeilaufgabenAktion =
  | {
      readonly k: 'add';
      readonly block: number;
      readonly teilaufgabe: Subtask;
      readonly stelle: number | null;
    }
  | {
      readonly k: 'update';
      readonly block: number;
      readonly stelle: number;
      readonly changes: SubtaskChanges;
    }
  | { readonly k: 'move'; readonly block: number; readonly von: number; readonly nach: number }
  | { readonly k: 'remove'; readonly block: number; readonly stelle: number };

const blockNr = fc.integer({ min: 0, max: FOLGE_BLOECKE.length - 1 });
const stelle = fc.nat({ max: 20 });

const aenderung: fc.Arbitrary<SubtaskChanges> = fc.oneof(
  teilaufgabenTitel.map((title): SubtaskChanges => ({ title })),
  teilaufgabenLtg.map((ltg): SubtaskChanges => ({ ltg })),
  teilaufgabenOrt.map((ort): SubtaskChanges => ({ ort })),
  teilaufgabeArb.map((s): SubtaskChanges => ({ ...s })),
);

/** Jede Aktion der vier Befehle aus Abschnitt 4a. */
export const teilaufgabenAktion: fc.Arbitrary<TeilaufgabenAktion> = fc.oneof(
  fc.record({
    k: fc.constant('add' as const),
    block: blockNr,
    teilaufgabe: teilaufgabeArb,
    stelle: fc.option(stelle, { nil: null }),
  }),
  fc.record({ k: fc.constant('update' as const), block: blockNr, stelle, changes: aenderung }),
  fc.record({ k: fc.constant('move' as const), block: blockNr, von: stelle, nach: stelle }),
  fc.record({ k: fc.constant('remove' as const), block: blockNr, stelle }),
);

export interface TeilaufgabenSchritt {
  readonly vorher: Plan;
  readonly blockId: Id;
  readonly result: CommandResult;
}

/**
 * Führt eine Aktion aus. Stellen modulo Anzahl (n = 0: jede Aktion wird zu «hinzufügen am Ende»), damit nur
 * gültige Indizes vorkommen; der Titel einer Aktion ist nie leer. Fehler des Befehls werden nicht abgefangen.
 */
export function teilaufgabenSchritt(plan: Plan, a: TeilaufgabenAktion): TeilaufgabenSchritt {
  const blockId = FOLGE_BLOECKE[a.block % FOLGE_BLOECKE.length] ?? 'e1';
  const n = teilaufgabenVon(plan, blockId)?.length ?? 0;
  const neu: Subtask = a.k === 'add' ? a.teilaufgabe : teilaufgabe('Fsg Fz', 'Zfhr', '');
  let result: CommandResult;
  if (a.k === 'add' || n === 0) {
    const index = a.k === 'add' && a.stelle !== null ? a.stelle % (n + 1) : undefined;
    result =
      index === undefined
        ? addSubtask(plan, blockId, neu, ctx)
        : addSubtask(plan, blockId, neu, ctx, index);
  } else if (a.k === 'update') {
    result = updateSubtask(plan, blockId, a.stelle % n, a.changes, ctx);
  } else if (a.k === 'move') {
    result = moveSubtask(plan, blockId, a.von % n, a.nach % n, ctx);
  } else {
    result = removeSubtask(plan, blockId, a.stelle % n, ctx);
  }
  return { vorher: plan, blockId, result };
}
