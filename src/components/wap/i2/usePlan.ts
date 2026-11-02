import { useEffect, useState } from 'react';
import type { ImportProgress, ImportReport } from '../../../io/wap-import/index';
import { renderPlanPdf, renderWeekPdf } from '../../../io/wap-pdf/index';
import { type PlanFile, parsePlanFile } from '../../../io/wap-plan/planFile';
import {
  exportTitle,
  listStands,
  type StandRenderers,
  type StandSummary,
  setNewStand,
  standPdf,
} from '../../../io/wap-plan/standStore';
import {
  type LoadedPlan,
  openPlanStore,
  type PendingMigration,
  type PersistenceStatus,
  type PlanStore,
  type PlanSummary,
  type RestorePointInfo,
} from '../../../io/wap-plan/store';
import type { CommandContext, CommandResult } from '../../../model/wap/commands/command';
import { createdKeptSets, tidyKeptColumnSets } from '../../../model/wap/commands/dayColumns';
import { type UserMessage, WapError } from '../../../model/wap/errors';
import { createPlanFromTemplate } from '../../../model/wap/factories';
import { EMPTY_HISTORY, type Patch, pushStep, redo } from '../../../model/wap/history/history';
import type { PdfTarget } from '../../../model/wap/stand/fileName';
import type { StandInput } from '../../../model/wap/stand/stand';
import { applyNewPlanDays, builtInTemplates, templateById } from '../../../model/wap/template';
import type { Id, Plan } from '../../../model/wap/types';
import type { ExcelImportEngine } from '../import/engine';
import { namingPlan, planFileNameFor } from './fileNames';

const clock = { now: () => new Date() };
const context: CommandContext = { templates: builtInTemplates() };
export type PlanCommand = (plan: Plan, ctx: CommandContext) => CommandResult;
type Snapshot = {
  ready: boolean;
  loaded: LoadedPlan | null;
  summaries: readonly PlanSummary[];
  busy: boolean;
  readOnly: boolean;
  readOnlyReason: string;
  error: UserMessage | null;
  pending: CommandResult | null;
  migration: PendingMigration | null;
  /** Sofort angezeigter Stand der eingereihten Befehle (I2b-A A3: kein Zurückspringen, Speichern im Hintergrund). */
  optimistic: Plan | null;
};

/**
 * Vorauslaufprotokoll (I2b-A A3): Ein sofort angezeigter, noch nicht gespeicherter Befehl steht synchron im
 * lokalen Speicher des Browsers, bis er im Planspeicher liegt. Nach einem Neuladen mitten im Speichern wird
 * er nachgetragen, sofern der Plan noch auf derselben Revision steht. Nur dieses Gerät, keine Übertragung.
 */
interface JournalEntry {
  readonly planId: Id;
  readonly baseRevision: number;
  readonly label: string;
  readonly patches: readonly Patch[];
  readonly inversePatches: readonly Patch[];
  readonly affectedDates: readonly string[];
  readonly affectedEntryIds: readonly string[];
}

export function downloadLocal(bytes: Uint8Array, fileName: string, mime: string) {
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes).buffer], { type: mime }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function message(error: unknown): UserMessage {
  return error instanceof WapError
    ? error.userMessage
    : {
        cause: 'Der Vorgang konnte nicht abgeschlossen werden.',
        nextStep: 'Die Plan-Datei sichern und erneut versuchen.',
      };
}

/** A tab owns one session per database. React StrictMode and route remounts only subscribe. */
export class I2Session {
  state: Snapshot = {
    ready: false,
    loaded: null,
    summaries: [],
    busy: false,
    readOnly: true,
    readOnlyReason: '',
    error: null,
    pending: null,
    migration: null,
    optimistic: null,
  };
  private listeners = new Set<() => void>();
  private store: PlanStore | null = null;
  private tail: Promise<unknown> = Promise.resolve();
  /** In dieser Sitzung von «Spalte entfernen» aufbewahrte Spaltensätze (Aufräumen nur dieser; CR-5-03). */
  private keptSets = new Map<Id, Set<Id>>();
  private releaseLease: (() => void) | null = null;
  private leaseDone: Promise<unknown> = Promise.resolve();
  private jobs = 0;
  private otherJobs = 0;
  private journal: JournalEntry[] = [];
  readonly initialized: Promise<void>;
  constructor(
    private dbName: string,
    private demos?: readonly Plan[],
  ) {
    this.initialized = this.boot();
    window.addEventListener('beforeunload', (event) => {
      if (this.state.pending || this.jobs > 0) event.preventDefault();
    });
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(patch: Partial<Snapshot>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => {
      listener();
    });
  }
  report(error: unknown) {
    this.publish({ error: message(error) });
  }
  private get storage() {
    if (!this.store) throw new Error('Speicher nicht bereit');
    return this.store;
  }
  private async boot() {
    try {
      this.store = await openPlanStore({ dbName: this.dbName });
      const migration = await this.store.pendingMigration(clock);
      if (migration) {
        this.publish({ ready: true, migration });
        return;
      }
      await this.loadInitial();
    } catch (error) {
      this.publish({ ready: true, error: message(error) });
    }
  }
  private async loadInitial() {
    for (const demo of this.demos ?? []) {
      if (!(await this.storage.load(demo.id))) {
        try {
          await this.storage.create(demo, clock);
        } catch (error) {
          if (!(error instanceof WapError && error.code === 'planExists')) throw error;
        }
      }
    }
    const summaries = await this.storage.listPlans();
    let preferred: string | null = null;
    try {
      preferred = localStorage.getItem(`${this.dbName}:selected`);
    } catch {
      /* Preference is optional. */
    }
    const id =
      summaries.find((p) => p.id === preferred)?.id ?? this.demos?.[0]?.id ?? summaries[0]?.id;
    this.publish({ summaries, migration: null });
    if (id) await this.selectNow(id);
    this.publish({ ready: true });
  }
  private get journalKey() {
    return `${this.dbName}:journal`;
  }
  private writeJournal(): boolean {
    try {
      if (this.journal.length === 0) localStorage.removeItem(this.journalKey);
      else localStorage.setItem(this.journalKey, JSON.stringify(this.journal));
      return true;
    } catch {
      return false;
    }
  }
  private readJournal(): JournalEntry[] {
    try {
      const raw = localStorage.getItem(this.journalKey);
      const parsed: unknown = raw === null ? [] : JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as JournalEntry[]) : [];
    } catch {
      return [];
    }
  }
  private dropJournal(entry: JournalEntry | null) {
    if (entry === null) return;
    this.journal = this.journal.filter((e) => e !== entry);
    this.writeJournal();
  }
  /** Trägt Befehle nach, die vor dem Neuladen angezeigt, aber nicht mehr gespeichert wurden. */
  private async replayJournal(loaded: LoadedPlan): Promise<LoadedPlan> {
    const stored = this.readJournal();
    const own = stored.filter((e) => e.planId === loaded.plan.id);
    this.journal = stored.filter((e) => e.planId !== loaded.plan.id);
    this.writeJournal();
    let current = loaded;
    for (const entry of [...own].sort((a, b) => a.baseRevision - b.baseRevision)) {
      if (entry.baseRevision !== current.revision) continue;
      // Patches über das Modell anwenden (Redo eines einzelnen Schritts), ohne eigenen Patch-Code.
      const step = {
        seq: 1,
        label: entry.label,
        at: '',
        patches: entry.patches,
        inversePatches: entry.inversePatches,
      };
      const applied = redo(current.plan, { ...EMPTY_HISTORY, steps: [step] });
      if (applied === null) continue;
      const result: CommandResult = {
        plan: applied.plan,
        patches: entry.patches,
        inversePatches: entry.inversePatches,
        label: entry.label,
        affectedDates: entry.affectedDates,
        affectedEntryIds: entry.affectedEntryIds,
      };
      const saved = await this.storage.commit(current.plan.id, result, clock, {
        expectedRevision: current.revision,
      });
      current = {
        ...current,
        plan: result.plan,
        history: pushStep(current.history, {
          label: result.label,
          at: saved.savedAt,
          patches: result.patches,
          inversePatches: result.inversePatches,
        }).history,
        revision: saved.revision,
        modifiedAt: saved.savedAt,
      };
    }
    return current;
  }
  private enqueue<T>(run: () => Promise<T>, other = true): Promise<T> {
    this.jobs++;
    if (other) this.otherJobs++;
    this.publish({ busy: true, error: null });
    const result = this.tail.then(async () => {
      await this.initialized;
      return run();
    });
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result
      .catch((error: unknown) => {
        this.report(error);
        throw error;
      })
      .finally(() => {
        this.jobs--;
        if (other) this.otherJobs--;
        this.publish(this.jobs > 0 ? { busy: true } : { busy: false, optimistic: null });
      });
  }
  private assertWritable() {
    if (this.state.readOnly || this.state.pending)
      throw new WapError('readOnly', {
        cause: this.state.pending
          ? 'Die letzte Änderung ist noch nicht gespeichert.'
          : 'Der Plan ist nur zum Lesen geöffnet.',
        nextStep: this.state.pending
          ? 'Die Plan-Datei sichern oder das Speichern erneut versuchen.'
          : 'Andere Tabs mit diesem Plan schliessen und den Plan erneut wählen.',
      });
  }
  private async lease(id: Id) {
    this.releaseLease?.();
    this.releaseLease = null;
    await this.leaseDone;
    const locks = navigator.locks;
    if (!locks) return false;
    let decide!: (granted: boolean) => void;
    const decision = new Promise<boolean>((resolve) => {
      decide = resolve;
    });
    this.leaseDone = locks
      .request(`wap-planer:${this.dbName}:plan:${id}`, { ifAvailable: true }, async (lock) => {
        if (!lock) {
          decide(false);
          return;
        }
        const leaseHeld = new Promise<void>((resolve) => {
          this.releaseLease = resolve;
        });
        decide(true);
        await leaseHeld;
      })
      .catch(() => {
        decide(false);
      });
    return decision;
  }
  private async selectNow(id: Id) {
    this.publish({ readOnly: true, readOnlyReason: 'Der Plan wird geöffnet …' });
    const writable = await this.lease(id);
    let loaded = await this.storage.load(id);
    if (loaded && writable) loaded = await this.replayJournal(loaded);
    this.publish({
      loaded,
      readOnly: !writable,
      readOnlyReason: writable
        ? ''
        : 'Nur lesen: Der Plan ist in einem anderen Tab geöffnet oder dieser Browser unterstützt die Plansperre nicht. Nächster Schritt: den anderen Tab mit dem WAP-Planer schliessen und diese Seite neu laden (F5).',
      pending: null,
    });
    try {
      localStorage.setItem(`${this.dbName}:selected`, id);
    } catch {
      /* Preference is optional. */
    }
  }
  select = (id: Id) =>
    this.enqueue(async () => {
      if (this.state.pending) this.assertWritable();
      await this.selectNow(id);
    });
  /** Vorschau sofort zeigen; der eigentliche Befehl läuft danach in der Warteschlange auf dem gespeicherten Stand. */
  private preview(run: PlanCommand): JournalEntry | null {
    const loaded = this.state.loaded;
    const base =
      this.state.optimistic && this.state.optimistic.id === loaded?.plan.id
        ? this.state.optimistic
        : loaded?.plan;
    // Nur hinter reinen Befehlen: dann entspricht die Vorschau genau dem späteren Lauf.
    if (!loaded || !base || this.state.readOnly || this.state.pending || this.otherJobs > 0)
      return null;
    try {
      const result = run(base, context);
      if (result.patches.length === 0) return null;
      const entry: JournalEntry = {
        planId: loaded.plan.id,
        baseRevision:
          loaded.revision + this.journal.filter((e) => e.planId === loaded.plan.id).length,
        label: result.label,
        patches: result.patches,
        inversePatches: result.inversePatches,
        affectedDates: result.affectedDates,
        affectedEntryIds: result.affectedEntryIds,
      };
      this.journal = [...this.journal, entry];
      if (!this.writeJournal()) {
        this.journal = this.journal.filter((e) => e !== entry);
        return null;
      }
      this.publish({ optimistic: result.plan });
      return entry;
    } catch {
      /* Der Befehl meldet seinen Fehler beim eigentlichen Lauf. */
      return null;
    }
  }
  command = (given: PlanCommand) => {
    // Aufbewahrte Spaltensätze ohne Verweis räumt derselbe Rückgängig-Schritt auf (CR-4-03) – nur Sätze, die ein
    // Befehl dieser Sitzung aufbewahrt hat, erkannt am Aufbau statt am Namen (CR-5-03).
    const run: PlanCommand = (p, ctx) => {
      const r = given(p, ctx);
      const kept = this.keptSets.get(p.id) ?? new Set<Id>();
      for (const id of createdKeptSets(p, r.plan)) kept.add(id);
      if (kept.size > 0) this.keptSets.set(p.id, kept);
      return tidyKeptColumnSets(r, ctx, kept);
    };
    const entry = this.preview(run);
    return this.enqueue(async () => {
      this.assertWritable();
      const before = this.state.loaded;
      if (!before) return;
      const result = run(before.plan, context);
      if (result.patches.length === 0) return;
      try {
        await this.commit(before, result);
      } catch (error) {
        this.publish({ pending: result, optimistic: null });
        throw error;
      }
    }, false)
      .catch((error: unknown) => {
        this.publish({ optimistic: null });
        throw error;
      })
      .finally(() => this.dropJournal(entry));
  };
  private async commit(before: LoadedPlan, result: CommandResult) {
    const saved = await this.storage.commit(before.plan.id, result, clock, {
      expectedRevision: before.revision,
    });
    const history = pushStep(before.history, {
      label: result.label,
      at: saved.savedAt,
      patches: result.patches,
      inversePatches: result.inversePatches,
    }).history;
    this.publish({
      loaded: {
        ...before,
        plan: result.plan,
        history,
        revision: saved.revision,
        modifiedAt: saved.savedAt,
      },
      pending: null,
    });
  }
  retry = () =>
    this.enqueue(async () => {
      if (this.state.readOnly) this.assertWritable();
      if (this.state.pending && this.state.loaded)
        await this.commit(this.state.loaded, this.state.pending);
    });
  history = (redo: boolean) =>
    this.enqueue(async () => {
      this.assertWritable();
      const before = this.state.loaded;
      if (!before) return;
      const result = await this.storage[redo ? 'redo' : 'undo'](before.plan.id, clock, {
        expectedRevision: before.revision,
      });
      if (result)
        this.publish({
          loaded: {
            ...before,
            plan: result.plan,
            history: result.history,
            revision: result.revision,
            modifiedAt: result.savedAt,
          },
        });
    });
  create = (name: string, templateId: string, startDate: string, weekCount: number) =>
    this.enqueue(async () => {
      if (this.state.pending) this.assertWritable();
      if (!name.trim())
        throw new WapError('missingName', {
          cause: 'Der Planname ist leer.',
          nextStep: 'Einen Planname eingeben und den Plan erneut anlegen.',
        });
      const template = templateById(templateId, context.templates);
      const created = createPlanFromTemplate(template, {
        planId: crypto.randomUUID(),
        startDate,
        weekCount,
      });
      // Tage nach der Vorlage (H-LAYOUT, SA-H-14): ein frischer Plan startet ohne Befund.
      const plan = applyNewPlanDays({ ...created, exerciseName: name.trim() }, template);
      await this.storage.create(plan, clock);
      this.publish({ summaries: await this.storage.listPlans() });
      await this.selectNow(plan.id);
      try {
        await this.storage.requestPersistence();
      } catch {
        /* Persistence permission is optional; the created plan is saved. */
      }
    });
  /**
   * «Excel-WAP importieren» (I4, Beschrieb 5.7, 8.2): Vorprüfung ohne Speicher, dann neuer Plan aus der
   * Kp-Vorlage und runImport (Wiederherstellungspunkt, ein Undo-Schritt, erster Stand, Bericht). Scheitert der
   * Import, wird der eben angelegte leere Plan wieder entfernt (wiederherstellbar). Die Datei bleibt lokal.
   */
  importExcel = (
    engine: ExcelImportEngine,
    bytes: Uint8Array,
    fileName: string,
    run: {
      readonly onProgress?: (p: ImportProgress) => void;
      readonly signal?: AbortSignal;
      readonly onWriting?: () => void;
    } = {},
  ) =>
    this.enqueue(async (): Promise<ImportReport> => {
      if (this.state.pending) this.assertWritable();
      const template = templateById('kp', context.templates);
      const draft = createPlanFromTemplate(template, {
        planId: crypto.randomUUID(),
        startDate: '2026-01-05',
        weekCount: 1,
      });
      // Personenliste des geöffneten Plans für Regel 12 (Klammer = Ort, ausser Name aus Personen- oder Funktionsliste →
      // Ltg; Beschrieb 8.2): nur übergeben, nicht in den neuen Plan kopiert; ohne Plan bzw. Personen leer.
      const options = {
        template,
        persons: this.state.loaded?.plan.persons ?? [],
        functionList: draft.functionList,
      };
      const probe = engine.importBytes(draft, bytes, fileName, options, context);
      const first = probe.result.plan.weeks[0]?.startDate ?? '2026-01-05';
      const plan = {
        ...createPlanFromTemplate(template, {
          planId: crypto.randomUUID(),
          startDate: first,
          weekCount: 1,
        }),
        exerciseName: fileName.replace(/\.xlsx$/i, ''),
      };
      await this.storage.create(plan, clock);
      try {
        const outcome = await engine.runImport(
          this.storage,
          plan.id,
          bytes,
          fileName,
          options,
          {
            week: async (p, weekId, title) =>
              (
                await renderWeekPdf(
                  p,
                  weekId,
                  { paper: 'A4', showStatus: true, templates: context.templates },
                  title,
                )
              ).bytes,
            plan: async (p, title) =>
              (
                await renderPlanPdf(
                  p,
                  { paper: 'A4', showStatus: true, templates: context.templates },
                  title,
                )
              ).bytes,
          },
          clock,
          { ctx: context, ...run },
        );
        this.publish({ summaries: await this.storage.listPlans() });
        await this.selectNow(plan.id);
        return outcome.report;
      } catch (error) {
        try {
          await this.storage.deletePlan(plan.id, clock);
        } catch {
          /* Der leere Plan bleibt dann bestehen; die Meldung zum Import gilt. */
        }
        this.publish({ summaries: await this.storage.listPlans() });
        throw error;
      }
    });
  /** Letzter sichtbarer Importbericht des Plans (nach Undo des Imports ausgeblendet, AR0-12). */
  importReport = async (planId: Id): Promise<ImportReport | null> => {
    await this.initialized;
    const records = await this.storage.importReports(planId);
    const report = records[0]?.report;
    return report !== undefined && typeof report === 'object' && report !== null
      ? (report as ImportReport)
      : null;
  };
  readFile = async (file: File): Promise<PlanFile> => {
    try {
      return parsePlanFile(new Uint8Array(await file.arrayBuffer()));
    } catch (error) {
      this.report(error);
      throw error;
    }
  };
  openFile = (file: PlanFile, copy = false) =>
    this.enqueue(async () => {
      if (this.state.pending) this.assertWritable();
      if (!copy && (await this.storage.load(file.planId))) return false;
      let loaded: LoadedPlan;
      try {
        loaded = await this.storage[copy ? 'importAsCopy' : 'openFromFile'](file, clock);
      } catch (error) {
        if (!copy && error instanceof WapError && error.code === 'planExists') return false;
        throw error;
      }
      this.publish({ summaries: await this.storage.listPlans() });
      await this.selectNow(loaded.plan.id);
      return true;
    });
  saveFile = () =>
    this.enqueue(async (): Promise<string | null> => {
      const loaded = this.state.loaded;
      if (!loaded) return null;
      const pending = this.state.pending;
      const output = await this.storage.exportPlanFile(
        loaded.plan.id,
        clock,
        pending
          ? {
              override: {
                plan: pending.plan,
                revision: loaded.revision,
                modifiedAt: clock.now().toISOString(),
              },
            }
          : undefined,
      );
      // Dateiname nach Konvention mit Planname, Datum und Uhrzeit (I2b-B B8).
      const fileName = planFileNameFor(pending?.plan ?? loaded.plan, clock.now());
      downloadLocal(output.bytes, fileName, 'application/json');
      if (!this.state.readOnly && !pending) {
        const at = clock.now().toISOString();
        await this.storage.setLastFileSave(loaded.plan.id, at);
        const current = this.state.loaded;
        if (current !== null && current.plan.id === loaded.plan.id)
          this.publish({ loaded: { ...current, lastFileSaveAt: at } });
      }
      return fileName;
    });
  pdf = async (weekId: Id, showStatus = true): Promise<string | null> => {
    try {
      await this.tail;
      const plan = this.state.pending?.plan ?? this.state.loaded?.plan;
      if (!plan) return null;
      const title = await exportTitle(this.storage, plan.id, namingPlan(plan), {
        kind: 'week',
        weekId,
      });
      const pdf = await renderWeekPdf(
        plan,
        weekId,
        { paper: 'A4', showStatus, statusRendering: true, templates: context.templates },
        title,
      );
      downloadLocal(pdf.bytes, `${title}.pdf`, 'application/pdf');
      return `${title}.pdf`;
    } catch (error) {
      this.report(error);
      throw error;
    }
  };
  /**
   * «Ersetzen» beim Öffnen einer Plan-Datei (I2b-B B6; Beschrieb 5.6 Pkt 5): vorher entsteht ein
   * Wiederherstellungspunkt «vor Ersetzen», das Ersetzen ist ein Undo-Schritt (ADR-006 P.2b).
   */
  replaceFile = (file: PlanFile) =>
    this.enqueue(async () => {
      this.assertWritable();
      await this.storage.replaceFromFile(file.planId, file, clock);
      this.publish({ summaries: await this.storage.listPlans() });
      await this.selectNow(file.planId);
    });
  // ---------------------------------------------------------------------------------------------
  // I5: Stand, Ausgabe, Wiederherstellungspunkte, Speicherzustand (Beschrieb 5.5, 5.6, 7, 10)
  // ---------------------------------------------------------------------------------------------

  /** Wie enqueue, meldet aber `aborted` nicht als Fehler (Abbrechen ist kein Fehler, UI-Richtlinie 11.2). */
  private enqueueQuiet<T>(run: () => Promise<T>): Promise<T> {
    this.jobs++;
    this.otherJobs++;
    this.publish({ busy: true, error: null });
    const result = this.tail.then(async () => {
      await this.initialized;
      return run();
    });
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result
      .catch((error: unknown) => {
        if (!(error instanceof WapError && error.code === 'aborted')) this.report(error);
        throw error;
      })
      .finally(() => {
        this.jobs--;
        this.otherJobs--;
        this.publish(this.jobs > 0 ? { busy: true } : { busy: false, optimistic: null });
      });
  }
  /** Plan nach einem Schreibvorgang neu laden (Historie, Revision, Datei-Sicherung). */
  private async reload(planId: Id) {
    const loaded = await this.storage.load(planId);
    if (loaded !== null) this.publish({ loaded, pending: null });
  }
  /** Sichtbare Stände des geöffneten Plans, neueste zuerst (Beschrieb 5.5). */
  stands = async (): Promise<readonly StandSummary[]> => {
    await this.initialized;
    const id = this.state.loaded?.plan.id;
    return id === undefined ? [] : listStands(this.storage, id);
  };
  /**
   * «Neuen Stand setzen» atomar (E1-05; ADR-006 P.2a): erst alle Stand-PDF, dann Dokument, Schritt und Aufzeichnung
   * in einer Transaktion. `signal` bricht bis vor dem Schreiben ab, `onWriting` meldet den Beginn des Schreibens.
   */
  setStand = (
    input: StandInput,
    renderers: StandRenderers,
    options: { readonly signal?: AbortSignal; readonly onWriting?: () => void } = {},
  ) =>
    this.enqueueQuiet(async () => {
      this.assertWritable();
      const id = this.state.loaded?.plan.id;
      if (id === undefined) return null;
      const result = await setNewStand(this.storage, id, input, renderers, clock, {
        ctx: context,
        ...(options.signal === undefined ? {} : { signal: options.signal }),
        ...(options.onWriting === undefined ? {} : { onWriting: options.onWriting }),
      });
      await this.reload(id);
      return result;
    });
  /** Gespeichertes PDF eines früheren Stands, unverändert (R-5.5-06; G-12 a: A4, Status rot). */
  standPdf = (standId: string, target: PdfTarget) =>
    this.enqueueQuiet(async (): Promise<string | null> => {
      const id = this.state.loaded?.plan.id;
      if (id === undefined) return null;
      const out = await standPdf(this.storage, id, standId, target);
      downloadLocal(out.bytes, out.fileName, 'application/pdf');
      return out.fileName;
    });
  /** Letzter sichtbarer Stand mit Dokument (für «Änderungen markieren» und «Stand veraltet»). */
  lastStandPlan = async (): Promise<Plan | null> => {
    await this.initialized;
    const id = this.state.loaded?.plan.id;
    if (id === undefined) return null;
    const visible = (await this.storage.standRecords(id)).filter((r) => r.visible);
    visible.sort((a, b) => b.version - a.version || b.seq - a.seq);
    return visible[0]?.plan ?? null;
  };
  /** PDF der Arbeitsfassung: Woche oder ganzer Plan, A4/A3, Status rot, Änderungen markieren (Beschrieb 10). */
  exportPdf = async (request: {
    readonly target: PdfTarget;
    readonly paper: 'A4' | 'A3';
    readonly showStatus: boolean;
    readonly changedEntryIds?: readonly Id[];
  }): Promise<string | null> => {
    try {
      await this.tail;
      const plan = this.state.pending?.plan ?? this.state.loaded?.plan;
      if (!plan) return null;
      const title = await exportTitle(this.storage, plan.id, namingPlan(plan), request.target);
      const options = {
        paper: request.paper,
        showStatus: request.showStatus,
        statusRendering: true,
        templates: context.templates,
        ...(request.changedEntryIds === undefined
          ? {}
          : { changedEntryIds: request.changedEntryIds }),
      } as const;
      const pdf =
        request.target.kind === 'week'
          ? await renderWeekPdf(plan, request.target.weekId, options, title)
          : await renderPlanPdf(plan, options, title);
      downloadLocal(pdf.bytes, `${title}.pdf`, 'application/pdf');
      return `${title}.pdf`;
    } catch (error) {
      this.report(error);
      throw error;
    }
  };
  /** Wiederherstellungspunkte des geöffneten Plans, neueste zuerst (Beschrieb 5.6 Pkt 2). */
  restorePoints = async (): Promise<readonly RestorePointInfo[]> => {
    await this.initialized;
    const id = this.state.loaded?.plan.id;
    return id === undefined ? [] : this.storage.listRestorePoints(id);
  };
  /** Punkt wiederherstellen: vorher Punkt «vor Wiederherstellung», selbst rückgängig machbar (R-5.6-09). */
  restore = (restorePointId: Id) =>
    this.enqueue(async () => {
      this.assertWritable();
      const id = this.state.loaded?.plan.id;
      if (id === undefined) return;
      await this.storage.restore(id, restorePointId, clock);
      await this.reload(id);
    });
  /** Dauerhaft, Belegung und Kontingent des Speichers (Beschrieb 5.6 Pkt 4; navigator.storage). */
  persistence = async (): Promise<PersistenceStatus | null> => {
    try {
      await this.initialized;
      return this.store === null ? null : await this.store.persistence();
    } catch {
      return null;
    }
  };
  /** Dauerhaften Speicher beim Browser anfragen; false, wenn er ablehnt. */
  requestPersistence = async (): Promise<boolean> => {
    try {
      await this.initialized;
      return this.store === null ? false : await this.store.requestPersistence();
    } catch {
      return false;
    }
  };
  migrate = (backup: boolean) =>
    this.enqueue(async () => {
      const migration = this.state.migration;
      if (!migration) return;
      if (backup)
        for (const file of migration.backups)
          downloadLocal(file.bytes(), file.fileName, 'application/json');
      await this.storage.runMigration(clock);
      await this.loadInitial();
    });
}

const sessions = new Map<string, I2Session>();
export function usePlan(demoPlans?: readonly Plan[]) {
  const dbName = demoPlans ? 'wap-planer-i2-demo' : 'wap-planer';
  const [session] = useState(() => {
    let existing = sessions.get(dbName);
    if (!existing) {
      existing = new I2Session(dbName, demoPlans);
      sessions.set(dbName, existing);
    }
    return existing;
  });
  const [state, setState] = useState(session.state);
  useEffect(() => {
    const update = () => setState(session.state);
    const unsubscribe = session.subscribe(update);
    update();
    return unsubscribe;
  }, [session]);
  return {
    session,
    state,
    plan:
      state.pending?.plan ??
      (state.optimistic && state.optimistic.id === state.loaded?.plan.id
        ? state.optimistic
        : null) ??
      state.loaded?.plan ??
      null,
  };
}
