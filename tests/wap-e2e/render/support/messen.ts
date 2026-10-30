// Node-Seite der E2E-Tests von Paket E1-02c: Harness öffnen, Seiten zeigen, Zeilen am Bildschirm vermessen
// (Vertrag E1-02c §3.2 «Lagetoleranz … Grundlinie über einen Null-Marker vertical-align: baseline wie im Spike
// ADR-004»), Pixel aus Bildschirmfotos und gerenderten PDF lesen. Alle Masse in pt, relativ zur linken oberen
// Ecke des Containers (role="document").
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { expect, type Page } from '@playwright/test';
import type { PageModel } from '../../../../src/model/wap/layout/pageModel';
import { type SeiteJson, zuJson } from '../../../wap/pdf/writer/support/seite-json';
import type { ZeigeOptionen } from './harness-api';

export const HARNESS = '/tests/wap-e2e/harness/page-view.html';

/** Toleranzen am Bildschirm (Vertrag E1-02c §3.2): x und Zeilenbreite ± 0,05 pt, Grundlinie ± 0,15 pt. */
export const TOL_X = 0.05;
export const TOL_GRUNDLINIE = 0.15;

/**
 * Genauigkeit der Layout-Werte des Browsers in px (Blink rechnet in LayoutUnit = 1/64 px). Gilt nur für
 * Grössen in px (Container, Papier, svg), für die der Vertrag keine eigene Toleranz nennt.
 */
export const TOL_PX = 1 / 64;

/** Öffnet die Harness (Vite oder Einzeldatei) und wartet auf window.wapHarness. */
export async function harnessBereit(page: Page, url: string = HARNESS): Promise<void> {
  await page.goto(url);
  await page.waitForFunction(() => window.wapHarness !== undefined, undefined, { timeout: 20_000 });
}

export async function zeige(page: Page, seite: PageModel, opts: ZeigeOptionen): Promise<void> {
  const json: SeiteJson = zuJson(seite);
  await page.evaluate(
    ([s, o]) => {
      window.wapHarness?.zeige(s, o);
    },
    [json, opts] as const,
  );
}

export interface Punkt {
  readonly x: number;
  readonly y: number;
}

export interface ZeileGemessen {
  /** Wert von data-wap-item. */
  readonly index: string | null;
  readonly text: string;
  /** Null-Marker vor dem ersten und nach dem letzten Lauf (Grundlinie, Laufrichtung). */
  readonly start: Punkt;
  readonly ende: Punkt;
  readonly stil: {
    readonly whiteSpace: string;
    readonly fontKerning: string;
    readonly fontFamily: string;
    readonly ligaturen: string;
    readonly synthese: string;
    readonly unicodeBidi: string;
    readonly direction: string;
    readonly fontSize: string;
    readonly position: string;
  };
  readonly laeufe: readonly {
    readonly text: string;
    readonly weight: string;
    readonly color: string;
  }[];
  /** Leere Elemente mit aria-hidden="true" in der Zeile (Durchstreichung). */
  readonly striche: readonly {
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
  }[];
  /** Je Codepunkt: linke Kante und Breite (pt) über Range#getBoundingClientRect. */
  readonly zeichen: readonly { readonly z: string; readonly x: number; readonly w: number }[];
}

/** Vermisst alle Zeilen (span[data-wap-item]) im Container mit dem Namen `label` bei der Zoomstufe `scale`. */
export async function messeZeilen(
  page: Page,
  label: string,
  scale: number,
): Promise<ZeileGemessen[]> {
  return page.evaluate(
    ([name, s]) => {
      const c = [...document.querySelectorAll('[role="document"]')].find(
        (e) => e.getAttribute('aria-label') === name,
      );
      if (c === undefined) return [];
      const cr = c.getBoundingClientRect();
      const pt = (r: DOMRect) => ({ x: (r.left - cr.left) / s, y: (r.top - cr.top) / s });
      const marker = (): HTMLSpanElement => {
        const m = document.createElement('span');
        m.style.cssText =
          'display:inline-block;width:0;height:0;margin:0;padding:0;border:0;vertical-align:baseline';
        return m;
      };
      return [...c.querySelectorAll('span[data-wap-item]')].map((el) => {
        const kinder = [...el.children];
        const laeufe = kinder.filter((k) => k.getAttribute('aria-hidden') !== 'true');
        const striche = kinder
          .filter((k) => k.getAttribute('aria-hidden') === 'true')
          .map((k) => {
            const r = k.getBoundingClientRect();
            return { ...pt(r), w: r.width / s, h: r.height / s };
          });
        const zeichen: { z: string; x: number; w: number }[] = [];
        const gaenger = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        for (let n = gaenger.nextNode(); n !== null; n = gaenger.nextNode()) {
          const t = (n as Text).data;
          for (let i = 0; i < t.length; ) {
            const l = (t.codePointAt(i) ?? 0) > 0xffff ? 2 : 1;
            const r = document.createRange();
            r.setStart(n, i);
            r.setEnd(n, i + l);
            const b = r.getBoundingClientRect();
            zeichen.push({ z: t.slice(i, i + l), x: (b.left - cr.left) / s, w: b.width / s });
            i += l;
          }
        }
        const a = marker();
        const b = marker();
        const erster = laeufe[0];
        const letzter = laeufe[laeufe.length - 1];
        if (erster !== undefined) erster.before(a);
        else el.prepend(a);
        if (letzter !== undefined) letzter.after(b);
        else el.append(b);
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        a.remove();
        b.remove();
        const cs = getComputedStyle(el);
        return {
          index: el.getAttribute('data-wap-item'),
          text: el.textContent ?? '',
          start: { x: (ra.left - cr.left) / s, y: (ra.top - cr.top) / s },
          ende: { x: (rb.left - cr.left) / s, y: (rb.top - cr.top) / s },
          stil: {
            whiteSpace: cs.whiteSpace,
            fontKerning: cs.fontKerning,
            fontFamily: cs.fontFamily,
            ligaturen: cs.fontVariantLigatures,
            synthese: cs.getPropertyValue('font-synthesis'),
            unicodeBidi: cs.unicodeBidi,
            direction: cs.direction,
            fontSize: cs.fontSize,
            position: cs.position,
          },
          laeufe: laeufe.map((k) => {
            const ks = getComputedStyle(k);
            return { text: k.textContent ?? '', weight: ks.fontWeight, color: ks.color };
          }),
          striche,
          zeichen,
        };
      });
    },
    [label, scale] as const,
  );
}

/** Erwartete Farbe als berechneter CSS-Wert. */
export function cssFarbe(c: {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}): string {
  return `rgb(${String(c.r)}, ${String(c.g)}, ${String(c.b)})`;
}

/** Prüft |ist − soll| ≤ tol mit sprechender Meldung. */
export function nahe(ist: number | undefined, soll: number, tol: number, name: string): void {
  expect(ist, `${name}: fehlt`).toBeDefined();
  expect(
    Math.abs((ist ?? Number.NaN) - soll),
    `${name}: ist ${String(ist)}, soll ${String(soll)} ± ${String(tol)}`,
  ).toBeLessThanOrEqual(tol);
}

/** RGBA-Pixel eines Bildschirmfotos des Containers `label` (1 px = 1 CSS-px, Skalierung 1). */
export async function bildschirmPixel(
  page: Page,
  label: string,
): Promise<{ breite: number; hoehe: number; rgba: Uint8ClampedArray }> {
  const box = await page.getByRole('document', { name: label }).boundingBox();
  expect(box, 'Container fehlt').not.toBeNull();
  const b = box ?? { x: 0, y: 0, width: 1, height: 1 };
  const png = await page.screenshot({
    clip: { x: b.x, y: b.y, width: Math.max(1, b.width), height: Math.max(1, b.height) },
  });
  const bild = await loadImage(png);
  const flaeche = createCanvas(bild.width, bild.height);
  const ctx = flaeche.getContext('2d');
  ctx.drawImage(bild, 0, 0);
  return {
    breite: bild.width,
    hoehe: bild.height,
    rgba: ctx.getImageData(0, 0, bild.width, bild.height).data,
  };
}

/** Pixel (r, g, b) an (x, y) in Bildpixeln. */
export function rgbBei(
  b: { readonly breite: number; readonly rgba: ArrayLike<number> },
  x: number,
  y: number,
): [number, number, number] {
  const i = (Math.round(y) * b.breite + Math.round(x)) * 4;
  return [b.rgba[i] ?? -1, b.rgba[i + 1] ?? -1, b.rgba[i + 2] ?? -1];
}

const ECKFARBEN: Readonly<Record<string, readonly [number, number, number]>> = {
  rot: [255, 0, 0],
  gruen: [0, 255, 0],
  blau: [0, 0, 255],
  gelb: [255, 255, 0],
};

/** Name der nächsten Eckfarbe (Abstand ≤ 90 je Kanal), sonst «unbekannt». */
export function eckfarbe(rgb: readonly number[]): string {
  for (const [name, soll] of Object.entries(ECKFARBEN)) {
    if (soll.every((v, i) => Math.abs(v - (rgb[i] ?? -999)) <= 90)) return name;
  }
  return 'unbekannt';
}

/** Eine Konsolenmeldung der Seite (Art, Anfang des Textes, Quelle). */
export interface Konsolenmeldung {
  readonly art: string;
  readonly text: string;
  readonly quelle: string;
}

/**
 * Zeichnet jede Konsolenmeldung der Seite auf, jeder Art (auch log, info, debug), für «keine Konsolenausgabe»
 * (Vertrag E1-02c §2.4, §3.1, §3.3; TR-E102c-06). Ausgenommen sind nur Meldungen der Testumgebung, die nicht vom
 * WAP-Planer stammen: der Vite-Client (Quelle /@vite/client, nur Projekt edge) und der Entwicklungshinweis von
 * React auf die DevTools.
 */
export function konsoleMitschneiden(page: Page): Konsolenmeldung[] {
  const liste: Konsolenmeldung[] = [];
  page.on('console', (m) => {
    const quelle = m.location().url;
    const text = m.text();
    if (quelle.includes('/@vite/client')) return;
    if (text.includes('React DevTools')) return;
    liste.push({
      art: m.type(),
      text: text.slice(0, 60),
      quelle: quelle.replace(/^.*\/(?=[^/]*$)/, ''),
    });
  });
  return liste;
}
