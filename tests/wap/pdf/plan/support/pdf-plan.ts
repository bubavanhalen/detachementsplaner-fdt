// Hilfen der PDF-Tests von Paket E1-02f (Vertrag docs/wap-planer/plan/vertraege/E1-02f.md, Notiz «Ausarbeitung
// Schritt 2» Abschnitte B, H1, J P1 bis P4). Erzeugt Wochen- und Gesamt-PDF über den öffentlichen Einstieg
// src/io/wap-pdf (renderWeekPdf, renderPlanPdf), legt gültige PDF als Artefakt `e1-02f-<fall>` ab (E1-01b-02)
// und liest sie mit `readPdf` (E1-01b, Nachtrag P). Geprüft wird nur das gelesene PDF.
// Kein `beforeAll` mit Stub-Aufruf (ADR-010 §3.3): die Hilfen laufen im Test selbst; `einmal` merkt sich das
// Ergebnis je Testdatei.
import { createHash } from 'node:crypto';
import { expect } from 'vitest';
import { type RenderedPdf, renderPlanPdf, renderWeekPdf } from '../../../../../src/io/wap-pdf';
import type { PageOptions } from '../../../../../src/model/wap/layout/page/types';
import type { Id, Plan } from '../../../../../src/model/wap/types';
import { pdfArtefakt } from '../../../support/pdf/artefakt';
import { type PdfInfo, readPdf } from '../../../support/pdf/read';
import { optionen, PDF_TITEL } from './plaene';

export interface GelesenesPdf {
  readonly pdf: RenderedPdf;
  readonly info: PdfInfo;
}

/** Wochen-PDF → Artefakt `e1-02f-<fall>` → `readPdf`. */
export async function wochenPdf(
  fall: string,
  plan: Plan,
  weekId: Id,
  opts: PageOptions = optionen(),
): Promise<GelesenesPdf> {
  const pdf = await renderWeekPdf(plan, weekId, opts, PDF_TITEL);
  await pdfArtefakt(`e1-02f-${fall}`, pdf.bytes);
  return { pdf, info: await readPdf(pdf.bytes) };
}

/** Gesamt-PDF → Artefakt `e1-02f-<fall>` → `readPdf`. */
export async function gesamtPdf(
  fall: string,
  plan: Plan,
  opts: PageOptions = optionen(),
): Promise<GelesenesPdf> {
  const pdf = await renderPlanPdf(plan, opts, PDF_TITEL);
  await pdfArtefakt(`e1-02f-${fall}`, pdf.bytes);
  return { pdf, info: await readPdf(pdf.bytes) };
}

/** Merkt sich das Ergebnis des ersten Aufrufs (auch eine Ablehnung) für alle Tests einer Datei. */
export function einmal<T>(f: () => Promise<T>): () => Promise<T> {
  let p: Promise<T> | undefined;
  return () => {
    p ??= f();
    return p;
  };
}

export function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** Ein gezeichnetes Element einer PDF-Seite ohne Seitenzahl und ohne dokumentweite Nummer `order`. */
export type SeitenElement =
  | {
      readonly typ: 'text';
      readonly text: string;
      readonly x: number;
      readonly baselineY: number;
      readonly width: number;
      readonly sizePt: number;
      readonly fontName: string;
      readonly bold: boolean;
      readonly color: string;
      readonly rotation: number;
    }
  | {
      readonly typ: 'strich';
      readonly kind: string;
      readonly bbox: readonly number[];
      readonly widthPt: number;
      readonly dash: readonly number[] | null;
      readonly color: string;
      readonly fill: string | null;
    }
  | { readonly typ: 'bild'; readonly bbox: readonly number[] };

function farbe(c: { readonly r: number; readonly g: number; readonly b: number }): string {
  return `${String(c.r)},${String(c.g)},${String(c.b)}`;
}

/**
 * Inhalt der Seite `seite` (ab 1) in Zeichenreihenfolge (aufsteigend nach `order`), Werte unverändert: Texte
 * mit Text, x, Grundlinie, Breite, Grösse, Schriftname, Schnitt, Farbe, Drehung; Striche mit Art, `bbox`,
 * Breite, Strichelung, Farbe, Füllung; Bildlagen (Vertrag J P3).
 */
export function seitenInhalt(info: PdfInfo, seite: number): SeitenElement[] {
  const aus: { order: number; e: SeitenElement }[] = [];
  for (const t of info.texts.filter((x) => x.page === seite)) {
    aus.push({
      order: t.order,
      e: {
        typ: 'text',
        text: t.text,
        x: t.x,
        baselineY: t.baselineY,
        width: t.width,
        sizePt: t.sizePt,
        fontName: t.fontName,
        bold: t.bold,
        color: farbe(t.color),
        rotation: t.rotation,
      },
    });
  }
  for (const s of info.strokes.filter((x) => x.page === seite)) {
    aus.push({
      order: s.order,
      e: {
        typ: 'strich',
        kind: s.kind,
        bbox: [s.bbox.x, s.bbox.y, s.bbox.w, s.bbox.h],
        widthPt: s.widthPt,
        dash: s.dash,
        color: farbe(s.color),
        fill: s.fill === null ? null : farbe(s.fill),
      },
    });
  }
  for (const b of info.imagePlacements.filter((x) => x.page === seite)) {
    aus.push({
      order: b.order,
      e: { typ: 'bild', bbox: [b.bbox.x, b.bbox.y, b.bbox.w, b.bbox.h] },
    });
  }
  return aus.sort((a, b) => a.order - b.order).map((x) => x.e);
}

/**
 * Prüft Seite s_w + j des Gesamt-PDF gegen Seite j des Wochen-PDF jeder Woche w (Vertrag J P3): s_w = Summe der
 * Seiten der Wochen vor w; alle Werte exakt, auch die Reihenfolge innerhalb der Seite.
 */
export function pruefeSeitengleichheit(
  gesamt: PdfInfo,
  wochen: readonly { readonly name: string; readonly info: PdfInfo }[],
): void {
  let versatz = 0;
  for (const w of wochen) {
    const n = w.info.pages.length;
    expect(n, `${w.name}: Seiten`).toBeGreaterThan(0);
    for (let j = 1; j <= n; j++) {
      expect(gesamt.pages[versatz + j - 1], `${w.name} Seite ${String(j)}: Grösse`).toEqual(
        w.info.pages[j - 1],
      );
      expect(
        seitenInhalt(gesamt, versatz + j),
        `${w.name} Seite ${String(j)} = Gesamt-PDF Seite ${String(versatz + j)}`,
      ).toEqual(seitenInhalt(w.info, j));
    }
    versatz += n;
  }
  expect(gesamt.pages.length, 'Gesamt-PDF: Seitenzahl = Summe der Wochen').toBe(versatz);
}
