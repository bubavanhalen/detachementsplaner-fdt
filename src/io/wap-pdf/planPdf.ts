// Wochen-PDF und Gesamt-PDF aus dem Plan (Vertrag E1-02f, Notiz «Ausarbeitung Schritt 2» Abschnitt B, C;
// Änderungsnotiz aus E1-02e CR-03; ADR-005 Punkt 4, Leitplanken 1, 2, 4; R-10-03).
// Bildschirm und PDF hängen nur über layoutWeekForOutput bzw. layoutWeekForOutputSync vom Plan ab.

import { PDFDocument } from 'pdf-lib';
import { type UserMessage, WapError } from '../../model/wap/errors';
import {
  a3,
  type ImageItem,
  type LayoutWarning,
  layoutWeekPage,
  type PageModel,
  type PageOptions,
  type WeekPageLayout,
} from '../../model/wap/layout';
import type { Id, ImageAsset, Plan } from '../../model/wap/types';
import { sanitizeImageBytes } from './imageBytes';
import { writePdf } from './writer';

export interface RenderedPdf {
  readonly bytes: Uint8Array;
  /** Seiten des Dokuments: Wochenseiten und Fortsetzungsseiten (R-10-02, R-10-03). */
  readonly pageCount: number;
  /** Zahl der Rückfallereignisse: Summe von WeekPageLayout.fallbacks.length über die gerenderten Wochen. */
  readonly fallbacks: number;
  /**
   * Warnungen der gerenderten Layouts (Änderungsnotiz CR-03 Nr 3); bei renderPlanPdf steht `invalidImage`
   * höchstens einmal, mit `page` 0.
   */
  readonly warnings: readonly LayoutWarning[];
}

/** 'noWeeks': Gesamt-PDF eines Plans ohne Woche (V-02f-1). */
export type PlanPdfErrorCode = 'noWeeks';

/** Verbindliche Meldungstexte (Vertrag E1-02f Abschnitt C). */
export const PLAN_PDF_MESSAGES: { readonly [C in PlanPdfErrorCode]: UserMessage } = {
  noWeeks: {
    cause: 'Der Plan enthält keine Woche. Ein Gesamt-PDF ist deshalb nicht möglich.',
    nextStep: 'Zuerst eine Woche anlegen, dann das PDF erneut erzeugen.',
  },
};

/** Fehler der Plan-PDF-Erzeugung (Vertrag E1-02f Abschnitt C). */
export class PlanPdfError extends WapError {
  declare readonly code: PlanPdfErrorCode;

  constructor(code: PlanPdfErrorCode, options?: { cause?: unknown }) {
    super(code, PLAN_PDF_MESSAGES[code], options);
  }
}

/** Layout für Bildschirm und PDF nach der Prüfung des Wappens (Änderungsnotiz CR-03 Nr 2). */
export interface OutputLayout {
  readonly layout: WeekPageLayout;
  readonly coatOfArmsDropped: boolean;
  readonly warnings: readonly LayoutWarning[];
}

// ---------------------------------------------------------------- Wappen (Änderungsnotiz CR-03 Nr 2)

/** Warnung bei nicht einbettbarem Wappen (Änderungsnotiz CR-03 Nr 2; E1-02e B, G2). */
const WAPPEN_WARNUNG: LayoutWarning = {
  code: 'invalidImage',
  character: null,
  codePoint: null,
  entryId: null,
  page: 0,
  item: null,
};

/** Ergebnis der Prüfung je Wappen-Objekt (Identität von `plan.coatOfArms`). */
const einbettbar = new WeakMap<ImageAsset, boolean>();

/** Das Wappen der Seiten: erstes `ImageItem` mit Rolle `sidebar`; null ohne Wappen. */
function wappenBild(pages: readonly PageModel[]): ImageItem | null {
  for (const page of pages) {
    for (const item of page.items) {
      if (item.kind === 'image' && item.role === 'sidebar') return item;
    }
  }
  return null;
}

/** Ergebnis bei einbettbarem oder fehlendem Wappen. */
function unveraendert(layout: WeekPageLayout): OutputLayout {
  return { layout, coatOfArmsDropped: false, warnings: layout.warnings };
}

/** Ergebnis bei nicht einbettbarem Wappen: Layout ohne Wappen, Warnung angehängt. */
function ohneWappen(plan: Plan, weekId: Id, options: PageOptions): OutputLayout {
  const layout = layoutWeekPage({ ...plan, coatOfArms: null }, weekId, options);
  return { layout, coatOfArmsDropped: true, warnings: [...layout.warnings, WAPPEN_WARNUNG] };
}

/** Ergebnis einer früheren Prüfung dieses Objekts aus dem Zwischenspeicher; undefined, wenn noch keines vorliegt. */
export function knownEmbeddable(asset: ImageAsset): boolean | undefined {
  return einbettbar.get(asset);
}

/**
 * Annahme wie writePdf (bettBildEin, writer.ts): bereinigen, in ein neues Dokument einbetten, `embed()`.
 * Jede Ausnahme ergibt false. Wirft nie; lädt fontkit nicht.
 */
export async function imageEmbeddable(
  mime: 'image/png' | 'image/jpeg',
  bytes: Uint8Array,
): Promise<boolean> {
  try {
    const sauber = sanitizeImageBytes(mime, bytes);
    if (sauber === null) return false;
    const doc = await PDFDocument.create({ updateMetadata: false });
    const bild = mime === 'image/png' ? await doc.embedPng(sauber) : await doc.embedJpg(sauber);
    await bild.embed();
    return true;
  } catch {
    return false;
  }
}

/** Ergebnis der Prüfung je Unterschrift-Objekt (Identität von plan.signatureImage). */
const unterschriftEinbettbar = new WeakMap<ImageAsset, boolean>();

/**
 * Plan ohne nicht einbettbare Unterschrift (Notiz E1-02f CR-03 zu E1-10): Ist das Bild nicht einbettbar, entfällt es
 * am Bildschirm und im PDF; der Plan bleibt sonst gleich. null, solange die Prüfung (synchron) noch aussteht.
 */
async function mitPruefterUnterschrift(plan: Plan): Promise<Plan> {
  const asset = plan.signatureImage;
  if (!plan.signatureEnabled || asset === null) return plan;
  let ok = unterschriftEinbettbar.get(asset);
  if (ok === undefined) {
    ok = await imageEmbeddable(asset.mime, sanitizedOrEmpty(asset));
    unterschriftEinbettbar.set(asset, ok);
  }
  return ok ? plan : { ...plan, signatureEnabled: false };
}

function mitPruefterUnterschriftSync(plan: Plan): Plan | null {
  const asset = plan.signatureImage;
  if (!plan.signatureEnabled || asset === null) return plan;
  const ok = unterschriftEinbettbar.get(asset);
  if (ok === undefined) return null;
  return ok ? plan : { ...plan, signatureEnabled: false };
}

/** Bytes des Bildes aus Base64 (Browser und Node); leer bei ungültiger Kodierung. */
function sanitizedOrEmpty(asset: ImageAsset): Uint8Array {
  try {
    const bin = atob(asset.dataBase64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return new Uint8Array(0);
  }
}

/** A3 (E1-10, F-43): Layout der A4-Seite, danach um √2 skaliert (gleiche Umbrüche). */
function aufPapier(out: OutputLayout, paper: PageOptions['paper']): OutputLayout {
  return paper === 'A3' ? { ...out, layout: a3(out.layout) } : out;
}

/**
 * layoutWeekPage, bei nicht einbettbarem Wappen erneut mit coatOfArms null, bei nicht einbettbarer Unterschrift
 * ohne Unterschrift; A3 als skalierte A4-Seite. Fehler wie layoutWeekPage, als abgelehntes Promise.
 */
export async function layoutWeekForOutput(
  plan: Plan,
  weekId: Id,
  options: PageOptions,
): Promise<OutputLayout> {
  return aufPapier(
    await layoutA4ForOutput(await mitPruefterUnterschrift(plan), weekId, {
      ...options,
      paper: 'A4',
    }),
    options.paper,
  );
}

async function layoutA4ForOutput(
  plan: Plan,
  weekId: Id,
  options: PageOptions,
): Promise<OutputLayout> {
  const layout = layoutWeekPage(plan, weekId, options);
  const bild = wappenBild(layout.pages);
  if (bild === null) return unveraendert(layout);
  const asset = plan.coatOfArms;
  let ok = asset === null ? undefined : einbettbar.get(asset);
  if (ok === undefined) {
    ok = await imageEmbeddable(bild.mime, bild.bytes);
    if (asset !== null) einbettbar.set(asset, ok);
  }
  return ok ? unveraendert(layout) : ohneWappen(plan, weekId, options);
}

/** Wie layoutWeekForOutput, aber synchron; null, solange das Wappen dieses Plans noch nicht geprüft ist. Fehler wie layoutWeekPage (synchron). */
export function layoutWeekForOutputSync(
  plan: Plan,
  weekId: Id,
  options: PageOptions,
): OutputLayout | null {
  const geprueft = mitPruefterUnterschriftSync(plan);
  if (geprueft === null) return null;
  const out = layoutA4ForOutputSync(geprueft, weekId, { ...options, paper: 'A4' });
  return out === null ? null : aufPapier(out, options.paper);
}

function layoutA4ForOutputSync(plan: Plan, weekId: Id, options: PageOptions): OutputLayout | null {
  const layout = layoutWeekPage(plan, weekId, options);
  if (wappenBild(layout.pages) === null) return unveraendert(layout);
  const ok = plan.coatOfArms === null ? undefined : knownEmbeddable(plan.coatOfArms);
  if (ok === undefined) return null;
  return ok ? unveraendert(layout) : ohneWappen(plan, weekId, options);
}

// ---------------------------------------------------------------- PDF

/** T-1: Titel ist ein String, nach trim() nicht leer; sonst Programmfehler. */
function pruefeTitel(title: unknown): asserts title is string {
  if (typeof title !== 'string' || title.trim() === '') throw new RangeError('PDF-Titel fehlt');
}

/**
 * Eine Woche (plus Fortsetzungsseiten) als PDF. title: PDF-Titel ohne «.pdf»; der Aufrufer bildet ihn
 * (E1-05 pdfFileName), T-1. Fehler nur als abgelehntes Promise (T-2): RangeError('PDF-Titel fehlt'),
 * ModelError 'unknownWeek', übrige Fehler von layoutWeekPage und PdfWriteError unverändert.
 * fontkit wird erst in writePdf ausgewertet (ADR-001).
 */
export async function renderWeekPdf(
  plan: Plan,
  weekId: Id,
  options: PageOptions,
  title: string,
): Promise<RenderedPdf> {
  pruefeTitel(title);
  const aus = await layoutWeekForOutput(plan, weekId, options);
  const bytes = await writePdf({ pages: aus.layout.pages, title });
  return {
    bytes,
    pageCount: aus.layout.pages.length,
    fallbacks: aus.layout.fallbacks.length,
    warnings: aus.warnings,
  };
}

/**
 * Gesamt-PDF: alle Wochen in Planreihenfolge, je Woche Wochenseite und Fortsetzungsseiten, mit genau einem
 * writePdf (R-10-03). Fehler nur als abgelehntes Promise (T-2): RangeError('PDF-Titel fehlt'),
 * PlanPdfError 'noWeeks', sonst der erste Fehler in Wochenfolge unverändert; kein Teil-PDF.
 */
export async function renderPlanPdf(
  plan: Plan,
  options: PageOptions,
  title: string,
): Promise<RenderedPdf> {
  pruefeTitel(title);
  if (plan.weeks.length === 0) throw new PlanPdfError('noWeeks');
  const pages: PageModel[] = [];
  const warnings: LayoutWarning[] = [];
  let fallbacks = 0;
  let wappenFehlt = false;
  for (const week of plan.weeks) {
    const aus = await layoutWeekForOutput(plan, week.id, options);
    pages.push(...aus.layout.pages);
    fallbacks += aus.layout.fallbacks.length;
    for (const w of aus.warnings) {
      if (w.code === 'invalidImage') wappenFehlt = true;
      else warnings.push(w);
    }
  }
  // invalidImage betrifft den ganzen Plan: höchstens einmal, mit page 0 (Änderungsnotiz CR-03 Nr 3).
  if (wappenFehlt) warnings.push(WAPPEN_WARNUNG);
  const bytes = await writePdf({ pages, title });
  return { bytes, pageCount: pages.length, fallbacks, warnings };
}
