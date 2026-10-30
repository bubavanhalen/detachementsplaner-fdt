// Messung der Wochenansicht am Bildschirm für den Paritätstest von Paket E1-02f (R-5-01; Vertrag E1-02f, Notiz
// «Ausarbeitung Schritt 2» Abschnitte E, G2; ADR-004 Spike: Null-Marker mit vertical-align: baseline; ADR-010
// §7.4). Bezug ist die linke obere Ecke des Containers (role="document") der Seite; pt = px / scale. Gemessen
// wird nur das Papier (erstes Kind des Containers, Vertrag E1-02c P-12), nie das Overlay. Hilfen zum Öffnen der
// Harness und zum Warten auf den Zustand «bereit» (Vertrag E).
import { expect, type Page } from '@playwright/test';
import type { Ergebnis, PdfErgebnis, WochenOptionen } from './wochen-harness-api';

export const HARNESS_WOCHE = '/tests/wap-e2e/harness/week.html';

/** Fester Titel aller Test-PDF dieses Pakets (Vertrag H1). */
export const PDF_TITEL = 'E1-02f Test';

/** Genauigkeit der Layout-Werte des Browsers in px (Blink: LayoutUnit = 1/64 px). */
export const TOL_PX = 1 / 64;

/** Bildschirm-Zoom 100 % (UI-Richtlinie 4.1: 1,333 px/pt). */
export const ZOOM_100 = 4 / 3;

export interface Punkt {
  readonly x: number;
  readonly y: number;
}

export interface Rechteck {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface LaufGemessen {
  readonly text: string;
  /** Berechnetes font-weight. */
  readonly gewicht: string;
  /** Berechnete Farbe «rgb(r, g, b)». */
  readonly farbe: string;
  /** Grundlinienpunkt vor dem Lauf (pt). */
  readonly start: Punkt;
  /** Grundlinienpunkt nach dem Lauf (pt). */
  readonly ende: Punkt;
}

export interface ZeileGemessen {
  /** Wert von data-wap-item. */
  readonly index: string | null;
  /** Drehung aus der berechneten Transformation: keine → 0, rotate(-90deg) → 90, rotate(90deg) → 270, sonst −1. */
  readonly drehung: number;
  /** Berechnete font-size der Zeile in px (Papier: 4 px/pt). */
  readonly schriftPx: number;
  readonly laeufe: readonly LaufGemessen[];
  /** Leere Kinder mit aria-hidden="true" (Durchstreichung), Rechteck in pt. */
  readonly striche: readonly Rechteck[];
}

export type FormGemessen =
  | {
      readonly art: 'pfad';
      /** Umschliessendes Rechteck von getBBox() im Bezug des Containers (pt); fill, stroke, strokeWidth und dash berechnet (getComputedStyle). */
      readonly bbox: Rechteck;
      readonly fill: string | null;
      readonly stroke: string | null;
      readonly strokeWidth: string | null;
      readonly dash: string | null;
    }
  | { readonly art: 'bild'; readonly bbox: Rechteck };

export interface SeiteGemessen {
  readonly name: string;
  readonly busy: boolean;
  /** Lage und Grösse des Containers in px (Seite). */
  readonly box: Rechteck;
  readonly zeilen: readonly ZeileGemessen[];
  readonly formen: readonly FormGemessen[];
}

/** Öffnet die Harness (Vite oder Einzeldatei) und wartet auf window.wapWochenHarness. */
export async function harnessBereit(page: Page, url: string = HARNESS_WOCHE): Promise<void> {
  await page.goto(url);
  await page.waitForFunction(() => window.wapWochenHarness !== undefined, undefined, {
    timeout: 20_000,
  });
}

export async function setzePlan(page: Page, plan: unknown): Promise<void> {
  await page.evaluate((p) => {
    window.wapWochenHarness?.setzePlan(p);
  }, plan);
}

export interface ZeigeOptionen extends WochenOptionen {
  readonly weekId: string;
  readonly scale: number;
  readonly overlay?: boolean;
  readonly semanticsProvidedByOverlay?: boolean;
}

export async function zeigeWoche(page: Page, o: ZeigeOptionen): Promise<Ergebnis<object> | null> {
  return page.evaluate(async (x) => (await window.wapWochenHarness?.zeigeWoche(x)) ?? null, o);
}

export async function pdfWoche(
  page: Page,
  o: WochenOptionen & { readonly weekId: string; readonly title?: string },
): Promise<Ergebnis<PdfErgebnis> | null> {
  return page.evaluate(async (x) => (await window.wapWochenHarness?.pdfWoche(x)) ?? null, {
    ...o,
    title: o.title ?? PDF_TITEL,
  });
}

export async function pdfPlan(
  page: Page,
  o: WochenOptionen & { readonly title?: string } = {},
): Promise<Ergebnis<PdfErgebnis> | null> {
  return page.evaluate(async (x) => (await window.wapWochenHarness?.pdfPlan(x)) ?? null, {
    ...o,
    title: o.title ?? PDF_TITEL,
  });
}

/** Container der Seiten unter #root (das Element html hat selbst die Rolle document). */
export function container(page: Page) {
  return page.locator('#root [role="document"]');
}

/**
 * Wartet auf den Zustand «bereit» (Vertrag E): je Container `[data-wap-item]` = Zahl der TextItem der Seite (aus
 * `layoutWeekPage`, Node), kein Container mit aria-busy, kein alert, Containergrösse = Seitengrösse · scale.
 * Die erste Erwartung ist die Zahl der Zeilen im ersten Container (Rot-Nachweis J).
 */
export async function warteBereit(
  page: Page,
  seiten: readonly {
    readonly textItems: number;
    readonly widthPt: number;
    readonly heightPt: number;
  }[],
  scale: number,
): Promise<void> {
  const c = container(page);
  for (const [i, s] of seiten.entries()) {
    expect(s.textItems, `Seite ${String(i + 1)}: TextItem (Node)`).toBeGreaterThan(0);
    await expect(c.nth(i).locator('span[data-wap-item]')).toHaveCount(s.textItems, {
      timeout: 30_000,
    });
  }
  await expect(c).toHaveCount(seiten.length);
  await expect(page.locator('#root [aria-busy="true"]')).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
  for (const [i, s] of seiten.entries()) {
    await expect
      .poll(async () => {
        const b = await c.nth(i).boundingBox();
        return Math.max(
          Math.abs((b?.width ?? 0) - s.widthPt * scale),
          Math.abs((b?.height ?? 0) - s.heightPt * scale),
        );
      })
      .toBeLessThanOrEqual(TOL_PX);
  }
}

/** Vermisst alle Seiten der Wochenansicht in DOM-Reihenfolge bei der Zoomstufe `scale`. */
export async function messeWoche(page: Page, scale: number): Promise<SeiteGemessen[]> {
  return page.evaluate((s) => {
    const marker = (): HTMLSpanElement => {
      const m = document.createElement('span');
      m.style.cssText =
        'display:inline-block;width:0;height:0;margin:0;padding:0;border:0;vertical-align:baseline';
      return m;
    };
    const drehung = (el: Element): number => {
      const t = getComputedStyle(el).transform;
      if (t === 'none' || t === '') return 0;
      const m = /^matrix\(([^)]+)\)$/.exec(t);
      if (m === null) return -1;
      const [a, b] = (m[1] ?? '').split(',').map((z) => Number.parseFloat(z));
      const grad = Math.round((Math.atan2(b ?? 0, a ?? 1) * 180) / Math.PI);
      if (grad === 0) return 0;
      if (grad === -90) return 90;
      if (grad === 90) return 270;
      return -1;
    };
    return [...document.querySelectorAll('#root [role="document"]')].map((c) => {
      const cr = c.getBoundingClientRect();
      const pt = (r: DOMRect) => ({ x: (r.left - cr.left) / s, y: (r.top - cr.top) / s });
      const papier = c.firstElementChild;
      const zeilen = [...(papier?.querySelectorAll('span[data-wap-item]') ?? [])].map((el) => {
        const kinder = [...el.children];
        const laeufe = kinder.filter((k) => k.getAttribute('aria-hidden') !== 'true');
        const striche = kinder
          .filter((k) => k.getAttribute('aria-hidden') === 'true')
          .map((k) => {
            const r = k.getBoundingClientRect();
            return { ...pt(r), w: r.width / s, h: r.height / s };
          });
        const vor = marker();
        const nach = laeufe.map(() => marker());
        const erster = laeufe[0];
        if (erster !== undefined) erster.before(vor);
        else el.prepend(vor);
        laeufe.forEach((l, i) => {
          const m = nach[i];
          if (m !== undefined) l.after(m);
        });
        const punkte = [vor, ...nach].map((m) => pt(m.getBoundingClientRect()));
        vor.remove();
        for (const m of nach) m.remove();
        return {
          index: el.getAttribute('data-wap-item'),
          drehung: drehung(el),
          schriftPx: Number.parseFloat(getComputedStyle(el).fontSize),
          laeufe: laeufe.map((l, i) => {
            const ls = getComputedStyle(l);
            return {
              text: l.textContent ?? '',
              gewicht: ls.fontWeight,
              farbe: ls.color,
              start: punkte[i] ?? { x: Number.NaN, y: Number.NaN },
              ende: punkte[i + 1] ?? { x: Number.NaN, y: Number.NaN },
            };
          }),
          striche,
        };
      });
      // Formen und Bilder im Bezug des Containers (G2; TR-E102f-01): Ecken über getScreenCTM in px der Seite,
      // minus Ursprung des Containers, geteilt durch scale; Farben und Strich als berechnete Werte.
      const imContainer = (el: SVGGraphicsElement, x: number, y: number, w: number, h: number) => {
        const m = el.getScreenCTM();
        const ecken = [
          [x, y],
          [x + w, y],
          [x, y + h],
          [x + w, y + h],
        ].map(([px0, py0]) => new DOMPoint(px0, py0).matrixTransform(m ?? undefined));
        const xs = ecken.map((p) => p.x);
        const ys = ecken.map((p) => p.y);
        const x0 = Math.min(...xs);
        const y0 = Math.min(...ys);
        return {
          x: (x0 - cr.left) / s,
          y: (y0 - cr.top) / s,
          w: (Math.max(...xs) - x0) / s,
          h: (Math.max(...ys) - y0) / s,
        };
      };
      const formen = [...(papier?.querySelectorAll('svg path, svg image') ?? [])].map((f) => {
        if (f instanceof SVGImageElement) {
          const zahl = (n: string) => Number.parseFloat(f.getAttribute(n) ?? 'NaN');
          return {
            art: 'bild' as const,
            bbox: imContainer(f, zahl('x'), zahl('y'), zahl('width'), zahl('height')),
          };
        }
        const g = f as SVGGraphicsElement;
        const b = g.getBBox();
        const cs = getComputedStyle(g);
        return {
          art: 'pfad' as const,
          bbox: imContainer(g, b.x, b.y, b.width, b.height),
          fill: cs.fill,
          stroke: cs.stroke,
          strokeWidth: cs.strokeWidth,
          dash: cs.strokeDasharray,
        };
      });
      return {
        name: c.getAttribute('aria-label') ?? '',
        busy: c.getAttribute('aria-busy') === 'true',
        box: { x: cr.left, y: cr.top, w: cr.width, h: cr.height },
        zeilen,
        formen,
      };
    });
  }, scale);
}

/** Alle sichtbaren Texte (Läufe) der gemessenen Seiten. */
export function bildschirmTexte(seiten: readonly SeiteGemessen[]): string[] {
  return seiten.flatMap((s) => s.zeilen.flatMap((z) => z.laeufe.map((l) => l.text)));
}
