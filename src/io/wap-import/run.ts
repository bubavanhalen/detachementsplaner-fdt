// Ablauf «Excel-WAP importieren» mit Speicher (Vertrag E1-08 §1 runImport; ADR-006 Punkt 2a; ADR-008 3a;
// R-5.6-05, R-8.2-22, R-8.2-24). Gleich gegliedert wie «Neuen Stand setzen» (E1-05):
// 0. gespeicherte Revision lesen; 1. lesen und importieren (rein); 2. Stand-PDF rendern («Abbrechen»
// wirksam); 3. atomar schreiben mit Wiederherstellungspunkt 'import', Historienschritt, Stand und Bericht.
// Modulgrenze (ADR-010 §4.4): der Import kennt den Speicher nur über den strukturellen Port `ImportStore`,
// den PlanStore (E1-04) erfüllt; die PDF-Erzeugung kommt über `StandRenderers` (Port E1-05).

import type { CommandContext, CommandResult } from '../../model/wap/commands/command';
import { WapError } from '../../model/wap/errors';
import { type PdfTarget, pdfFileName, standsSameDayFor } from '../../model/wap/stand/fileName';
import type { Id, IsoDate, Plan } from '../../model/wap/types';
import { readWorkbook, XlsxError } from '../xlsx-drawing/index';
import { type ImportOutcome, importKpWorkbook } from './assemble';
import { ImportError, type ImportOptions } from './types';

export interface ImportClock {
  now(): Date;
}

/** Renderer der Stand-Varianten (strukturgleich mit StandRenderers aus E1-05). */
export interface ImportRenderers {
  week(plan: Plan, weekId: Id, title: string): Promise<Uint8Array>;
  plan(plan: Plan, title: string): Promise<Uint8Array>;
}

interface StoredStand {
  readonly standId: string;
  readonly date: IsoDate;
  readonly version: number;
  readonly standsSameDay: number;
  readonly visible: boolean;
}

/** Port zum Speicher; PlanStore (E1-04) erfüllt ihn strukturell. */
export interface ImportStore {
  load(planId: Id): Promise<{ readonly plan: Plan; readonly revision: number } | null>;
  commitAtomic(
    planId: Id,
    write: {
      readonly expectedRevision: number;
      readonly result: CommandResult;
      readonly restorePoint: 'import';
      readonly standRecord?: {
        readonly recordId: string;
        readonly standId: string;
        readonly date: IsoDate;
        readonly version: number;
        readonly snapshot: Plan;
        readonly pdfs: ReadonlyMap<string, Uint8Array>;
        readonly standsSameDay: number;
      };
      readonly importReport: { readonly report: unknown };
    },
    clock: ImportClock,
  ): Promise<{ readonly savedAt: string; readonly revision: number; readonly seq: number }>;
  standRecords(planId: Id): Promise<readonly StoredStand[]>;
}

export interface ImportProgress {
  readonly step: 'read' | 'import' | 'render' | 'write';
  /** Bei 'render': erledigte und alle Varianten. */
  readonly done: number;
  readonly total: number;
}

export interface RunImportOptions {
  readonly ctx: CommandContext;
  readonly onProgress?: (p: ImportProgress) => void;
  readonly signal?: AbortSignal;
  /** Genau einmal unmittelbar vor dem Schreiben; danach ist «Abbrechen» wirkungslos (E1-16). */
  readonly onWriting?: () => void;
}

const XLSX_TO_IMPORT: Readonly<Record<string, ImportError['code']>> = {
  notXlsx: 'notXlsx',
  oldXlsFormat: 'oldXlsFormat',
  corrupt: 'corrupt',
  tooLarge: 'tooLarge',
  unsupported: 'unsupported',
  shapeIndexMismatch: 'corrupt',
  calibrationFailed: 'calibrationFailed',
};

/** Liest die Arbeitsmappe; Fehler des Lesemoduls werden ImportError (Vertrag E1-08 Hinweisnotiz Nr 11). */
export function readImportWorkbook(bytes: Uint8Array): ReturnType<typeof readWorkbook> {
  try {
    return readWorkbook(bytes);
  } catch (error) {
    if (error instanceof XlsxError)
      throw new ImportError(XLSX_TO_IMPORT[error.code] ?? 'corrupt', { cause: error });
    throw new ImportError('corrupt', { cause: error });
  }
}

/** Liest und importiert ohne Speicher (z.B. Vorprüfung vor dem Anlegen eines Plans). */
export function importBytes(
  target: Plan,
  bytes: Uint8Array,
  fileName: string,
  options: ImportOptions,
  ctx: CommandContext,
): ImportOutcome {
  return importKpWorkbook(target, readImportWorkbook(bytes), fileName, options, ctx);
}

function checkAbort(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new ImportError('aborted');
}

function titleOf(plan: Plan, target: PdfTarget, n: number): string {
  return pdfFileName(plan, target, n).replace(/\.pdf$/, '');
}

/** Wartet auf `p`; ein Abbruch beendet sofort, ein später fertiges Ergebnis wird verworfen (AR0-49). */
function raceAbort<T>(p: Promise<T>, signal: AbortSignal | undefined): Promise<T> {
  if (signal === undefined) return p;
  return new Promise<T>((resolve, reject) => {
    const onAbort = (): void => reject(new ImportError('aborted'));
    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener('abort', onAbort, { once: true });
    p.then(
      (v) => {
        signal.removeEventListener('abort', onAbort);
        resolve(v);
      },
      (e: unknown) => {
        signal.removeEventListener('abort', onAbort);
        reject(e);
      },
    );
  });
}

/**
 * Import mit Speicher, atomar (Vertrag E1-08 §1). Die Eingabe-Bytes werden nie verändert (R-8.2-22).
 * Fehler: ImportError ('aborted', 'standRenderFailed', 'planNotFound', Lesefehler) oder StorageError
 * 'conflict' (Plan während des Imports geändert, nichts geschrieben).
 */
export async function runImport(
  store: ImportStore,
  planId: Id,
  bytes: Uint8Array,
  fileName: string,
  options: ImportOptions,
  render: ImportRenderers,
  clock: ImportClock,
  run: RunImportOptions,
): Promise<
  ImportOutcome & { readonly savedAt: string; readonly revision: number; readonly seq: number }
> {
  const { signal, onProgress } = run;
  checkAbort(signal);
  onProgress?.({ step: 'read', done: 0, total: 1 });
  const loaded = await raceAbort(store.load(planId), signal);
  if (loaded === null) throw new ImportError('planNotFound');
  checkAbort(signal);
  const workbook = readImportWorkbook(bytes);
  onProgress?.({ step: 'import', done: 0, total: 1 });
  checkAbort(signal);
  const outcome = importKpWorkbook(loaded.plan, workbook, fileName, options, run.ctx);
  const planAfter = outcome.result.plan;
  let standRecord: Parameters<ImportStore['commitAtomic']>[1]['standRecord'];
  if (planAfter.stand !== null) {
    const stand = planAfter.stand;
    const records = await raceAbort(store.standRecords(planId), signal);
    const n = standsSameDayFor(
      records.filter((r) => r.visible),
      stand.date,
    );
    const targets: PdfTarget[] = [
      ...planAfter.weeks.map((w): PdfTarget => ({ kind: 'week', weekId: w.id })),
      { kind: 'plan' },
    ];
    const pdfs = new Map<string, Uint8Array>();
    for (const [i, target] of targets.entries()) {
      checkAbort(signal);
      onProgress?.({ step: 'render', done: i, total: targets.length });
      const title = titleOf(planAfter, target, n);
      let pdf: Uint8Array;
      try {
        pdf = await raceAbort(
          target.kind === 'week'
            ? render.week(planAfter, target.weekId, title)
            : render.plan(planAfter, title),
          signal,
        );
      } catch (cause) {
        if (cause instanceof ImportError) throw cause;
        throw new ImportError('standRenderFailed', { cause });
      }
      // Realmunabhängige Prüfung (Bytes aus einem anderen Fenster oder Worker sind ebenfalls Uint8Array).
      if (Object.prototype.toString.call(pdf) !== '[object Uint8Array]')
        throw new ImportError('standRenderFailed');
      pdfs.set(target.kind === 'week' ? target.weekId : 'plan', pdf);
    }
    onProgress?.({ step: 'render', done: targets.length, total: targets.length });
    standRecord = {
      recordId: crypto.randomUUID(),
      standId: crypto.randomUUID(),
      date: stand.date,
      version: stand.version,
      snapshot: planAfter,
      pdfs,
      standsSameDay: n,
    };
  }
  checkAbort(signal);
  // Ab hier gilt der Schreibauftrag vollständig (Abbruch wirkungslos).
  run.onWriting?.();
  onProgress?.({ step: 'write', done: 0, total: 1 });
  const saved = await store.commitAtomic(
    planId,
    {
      expectedRevision: loaded.revision,
      result: outcome.result,
      restorePoint: 'import',
      ...(standRecord === undefined ? {} : { standRecord }),
      importReport: { report: outcome.report },
    },
    clock,
  );
  return { ...outcome, ...saved };
}

export function isImportError(e: unknown): e is ImportError {
  return e instanceof WapError && e instanceof ImportError;
}
