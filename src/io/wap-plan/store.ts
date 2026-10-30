// Lokaler Speicher des WAP-Planers in IndexedDB (Vertrag E1-04, Notiz «Ausarbeitung Schritt 2 (07.10.2026)» Abschnitte H–L;
// ADR-006; Beschrieb 5.6; R-5.6-04, -08, -14, -15, -17, R-H-33, R-L-08). Alles bleibt im Browser dieses Geräts; keine
// Netzanfrage, keine Protokollausgabe von Planinhalten. Erfüllt den Port `StandStore` von E1-05 strukturell.

import { formatDate } from '../../model/wap/calendar';
import type { CommandResult } from '../../model/wap/commands/command';
import { type UserMessage, WapError } from '../../model/wap/errors';
import {
  cutHistory,
  EMPTY_HISTORY,
  type HistoryChange,
  type HistoryState,
  type HistoryStep,
  isRecordVisible,
  isStepApplied,
  pushStep,
  redo as redoHistory,
  rootReplaceResult,
  undo as undoHistory,
} from '../../model/wap/history/history';
import type { Id, IsoDate, Plan } from '../../model/wap/types';
import {
  CURRENT_FORMAT,
  checkFormat,
  hasInternalNotes,
  migrationBackupFileName,
  type PlanFile,
  type PlanFormat,
  planDisplayName,
  planFileName,
  type StandSnapshotFile,
  serializeLegacyPlanFile,
  serializePlanFile,
} from './planFile';
import { isIsoTimestamp, validatePlan, withoutUndefined } from './schema';
import type {
  Clock,
  StandRecord,
  StandRecordWrite,
  StandStore,
  StoredStandRecord,
} from './standStore';

/** Einzige Definition in standStore.ts (Notiz E1-05 J1). */
export type { Clock } from './standStore';

/** Name der Datenbank (ADR-006 Punkt 1, Gate-0-Entscheid G-6). */
export const DB_NAME = 'wap-planer';
/** Je Plan behaltene Wiederherstellungspunkte ohne 'planDelete' (R-5.6-08). */
export const RESTORE_POINTS_KEPT = 30;
/** Frist für gelöschte Pläne in Tagen (ADR-006 Punkt 2b). */
export const DELETED_PLAN_RETENTION_DAYS = 30;
/** Ab diesem Anteil von usage/quota gilt der Speicher als fast voll (ADR-006 Punkt 3). */
export const NEAR_FULL_RATIO = 0.8;

export type RestoreReason =
  | 'daily'
  | 'import'
  | 'adoption'
  | 'stand'
  | 'migration'
  | 'restore'
  | 'fileReplace'
  | 'planDelete';

export interface RestorePointInfo {
  readonly id: Id;
  readonly planId: Id;
  readonly reason: RestoreReason;
  /** ISO-Zeitpunkt vom Clock. */
  readonly at: string;
  /** Anzahl Einträge im gesicherten Dokument (Spalte «Umfang»). */
  readonly entryCount: number;
  /** Formatversion des gesicherten Dokuments; älter → beim Zurückholen migriert (AR0-14 d). */
  readonly formatVersion: number;
  /** Nur bei 'stand': Version des gesetzten Stands (Glossar «vor Stand V‹n›»; E1-05 O-2); sonst null. */
  readonly standVersion: number | null;
}

export interface PersistenceStatus {
  readonly persisted: boolean;
  readonly usageBytes: number | null;
  readonly quotaBytes: number | null;
  /** usage / quota > NEAR_FULL_RATIO; ohne Werte false. */
  readonly nearFull: boolean;
}

export interface LoadedPlan {
  readonly plan: Plan;
  readonly history: HistoryState;
  readonly revision: number;
  readonly modifiedAt: string;
  readonly lastFileSaveAt: string | null;
  /** Gesetzt bei «Als Kopie öffnen» und bei Wiederherstellung als Kopie (Zeitpunkt der Kopie); sonst null. */
  readonly copyCreatedAt: string | null;
}

export interface PlanSummary {
  readonly id: Id;
  /** planDisplayName(plan). */
  readonly name: string;
  readonly unit: string;
  readonly service: string;
  readonly modifiedAt: string;
  readonly copyCreatedAt: string | null;
}

/** Rückgabe von commit und commitAtomic (Port E1-05 Abschnitt E). */
export interface SaveResult {
  readonly savedAt: string;
  readonly revision: number;
  readonly seq: number;
}

/** Rückgabe von undo und redo. */
export interface HistoryMoveResult {
  readonly plan: Plan;
  readonly history: HistoryState;
  readonly revision: number;
  readonly savedAt: string;
}

/** Rückgabe von restore und replaceFromFile (eigener Historienschritt seq). */
export interface StepResult extends HistoryMoveResult {
  readonly seq: number;
}

export interface CommitOptions {
  /** Revision des Dokuments, auf dem der Befehl lief; abweichend → StorageError 'conflict', nichts geschrieben. */
  readonly expectedRevision?: number;
}

export interface ImportReportWrite {
  /** ImportReport (Typ E1-08), unverändert gespeichert (strukturiert geklont). */
  readonly report: unknown;
}

/** Schreibauftrag an commitAtomic (Stand, Import; ADR-006 Punkt 2a). StandCommitWrite (E1-05) ist ein Sonderfall. */
export interface AtomicWrite {
  readonly expectedRevision: number;
  readonly result: CommandResult;
  readonly restorePoint: RestoreReason;
  readonly standRecord?: StandRecordWrite;
  readonly importReport?: ImportReportWrite;
  /**
   * Grenze der Undo-Historie («Neuen Stand setzen», Entscheid des Auftraggebers vom 19.10.2026 «Stand: ja»;
   * ADR-006 Änderungsnotiz F-UX1): Der neue Schritt und alle davor gelten danach als dauerhaft angewendet (wie
   * gekürzt); Undo an der Grenze lehnt mit 'standNotUndoable' ab. Ohne Angabe wie bisher (Import, Vertrag E1-04).
   */
  readonly undoBoundary?: boolean;
}

export interface ImportReportRecord {
  readonly planId: Id;
  /** Import-Historienschritt, ≥ 1; sichtbar ⇔ isStepApplied(history, seq). */
  readonly seq: number;
  readonly at: string;
  readonly report: unknown;
}

export interface DeletedPlanInfo {
  readonly planId: Id;
  readonly name: string;
  readonly deletedAt: string;
  readonly restorePointId: Id;
  readonly expiresAt: string;
}

export interface MigrationBackup {
  readonly planId: Id;
  readonly planName: string;
  /** «Stand V‹n› vom dd.mm.yyyy» oder null ohne Stand. */
  readonly standLabel: string | null;
  readonly modifiedAt: string;
  readonly fileName: string;
  /** Plan-Datei im alten Format (serializeLegacyPlanFile). */
  bytes(): Uint8Array;
}

export interface PendingMigration {
  readonly fromVersion: number;
  readonly toVersion: number;
  readonly backups: readonly MigrationBackup[];
}

/** Dokument der Seite für «Plan-Datei sichern» im Zustand «Speicher voll» (Abschnitt I2, V02). */
export interface ExportOverride {
  readonly plan: Plan;
  readonly revision: number;
  readonly modifiedAt: string;
}

export interface PlanFileExport {
  readonly bytes: Uint8Array;
  readonly fileName: string;
  readonly containsInternalNotes: boolean;
}

export interface PlanStore {
  listPlans(): Promise<readonly PlanSummary[]>;
  load(planId: Id): Promise<LoadedPlan | null>;
  create(plan: Plan, clock: Clock): Promise<LoadedPlan>;
  commit(
    planId: Id,
    result: CommandResult,
    clock: Clock,
    options?: CommitOptions,
  ): Promise<SaveResult>;
  commitAtomic(planId: Id, write: AtomicWrite, clock: Clock): Promise<SaveResult>;
  undo(planId: Id, clock: Clock, options?: CommitOptions): Promise<HistoryMoveResult | null>;
  redo(planId: Id, clock: Clock, options?: CommitOptions): Promise<HistoryMoveResult | null>;
  standRecords(planId: Id): Promise<readonly StoredStandRecord[]>;
  importReports(planId: Id): Promise<readonly ImportReportRecord[]>;
  createRestorePoint(planId: Id, reason: RestoreReason, clock: Clock): Promise<RestorePointInfo>;
  listRestorePoints(planId: Id): Promise<readonly RestorePointInfo[]>;
  /** «Ältere löschen …»: löscht alle Punkte des Plans, die älter als der Bezugspunkt sind, ausser 'planDelete' (Abschnitt I2). */
  deleteRestorePointsOlderThan(
    planId: Id,
    restorePointId: Id,
  ): Promise<{ readonly deleted: number }>;
  restore(planId: Id, restorePointId: Id, clock: Clock): Promise<StepResult>;
  openFromFile(file: PlanFile, clock: Clock): Promise<LoadedPlan>;
  replaceFromFile(planId: Id, file: PlanFile, clock: Clock): Promise<StepResult>;
  importAsCopy(file: PlanFile, clock: Clock): Promise<LoadedPlan>;
  exportPlanFile(
    planId: Id,
    clock: Clock,
    options?: { readonly override?: ExportOverride },
  ): Promise<PlanFileExport>;
  deletePlan(planId: Id, clock: Clock): Promise<{ readonly restorePointId: Id }>;
  listDeletedPlans(clock: Clock): Promise<readonly DeletedPlanInfo[]>;
  restoreDeletedPlan(
    restorePointId: Id,
    clock: Clock,
  ): Promise<LoadedPlan & { readonly asCopy: boolean }>;
  pendingMigration(clock: Clock): Promise<PendingMigration | null>;
  runMigration(
    clock: Clock,
    onProgress?: (p: { readonly done: number; readonly total: number }) => void,
  ): Promise<void>;
  persistence(): Promise<PersistenceStatus>;
  requestPersistence(): Promise<boolean>;
  setLastFileSave(planId: Id, at: string): Promise<void>;
  /** Schliesst die Verbindung; danach lehnen alle Methoden ab. Wirft nie. */
  close(): void;
}

/** Prüft zur Übersetzungszeit, dass PlanStore den Port StandStore (E1-05 Abschnitt E) erfüllt. */
type RequiresStandStore<T extends StandStore> = T;
export type PlanStoreAsStandStore = RequiresStandStore<PlanStore>;

export interface PlanStoreOptions {
  /** Standard DB_NAME. */
  readonly dbName?: string;
  /** Standard globalThis.indexedDB; fehlt sie → StorageError 'unavailable'. Tests: new IDBFactory() aus fake-indexeddb. */
  readonly indexedDB?: IDBFactory;
  /** Standard globalThis.navigator?.storage; null = nicht verfügbar. */
  readonly storage?: StorageManager | null;
  /** Standard CURRENT_FORMAT; Tests übergeben eine Folgeversion mit Migration (Abschnitt F1). */
  readonly format?: PlanFormat;
}

export type StorageErrorCode =
  | 'unavailable'
  | 'blocked'
  | 'newerSchema'
  | 'migrationPending'
  | 'migrationFailed'
  | 'quotaExceeded'
  | 'conflict'
  | 'planNotFound'
  | 'planExists'
  | 'restorePointNotFound'
  | 'standNotUndoable';

/** Verbindliche Meldungen (Abschnitt G1); 'conflict' siehe CONFLICT_MESSAGES, 'migrationFailed' ersetzt {plan}. */
export const STORAGE_MESSAGES: {
  readonly [C in Exclude<StorageErrorCode, 'conflict'>]: UserMessage;
} = {
  unavailable: {
    cause:
      'Der lokale Speicher des Browsers ist nicht verfügbar; Änderungen können nicht gespeichert werden.',
    nextStep:
      'Seite neu laden (F5). Hilft das nicht: den WAP-Planer in Microsoft Edge öffnen und die Plan-Datei sichern.',
  },
  blocked: {
    cause:
      'Der WAP-Planer ist in einem anderen Tab mit einer älteren Version geöffnet; die Umstellung des Speichers wartet.',
    nextStep: 'Die anderen Tabs mit dem WAP-Planer schliessen und diese Seite neu laden (F5).',
  },
  newerSchema: {
    cause:
      'Die Pläne auf diesem Gerät wurden mit einer neueren Version des WAP-Planers gespeichert.',
    nextStep: 'Die neueste Version des WAP-Planers öffnen.',
  },
  migrationPending: {
    cause: 'Die Pläne müssen zuerst ins neue Format umgestellt werden.',
    nextStep:
      'Im Dialog «Sicherung vor dem Update» die Plan-Dateien sichern oder ohne Sicherung fortfahren.',
  },
  migrationFailed: {
    cause:
      'Die Pläne wurden nicht ins neue Format umgestellt. Die Umstellung brach bei «{plan}» ab; alle Pläne sind unverändert im bisherigen Format.',
    nextStep:
      'Seite neu laden (F5). Hilft das nicht: mit der vorherigen Version des WAP-Planers weiterarbeiten und die gesicherte Plan-Datei öffnen.',
  },
  quotaExceeded: {
    cause: 'Der lokale Speicher ist voll; die Änderung ist nicht gespeichert.',
    nextStep: 'Jetzt die Plan-Datei sichern, danach alte Wiederherstellungspunkte löschen.',
  },
  planNotFound: {
    cause: 'Der Plan ist im Speicher nicht vorhanden.',
    nextStep: 'Den Plan aus einer Plan-Datei öffnen oder einen neuen Plan erstellen.',
  },
  planExists: {
    cause: 'Auf diesem Gerät gibt es bereits einen Plan mit dieser Kennung.',
    nextStep:
      'Die Plan-Datei über «Plan-Datei öffnen» laden und «Behalten», «Ersetzen» oder «Als Kopie öffnen» wählen.',
  },
  restorePointNotFound: {
    cause: 'Der Wiederherstellungspunkt ist nicht mehr vorhanden.',
    nextStep: 'Einen anderen Wiederherstellungspunkt wählen.',
  },
  standNotUndoable: {
    cause:
      'Ein gesetzter Stand lässt sich nicht rückgängig machen. Der Stand und seine PDF bleiben unverändert gespeichert.',
    nextStep:
      'Änderungen direkt im Plan vornehmen und bei Bedarf einen neuen Stand setzen. Die Fassung vor dem Stand holt «Wiederherstellungspunkte …» (Punkt «vor Stand») zurück.',
  },
};

/** Meldungen zu 'conflict' (Vorrangregel V12: importReport vor standRecord, sonst Änderung). */
export const CONFLICT_MESSAGES: {
  readonly import: UserMessage;
  readonly stand: UserMessage;
  readonly change: UserMessage;
} = {
  import: {
    cause:
      'Der Plan wurde während des Imports geändert. Nichts importiert; die Änderung ist gespeichert.',
    nextStep: 'Import erneut starten.',
  },
  stand: {
    cause:
      'Der Plan wurde während des Stand-Setzens geändert. Kein Stand gesetzt; die Änderung ist gespeichert.',
    nextStep: 'Stand erneut setzen.',
  },
  change: {
    cause:
      'Der Plan wurde inzwischen an anderer Stelle geändert, z.B. in einem anderen Tab. Diese Änderung ist nicht gespeichert.',
    nextStep: 'Seite neu laden (F5) und die Änderung wiederholen.',
  },
};

export interface StorageErrorDetails {
  /** Bei 'migrationFailed': Anzeigename des Plans, bei dem die Umstellung abbrach. */
  readonly planName?: string;
  /** Bei 'conflict': welche Meldung (Standard 'change'). */
  readonly conflict?: keyof typeof CONFLICT_MESSAGES;
}

export class StorageError extends WapError {
  declare readonly code: StorageErrorCode;
  readonly planName: string | null;

  constructor(
    code: StorageErrorCode,
    details?: StorageErrorDetails,
    options?: { cause?: unknown },
  ) {
    const message: UserMessage =
      code === 'conflict'
        ? CONFLICT_MESSAGES[details?.conflict ?? 'change']
        : code === 'migrationFailed'
          ? {
              cause: STORAGE_MESSAGES.migrationFailed.cause.replaceAll(
                '{plan}',
                details?.planName ?? '',
              ),
              nextStep: STORAGE_MESSAGES.migrationFailed.nextStep,
            }
          : STORAGE_MESSAGES[code];
    super(code, message, options);
    this.planName = details?.planName ?? null;
  }
}

interface PlanRow {
  planId: Id;
  plan: Plan;
  revision: number;
  modifiedAt: string;
  lastFileSaveAt: string | null;
  copyCreatedAt: string | null;
  dailyPointDay: IsoDate | null;
  historyHead: Omit<HistoryState, 'steps'>;
  /** Fehlend = unbekannt bis zum nächsten Durchgang nach J (Vertrag R2-2). */
  standSeqs?: number[];
  /** seq des letzten Stand-Schritts mit Undo-Grenze (AtomicWrite.undoBoundary); fehlt ohne solche Grenze. */
  standBoundarySeq?: number;
}
interface PointRow {
  id: Id;
  planId: Id;
  ordinal: number;
  reason: RestoreReason;
  at: string;
  formatVersion: number;
  plan: Plan;
  revision: number;
  lastFileSaveAt: string | null;
  standVersion: number | null;
  stands: readonly StandSnapshotFile[] | null;
}
type HistoryRow = HistoryStep & { readonly planId: Id };
const STORES = ['plans', 'history', 'restorePoints', 'stands', 'importReports', 'meta'];
const RETENTION_MS = DELETED_PLAN_RETENTION_DAYS * 86_400_000;
const compareText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
function quotaError(cause: unknown): unknown {
  return typeof cause === 'object' &&
    cause !== null &&
    'name' in cause &&
    cause.name === 'QuotaExceededError'
    ? new StorageError('quotaExceeded', undefined, { cause })
    : cause;
}
/** Ein Ergebnis gilt erst mit complete als gespeichert; jeder Fehler bricht alles ab. */
async function transaction<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  action: (tx: IDBTransaction) => Promise<T>,
): Promise<T> {
  let tx: IDBTransaction;
  try {
    tx = db.transaction(STORES, mode, mode === 'readwrite' ? { durability: 'strict' } : undefined);
  } catch (cause) {
    if (
      typeof cause === 'object' &&
      cause !== null &&
      'name' in cause &&
      cause.name === 'InvalidStateError'
    )
      throw new StorageError('unavailable', undefined, { cause });
    throw quotaError(cause);
  }
  const finished = new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () =>
      reject(tx.error ?? new DOMException('Transaktion abgebrochen.', 'AbortError'));
    tx.onerror = () => {}; // request.error und abort liefern den Fehler, ohne Protokollausgabe.
  });
  // Auch ein früher Abbruch darf kein unbehandeltes Promise erzeugen.
  void finished.catch(() => {});
  try {
    const result = await action(tx);
    await finished;
    return result;
  } catch (cause) {
    try {
      tx.abort();
    } catch {
      /* Bereits abgeschlossen/abgebrochen. */
    }
    await finished.catch(() => {});
    throw quotaError(cause);
  }
}
async function allByPlan<T>(tx: IDBTransaction, store: string, planId: Id): Promise<T[]> {
  return (await request(tx.objectStore(store).index('byPlan').getAll(planId))) as T[];
}
async function deleteByPlan(tx: IDBTransaction, store: string, planId: Id): Promise<void> {
  const area = tx.objectStore(store);
  const keys = await request(area.index('byPlan').getAllKeys(planId));
  await Promise.all(keys.map((key) => request(area.delete(key))));
}
async function planRow(tx: IDBTransaction, id: Id): Promise<PlanRow> {
  const row = (await request(tx.objectStore('plans').get(id))) as PlanRow | undefined;
  if (row === undefined) throw new StorageError('planNotFound');
  return row;
}
async function readHistory(
  tx: IDBTransaction,
  row: PlanRow,
  patches = true,
): Promise<HistoryState> {
  let steps: HistoryStep[];
  if (patches)
    steps = (await allByPlan<HistoryRow>(tx, 'history', row.planId)).map(
      ({ planId: _id, ...step }) => step,
    );
  else {
    const keys = await request(tx.objectStore('history').index('byPlan').getAllKeys(row.planId));
    steps = keys.map((key) => ({
      seq: (key as [string, number])[1],
      label: '',
      at: '',
      patches: [],
      inversePatches: [],
    }));
  }
  steps.sort((a, b) => a.seq - b.seq);
  return { ...row.historyHead, steps };
}
function head(history: HistoryState): PlanRow['historyHead'] {
  const { steps: _steps, ...result } = history;
  return result;
}
function loaded(row: PlanRow, history: HistoryState): LoadedPlan {
  return {
    plan: row.plan,
    history,
    revision: row.revision,
    modifiedAt: row.modifiedAt,
    lastFileSaveAt: row.lastFileSaveAt,
    copyCreatedAt: row.copyCreatedAt,
  };
}
function newRow(
  plan: Plan,
  at: string,
  revision = 0,
  lastFileSaveAt: string | null = null,
  copyCreatedAt: string | null = null,
): PlanRow {
  return {
    planId: plan.id,
    plan,
    revision,
    modifiedAt: at,
    lastFileSaveAt,
    copyCreatedAt,
    dailyPointDay: null,
    historyHead: head(EMPTY_HISTORY),
    standSeqs: [],
  };
}
function copyPdfs(pdfs: ReadonlyMap<string, Uint8Array>): Map<string, Uint8Array> {
  return new Map([...pdfs].map(([key, bytes]) => [key, new Uint8Array(bytes)]));
}
function snapshot(r: StandRecord): StandSnapshotFile {
  return {
    standId: r.standId,
    date: r.date,
    version: r.version,
    standsSameDay: r.standsSameDay,
    plan: r.plan,
    pdfs: copyPdfs(r.pdfs),
  };
}
async function visibleStands(tx: IDBTransaction, row: PlanRow): Promise<StandSnapshotFile[]> {
  const history = await readHistory(tx, row, false);
  const records = (await allByPlan<StandRecord>(tx, 'stands', row.planId))
    .filter((r) => isRecordVisible(history, r))
    .sort((a, b) => b.seq - a.seq || compareText(a.recordId, b.recordId));
  const chosen = new Map<string, StandRecord>();
  for (const r of records) if (!chosen.has(r.standId)) chosen.set(r.standId, r);
  return [...chosen.values()]
    .sort(
      (a, b) =>
        b.version - a.version ||
        compareText(b.date, a.date) ||
        b.seq - a.seq ||
        compareText(a.recordId, b.recordId),
    )
    .map(snapshot);
}
function pointInfo(row: PointRow): RestorePointInfo {
  return {
    id: row.id,
    planId: row.planId,
    reason: row.reason,
    at: row.at,
    entryCount:
      row.plan?.entries && typeof row.plan.entries === 'object'
        ? Object.keys(row.plan.entries).length
        : 0,
    formatVersion: row.formatVersion,
    standVersion: row.standVersion,
  };
}
async function addPoint(
  tx: IDBTransaction,
  row: PlanRow,
  reason: RestoreReason,
  now: Date,
  version: number,
  standVersion: number | null = null,
  stands: readonly StandSnapshotFile[] | null = null,
): Promise<PointRow> {
  const meta = tx.objectStore('meta');
  const counter = (await request(meta.get('nextRestoreOrdinal'))) as
    | { key: string; value: number }
    | undefined;
  const ordinal = counter?.value ?? 1;
  const point: PointRow = {
    id: crypto.randomUUID(),
    planId: row.planId,
    ordinal,
    reason,
    at: now.toISOString(),
    formatVersion: version,
    plan: row.plan,
    revision: row.revision,
    lastFileSaveAt: row.lastFileSaveAt,
    standVersion,
    stands,
  };
  await request(meta.put({ key: 'nextRestoreOrdinal', value: ordinal + 1 }));
  await request(tx.objectStore('restorePoints').add(point));
  if (reason !== 'planDelete') {
    const points = (await allByPlan<PointRow>(tx, 'restorePoints', row.planId))
      .filter((p) => p.reason !== 'planDelete')
      .sort((a, b) => b.ordinal - a.ordinal);
    await Promise.all(
      points
        .slice(RESTORE_POINTS_KEPT)
        .map((p) => request(tx.objectStore('restorePoints').delete(p.id))),
    );
  }
  return point;
}
async function daily(tx: IDBTransaction, row: PlanRow, now: Date, version: number): Promise<void> {
  const day = localDay(now);
  if (row.dailyPointDay !== day) {
    await addPoint(tx, row, 'daily', now, version);
    row.dailyPointDay = day;
  }
}
async function pruneHistory(
  tx: IDBTransaction,
  row: PlanRow,
  change: HistoryChange,
): Promise<void> {
  // Ohne verworfene oder gekürzte Schritte ändert sich keine Aufzeichnung.
  if (change.discardedSeqs.length === 0 && change.truncatedSeqs.length === 0) return;
  const discarded = new Set(change.discardedSeqs);
  const removed = [...change.discardedSeqs, ...change.truncatedSeqs];
  await Promise.all(
    removed.map((seq) => request(tx.objectStore('history').delete([row.planId, seq]))),
  );
  await Promise.all(
    change.discardedSeqs.map((seq) =>
      request(tx.objectStore('importReports').delete([row.planId, seq])),
    ),
  );
  const removedSet = new Set(removed);
  if (row.standSeqs !== undefined && !row.standSeqs.some((seq) => removedSet.has(seq))) return;
  const standSeqs = new Set<number>();
  for (const record of await allByPlan<StandRecord>(tx, 'stands', row.planId)) {
    if (discarded.has(record.seq)) await request(tx.objectStore('stands').delete(record.recordId));
    else {
      const r = discarded.has(record.hiddenBySeq ?? -1) ? { ...record, hiddenBySeq: null } : record;
      if (r.hiddenBySeq !== null && r.hiddenBySeq <= change.history.truncatedThroughSeq)
        await request(tx.objectStore('stands').delete(r.recordId));
      else {
        if (r !== record) await request(tx.objectStore('stands').put(r));
        if (r.seq > change.history.truncatedThroughSeq) standSeqs.add(r.seq);
        if (r.hiddenBySeq !== null) standSeqs.add(r.hiddenBySeq);
      }
    }
  }
  row.standSeqs = [...standSeqs].sort((a, b) => a - b);
}
async function appendStep(
  tx: IDBTransaction,
  row: PlanRow,
  history: HistoryState,
  result: CommandResult,
  now: Date,
  coupleStand = false,
) {
  const change = pushStep(history, {
    label: result.label,
    at: now.toISOString(),
    patches: result.patches,
    inversePatches: result.inversePatches,
  });
  await pruneHistory(tx, row, change);
  // Erst nach J hinzufügen: dessen Durchgang setzt den Merker aus den alten Aufzeichnungen neu.
  // Ein unbekannter Merker bleibt bis zu einem solchen Durchgang unbekannt.
  if (coupleStand && row.standSeqs !== undefined)
    row.standSeqs = [...new Set([...row.standSeqs, change.seq])].sort((a, b) => a - b);
  const step = change.history.steps.at(-1);
  await request(tx.objectStore('history').add({ ...step, planId: row.planId }));
  row.plan = result.plan;
  row.historyHead = head(change.history);
  row.revision++;
  row.modifiedAt = now.toISOString();
  await request(tx.objectStore('plans').put(row));
  return change;
}
async function addSnapshots(
  tx: IDBTransaction,
  planId: Id,
  stands: readonly StandSnapshotFile[],
  asCopy: boolean,
  seq = 0,
): Promise<void> {
  await Promise.all(
    stands.map((s) =>
      request(
        tx.objectStore('stands').add({
          ...s,
          pdfs: copyPdfs(s.pdfs),
          recordId: crypto.randomUUID(),
          standId: asCopy ? crypto.randomUUID() : s.standId,
          planId,
          seq,
          hiddenBySeq: null,
        }),
      ),
    ),
  );
}
function checkRevision(
  row: PlanRow,
  revision: number | undefined,
  conflict: keyof typeof CONFLICT_MESSAGES = 'change',
): void {
  if (revision !== undefined && revision !== row.revision)
    throw new StorageError('conflict', { conflict });
}
function createStores(db: IDBDatabase): void {
  db.createObjectStore('plans', { keyPath: 'planId' });
  db.createObjectStore('meta', { keyPath: 'key' });
  for (const [name, keyPath] of [
    ['history', ['planId', 'seq']],
    ['importReports', ['planId', 'seq']],
    ['stands', 'recordId'],
    ['restorePoints', 'id'],
  ] as const) {
    const area = db.createObjectStore(name, {
      keyPath: typeof keyPath === 'string' ? keyPath : [...keyPath],
    });
    area.createIndex('byPlan', 'planId');
  }
}
function openDatabase(factory: IDBFactory, name: string, version: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let rejected = false;
    let r: IDBOpenDBRequest;
    try {
      r = factory.open(name, version);
    } catch (cause) {
      reject(new StorageError('unavailable', undefined, { cause }));
      return;
    }
    r.onblocked = () => {
      rejected = true;
      reject(new StorageError('blocked'));
    };
    r.onupgradeneeded = (e) => {
      if (rejected) r.transaction?.abort();
      else if (e.oldVersion === 0) createStores(r.result);
    };
    r.onerror = () => reject(new StorageError('unavailable', undefined, { cause: r.error }));
    r.onsuccess = () => {
      if (rejected) r.result.close();
      else resolve(r.result);
    };
  });
}

/** Öffnet ausschliesslich den lokalen Speicher; Formatwechsel bleiben bis runMigration offen. */
export async function openPlanStore(options: PlanStoreOptions = {}): Promise<PlanStore> {
  const format = options.format ?? CURRENT_FORMAT;
  checkFormat(format);
  const factory = options.indexedDB ?? globalThis.indexedDB;
  if (factory === undefined) throw new StorageError('unavailable');
  const storage =
    options.storage === undefined ? (globalThis.navigator?.storage ?? null) : options.storage;
  const name = options.dbName ?? DB_NAME;
  let databases: IDBDatabaseInfo[];
  try {
    databases = await factory.databases();
  } catch (cause) {
    throw new StorageError('unavailable', undefined, { cause });
  }
  const previous = databases.find((d) => d.name === name)?.version ?? format.version;
  if (previous > format.version) throw new StorageError('newerSchema');
  let db = await openDatabase(factory, name, previous);
  let closed = false;
  let pending = previous < format.version;
  let barrier: Promise<void> = Promise.resolve();
  const activeTransactions = new Set<Promise<unknown>>();
  function bind() {
    db.onclose = () => {
      closed = true;
    };
    db.onversionchange = () => {
      closed = true;
      db.close();
    };
  }
  bind();
  async function ready<T>(allowMigration: boolean, action: () => T | Promise<T>): Promise<T> {
    let observed: Promise<void>;
    do {
      observed = barrier;
      await observed;
    } while (observed !== barrier);
    if (closed) throw new StorageError('unavailable');
    if (pending && !allowMigration) throw new StorageError('migrationPending');
    // Prüfung und Verbindungszugriff bleiben im selben synchronen Abschnitt.
    return action();
  }
  function beginTransaction<T>(
    mode: IDBTransactionMode,
    action: (tx: IDBTransaction) => Promise<T>,
  ): Promise<T> {
    const result = transaction(db, mode, action);
    activeTransactions.add(result);
    void result.then(
      () => activeTransactions.delete(result),
      () => activeTransactions.delete(result),
    );
    return result;
  }
  async function transact<T>(
    mode: IDBTransactionMode,
    action: (tx: IDBTransaction) => Promise<T>,
    allowMigration = false,
  ): Promise<T> {
    return ready(allowMigration, () => beginTransaction(mode, action));
  }
  function migrateDocument(plan: Plan, from: number): Plan {
    try {
      let value: unknown = withoutUndefined(structuredClone(plan));
      for (let v = from; v < format.version; v++) {
        const migration = format.migrations[v - 1];
        if (migration === undefined) throw new RangeError('Fehlende Migration.');
        value = migration.migrate(value);
      }
      return validatePlan(value);
    } catch (cause) {
      throw new StorageError('migrationFailed', { planName: planDisplayName(plan) }, { cause });
    }
  }
  async function move(
    planId: Id,
    clock: Clock,
    redo: boolean,
    opts?: CommitOptions,
  ): Promise<HistoryMoveResult | null> {
    const now = new Date(clock.now().getTime());
    return transact('readwrite', async (tx) => {
      const row = await planRow(tx, planId);
      checkRevision(row, opts?.expectedRevision);
      const h = await readHistory(tx, row);
      // Grenze «Neuen Stand setzen»: alles bis und mit dem Stand-Schritt gilt als dauerhaft angewendet (F-UX1).
      if (
        !redo &&
        h.cursor === 0 &&
        row.standBoundarySeq !== undefined &&
        row.standBoundarySeq === h.truncatedThroughSeq
      )
        throw new StorageError('standNotUndoable');
      const result = (redo ? redoHistory : undoHistory)(row.plan, h);
      if (result === null) return null;
      await daily(tx, row, now, format.version);
      row.plan = result.plan;
      row.historyHead = head(result.history);
      row.revision++;
      row.modifiedAt = now.toISOString();
      await request(tx.objectStore('plans').put(row));
      return {
        plan: row.plan,
        history: result.history,
        revision: row.revision,
        savedAt: row.modifiedAt,
      };
    });
  }
  const store: PlanStore = {
    async listPlans() {
      return transact('readonly', async (tx) => {
        const rows = (await request(tx.objectStore('plans').getAll())) as PlanRow[];
        return rows
          .map((r) => ({
            id: r.planId,
            name: planDisplayName(r.plan),
            unit: r.plan.unit,
            service: r.plan.service,
            modifiedAt: r.modifiedAt,
            copyCreatedAt: r.copyCreatedAt,
          }))
          .sort((a, b) => compareText(b.modifiedAt, a.modifiedAt) || compareText(a.id, b.id));
      });
    },
    async load(planId) {
      return transact('readonly', async (tx) => {
        const row = (await request(tx.objectStore('plans').get(planId))) as PlanRow | undefined;
        return row === undefined ? null : loaded(row, await readHistory(tx, row));
      });
    },
    async create(plan, clock) {
      const now = new Date(clock.now().getTime());
      return transact('readwrite', async (tx) => {
        if ((await request(tx.objectStore('plans').get(plan.id))) !== undefined)
          throw new StorageError('planExists');
        const row = newRow(plan, now.toISOString());
        await request(tx.objectStore('plans').add(row));
        return loaded(row, { ...EMPTY_HISTORY, steps: [] });
      });
    },
    async commit(planId, result, clock, opts) {
      const now = new Date(clock.now().getTime());
      return transact('readwrite', async (tx) => {
        const row = await planRow(tx, planId);
        checkRevision(row, opts?.expectedRevision);
        if (result.patches.length === 0)
          return { savedAt: row.modifiedAt, revision: row.revision, seq: 0 };
        await daily(tx, row, now, format.version);
        const change = await appendStep(tx, row, await readHistory(tx, row, false), result, now);
        return { savedAt: row.modifiedAt, revision: row.revision, seq: change.seq };
      });
    },
    async commitAtomic(planId, write, clock) {
      const now = new Date(clock.now().getTime());
      return transact('readwrite', async (tx) => {
        if (write.restorePoint === 'planDelete')
          throw new RangeError('Löschpunkte entstehen nur beim Löschen eines Plans.');
        const row = await planRow(tx, planId);
        checkRevision(
          row,
          write.expectedRevision,
          write.importReport ? 'import' : write.standRecord ? 'stand' : 'change',
        );
        await daily(tx, row, now, format.version);
        await addPoint(
          tx,
          row,
          write.restorePoint,
          now,
          format.version,
          write.restorePoint === 'stand' ? (write.standRecord?.version ?? null) : null,
        );
        const change = await appendStep(
          tx,
          row,
          await readHistory(tx, row, false),
          write.result,
          now,
          write.standRecord !== undefined,
        );
        if (write.standRecord) {
          const { snapshot: plan, ...fields } = write.standRecord;
          await request(
            tx
              .objectStore('stands')
              .add({ ...fields, plan, planId, seq: change.seq, hiddenBySeq: null }),
          );
        }
        if (write.importReport)
          await request(
            tx.objectStore('importReports').add({
              planId,
              seq: change.seq,
              at: now.toISOString(),
              report: write.importReport.report,
            }),
          );
        if (write.undoBoundary === true) {
          // Grenze der Undo-Historie (F-UX1): der Stand-Schritt und alle davor werden dauerhaft angewendet wie beim
          // Kürzen; ein Redo-Zweig entsteht dahinter nie, also verwirft auch kein späterer Schritt den Stand.
          const cut = cutHistory(change.history);
          await pruneHistory(tx, row, cut);
          row.historyHead = head(cut.history);
          row.standBoundarySeq = change.seq;
          await request(tx.objectStore('plans').put(row));
        }
        return { savedAt: row.modifiedAt, revision: row.revision, seq: change.seq };
      });
    },
    async undo(planId, clock, opts) {
      return move(planId, clock, false, opts);
    },
    async redo(planId, clock, opts) {
      return move(planId, clock, true, opts);
    },
    async standRecords(planId) {
      return transact('readonly', async (tx) => {
        const row = (await request(tx.objectStore('plans').get(planId))) as PlanRow | undefined;
        if (row === undefined) return [];
        const history = await readHistory(tx, row, false);
        return (await allByPlan<StandRecord>(tx, 'stands', planId)).map((r) => ({
          ...r,
          pdfs: copyPdfs(r.pdfs),
          visible: isRecordVisible(history, r),
        }));
      });
    },
    async importReports(planId) {
      return transact('readonly', async (tx) => {
        const row = (await request(tx.objectStore('plans').get(planId))) as PlanRow | undefined;
        if (row === undefined) return [];
        const history = await readHistory(tx, row, false);
        return (await allByPlan<ImportReportRecord>(tx, 'importReports', planId))
          .filter((r) => isStepApplied(history, r.seq))
          .sort((a, b) => b.seq - a.seq);
      });
    },
    async createRestorePoint(planId, reason, clock) {
      const now = new Date(clock.now().getTime());
      return transact('readwrite', async (tx) => {
        if (reason === 'planDelete')
          throw new RangeError('Löschpunkte entstehen nur beim Löschen eines Plans.');
        return pointInfo(
          await addPoint(tx, await planRow(tx, planId), reason, now, format.version),
        );
      });
    },
    async listRestorePoints(planId) {
      return transact('readonly', async (tx) =>
        (await allByPlan<PointRow>(tx, 'restorePoints', planId))
          .sort((a, b) => b.ordinal - a.ordinal)
          .map(pointInfo),
      );
    },
    async deleteRestorePointsOlderThan(planId, restorePointId) {
      return transact('readwrite', async (tx) => {
        await planRow(tx, planId);
        const point = (await request(tx.objectStore('restorePoints').get(restorePointId))) as
          | PointRow
          | undefined;
        if (point === undefined || point.planId !== planId)
          throw new StorageError('restorePointNotFound');
        const older = (await allByPlan<PointRow>(tx, 'restorePoints', planId)).filter(
          (p) => p.ordinal < point.ordinal && p.reason !== 'planDelete',
        );
        await Promise.all(older.map((p) => request(tx.objectStore('restorePoints').delete(p.id))));
        return { deleted: older.length };
      });
    },
    async restore(planId, restorePointId, clock) {
      const now = new Date(clock.now().getTime());
      return transact('readwrite', async (tx) => {
        const row = await planRow(tx, planId);
        const point = (await request(tx.objectStore('restorePoints').get(restorePointId))) as
          | PointRow
          | undefined;
        if (point === undefined || point.planId !== planId)
          throw new StorageError('restorePointNotFound');
        const restored = migrateDocument(point.plan, point.formatVersion);
        const result = rootReplaceResult(
          row.plan,
          { ...restored, nextId: Math.max(row.plan.nextId, restored.nextId) },
          'Wiederherstellungspunkt wiederhergestellt',
        );
        await daily(tx, row, now, format.version);
        await addPoint(tx, row, 'restore', now, format.version);
        // Stände im Punkt (z.B. «vor Ersetzen», CR-D-2-01): fehlende werden mit dem Wiederherstellen wieder sichtbar,
        // gekoppelt an diesen Schritt (Undo blendet sie aus); der Punkt behält sie (ADR-006 F-UX1 Runde 2).
        const sichtbar = new Set((await visibleStands(tx, row)).map((s) => s.standId));
        const fehlend = (point.stands ?? [])
          .filter((s) => !sichtbar.has(s.standId))
          .map((s) => ({ ...s, plan: migrateDocument(s.plan, point.formatVersion) }));
        const change = await appendStep(
          tx,
          row,
          await readHistory(tx, row),
          result,
          now,
          fehlend.length > 0,
        );
        await addSnapshots(tx, planId, fehlend, false, change.seq);
        return {
          plan: row.plan,
          history: change.history,
          revision: row.revision,
          savedAt: row.modifiedAt,
          seq: change.seq,
        };
      });
    },
    async openFromFile(file, clock) {
      clock.now();
      return transact('readwrite', async (tx) => {
        if ((await request(tx.objectStore('plans').get(file.planId))) !== undefined)
          throw new StorageError('planExists');
        const row = newRow(file.plan, file.modifiedAt, file.revision, file.savedAt);
        await request(tx.objectStore('plans').add(row));
        await addSnapshots(tx, row.planId, file.stands, false);
        return loaded(row, { ...EMPTY_HISTORY, steps: [] });
      });
    },
    async replaceFromFile(planId, file, clock) {
      const now = new Date(clock.now().getTime());
      return transact('readwrite', async (tx) => {
        if (file.planId !== planId) throw new RangeError('Unterschiedliche Plan-Kennungen.');
        const row = await planRow(tx, planId);
        const result = rootReplaceResult(
          row.plan,
          { ...file.plan, nextId: Math.max(row.plan.nextId, file.plan.nextId) },
          'Plan durch Datei ersetzt',
        );
        await daily(tx, row, now, format.version);
        // Der Punkt «vor Ersetzen» enthält die sichtbaren Stände samt PDF (CR-D-2-01): Ein ausgeblendeter Stand bleibt
        // so wiederherstellbar, auch wenn die Grenze «Neuen Stand setzen» das Ersetzen dauerhaft macht.
        await addPoint(
          tx,
          row,
          'fileReplace',
          now,
          format.version,
          null,
          await visibleStands(tx, row),
        );
        const change = await appendStep(tx, row, await readHistory(tx, row), result, now, true);
        const records = (await allByPlan<StandRecord>(tx, 'stands', planId)).filter((r) =>
          isRecordVisible(change.history, r),
        );
        const ids = new Set(file.stands.map((s) => s.standId));
        await addSnapshots(
          tx,
          planId,
          file.stands.filter((s) => !records.some((r) => r.standId === s.standId)),
          false,
          change.seq,
        );
        for (const record of records)
          if (!ids.has(record.standId))
            await request(tx.objectStore('stands').put({ ...record, hiddenBySeq: change.seq }));
        return {
          plan: row.plan,
          history: change.history,
          revision: row.revision,
          savedAt: row.modifiedAt,
          seq: change.seq,
        };
      });
    },
    async importAsCopy(file, clock) {
      const now = new Date(clock.now().getTime());
      return transact('readwrite', async (tx) => {
        const row = newRow(
          { ...file.plan, id: crypto.randomUUID() },
          now.toISOString(),
          0,
          null,
          now.toISOString(),
        );
        await request(tx.objectStore('plans').add(row));
        await addSnapshots(tx, row.planId, file.stands, true);
        return loaded(row, { ...EMPTY_HISTORY, steps: [] });
      });
    },
    async exportPlanFile(planId, clock, opts) {
      const now = new Date(clock.now().getTime());
      return transact('readonly', async (tx) => {
        const row = await planRow(tx, planId);
        const input = opts?.override ?? row;
        if (input.plan.id !== planId) throw new RangeError('Unterschiedliche Plan-Kennungen.');
        const stands = await visibleStands(tx, row);
        return {
          bytes: serializePlanFile(
            { plan: input.plan, revision: input.revision, modifiedAt: input.modifiedAt, stands },
            { now: () => now },
            format,
          ),
          fileName: planFileName(input.plan, localDay(now)),
          containsInternalNotes: hasInternalNotes(input.plan),
        };
      });
    },
    async deletePlan(planId, clock) {
      const now = new Date(clock.now().getTime());
      return transact('readwrite', async (tx) => {
        const row = await planRow(tx, planId);
        const point = await addPoint(
          tx,
          row,
          'planDelete',
          now,
          format.version,
          null,
          await visibleStands(tx, row),
        );
        await Promise.all(
          ['history', 'stands', 'importReports'].map((area) => deleteByPlan(tx, area, planId)),
        );
        await request(tx.objectStore('plans').delete(planId));
        return { restorePointId: point.id };
      });
    },
    async listDeletedPlans(clock) {
      const now = new Date(clock.now().getTime());
      return transact('readwrite', async (tx) => {
        const all = (await request(tx.objectStore('restorePoints').getAll())) as PointRow[];
        const points = all.filter((p) => p.reason === 'planDelete');
        const expired = points.filter(
          (p) => now.getTime() >= new Date(p.at).getTime() + RETENTION_MS,
        );
        const retained = points.filter((p) => !expired.includes(p));
        await Promise.all(
          expired.map((p) => request(tx.objectStore('restorePoints').delete(p.id))),
        );
        for (const id of new Set(expired.map((p) => p.planId))) {
          if (
            !retained.some((p) => p.planId === id) &&
            (await request(tx.objectStore('plans').get(id))) === undefined
          )
            await deleteByPlan(tx, 'restorePoints', id);
        }
        return retained
          .map((p) => ({
            planId: p.planId,
            name: planDisplayName(p.plan),
            deletedAt: p.at,
            restorePointId: p.id,
            expiresAt: new Date(new Date(p.at).getTime() + RETENTION_MS).toISOString(),
          }))
          .sort(
            (a, b) =>
              compareText(b.deletedAt, a.deletedAt) ||
              compareText(a.restorePointId, b.restorePointId),
          );
      });
    },
    async restoreDeletedPlan(restorePointId, clock) {
      const now = new Date(clock.now().getTime());
      return transact('readwrite', async (tx) => {
        const point = (await request(tx.objectStore('restorePoints').get(restorePointId))) as
          | PointRow
          | undefined;
        if (
          point === undefined ||
          point.reason !== 'planDelete' ||
          now.getTime() >= new Date(point.at).getTime() + RETENTION_MS
        )
          throw new StorageError('restorePointNotFound');
        const plan = migrateDocument(point.plan, point.formatVersion);
        const stands = (point.stands ?? []).map((s) => ({
          ...s,
          plan: migrateDocument(s.plan, point.formatVersion),
        }));
        const asCopy = (await request(tx.objectStore('plans').get(point.planId))) !== undefined;
        const row = newRow(
          asCopy ? { ...plan, id: crypto.randomUUID() } : plan,
          now.toISOString(),
          asCopy ? 0 : point.revision + 1,
          asCopy ? null : point.lastFileSaveAt,
          asCopy ? now.toISOString() : null,
        );
        await request(tx.objectStore('plans').add(row));
        await addSnapshots(tx, row.planId, stands, asCopy);
        await request(tx.objectStore('restorePoints').delete(point.id));
        return { ...loaded(row, { ...EMPTY_HISTORY, steps: [] }), asCopy };
      });
    },
    async pendingMigration(clock) {
      const now = new Date(clock.now().getTime());
      return ready(true, () => {
        if (!pending) return null;
        const fromVersion = db.version;
        return beginTransaction('readonly', async (tx) => {
          const rows = (await request(tx.objectStore('plans').getAll())) as PlanRow[];
          rows.sort(
            (a, b) => compareText(b.modifiedAt, a.modifiedAt) || compareText(a.planId, b.planId),
          );
          const backups: MigrationBackup[] = [];
          for (const row of rows) {
            const input = {
              version: fromVersion,
              plan: row.plan,
              revision: row.revision,
              modifiedAt: row.modifiedAt,
              stands: await visibleStands(tx, row),
            };
            backups.push({
              planId: row.planId,
              planName: planDisplayName(row.plan),
              modifiedAt: row.modifiedAt,
              standLabel:
                row.plan.stand === null
                  ? null
                  : `Stand V${row.plan.stand.version} vom ${formatDate(row.plan.stand.date, 'long')}`,
              fileName: migrationBackupFileName(row.plan, fromVersion, localDay(now)),
              bytes: () => serializeLegacyPlanFile(input, { now: () => now }),
            });
          }
          return { fromVersion, toVersion: format.version, backups };
        });
      });
    },
    async runMigration(clock, onProgress) {
      const now = new Date(clock.now().getTime());
      return ready(true, () => {
        if (!pending) return;
        const fromVersion = db.version;
        db.close();
        let finishBarrier: () => void = () => {};
        barrier = new Promise<void>((resolve) => {
          finishBarrier = resolve;
        });
        // Native IndexedDB kann den Versionswechsel noch an eigenen auslaufenden
        // Transaktionen blockieren. Die Barriere steht bereits; erst complete/abort,
        // dann die neue Öffnungsanfrage (fremde Verbindungen bleiben echte Blockierer).
        return Promise.allSettled([...activeTransactions]).then(() => {
          if (closed) {
            finishBarrier();
            throw new StorageError('unavailable');
          }
          return new Promise<void>((resolve, reject) => {
            let rejected = false;
            let failure: unknown;
            let r: IDBOpenDBRequest;
            async function reopen() {
              try {
                db = await openDatabase(factory, name, fromVersion);
                if (closed) db.close();
                else bind();
              } catch {
                closed = true;
              } finally {
                finishBarrier();
              }
            }
            try {
              r = factory.open(name, format.version);
            } catch (cause) {
              void reopen();
              reject(new StorageError('unavailable', undefined, { cause }));
              return;
            }
            r.onblocked = () => {
              rejected = true;
              reject(new StorageError('blocked'));
            };
            r.onupgradeneeded = () => {
              const tx = r.transaction;
              if (tx === null) return;
              if (rejected) {
                tx.abort();
                return;
              }
              void (async () => {
                const rows = (await request(tx.objectStore('plans').getAll())) as PlanRow[];
                rows.sort((a, b) => compareText(a.planId, b.planId));
                for (let i = 0; i < rows.length; i++) {
                  const row = rows[i];
                  if (row === undefined) continue;
                  const oldName = planDisplayName(row.plan);
                  try {
                    await addPoint(tx, row, 'migration', now, fromVersion);
                    row.plan = migrateDocument(row.plan, fromVersion);
                    for (const stand of await allByPlan<StandRecord>(tx, 'stands', row.planId))
                      await request(
                        tx
                          .objectStore('stands')
                          .put({ ...stand, plan: migrateDocument(stand.plan, fromVersion) }),
                      );
                    if (format.migrations.slice(fromVersion - 1).some((m) => !m.additive)) {
                      const change = cutHistory(await readHistory(tx, row, false));
                      await pruneHistory(tx, row, change);
                      row.historyHead = head(change.history);
                    }
                    await request(tx.objectStore('plans').put(row));
                  } catch (cause) {
                    failure = new StorageError('migrationFailed', { planName: oldName }, { cause });
                    throw failure;
                  }
                  try {
                    onProgress?.({ done: i + 1, total: rows.length });
                  } catch {
                    /* Rückmeldung ist kein Teil der Transaktion. */
                  }
                }
              })().catch((cause) => {
                failure ??= cause;
                try {
                  tx.abort();
                } catch {
                  /* Bereits abgebrochen. */
                }
              });
            };
            r.onerror = () => {
              void reopen().then(() => {
                if (!rejected)
                  reject(failure ?? new StorageError('unavailable', undefined, { cause: r.error }));
              });
            };
            r.onsuccess = () => {
              if (rejected || closed) {
                r.result.close();
                void reopen();
                if (!rejected) reject(new StorageError('unavailable'));
              } else {
                db = r.result;
                bind();
                pending = false;
                finishBarrier();
                resolve();
              }
            };
          });
        });
      });
    },
    async persistence() {
      return ready(true, async () => {
        if (storage === null)
          return { persisted: false, usageBytes: null, quotaBytes: null, nearFull: false };
        const persisted = await storage.persisted();
        const { usage, quota } = await storage.estimate();
        return {
          persisted,
          usageBytes: usage ?? null,
          quotaBytes: quota ?? null,
          nearFull:
            typeof usage === 'number' &&
            typeof quota === 'number' &&
            quota > 0 &&
            usage / quota > NEAR_FULL_RATIO,
        };
      });
    },
    async requestPersistence() {
      return ready(true, async () => {
        if (storage === null) return false;
        try {
          return await storage.persist();
        } catch {
          return false;
        }
      });
    },
    async setLastFileSave(planId, at) {
      return transact('readwrite', async (tx) => {
        if (!isIsoTimestamp(at)) throw new RangeError('Ungültiger Sicherungszeitpunkt.');
        const row = await planRow(tx, planId);
        row.lastFileSaveAt = at;
        await request(tx.objectStore('plans').put(row));
      });
    },
    close() {
      closed = true;
      try {
        db.close();
      } catch {
        /* close wirft nie. */
      }
    },
  };
  return store;
}

/** Lokaler Kalendertag, unabhängig vom UTC-Tag des Zeitpunkts. */
export function localDay(at: Date): IsoDate {
  return `${String(at.getFullYear()).padStart(4, '0')}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
}
