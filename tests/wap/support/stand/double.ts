// In-Memory-Double des Ports StandStore (Vertrag docs/wap-planer/plan/vertraege/E1-05.md, Notiz «Ausarbeitung
// Schritt 2» Abschnitt E und H1). Erfüllt Abschnitt E wörtlich, im Speicher, einschliesslich der
// Revisionsregel: jeder Schreibvorgang an Dokument oder Historie (commitAtomic, Änderung, Undo, Redo,
// Wiederherstellen) erhöht die Revision des Plans um genau 1. Nur für Tests zusätzlich: gewöhnliche Änderung als
// Schritt (ohne Wiederherstellungspunkt), Undo (wendet inversePatches an) und Redo (wendet patches an),
// Wiederherstellen eines Dokuments als neuer Schritt, Ablegen einer Aufzeichnung mit vorgegebenen Feldern.
// Ein neuer Schritt verwirft den Redo-Zweig wie E1-04 §2: Aufzeichnungen mit seq im verworfenen Zweig werden
// gelöscht, hiddenBySeq im verworfenen Zweig wird null. Sichtbarkeit nach isRecordVisible (E1-04 §1):
// (seq = 0 oder Schritt seq angewendet) und (hiddenBySeq = null oder Schritt hiddenBySeq nicht angewendet).
// Zähler, Aufrufprotokoll je Port-Methode, Tore für load, standRecords und commitAtomic; das zuletzt abgelehnte
// Konfliktobjekt ist offengelegt (für `toBe`). Keine E1-05-Logik (keine Dateinamen, keine Zählung
// standsSameDay).
import { applyPatches, enablePatches, type Patch, produceWithPatches } from 'immer';
import type {
  Clock,
  StandCommitWrite,
  StandRecord,
  StandStore,
  StoredStandRecord,
} from '../../../../src/io/wap-plan/standStore';
import type { CommandResult } from '../../../../src/model/wap/commands/command';
import { WapError } from '../../../../src/model/wap/errors';
import type { Id, Plan } from '../../../../src/model/wap/types';
import type { Tor } from './hilfen';

enablePatches();

/** Meldung zu `conflict` bei einem Schreibauftrag mit standRecord (Notiz J1, Glossar). */
export const KONFLIKT_MELDUNG = {
  cause:
    'Der Plan wurde während des Stand-Setzens geändert. Kein Stand gesetzt; die Änderung ist gespeichert.',
  nextStep: 'Stand erneut setzen.',
} as const;

export interface Schritt {
  readonly seq: number;
  readonly label: string;
  readonly patches: readonly Patch[];
  readonly inversePatches: readonly Patch[];
}

export interface Wiederherstellungspunkt {
  readonly grund: string;
  readonly dokument: Plan;
}

/** Gespeicherte Aufzeichnung ohne berechnete Sichtbarkeit. */
type Aufzeichnung = StandRecord;

interface PlanZustand {
  dokument: Plan;
  revision: number;
  schritte: Schritt[];
  /** Anzahl angewendeter Schritte (Zeiger). */
  cursor: number;
  /** Nächste zu vergebende seq; beginnt bei 1, nie wiederverwendet. */
  naechsteSeq: number;
  punkte: Wiederherstellungspunkt[];
  aufzeichnungen: Aufzeichnung[];
}

export type PortMethode = 'load' | 'commitAtomic' | 'standRecords';

export interface Aufruf {
  readonly methode: PortMethode;
  readonly planId: Id;
  readonly write?: StandCommitWrite;
  readonly clock?: Clock;
}

export interface Zaehler {
  readonly aufzeichnungen: number;
  readonly schritte: number;
  readonly wiederherstellungspunkte: number;
}

export class StandStoreDouble implements StandStore {
  private readonly plaene = new Map<Id, PlanZustand>();
  /** Aufrufprotokoll aller Port-Methoden in Aufrufreihenfolge. */
  readonly aufrufe: Aufruf[] = [];
  /** Tore: ist eines gesetzt, wartet die Methode vor ihrer Wirkung daran (einmalig, danach entfernt). */
  readonly tore: { load?: Tor; standRecords?: Tor; commitAtomic?: Tor } = {};
  /** Das zuletzt von commitAtomic abgelehnte Konfliktobjekt. */
  letzterKonflikt: WapError | null = null;
  /** Fehler, mit dem die nächste Port-Methode der Art ablehnt (einmalig). */
  readonly fehler: { load?: unknown; standRecords?: unknown; commitAtomic?: unknown } = {};

  constructor(planId?: Id, plan?: Plan, revision = 0) {
    // Port-Methoden gebunden: funktionieren auch ohne `this` (z.B. nach Destrukturierung).
    this.load = this.load.bind(this);
    this.commitAtomic = this.commitAtomic.bind(this);
    this.standRecords = this.standRecords.bind(this);
    if (planId !== undefined && plan !== undefined) this.anlegen(planId, plan, revision);
  }

  /** Legt einen Plan an (ohne Schritt, ohne Wiederherstellungspunkt). */
  anlegen(planId: Id, plan: Plan, revision = 0): void {
    this.plaene.set(planId, {
      dokument: plan,
      revision,
      schritte: [],
      cursor: 0,
      naechsteSeq: 1,
      punkte: [],
      aufzeichnungen: [],
    });
  }

  // ------------------------------------------------------------------------------------------- Port

  async load(planId: Id): Promise<{ readonly plan: Plan; readonly revision: number } | null> {
    this.aufrufe.push({ methode: 'load', planId });
    await this.torPassieren('load');
    this.fehlerPruefen('load');
    const z = this.plaene.get(planId);
    return z === undefined ? null : { plan: z.dokument, revision: z.revision };
  }

  async commitAtomic(
    planId: Id,
    write: StandCommitWrite,
    clock: Clock,
  ): Promise<{ readonly savedAt: string; readonly revision: number; readonly seq: number }> {
    this.aufrufe.push({ methode: 'commitAtomic', planId, write, clock });
    await this.torPassieren('commitAtomic');
    this.fehlerPruefen('commitAtomic');
    const z = this.plaene.get(planId);
    if (z === undefined) {
      throw new WapError('notFound', {
        cause: 'Der Plan ist im Speicher nicht vorhanden.',
        nextStep: 'Den Plan neu öffnen.',
      });
    }
    if (z.revision !== write.expectedRevision) {
      const konflikt = new WapError('conflict', { ...KONFLIKT_MELDUNG });
      this.letzterKonflikt = konflikt;
      throw konflikt;
    }
    // Alles in einem Schritt: Punkt mit dem Dokument davor, Dokument, Revision, Historienschritt, Aufzeichnung.
    z.punkte.push({ grund: write.restorePoint, dokument: z.dokument });
    const seq = this.schrittAnhaengen(z, {
      label: write.result.label,
      patches: write.result.patches,
      inversePatches: write.result.inversePatches,
    });
    z.dokument = write.result.plan;
    z.revision += 1;
    const s = write.standRecord;
    z.aufzeichnungen.push({
      recordId: s.recordId,
      standId: s.standId,
      planId,
      date: s.date,
      version: s.version,
      plan: s.snapshot,
      pdfs: s.pdfs,
      seq,
      hiddenBySeq: null,
      standsSameDay: s.standsSameDay,
    });
    return { savedAt: clock.now().toISOString(), revision: z.revision, seq };
  }

  async standRecords(planId: Id): Promise<readonly StoredStandRecord[]> {
    this.aufrufe.push({ methode: 'standRecords', planId });
    await this.torPassieren('standRecords');
    this.fehlerPruefen('standRecords');
    const z = this.plaene.get(planId);
    if (z === undefined) return [];
    return z.aufzeichnungen.map((a) => ({ ...a, visible: this.sichtbar(z, a) }));
  }

  // ------------------------------------------------------------------------------- nur für Tests

  /** Gewöhnliche Änderung als neuer Schritt (Revision + 1, ohne Wiederherstellungspunkt). */
  aendern(
    planId: Id,
    befehl: (plan: Plan) => CommandResult,
  ): { readonly seq: number; readonly revision: number } {
    const z = this.zustand(planId);
    const r = befehl(z.dokument);
    const seq = this.schrittAnhaengen(z, {
      label: r.label,
      patches: r.patches,
      inversePatches: r.inversePatches,
    });
    z.dokument = r.plan;
    z.revision += 1;
    return { seq, revision: z.revision };
  }

  /** Undo des zuletzt angewendeten Schritts: inversePatches auf das Dokument, Zeiger − 1, Revision + 1. */
  undo(planId: Id): void {
    const z = this.zustand(planId);
    const s = z.schritte[z.cursor - 1];
    if (s === undefined) throw new Error('Testaufbau: kein Schritt für Undo');
    z.dokument = applyPatches(z.dokument, [...s.inversePatches]);
    z.cursor -= 1;
    z.revision += 1;
  }

  /** Redo des nächsten Schritts: patches auf das Dokument, Zeiger + 1, Revision + 1. */
  redo(planId: Id): void {
    const z = this.zustand(planId);
    const s = z.schritte[z.cursor];
    if (s === undefined) throw new Error('Testaufbau: kein Schritt für Redo');
    z.dokument = applyPatches(z.dokument, [...s.patches]);
    z.cursor += 1;
    z.revision += 1;
  }

  /** Stellt `dokument` als neuen Schritt her (Revision + 1). */
  wiederherstellen(
    planId: Id,
    dokument: Plan,
    label = 'Wiederhergestellt',
  ): { readonly seq: number } {
    const z = this.zustand(planId);
    const [next, patches, inversePatches] = produceWithPatches(z.dokument, () =>
      structuredClone(dokument),
    );
    const seq = this.schrittAnhaengen(z, { label, patches, inversePatches });
    z.dokument = next;
    z.revision += 1;
    return { seq };
  }

  /** Legt eine Aufzeichnung mit vorgegebenen Feldern ab (ohne Schritt, ohne Revisionsänderung). */
  ablegen(planId: Id, aufzeichnung: StandRecord): void {
    this.zustand(planId).aufzeichnungen.push(aufzeichnung);
  }

  dokument(planId: Id): Plan {
    return this.zustand(planId).dokument;
  }

  revision(planId: Id): number {
    return this.zustand(planId).revision;
  }

  zaehler(planId: Id): Zaehler {
    const z = this.zustand(planId);
    return {
      aufzeichnungen: z.aufzeichnungen.length,
      schritte: z.schritte.length,
      wiederherstellungspunkte: z.punkte.length,
    };
  }

  schritte(planId: Id): readonly Schritt[] {
    return [...this.zustand(planId).schritte];
  }

  wiederherstellungspunkte(planId: Id): readonly Wiederherstellungspunkt[] {
    return [...this.zustand(planId).punkte];
  }

  /** Gespeicherte Aufzeichnungen mit berechneter Sichtbarkeit, ohne Protokolleintrag. */
  aufzeichnungen(planId: Id): readonly StoredStandRecord[] {
    const z = this.zustand(planId);
    return z.aufzeichnungen.map((a) => ({ ...a, visible: this.sichtbar(z, a) }));
  }

  /** Methoden der Port-Aufrufe in Reihenfolge. */
  methoden(): PortMethode[] {
    return this.aufrufe.map((a) => a.methode);
  }

  /** Alle commitAtomic-Aufrufe. */
  commits(): Aufruf[] {
    return this.aufrufe.filter((a) => a.methode === 'commitAtomic');
  }

  // ------------------------------------------------------------------------------------- intern

  private zustand(planId: Id): PlanZustand {
    const z = this.plaene.get(planId);
    if (z === undefined) throw new Error(`Testaufbau: Plan ${planId} fehlt im Double`);
    return z;
  }

  private async torPassieren(m: PortMethode): Promise<void> {
    const tor = this.tore[m];
    if (tor === undefined) return;
    delete this.tore[m];
    await tor.warten();
  }

  private fehlerPruefen(m: PortMethode): void {
    if (!(m in this.fehler)) return;
    const f = this.fehler[m];
    delete this.fehler[m];
    throw f;
  }

  /** Schritt anhängen: Redo-Zweig verwerfen (E1-04 §2), neue seq vergeben, Zeiger ans Ende. */
  private schrittAnhaengen(z: PlanZustand, s: Omit<Schritt, 'seq'>): number {
    const verworfen = new Set(z.schritte.slice(z.cursor).map((x) => x.seq));
    if (verworfen.size > 0) {
      z.schritte = z.schritte.slice(0, z.cursor);
      z.aufzeichnungen = z.aufzeichnungen
        .filter((a) => !verworfen.has(a.seq))
        .map((a) =>
          a.hiddenBySeq !== null && verworfen.has(a.hiddenBySeq) ? { ...a, hiddenBySeq: null } : a,
        );
    }
    const seq = z.naechsteSeq;
    z.naechsteSeq += 1;
    z.schritte.push({ seq, ...s });
    z.cursor = z.schritte.length;
    return seq;
  }

  private angewendet(z: PlanZustand, seq: number): boolean {
    if (seq === 0) return true;
    return z.schritte.slice(0, z.cursor).some((s) => s.seq === seq);
  }

  private sichtbar(z: PlanZustand, a: Aufzeichnung): boolean {
    return (
      this.angewendet(z, a.seq) && (a.hiddenBySeq === null || !this.angewendet(z, a.hiddenBySeq))
    );
  }
}
