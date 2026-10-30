// Fiktive Pläne, Befehle, Stand-Schreibaufträge und Plan-Dateien für die Tests von Paket E1-04 (Vertrag
// docs/wap-planer/plan/vertraege/E1-04.md, Notiz «Ausarbeitung Schritt 2» Abschnitte D, E, L «Gemeinsam», M1).
// Grundlage ist der Prüf-Plan P von E1-05 (tests/wap/support/stand/**, eingefroren): createPlanFromTemplate mit der
// Kp-Vorlage, Beilage «Beilage 01-02 zum Allgemeinen Befehl (fiktiv)», Dienst «FDT 2026». Plan-Dateien werden hier
// ohne Funktion des Pakets gebaut (als `PlanFile`-Objekt bzw. als rohes JSON-Objekt und Bytes), damit Fehlerfälle
// gebaut werden können. Keine E1-04-Logik. Alle Inhalte sind fiktiv.
import type { PlanFile, StandSnapshotFile } from '../../../../src/io/wap-plan/planFile';
import type { StandRecordWrite } from '../../../../src/io/wap-plan/standStore';
import type { AtomicWrite, PlanStore } from '../../../../src/io/wap-plan/store';
import { type CommandResult, command } from '../../../../src/model/wap/commands/command';
import { updateEntry } from '../../../../src/model/wap/commands/entries';
import { applyStand } from '../../../../src/model/wap/stand/stand';
import type { Id, IsoDate, Plan } from '../../../../src/model/wap/types';
import { bytesFuer, planMitInhalt } from '../stand/ablauf';
import { ctx, DATUM, PLAN_ID } from '../stand/plan';
import type { TestUhr } from './uhr';

export { ctx, DATUM, PLAN_ID } from '../stand/plan';

/** Zweiter Plan (andere Plan-ID, anderer Dienst und Übungsname). */
export const PLAN_B_ID = 'p-zwei';

/** Plan A: Prüf-Plan P mit fiktivem Inhalt in jeder Woche (E1-05), Plan-ID `PLAN_ID`. */
export function planA(): Plan {
  return planMitInhalt();
}

/** Plan B: wie A, aber eigene Plan-ID, Dienst «WK 2027», Übungsname «ZWEI» (fiktiv). */
export function planB(over: Partial<Plan> = {}): Plan {
  return { ...planMitInhalt(), id: PLAN_B_ID, service: 'WK 2027', exerciseName: 'ZWEI', ...over };
}

/** Erstes Element; scheitert laut, wenn es fehlt (Testaufbau). */
export function erstes<T>(liste: readonly T[], was = 'Element'): T {
  const x = liste[0];
  if (x === undefined) throw new Error(`Testaufbau: ${was} fehlt`);
  return x;
}

/** Befehl «Titel des Blocks ändern» (E1-03 updateEntry). */
export function titel(id: Id, text: string): (plan: Plan) => CommandResult {
  return (plan) => updateEntry(plan, id, 'block', { title: [{ text, bold: false }] }, ctx);
}

/** Befehl «Motto ändern» (eine Änderung ohne Eintrag). */
export function motto(text: string): (plan: Plan) => CommandResult {
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

/** Befehl, der den ID-Zähler `nextId` um `n` erhöht (Prüfung AR0-31, AR0-41). */
export function zaehlerErhoehen(n: number): (plan: Plan) => CommandResult {
  return (plan) =>
    command(
      plan,
      'Zähler erhöht',
      (d) => {
        d.nextId += n;
      },
      ctx,
    );
}

/** Leeres Ergebnis (keine Patches) auf `plan`. */
export function leeresErgebnis(plan: Plan): CommandResult {
  return {
    plan,
    patches: [],
    inversePatches: [],
    label: 'Keine Änderung',
    affectedDates: [],
    affectedEntryIds: [],
  };
}

/** Wendet die Befehle der Reihe nach an; liefert die Ergebnisse. */
export function nacheinander(
  plan: Plan,
  befehle: readonly ((p: Plan) => CommandResult)[],
): CommandResult[] {
  const out: CommandResult[] = [];
  let p = plan;
  for (const b of befehle) {
    const r = b(p);
    out.push(r);
    p = r.plan;
  }
  return out;
}

/** Speichert einen Befehl über `commit` auf dem gespeicherten Dokument; liefert Ergebnis und seq. */
export async function speichern(
  store: PlanStore,
  planId: Id,
  befehl: (p: Plan) => CommandResult,
  uhr: TestUhr,
): Promise<{ readonly result: CommandResult; readonly seq: number; readonly revision: number }> {
  const geladen = await store.load(planId);
  if (geladen === null) throw new Error('Testaufbau: Plan fehlt im Speicher');
  const result = befehl(geladen.plan);
  const s = await store.commit(planId, result, uhr);
  return { result, seq: s.seq, revision: s.revision };
}

/** PDF-Bytes je Woche und 'plan' (fiktiv, je Kennung verschieden). */
export function pdfsFuer(plan: Plan, kennung: string): Map<string, Uint8Array> {
  return new Map(
    [...plan.weeks.map((w) => w.id), 'plan'].map((k): [string, Uint8Array] => [
      k,
      bytesFuer(kennung, k),
    ]),
  );
}

export interface StandOptionen {
  readonly standId: string;
  readonly recordId?: string;
  readonly date?: IsoDate;
  readonly version?: number;
  readonly standsSameDay?: number;
}

/** Stand-Befehl (applyStand, E1-05) und Aufzeichnung für `commitAtomic` auf `plan`. */
export function standAuftrag(
  plan: Plan,
  o: StandOptionen,
): { readonly result: CommandResult; readonly standRecord: StandRecordWrite } {
  const result = applyStand(
    plan,
    { date: o.date ?? DATUM, ...(o.version === undefined ? {} : { version: o.version }) },
    ctx,
  );
  const stand = result.plan.stand;
  if (stand === null) throw new Error('Testaufbau: applyStand ohne Stand');
  const recordId = o.recordId ?? `rec-${o.standId}`;
  return {
    result,
    standRecord: {
      recordId,
      standId: o.standId,
      date: stand.date,
      version: stand.version,
      snapshot: result.plan,
      pdfs: pdfsFuer(result.plan, recordId),
      standsSameDay: o.standsSameDay ?? 1,
    },
  };
}

/** Setzt einen Stand über `commitAtomic` (Grund 'stand') auf dem gespeicherten Dokument. */
export async function standSetzen(
  store: PlanStore,
  planId: Id,
  uhr: TestUhr,
  o: StandOptionen & { readonly importReport?: unknown },
): Promise<{
  readonly seq: number;
  readonly revision: number;
  readonly auftrag: AtomicWrite;
  readonly standRecord: StandRecordWrite;
}> {
  const geladen = await store.load(planId);
  if (geladen === null) throw new Error('Testaufbau: Plan fehlt im Speicher');
  const { result, standRecord } = standAuftrag(geladen.plan, o);
  const auftrag: AtomicWrite = {
    expectedRevision: geladen.revision,
    result,
    restorePoint: 'stand',
    standRecord,
    ...(o.importReport === undefined ? {} : { importReport: { report: o.importReport } }),
  };
  const s = await store.commitAtomic(planId, auftrag, uhr);
  return { seq: s.seq, revision: s.revision, auftrag, standRecord };
}

/** Import über `commitAtomic` (Grund 'import') mit Importbericht, ohne Stand. */
export async function importieren(
  store: PlanStore,
  planId: Id,
  uhr: TestUhr,
  befehl: (p: Plan) => CommandResult,
  report: unknown,
): Promise<{ readonly seq: number; readonly revision: number }> {
  const geladen = await store.load(planId);
  if (geladen === null) throw new Error('Testaufbau: Plan fehlt im Speicher');
  const s = await store.commitAtomic(
    planId,
    {
      expectedRevision: geladen.revision,
      result: befehl(geladen.plan),
      restorePoint: 'import',
      importReport: { report },
    },
    uhr,
  );
  return { seq: s.seq, revision: s.revision };
}

/** Stand-Eintrag einer Plan-Datei: Schnappschuss = `plan` mit Stand, PDF je Woche und 'plan'. */
export function dateiStand(
  plan: Plan,
  standId: string,
  o: { readonly date?: IsoDate; readonly version?: number; readonly standsSameDay?: number } = {},
): StandSnapshotFile {
  const date = o.date ?? DATUM;
  const version = o.version ?? 1;
  const snapshot: Plan = { ...plan, stand: { date, version } };
  return {
    standId,
    date,
    version,
    standsSameDay: o.standsSameDay ?? 1,
    plan: snapshot,
    pdfs: pdfsFuer(snapshot, `datei-${standId}`),
  };
}

export interface DateiOptionen {
  readonly revision?: number;
  readonly modifiedAt?: string;
  readonly savedAt?: string;
  readonly stands?: readonly StandSnapshotFile[];
  readonly containsInternalNotes?: boolean;
}

/** Gelesene Plan-Datei (Typ `PlanFile`), ohne Funktion des Pakets gebaut. */
export function planDatei(plan: Plan, o: DateiOptionen = {}): PlanFile {
  return {
    format: 'wap-planer-plan',
    version: 1,
    planId: plan.id,
    revision: o.revision ?? 3,
    modifiedAt: o.modifiedAt ?? '2026-10-01T12:00:00.000Z',
    savedAt: o.savedAt ?? '2026-10-02T12:00:00.000Z',
    containsInternalNotes: o.containsInternalNotes ?? false,
    plan,
    stands: o.stands ?? [],
  };
}

/** Base64 (RFC 4648, Standardalphabet) ohne Buffer. */
export function base64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

/** Bytes aus Base64. */
export function ausBase64(text: string): Uint8Array {
  return Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
}

/** Tiefe, veränderbare Kopie reiner Daten (JSON). */
export function jsonKopie<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/** Rohes Dateiobjekt (wie aus JSON.parse) zu einer Plan-Datei; Bytes als Base64 (Abschnitt D1, D2). */
export function rohDatei(datei: PlanFile): Record<string, unknown> {
  return {
    format: datei.format,
    version: datei.version,
    planId: datei.planId,
    revision: datei.revision,
    modifiedAt: datei.modifiedAt,
    savedAt: datei.savedAt,
    containsInternalNotes: datei.containsInternalNotes,
    plan: jsonKopie(datei.plan),
    stands: datei.stands.map((s) => ({
      standId: s.standId,
      date: s.date,
      version: s.version,
      standsSameDay: s.standsSameDay,
      plan: jsonKopie(s.plan),
      pdfs: [...s.pdfs].map(([key, b]) => ({ key, base64: base64(b) })),
    })),
  };
}

/** UTF-8-Bytes eines Textes (Uint8Array dieses Realms, TR-E105-01). */
export function textBytes(text: string): Uint8Array {
  return Uint8Array.from(new TextEncoder().encode(text));
}

/** Plan-Datei aus einem Objekt (M1): JSON.stringify, UTF-8. */
export function jsonBytes(wert: unknown): Uint8Array {
  return textBytes(JSON.stringify(wert));
}

/** Text der Bytes (UTF-8). */
export function alsText(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}

/** Kopie der Bytes für Vorher-nachher-Vergleiche. */
export function bytesKopie(bytes: Uint8Array): number[] {
  return Array.from(bytes);
}

/** Plan-Inhalt eines Eintrags als veränderbares Objekt (für Fehlerfälle im rohen Dateiobjekt). */
export function rohEintrag(roh: Record<string, unknown>, id: Id): Record<string, unknown> {
  const plan = roh.plan as Record<string, unknown>;
  const entries = plan.entries as Record<string, Record<string, unknown>>;
  const e = entries[id];
  if (e === undefined) throw new Error(`Testaufbau: Eintrag ${id} fehlt`);
  return e;
}

/** Plan-ID von Plan A (für Lesbarkeit in Tests). */
export const A: Id = PLAN_ID;
