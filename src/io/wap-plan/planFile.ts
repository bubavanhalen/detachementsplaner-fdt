// Plan-Datei (Vertrag E1-04, Notiz «Ausarbeitung Schritt 2 (07.10.2026)» Abschnitte C–F; ADR-006 Punkt 5, ADR-007 Punkt 2;
// Beschrieb 5.6 Punkt 5 und 7; R-5.6-17, R-H-33). Rein bis auf den Clock-Parameter. Lesen ist streng: jede Abweichung vom
// Schema (Abschnitt E), auch ein unbekannter Schlüssel in irgendeinem Objekt, ergibt PlanFileError 'corrupt'; es wird nie
// still normalisiert, ergänzt oder verworfen.

import { formatDate } from '../../model/wap/calendar';
import { type UserMessage, WapError } from '../../model/wap/errors';
import { fileNamePrefix } from '../../model/wap/stand/fileName';
import type { IsoDate, Plan } from '../../model/wap/types';
import { isObject, SchemaError, validateFile, withoutUndefined } from './schema';
import type { Clock } from './standStore';

/** Kennung im Feld `format` jeder Plan-Datei. */
export const PLAN_FILE_FORMAT = 'wap-planer-plan';

/** Formatversion von Plan-Datei, Speicherschema (IndexedDB-Version) und Wiederherstellungspunkten (Abschnitt F1). */
export const FORMAT_VERSION = 1;

/** Glossar «Plan-Datei»: gleich FORMAT_VERSION. */
export const PLAN_FILE_VERSION = FORMAT_VERSION;

/** Hebt ein Plan-Dokument (roh, aus JSON) von `fromVersion` auf `fromVersion + 1`; rein; wirft bei unbrauchbarer Eingabe. */
export interface FormatMigration {
  readonly fromVersion: number;
  /** Nur ergänzend (Abschnitt F1): fügt nur optionale Felder hinzu, ändert keinen bestehenden Wert; dann bleibt die Undo-Historie (F5). */
  readonly additive: boolean;
  migrate(plan: unknown): unknown;
}

/** Zielversion und Migrationskette (Abschnitt F1). migrations[i].fromVersion = i + 1; Länge = version − 1. */
export interface PlanFormat {
  readonly version: number;
  readonly migrations: readonly FormatMigration[];
}

/** Format dieser Version des WAP-Planers: Version 1, keine Migration (Etappe 1). */
export const CURRENT_FORMAT: PlanFormat = { version: FORMAT_VERSION, migrations: [] };

/** Stand-Aufzeichnung in der Plan-Datei; im JSON stehen die Bytes als Base64 (Abschnitt D, E). */
export interface StandSnapshotFile {
  readonly standId: string;
  readonly date: IsoDate;
  readonly version: number;
  /** Notiz E1-02f: Pflicht, ganze Zahl ≥ 1, unverändert übernommen. */
  readonly standsSameDay: number;
  readonly plan: Plan;
  /** Schlüssel weekId bzw. 'plan' (AR0-26), Reihenfolge wie in der Datei. */
  readonly pdfs: ReadonlyMap<string, Uint8Array>;
}

export interface PlanFile {
  readonly format: typeof PLAN_FILE_FORMAT;
  readonly version: number;
  readonly planId: string;
  readonly revision: number;
  readonly modifiedAt: string;
  readonly savedAt: string;
  /** Für den Hinweis beim Sichern (R-6-39, F-46); gleich hasInternalNotes(plan). */
  readonly containsInternalNotes: boolean;
  readonly plan: Plan;
  readonly stands: readonly StandSnapshotFile[];
}

/** Eingabe von serializePlanFile; planId, savedAt, containsInternalNotes und version bildet die Funktion selbst. */
export interface PlanFileInput {
  readonly plan: Plan;
  readonly revision: number;
  readonly modifiedAt: string;
  readonly stands: readonly StandSnapshotFile[];
}

/** Sicherung im alten Format vor einer Migration (Abschnitt C3): Dokumente ungeprüft und unverändert. */
export interface LegacyPlanFileInput {
  readonly version: number;
  readonly plan: Plan;
  readonly revision: number;
  readonly modifiedAt: string;
  readonly stands: readonly StandSnapshotFile[];
}

export type LocalComparison = 'noLocal' | 'same' | 'localNewer' | 'localOlder';

export type PlanFileErrorCode =
  | 'invalidJson'
  | 'notPlanFile'
  | 'newerVersion'
  | 'corrupt'
  | 'notSerializable';

/** Verbindliche Meldungen (Abschnitt G2); bei 'newerVersion' ersetzt PlanFileError {v} und {max}. */
export const PLAN_FILE_MESSAGES: { readonly [C in PlanFileErrorCode]: UserMessage } = {
  invalidJson: {
    cause: 'Die Datei ist keine lesbare Plan-Datei (kein gültiges JSON). Nichts wurde geändert.',
    nextStep: 'Eine mit «Datei sichern» erstellte Plan-Datei wählen.',
  },
  notPlanFile: {
    cause: 'Die Datei ist keine Plan-Datei des WAP-Planers. Nichts wurde geändert.',
    nextStep: 'Eine mit «Datei sichern» erstellte Plan-Datei wählen.',
  },
  newerVersion: {
    cause:
      'Die Plan-Datei stammt aus einer neueren Version des WAP-Planers (Format {v}); diese Version liest höchstens Format {max}. Nichts wurde geändert.',
    nextStep: 'Den WAP-Planer aktualisieren und die Plan-Datei danach erneut öffnen.',
  },
  corrupt: {
    cause: 'Die Plan-Datei ist beschädigt oder unvollständig. Nichts wurde geändert.',
    nextStep: 'Eine frühere Sicherung der Plan-Datei öffnen.',
  },
  notSerializable: {
    cause:
      'Der Plan kann nicht als Plan-Datei gesichert werden, weil er eine ungültige Angabe enthält. Der Plan im Speicher ist unverändert.',
    nextStep:
      'Die letzte Änderung rückgängig machen (Ctrl+Z) und erneut sichern. Hilft das nicht: den Plan über «Wiederherstellungspunkte» auf einen früheren Stand zurücksetzen.',
  },
};

export interface PlanFileErrorDetails {
  /** Bei 'corrupt' und 'notSerializable': Pfad der ersten Abweichung (Abschnitt E5), z.B. 'plan.entries.e12.subtasks[0].stufe'. */
  readonly path?: string;
  /** Bei 'newerVersion': Formatversion der Datei. */
  readonly version?: number;
  /** Bei 'newerVersion': höchste lesbare Version (Standard FORMAT_VERSION). */
  readonly maxVersion?: number;
}

export class PlanFileError extends WapError {
  declare readonly code: PlanFileErrorCode;
  readonly path: string | null;
  readonly version: number | null;

  constructor(
    code: PlanFileErrorCode,
    details?: PlanFileErrorDetails,
    options?: { cause?: unknown },
  ) {
    const base = PLAN_FILE_MESSAGES[code];
    const v = String(details?.version ?? '');
    const max = String(details?.maxVersion ?? FORMAT_VERSION);
    const message: UserMessage =
      code === 'newerVersion'
        ? {
            cause: base.cause.replaceAll('{v}', v).replaceAll('{max}', max),
            nextStep: base.nextStep,
          }
        : base;
    super(code, message, options);
    this.path = details?.path ?? null;
    this.version = details?.version ?? null;
  }
}

/** Zielversion und lückenlose Migrationsfolge (Vertrag F1). */
export function checkFormat(format: PlanFormat): void {
  if (
    !isObject(format) ||
    !Number.isSafeInteger(format.version) ||
    format.version < 1 ||
    !Array.isArray(format.migrations) ||
    format.migrations.length !== format.version - 1 ||
    format.migrations.some((m, i) => !isObject(m) || m.fromVersion !== i + 1)
  ) {
    throw new RangeError('Ungültige Formatversion oder Migrationsfolge.');
  }
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  // Kleine Stücke vermeiden die Argumentgrenze bei grossen PDFs.
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
function decodeBase64(text: string): Uint8Array {
  const binary = atob(text);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}
function envelope(
  input: PlanFileInput,
  savedAt: string,
  version: number,
  containsInternalNotes = hasInternalNotes(input.plan),
) {
  return {
    format: PLAN_FILE_FORMAT,
    version,
    planId: input.plan.id,
    revision: input.revision,
    modifiedAt: input.modifiedAt,
    savedAt,
    containsInternalNotes,
    plan: input.plan,
    stands: input.stands.map((s) => ({
      standId: s.standId,
      date: s.date,
      version: s.version,
      standsSameDay: s.standsSameDay,
      plan: s.plan,
      pdfs: [...s.pdfs].map(([key, bytes]) => ({ key, base64: encodeBase64(bytes) })),
    })),
  };
}
function jsonBytes(v: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(v, null, 2));
}

/** UTF-8-JSON mit kanonischer Reihenfolge und derselben Prüfung wie beim Öffnen. */
export function serializePlanFile(
  input: PlanFileInput,
  clock: Clock,
  format: PlanFormat = CURRENT_FORMAT,
): Uint8Array {
  checkFormat(format);
  const now = clock.now();
  try {
    // Die Notiz-Angabe entsteht erst aus dem geprüften Dokument, damit auch beschädigte
    // Notizfelder den vorgesehenen Schemafehler liefern.
    return jsonBytes(
      validateFile(
        withoutUndefined(envelope(input, now.toISOString(), format.version, false)),
        hasInternalNotes,
        true,
      ),
    );
  } catch (cause) {
    if (cause instanceof SchemaError)
      throw new PlanFileError('notSerializable', { path: cause.path }, { cause });
    throw cause;
  }
}

/** Sicherung im bisherigen Format; die Dokumente bleiben ungeprüft. */
export function serializeLegacyPlanFile(input: LegacyPlanFileInput, clock: Clock): Uint8Array {
  return jsonBytes(envelope(input, clock.now().toISOString(), input.version));
}

export function parsePlanFile(bytes: Uint8Array, format: PlanFormat = CURRENT_FORMAT): PlanFile {
  checkFormat(format);
  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch (cause) {
    throw new PlanFileError('invalidJson', undefined, { cause });
  }
  return migratePlanFile(raw, format);
}

export function migratePlanFile(raw: unknown, format: PlanFormat = CURRENT_FORMAT): PlanFile {
  checkFormat(format);
  if (!isObject(raw) || !Object.hasOwn(raw, 'format') || raw.format !== PLAN_FILE_FORMAT)
    throw new PlanFileError('notPlanFile');
  if (
    !Object.hasOwn(raw, 'version') ||
    typeof raw.version !== 'number' ||
    !Number.isSafeInteger(raw.version) ||
    raw.version < 1
  ) {
    throw new PlanFileError('corrupt', { path: 'version' });
  }
  if (raw.version > format.version)
    throw new PlanFileError('newerVersion', { version: raw.version, maxVersion: format.version });
  const copy = structuredClone(raw);
  for (let version = raw.version; version < format.version; version++) {
    const migration = format.migrations[version - 1];
    if (migration === undefined) throw new RangeError('Fehlende Migration.');
    try {
      copy.plan = migration.migrate(copy.plan);
    } catch (cause) {
      throw new PlanFileError('corrupt', { path: 'plan' }, { cause });
    }
    if (Array.isArray(copy.stands)) {
      copy.stands.forEach((stand: unknown, i: number) => {
        if (isObject(stand) && isObject(stand.plan)) {
          try {
            stand.plan = migration.migrate(stand.plan);
          } catch (cause) {
            throw new PlanFileError('corrupt', { path: `stands[${i}].plan` }, { cause });
          }
        }
      });
    }
  }
  copy.version = format.version;
  let checked: Record<string, unknown>;
  try {
    checked = validateFile(copy, hasInternalNotes);
  } catch (cause) {
    if (cause instanceof SchemaError)
      throw new PlanFileError('corrupt', { path: cause.path }, { cause });
    throw cause;
  }
  const stands = (
    checked.stands as readonly {
      standId: string;
      date: IsoDate;
      version: number;
      standsSameDay: number;
      plan: Plan;
      pdfs: readonly { key: string; base64: string }[];
    }[]
  ).map((s) => ({ ...s, pdfs: new Map(s.pdfs.map((p) => [p.key, decodeBase64(p.base64)])) }));
  return { ...checked, stands } as unknown as PlanFile;
}

export function compareWithLocal(
  file: PlanFile,
  local: { readonly plan: Plan; readonly revision: number; readonly modifiedAt: string } | null,
): LocalComparison {
  if (local === null) return 'noLocal';
  if (local.plan.id !== file.planId) throw new RangeError('Unterschiedliche Plan-Kennungen.');
  if (local.revision === file.revision && local.modifiedAt === file.modifiedAt) return 'same';
  return local.modifiedAt > file.modifiedAt ||
    (local.modifiedAt === file.modifiedAt && local.revision > file.revision)
    ? 'localNewer'
    : 'localOlder';
}
export function planFileName(plan: Plan, savedAt: IsoDate): string {
  return `${fileNamePrefix(plan)}_Plan_${formatDate(savedAt, 'file')}.wap.json`;
}
export function migrationBackupFileName(plan: Plan, fromVersion: number, date: IsoDate): string {
  if (!Number.isSafeInteger(fromVersion) || fromVersion < 1)
    throw new RangeError('Ungültige Formatversion.');
  return `${fileNamePrefix(plan)}_Plan_vor-Update_Format${fromVersion}_${formatDate(date, 'file')}.wap.json`;
}
export function hasInternalNotes(plan: Plan): boolean {
  const entries = [...Object.values(plan.entries), ...plan.deletedWeeks.flatMap((w) => w.entries)];
  const weeks = [...plan.weeks, ...plan.deletedWeeks.map((w) => w.week)];
  return (
    entries.some((e) => e.internalNote.trim() !== '') ||
    weeks.some((w) => w.days.some((d) => d.internalNote.trim() !== ''))
  );
}
export function planDisplayName(plan: Plan): string {
  const service = plan.service.trim();
  const exercise = plan.exerciseName.trim();
  return service && exercise
    ? `${service} «${exercise}»`
    : service || (exercise ? `«${exercise}»` : 'Plan ohne Namen');
}
