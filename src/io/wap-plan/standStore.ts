// Stand atomar setzen, gespeicherte Stände lesen (Vertrag E1-05, Notiz «Ausarbeitung Schritt 2» Abschnitte A–F;
// ADR-002 Punkt 6, ADR-005 Punkt 4, ADR-006 Punkt 2a; R-5.5-03 bis -06, R-5.6-07, R-6-12).
// Kein IndexedDB-Zugriff: Gelesen und geschrieben wird nur über den Port `StandStore`, den `PlanStore` (E1-04)
// strukturell erfüllt (Abschnitt A, E).

import type { CommandContext, CommandResult } from '../../model/wap/commands/command';
import { type UserMessage, WapError } from '../../model/wap/errors';
import { type PdfTarget, pdfFileName, standsSameDayFor } from '../../model/wap/stand/fileName';
import { applyStand, type StandInput } from '../../model/wap/stand/stand';
import type { Id, IsoDate, Plan } from '../../model/wap/types';

/** Uhr nur in src/io und in der Oberfläche (_konventionen.md §4). Einzige Definition; store.ts (E1-04) re-exportiert. */
export interface Clock {
  now(): Date;
}

/** Renderer der garantierten Stand-Variante (A4, Status rot; AR0-10, G-12 a). `title` = Dateiname ohne «.pdf». */
export interface StandRenderers {
  week(plan: Plan, weekId: Id, title: string): Promise<Uint8Array>;
  plan(plan: Plan, title: string): Promise<Uint8Array>;
}

/** Gespeicherte Stand-Aufzeichnung (Speicherbereich `stands`, ADR-006 Punkt 1). */
export interface StandRecord {
  /** Primärschlüssel, crypto.randomUUID(); eine standId kann in zwei Aufzeichnungen vorkommen (AR0-45). */
  readonly recordId: string;
  /** crypto.randomUUID() in src/io, nie aus plan.nextId (AR0-31). */
  readonly standId: string;
  readonly planId: Id;
  readonly date: IsoDate;
  readonly version: number;
  /** Dokument nach dem Stand-Befehl (Schnappschuss). */
  readonly plan: Plan;
  /** Schlüssel: weekId je Woche und 'plan' für das Gesamt-PDF; Reihenfolge Wochen wie plan.weeks, dann 'plan'. */
  readonly pdfs: ReadonlyMap<string, Uint8Array>;
  /** Einblendender Historienschritt (≥ 1); 0 = ungekoppelt (ADR-006 P.2e). */
  readonly seq: number;
  /** Ausblendender Schritt (Ersetzen aus Datei), sonst null (AR0-45). */
  readonly hiddenBySeq: number | null;
  /** Beim Anlegen einmal bestimmt, nie geändert (Notiz E1-02f); ≥ 2 → Zusatz _V‹Version›. */
  readonly standsSameDay: number;
}

/** Aufzeichnung mit der vom Speicher berechneten Sichtbarkeit (isRecordVisible, E1-04 §1). */
export type StoredStandRecord = StandRecord & { readonly visible: boolean };

/** Eintrag von listStands: Aufzeichnung ohne Schnappschuss und Bytes. */
export type StandSummary = Omit<StandRecord, 'plan' | 'pdfs'>;

/** Ergebnis von setNewStand: Aufzeichnung plus savedAt und revision aus commitAtomic (Abschnitt C1 Punkt 9, V10). */
export type SetNewStandResult = StandRecord & {
  readonly savedAt: string;
  readonly revision: number;
};

/** Zu schreibende Aufzeichnung; seq und hiddenBySeq vergibt der Speicher (seq = neuer Schritt, hiddenBySeq null). */
export interface StandRecordWrite {
  readonly recordId: string;
  readonly standId: string;
  readonly date: IsoDate;
  readonly version: number;
  readonly snapshot: Plan;
  readonly pdfs: ReadonlyMap<string, Uint8Array>;
  readonly standsSameDay: number;
}

/** Schreibauftrag «Neuen Stand setzen» an commitAtomic (E1-04 §2, Notiz «Ausarbeitung Schritt 2» Abschnitt E). */
export interface StandCommitWrite {
  readonly expectedRevision: number;
  readonly result: CommandResult;
  readonly restorePoint: 'stand';
  readonly standRecord: StandRecordWrite;
  /**
   * Grenze der Undo-Historie: Ein gesetzter Stand lässt sich nicht per Undo zurücknehmen (Entscheid des
   * Auftraggebers vom 19.10.2026 «Stand: ja»; ADR-006 Änderungsnotiz F-UX1). setNewStand setzt immer true.
   */
  readonly undoBoundary?: true;
}

/** Port zum Speicher; PlanStore (E1-04) erfüllt ihn strukturell. Semantik: Abschnitt E. */
export interface StandStore {
  load(planId: Id): Promise<{ readonly plan: Plan; readonly revision: number } | null>;
  commitAtomic(
    planId: Id,
    write: StandCommitWrite,
    clock: Clock,
  ): Promise<{ readonly savedAt: string; readonly revision: number; readonly seq: number }>;
  standRecords(planId: Id): Promise<readonly StoredStandRecord[]>;
}

export type StandErrorCode =
  | 'renderFailed'
  | 'aborted'
  | 'variantNotStored'
  | 'planNotFound'
  | 'standNotFound';

/** Verbindliche Meldungen (Abschnitt F). */
export const STAND_MESSAGES: { readonly [C in StandErrorCode]: UserMessage } = {
  renderFailed: {
    cause:
      'Das PDF für den Stand konnte nicht erzeugt werden. Kein Stand gesetzt; der Plan ist unverändert.',
    nextStep:
      'Die Befunde prüfen und den Stand erneut setzen. Bleibt der Fehler, den WAP-Planer neu laden.',
  },
  aborted: {
    cause: 'Das Setzen des Stands wurde abgebrochen. Kein Stand gesetzt; der Plan ist unverändert.',
    nextStep: 'Den Stand bei Bedarf erneut setzen.',
  },
  variantNotStored: {
    cause: 'Für diesen Stand ist kein PDF dieser Woche gespeichert.',
    nextStep:
      'Eine Woche wählen, die es beim Setzen des Stands gab, oder die Arbeitsfassung exportieren.',
  },
  planNotFound: {
    cause: 'Der Plan ist im Speicher nicht vorhanden.',
    nextStep: 'Den Plan aus einer Plan-Datei öffnen oder einen neuen Plan erstellen.',
  },
  standNotFound: {
    cause: 'Der gewählte Stand ist nicht mehr vorhanden.',
    nextStep: 'Einen anderen Stand wählen oder die Arbeitsfassung exportieren.',
  },
};

export interface StandErrorDetails {
  /** Bei 'renderFailed' und 'variantNotStored': weekId oder 'plan'. */
  readonly variant?: string;
}

export class StandError extends WapError {
  declare readonly code: StandErrorCode;
  readonly variant: string | null;

  constructor(code: StandErrorCode, details?: StandErrorDetails, options?: { cause?: unknown }) {
    super(code, STAND_MESSAGES[code], options);
    this.variant = details?.variant ?? null;
  }
}

/** Meldung zu 'versionInUse' (F-UX1; R-5.5-03). */
export const VERSION_IN_USE_MESSAGE: UserMessage = {
  cause: 'Ein früherer Stand trägt diese Versionsnummer bereits. Kein Stand gesetzt.',
  nextStep: 'Die nächste freie Version eingeben; «Neuen Stand setzen» schlägt sie vor.',
};

/**
 * Die angegebene Version trägt schon ein sichtbarer Stand (z.B. nach Wiederherstellen eines Punkts «vor Stand»;
 * F-UX1, Entscheid «Stand: ja»). Eigene Klasse neben StandError, dessen Codes der Vertrag E1-05 festlegt.
 */
export class StandVersionError extends WapError {
  declare readonly code: 'versionInUse';

  constructor() {
    super('versionInUse', VERSION_IN_USE_MESSAGE);
  }
}

export interface SetNewStandOptions {
  /** Für applyStand (Vorlagen als Parameter, AR0-18). */
  readonly ctx: CommandContext;
  /** «Abbrechen» bis vor dem Schreiben (AR0-40, AR0-49). */
  readonly signal?: AbortSignal;
  /** Genau einmal synchron unmittelbar vor commitAtomic; danach ist «Abbrechen» wirkungslos (E1-16). */
  readonly onWriting?: () => void;
}

/** Ablauf «Neuen Stand setzen», atomar (Abschnitt C1). Fehler nur als abgelehntes Promise. */
export async function setNewStand(
  store: StandStore,
  planId: Id,
  input: StandInput,
  render: StandRenderers,
  clock: Clock,
  options: SetNewStandOptions,
): Promise<SetNewStandResult> {
  const abort = new StandAbortScope(options.signal);
  try {
    const loaded = await abort.wait(() => store.load(planId));
    if (loaded === null) throw new StandError('planNotFound');
    // Prüfung der Eingabe vor jedem weiteren Speicherzugriff (Vertrag E1-05, R-5.5-04).
    let result = applyStand(loaded.plan, input, options.ctx);
    const visible = (await abort.wait(() => store.standRecords(planId))).filter((r) => r.visible);
    // Ohne Angabe die nächste freie Version: höchste Version aller sichtbaren Stände + 1, auch nach Wiederherstellen
    // eines Punkts «vor Stand» (Gate-0-Entscheid F-47 «+1 je Stand … nur aufsteigend»; FD-05, TE-FUX1-01).
    const next = Math.max(0, ...visible.map((r) => r.version)) + 1;
    if (input.version === undefined && next > (result.plan.stand?.version ?? 0))
      result = applyStand(loaded.plan, { ...input, version: next }, options.ctx);
    const planAfter = result.plan;
    const stand = planAfter.stand;
    if (stand === null) throw new RangeError('Der Stand-Befehl muss einen Stand setzen.');
    // Eine angegebene Version wird nie ein zweites Mal vergeben, auch nach Wiederherstellen eines Punkts «vor
    // Stand» (F-UX1, R-5.5-03).
    if (input.version !== undefined && visible.some((r) => r.version === stand.version))
      throw new StandVersionError();
    const n = standsSameDayFor(visible, stand.date);
    const pdfs = await renderStandPdfs(planAfter, render, n, abort);
    abort.check();
    const recordId = crypto.randomUUID();
    const standId = crypto.randomUUID();
    // Ab hier gilt der Schreibauftrag vollständig, auch bei Abbruch in onWriting (C1 Punkt 7).
    abort.dispose();
    options.onWriting?.();
    const saved = await store.commitAtomic(
      planId,
      {
        expectedRevision: loaded.revision,
        result,
        restorePoint: 'stand',
        undoBoundary: true,
        standRecord: {
          recordId,
          standId,
          date: stand.date,
          version: stand.version,
          snapshot: planAfter,
          pdfs,
          standsSameDay: n,
        },
      },
      clock,
    );
    return {
      recordId,
      standId,
      planId,
      date: stand.date,
      version: stand.version,
      plan: planAfter,
      pdfs,
      seq: saved.seq,
      hiddenBySeq: null,
      standsSameDay: n,
      savedAt: saved.savedAt,
      revision: saved.revision,
    };
  } finally {
    abort.dispose();
  }
}

/** Für den Import-Stand (E1-08): Schritte Rendern ohne Speichern (Abschnitt C2). */
export async function prepareStandRecord(
  planAfter: Plan,
  render: StandRenderers,
  standsSameDay: number,
  signal?: AbortSignal,
): Promise<{ readonly pdfs: ReadonlyMap<string, Uint8Array> }> {
  if (planAfter.stand === null) throw new RangeError('Für Stand-PDF ist ein Stand erforderlich.');
  if (!Number.isSafeInteger(standsSameDay) || standsSameDay < 1) {
    throw new RangeError('Die Anzahl Stände am selben Tag muss eine sichere ganze Zahl ab 1 sein.');
  }
  const abort = new StandAbortScope(signal);
  try {
    abort.check();
    return { pdfs: await renderStandPdfs(planAfter, render, standsSameDay, abort) };
  } finally {
    abort.dispose();
  }
}

/** Sichtbare Stände, je standId höchstens einmal, sortiert (Abschnitt D4). */
export async function listStands(store: StandStore, planId: Id): Promise<readonly StandSummary[]> {
  const records = await store.standRecords(planId);
  const selected = new Map<string, StoredStandRecord>();
  for (const record of records) {
    if (!record.visible) continue;
    const previous = selected.get(record.standId);
    if (previous === undefined || compareRecordChoice(record, previous) < 0) {
      selected.set(record.standId, record);
    }
  }
  return [...selected.values()]
    .sort(
      (a, b) => b.version - a.version || compareText(b.date, a.date) || compareRecordChoice(a, b),
    )
    .map((r) => ({
      recordId: r.recordId,
      standId: r.standId,
      planId: r.planId,
      date: r.date,
      version: r.version,
      seq: r.seq,
      hiddenBySeq: r.hiddenBySeq,
      standsSameDay: r.standsSameDay,
    }));
}

/** Gespeicherte Bytes eines sichtbaren Stands, nie neu gerendert (R-5.5-06); Abschnitt D5. */
export async function standPdf(
  store: StandStore,
  planId: Id,
  standId: string,
  target: PdfTarget,
): Promise<{ readonly bytes: Uint8Array; readonly fileName: string }> {
  const records = await store.standRecords(planId);
  const record = records
    .filter((r) => r.visible && r.standId === standId)
    .sort(compareRecordChoice)[0];
  if (record === undefined) throw new StandError('standNotFound');
  const variant = target.kind === 'week' ? target.weekId : 'plan';
  const bytes = record.pdfs.get(variant);
  if (bytes === undefined) throw new StandError('variantNotStored', { variant });
  return { bytes, fileName: pdfFileName(record.plan, target, record.standsSameDay) };
}

/** Einzige Quelle für standsSameDay eines neuen Stands (Arbeitsannahme V-02f-4); Abschnitt D3. */
export async function nextStandsSameDay(
  store: StandStore,
  planId: Id,
  date: IsoDate,
): Promise<number> {
  const records = await store.standRecords(planId);
  return standsSameDayFor(
    records.filter((r) => r.visible),
    date,
  );
}

/** Titel (ohne «.pdf») für den Export der Arbeitsfassung (E1-16); Abschnitt D6. */
export async function exportTitle(
  store: StandStore,
  planId: Id,
  plan: Plan,
  target: PdfTarget,
): Promise<string> {
  if (plan.stand === null) return titelOhneEndung(pdfFileName(plan, target, 1));
  const stand = plan.stand;
  const records = await store.standRecords(planId);
  const record = records
    .filter((r) => r.visible && r.date === stand.date && r.version === stand.version)
    .sort(
      (a, b) =>
        b.seq - a.seq || b.standsSameDay - a.standsSameDay || compareText(a.recordId, b.recordId),
    )[0];
  return titelOhneEndung(pdfFileName(plan, target, record?.standsSameDay ?? 1));
}

const PDF_ENDUNG = '.pdf';

function titelOhneEndung(name: string): string {
  if (!name.endsWith(PDF_ENDUNG)) throw new RangeError('PDF-Name ohne Endung .pdf');
  return name.slice(0, -PDF_ENDUNG.length);
}

/** Vergleich von UTF-16-Codeeinheiten, unabhängig von Sprache und Laufzeitumgebung (D4–D6). */
function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareRecordChoice(a: StoredStandRecord, b: StoredStandRecord): number {
  return b.seq - a.seq || compareText(a.recordId, b.recordId);
}

/**
 * Ein Listener für die gesamte Vorbereitungsphase. Nur der ausstehende Schritt wird abgelehnt;
 * seine späte Erfüllung oder Ablehnung wird konsumiert, ohne den Ablauf fortzusetzen (C1 Punkt 6).
 */
class StandAbortScope {
  private rejectPending: ((reason: unknown) => void) | undefined;
  private readonly onAbort = (): void => {
    this.rejectPending?.(new StandError('aborted'));
  };

  constructor(private readonly signal?: AbortSignal) {
    signal?.addEventListener('abort', this.onAbort);
  }

  check(): void {
    if (this.signal?.aborted) throw new StandError('aborted');
  }

  async wait<T>(operation: () => Promise<T>): Promise<T> {
    this.check();
    try {
      const value = await new Promise<T>((resolve, reject) => {
        this.rejectPending = reject;
        // Der Promise-Konstruktor fängt auch synchron geworfene Fehler des Aufrufers ab.
        Promise.resolve(operation()).then(resolve, reject);
      });
      this.check();
      return value;
    } finally {
      this.rejectPending = undefined;
    }
  }

  dispose(): void {
    this.signal?.removeEventListener('abort', this.onAbort);
  }
}

/** Gemeinsamer sequenzieller Renderablauf für Stand-Setzen und Import (C1 Punkt 5, C2). */
async function renderStandPdfs(
  plan: Plan,
  render: StandRenderers,
  n: number,
  abort: StandAbortScope,
): Promise<ReadonlyMap<string, Uint8Array>> {
  const pdfs = new Map<string, Uint8Array>();
  const targets: PdfTarget[] = [
    ...plan.weeks.map((week): PdfTarget => ({ kind: 'week', weekId: week.id })),
    { kind: 'plan' },
  ];
  for (const target of targets) {
    abort.check();
    const variant = target.kind === 'week' ? target.weekId : 'plan';
    const title = titelOhneEndung(pdfFileName(plan, target, n));
    let bytes: Uint8Array;
    try {
      bytes = await abort.wait(() =>
        target.kind === 'week' ? render.week(plan, target.weekId, title) : render.plan(plan, title),
      );
    } catch (cause) {
      abort.check();
      throw new StandError('renderFailed', { variant }, { cause });
    }
    if (!(bytes instanceof Uint8Array)) throw new StandError('renderFailed', { variant });
    pdfs.set(variant, bytes);
  }
  return pdfs;
}
