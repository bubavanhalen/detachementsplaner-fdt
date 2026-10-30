// Node-Seite der Paritäts- und Wochenansichtstests von Paket E1-02f (Vertrag E1-02f, Notiz «Ausarbeitung
// Schritt 2» Abschnitte E «Node-Seite», G, J; Änderungsnotiz CR-03 Nr 5). Läuft nur im Kindprozess über die
// Vite-API (tests/wap-e2e/parity/support/kindprozess.ts), weil die Schriften über Vite `?inline` kommen und die
// KVK-Fixture als JSON-Modul geladen wird. Liefert die Pläne als JSON (pseudonymisierte KVK-Fixture, KVK+,
// synthetischer Plan, fiktive Varianten) und die Sollwerte aus `layoutWeekPage` (Zahl der TextItem je Seite,
// Zeilentexte, Seitengrösse) sowie die SHA-256 von `renderWeekPdf` für den Determinismus (X8).
import { createHash } from 'node:crypto';
import { renderWeekPdf } from '../../../../src/io/wap-pdf';
import { SHARED_GLYPH_PRIMARY } from '../../../../src/io/wap-pdf/fontkitAdapter';
import { sanitizeImageBytes } from '../../../../src/io/wap-pdf/imageBytes';
import { layoutWeekPage } from '../../../../src/model/wap/layout/page/compose';
import type { PageOptions, WeekPageLayout } from '../../../../src/model/wap/layout/page/types';
import {
  LINE_EXCLUDED_CODEPOINTS,
  type PageItem,
  type TextItem,
} from '../../../../src/model/wap/layout/pageModel';
import type { Block, Plan, Rgb } from '../../../../src/model/wap/types';
import {
  fortsetzung,
  mitEintrag,
  mitWappen,
  optionen,
  pngLeeresIdat,
  pngNurIhdr,
  tagesbemerkungen,
} from '../../../wap/pdf/plan/support/plaene';
import { KVK_WOCHE, kvk, kvkPlus, MO, mitEintraegen } from '../../../wap/support/page/varianten';
import { syntheticPlan } from '../../../wap/support/synthetic-plan';

export type PlanName = 'kvk' | 'kvkPlus' | 'fortsetzung' | 'synthetisch' | 'kvkPlusIhdr';

/**
 * Varianten, die erst eine Suche über das Layout bzw. eine Vorbedingung festlegt. Sie werden einzeln gebildet;
 * scheitert eine, steht ihr Fehler in `variantenFehler`, und nur die Tests dieser Variante werden rot (TR-E102f-08).
 */
export type VariantenName = 'x6Lage' | 'x6Text' | 'x6Farbe' | 'w8' | 'fortsetzung2' | 'x10';

export interface Variante {
  readonly plan: Plan;
  /** Sollwerte des Layouts, das Bildschirm und PDF zeichnen (bei nicht einbettbarem Wappen ohne Wappen). */
  readonly wochen: readonly WochenFakt[];
  /** Zeilentexte der Wochenseite, die es in der Ausgangswoche nicht gibt (w8: gegen KVK+, x10: gegen KVK). */
  readonly neu: readonly string[];
}

export interface SeitenFakt {
  readonly widthPt: number;
  readonly heightPt: number;
  /** Zahl der TextItem der Seite. */
  readonly textItems: number;
  /** Text je TextItem (Läufe aneinandergereiht), in der Reihenfolge von `items`. */
  readonly zeilen: readonly string[];
}

export interface WochenFakt {
  readonly weekId: string;
  readonly label: string;
  readonly shortName: string;
  readonly seiten: readonly SeitenFakt[];
}

export interface Daten {
  readonly plaene: Readonly<Record<PlanName, Plan>>;
  readonly wochen: Readonly<Record<PlanName, readonly WochenFakt[]>>;
  /** LINE_EXCLUDED_CODEPOINTS (Bereiche einschliesslich der Grenzen). */
  readonly ausgeschlossen: readonly (readonly [number, number])[];
  /** Zweitcodepunkte aus SHARED_GLYPH_PRIMARY. */
  readonly zweitCodepunkte: readonly number[];
  readonly varianten: Readonly<Partial<Record<VariantenName, Variante>>>;
  /** Fehler beim Bilden einer Variante (nur Meldung, keine Planinhalte). */
  readonly variantenFehler: Readonly<Partial<Record<VariantenName, string>>>;
  /** W9: `standOverride` und die Sollwerte der KVK mit dieser Option (TR-E102f-04). */
  readonly stand: {
    readonly standOverride: { readonly date: string; readonly version: number };
    readonly wochen: readonly WochenFakt[];
  };
  /** X10, Vorbedingung: das Layout von «x10» enthält das Wappen als ImageItem, und sanitizeImageBytes nimmt es an. */
  readonly x10Vorbedingung: boolean;
}

export type Auftrag =
  | { readonly art: 'daten' }
  | {
      readonly art: 'pdfWoche';
      readonly plan: Plan;
      readonly weekId: string;
      readonly title: string;
    };

export interface PdfSha {
  readonly sha256: string;
  readonly zeitzone: string;
  /** Date#getTimezoneOffset am 15.01.2026 1200 UTC (Minuten). */
  readonly versatzJanuar: number;
}

function zeileText(t: TextItem): string {
  return t.runs.map((r) => r.text).join('');
}

function texte(items: readonly PageItem[]): string[] {
  return items.filter((i): i is TextItem => i.kind === 'text').map(zeileText);
}

function fakten(plan: Plan, opts: PageOptions = optionen()): WochenFakt[] {
  return plan.weeks.map((w) => {
    const l = layoutWeekPage(plan, w.id, opts);
    return {
      weekId: w.id,
      label: w.label,
      shortName: w.shortName,
      seiten: l.pages.map((p) => ({
        widthPt: p.widthPt,
        heightPt: p.heightPt,
        textItems: p.items.filter((i) => i.kind === 'text').length,
        zeilen: texte(p.items),
      })),
    };
  });
}

function bloecke(plan: Plan): Block[] {
  return Object.values(plan.entries)
    .filter((e): e is Block => e.type === 'block')
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Je Seite Zahl der Elemente je Art und der sichtbaren Läufe (Vertrag J X6: gleiche Anzahlen). */
function anzahlen(l: WeekPageLayout): string {
  return JSON.stringify(
    l.pages.map((p) => {
      const n: Record<string, number> = {};
      for (const i of p.items) n[i.kind] = (n[i.kind] ?? 0) + 1;
      n.laeufe = p.items
        .filter((i): i is TextItem => i.kind === 'text')
        .reduce((s, t) => s + t.runs.filter((r) => r.text.trim() !== '').length, 0);
      return n;
    }),
  );
}

function signatur(i: PageItem): string {
  return JSON.stringify(i, (_, v: unknown) =>
    v instanceof Uint8Array ? `bytes:${String(v.length)}` : v,
  );
}

/** Elemente, die nur in `b` vorkommen (Mehrfachmenge über alle Seiten). */
function nurIn(a: WeekPageLayout, b: WeekPageLayout): PageItem[] {
  const zaehler = new Map<string, number>();
  for (const i of a.pages.flatMap((p) => p.items)) {
    const s = signatur(i);
    zaehler.set(s, (zaehler.get(s) ?? 0) + 1);
  }
  const aus: PageItem[] = [];
  for (const i of b.pages.flatMap((p) => p.items)) {
    const s = signatur(i);
    const n = zaehler.get(s) ?? 0;
    if (n > 0) zaehler.set(s, n - 1);
    else aus.push(i);
  }
  return aus;
}

function layout(plan: Plan): WeekPageLayout {
  return layoutWeekPage(plan, KVK_WOCHE, optionen());
}

/**
 * X6 (a): ein Block um 15 Min verschoben, an einer Stelle ohne Nachbarn in der Spalte: der erste Block (nach Id),
 * dessen Verschiebung (+15, sonst −15 Min) nur seine eigenen Elemente ändert (1 bis 3), alle Anzahlen und alle
 * Texte gleich lässt.
 */
function verschobenerBlock(plan: Plan): Plan {
  const basis = layout(plan);
  for (const b of bloecke(plan)) {
    if (b.time.form !== 'range') continue;
    for (const d of [15, -15]) {
      const v = mitEintrag(plan, {
        ...b,
        time: { ...b.time, from: b.time.from + d, to: b.time.to + d },
      });
      const l = layout(v);
      if (anzahlen(l) !== anzahlen(basis)) continue;
      const neu = nurIn(basis, l);
      const alleTexte = (x: WeekPageLayout) =>
        x.pages
          .flatMap((p) => texte(p.items))
          .sort()
          .join('\n');
      if (neu.length >= 1 && neu.length <= 3 && alleTexte(l) === alleTexte(basis)) return v;
    }
  }
  throw new Error('X6 (a): kein verschiebbarer Block gefunden');
}

/**
 * X6 (b) und W8: in einem Blocktitel ein Buchstabe durch einen gleich breiten ersetzt («a» ↔ «e», Arimo je
 * 1139/2048 em). Gewählt wird der erste Block (nach Id), bei dem sich nur Texte ändern, nicht Lage, Grösse,
 * Zeilenzahl oder Anzahlen.
 */
function buchstabeErsetzt(plan: Plan): Plan {
  const basis = layout(plan);
  for (const b of bloecke(plan)) {
    const k = b.title.findIndex((r) => /[ae]/.test(r.text));
    const lauf = b.title[k];
    if (lauf === undefined) continue;
    const text = lauf.text.replace(/[ae]/, (z) => (z === 'a' ? 'e' : 'a'));
    const v = mitEintrag(plan, {
      ...b,
      title: b.title.map((r, i) => (i === k ? { ...r, text } : r)),
    });
    const l = layout(v);
    if (anzahlen(l) !== anzahlen(basis)) continue;
    const neu = nurIn(basis, l);
    const ohneText = (x: WeekPageLayout) =>
      x.pages
        .flatMap((p) => p.items)
        .map((i) =>
          i.kind === 'text'
            ? signatur({ ...i, runs: i.runs.map((r) => ({ ...r, text: String(r.text.length) })) })
            : signatur(i),
        )
        .join('\n');
    if (neu.length >= 1 && neu.every((i) => i.kind === 'text') && ohneText(l) === ohneText(basis)) {
      return v;
    }
  }
  throw new Error('X6 (b): kein Blocktitel mit ersetzbarem Buchstaben gefunden');
}

/** X6 (c): andere Füllfarbe der Kategorie, die die meisten Blöcke tragen. */
function andereFarbe(plan: Plan): Plan {
  const zahl = new Map<string, number>();
  for (const b of bloecke(plan)) zahl.set(b.categoryId, (zahl.get(b.categoryId) ?? 0) + 1);
  const [id] = [...zahl.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0] ?? [];
  const neu: Rgb = { r: 150, g: 220, b: 150 };
  const alt = plan.legend.find((k) => k.id === id);
  if (
    alt === undefined ||
    (alt.color.r === neu.r && alt.color.g === neu.g && alt.color.b === neu.b)
  ) {
    throw new Error('X6 (c): keine Kategorie gefunden');
  }
  return {
    ...plan,
    legend: plan.legend.map((k) => (k.id === id ? { ...k, color: neu } : k)),
  };
}

/**
 * TR-E102f-07: KVK mit so vielen einzeiligen Tagesbemerkungen am Mo, dass die Woche genau zwei
 * Fortsetzungsseiten hat (kleinste Zahl ab 50 in Zehnerschritten bis 400, bestimmt über layoutWeekPage).
 */
function zweiFortsetzungen(): Plan {
  for (let n = 50; n <= 400; n += 10) {
    const p = mitEintraegen(kvk(), tagesbemerkungen(n, MO, 600));
    if (layout(p).pages.length === 3) return p;
  }
  throw new Error('keine Zahl von Tagesbemerkungen mit genau zwei Fortsetzungsseiten gefunden');
}

/** Zeilen der Wochenseite von `b`, die es in `a` nicht gibt (Mehrfachmenge). */
function neueZeilen(a: readonly WochenFakt[], b: readonly WochenFakt[]): string[] {
  const alt = new Map<string, number>();
  for (const z of a[0]?.seiten[0]?.zeilen ?? []) alt.set(z, (alt.get(z) ?? 0) + 1);
  const aus: string[] = [];
  for (const z of b[0]?.seiten[0]?.zeilen ?? []) {
    const n = alt.get(z) ?? 0;
    if (n > 0) alt.set(z, n - 1);
    else aus.push(z);
  }
  return aus;
}

function daten(): Daten {
  const basis = kvk();
  const plus = kvkPlus();
  const plaene: Record<PlanName, Plan> = {
    kvk: basis,
    kvkPlus: plus,
    fortsetzung: fortsetzung(),
    synthetisch: syntheticPlan(),
    kvkPlusIhdr: mitWappen(kvkPlus(), 'image/png', pngNurIhdr()),
  };
  const wochen = {} as Record<PlanName, WochenFakt[]>;
  for (const [name, p] of Object.entries(plaene) as [PlanName, Plan][]) {
    // Bei nicht einbettbarem Wappen zeichnen Bildschirm und PDF das Layout ohne Wappen (CR-03 Nr 2).
    wochen[name] = fakten(name === 'kvkPlusIhdr' ? { ...p, coatOfArms: null } : p);
  }
  const x10 = mitWappen(kvkPlus(), 'image/png', pngLeeresIdat());
  const bildung: Record<
    VariantenName,
    () => { plan: Plan; ohneWappen: boolean; gegen: WochenFakt[] }
  > = {
    x6Lage: () => ({ plan: verschobenerBlock(basis), ohneWappen: false, gegen: wochen.kvk }),
    x6Text: () => ({ plan: buchstabeErsetzt(basis), ohneWappen: false, gegen: wochen.kvk }),
    x6Farbe: () => ({ plan: andereFarbe(basis), ohneWappen: false, gegen: wochen.kvk }),
    w8: () => ({ plan: buchstabeErsetzt(plus), ohneWappen: false, gegen: wochen.kvkPlus }),
    fortsetzung2: () => ({ plan: zweiFortsetzungen(), ohneWappen: false, gegen: wochen.kvk }),
    x10: () => ({ plan: x10, ohneWappen: true, gegen: wochen.kvk }),
  };
  const varianten: Partial<Record<VariantenName, Variante>> = {};
  const variantenFehler: Partial<Record<VariantenName, string>> = {};
  for (const [name, f] of Object.entries(bildung) as [
    VariantenName,
    (typeof bildung)[VariantenName],
  ][]) {
    try {
      const v = f();
      const w = fakten(v.ohneWappen ? { ...v.plan, coatOfArms: null } : v.plan);
      varianten[name] = { plan: v.plan, wochen: w, neu: neueZeilen(v.gegen, w) };
    } catch (e) {
      variantenFehler[name] = e instanceof Error ? e.message : String(e);
    }
  }
  const wappen = layout(x10)
    .pages.flatMap((p) => p.items)
    .find((i) => i.kind === 'image' && i.role === 'sidebar');
  const standOverride = { date: '2026-10-01', version: 3 };
  return {
    plaene,
    wochen,
    ausgeschlossen: LINE_EXCLUDED_CODEPOINTS,
    zweitCodepunkte: [...SHARED_GLYPH_PRIMARY.keys()],
    varianten,
    variantenFehler,
    stand: {
      standOverride,
      wochen: fakten(basis, optionen({ standOverride: { ...standOverride, date: '2026-10-01' } })),
    },
    x10Vorbedingung:
      wappen !== undefined &&
      wappen.kind === 'image' &&
      sanitizeImageBytes(wappen.mime, wappen.bytes) !== null,
  };
}

/** Einstieg des Kindprozesses: Ergebnis als JSON-fähiger Wert. */
export async function fuehreAus(a: Auftrag): Promise<Daten | PdfSha> {
  if (a.art === 'daten') return daten();
  const r = await renderWeekPdf(a.plan, a.weekId, optionen(), a.title);
  return {
    sha256: createHash('sha256').update(r.bytes).digest('hex'),
    zeitzone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    versatzJanuar: new Date(Date.UTC(2026, 0, 15, 12)).getTimezoneOffset(),
  };
}
