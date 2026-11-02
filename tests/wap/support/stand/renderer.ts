// Prüf-Renderer für Paket E1-05 (Vertrag docs/wap-planer/plan/vertraege/E1-05.md, Notiz «Ausarbeitung Schritt 2»
// Abschnitt H2). Erzeugt echte PDF mit writePdf (E1-02c): eine A4-Seite, Info-Feld Title = Argument `title`.
// Je eine Textzeile: «Stand ‹dd.mm.yyyy›» bzw. «Entwurf»; dann je Woche des Ziels (eine Woche bzw. alle Wochen in
// Planreihenfolge) deren `label` und danach je Eintrag der Woche, sortiert nach `id`, der Klartext:
// block, beso, querbalken Titel über resolveTitle (Läufe verbunden); rapport `code`; marker `kind` bzw. bei
// `custom` `customKind`; dayRemark und multiDayRemark `text`. «Eintrag der Woche»: `date` in der Woche;
// Querbalken und Bemerkung mit Bereich, wenn sich fromDate–toDate mit der Woche überschneidet; Bemerkung `week`
// bei gleicher Woche, `plan` in jeder Woche. Gestrichene Einträge erscheinen gleich wie andere. Deterministisch;
// protokolliert jeden Aufruf (Art, weekId, title, plan.stand, plan); Tor und Verhalten je Aufruf einstellbar.
// Keine E1-05-Logik (kein Dateiname).
import { writePdf } from '../../../../src/io/wap-pdf/writer';
import type { StandRenderers } from '../../../../src/io/wap-plan/standStore';
import { addDays } from '../../../../src/model/wap/calendar';
import { resolveTitle } from '../../../../src/model/wap/derive/agenda';
import type { PageItem } from '../../../../src/model/wap/layout/pageModel';
import type { Entry, Id, Plan, Week } from '../../../../src/model/wap/types';
import type { Tor } from './hilfen';

/** Ziel eines Prüf-PDF (strukturgleich mit PdfTarget aus E1-05). */
export type Ziel = { readonly kind: 'week'; readonly weekId: Id } | { readonly kind: 'plan' };

export interface RenderAufruf {
  readonly art: 'week' | 'plan';
  readonly weekId: Id | null;
  readonly title: string;
  readonly stand: Plan['stand'];
  readonly plan: Plan;
}

/**
 * Verhalten eines Aufrufs (Nummer ab 1 über alle Aufrufe): zuerst am Tor warten (falls gesetzt), dann
 * synchron werfen, ablehnen oder einen festen Wert liefern; sonst das Prüf-PDF.
 */
export interface Verhalten {
  readonly tor?: Tor;
  readonly werfen?: unknown;
  readonly ablehnen?: unknown;
  readonly liefern?: unknown;
}

function anzeigeDatum(iso: string): string {
  const [y = '', m = '', d = ''] = iso.split('-');
  return `${d}.${m}.${y}`;
}

function inWoche(w: Week, e: Entry): boolean {
  const von = w.startDate;
  const bis = addDays(w.startDate, 6);
  const ueberschneidet = (a: string, b: string): boolean => a <= bis && b >= von;
  switch (e.type) {
    case 'querbalken':
      return ueberschneidet(e.fromDate, e.toDate);
    case 'multiDayRemark':
      if (e.scope.kind === 'plan') return true;
      if (e.scope.kind === 'week') return e.scope.weekId === w.id;
      return ueberschneidet(e.scope.fromDate, e.scope.toDate);
    default:
      return e.date >= von && e.date <= bis;
  }
}

function klartext(plan: Plan, e: Entry): string {
  switch (e.type) {
    case 'block':
    case 'beso':
    case 'querbalken':
      return resolveTitle(plan, e.title)
        .map((r) => r.text)
        .join('');
    case 'rapport':
      return e.code;
    case 'marker':
      return e.kind === 'custom' ? e.customKind : e.kind;
    case 'dayRemark':
    case 'multiDayRemark':
      return e.text;
  }
}

/** Textzeilen des Prüf-PDF eines Ziels (H2). */
export function pruefZeilen(plan: Plan, ziel: Ziel): string[] {
  const zeilen = [plan.stand === null ? 'Entwurf' : `Stand ${anzeigeDatum(plan.stand.date)}`];
  const wochen = ziel.kind === 'plan' ? plan.weeks : plan.weeks.filter((w) => w.id === ziel.weekId);
  const eintraege = Object.values(plan.entries).sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );
  for (const w of wochen) {
    zeilen.push(w.label);
    for (const e of eintraege) if (inWoche(w, e)) zeilen.push(klartext(plan, e));
  }
  return zeilen;
}

const A4 = { widthPt: 595.28, heightPt: 841.89 } as const;

/** Prüf-PDF eines Ziels: eine A4-Seite mit den Zeilen von `pruefZeilen`, Title = `title`. */
export async function pruefPdf(plan: Plan, ziel: Ziel, title: string): Promise<Uint8Array> {
  const items: PageItem[] = pruefZeilen(plan, ziel).map((text, i) => ({
    kind: 'text',
    role: i === 0 ? 'header' : 'block',
    x: 40,
    baselineY: 40 + i * 12,
    rotation: 0,
    sizePt: 8,
    runs: [{ text, weight: 'regular', color: { r: 0, g: 0, b: 0 }, strike: false }],
    frame: { x: 36, y: 30 + i * 12, w: 520, h: 12 },
  }));
  return writePdf({ pages: [{ ...A4, kind: 'week', items }], title });
}

export class PruefRenderer implements StandRenderers {
  /** Protokoll aller Aufrufe in Aufrufreihenfolge. */
  readonly aufrufe: RenderAufruf[] = [];
  private readonly verhalten = new Map<number, Verhalten>();

  /** Stellt das Verhalten des n-ten Aufrufs ein (n ab 1, über Wochen- und Gesamt-PDF gezählt). */
  bei(n: number, v: Verhalten): this {
    this.verhalten.set(n, v);
    return this;
  }

  /** Gebunden: funktioniert auch ohne `this` (z.B. nach Destrukturierung). */
  readonly week = (plan: Plan, weekId: Id, title: string): Promise<Uint8Array> =>
    this.aufruf({ art: 'week', weekId, title, stand: plan.stand, plan }, { kind: 'week', weekId });

  /** Gebunden: funktioniert auch ohne `this`. */
  readonly plan = (plan: Plan, title: string): Promise<Uint8Array> =>
    this.aufruf({ art: 'plan', weekId: null, title, stand: plan.stand, plan }, { kind: 'plan' });

  private aufruf(a: RenderAufruf, ziel: Ziel): Promise<Uint8Array> {
    this.aufrufe.push(a);
    const v = this.verhalten.get(this.aufrufe.length);
    if (v !== undefined && v.tor === undefined && 'werfen' in v) throw v.werfen;
    return (async (): Promise<Uint8Array> => {
      if (v?.tor !== undefined) await v.tor.warten();
      if (v !== undefined && 'werfen' in v) throw v.werfen;
      if (v !== undefined && 'ablehnen' in v) throw v.ablehnen;
      if (v !== undefined && 'liefern' in v) return v.liefern as Uint8Array;
      return pruefPdf(a.plan, ziel, a.title);
    })();
  }
}
