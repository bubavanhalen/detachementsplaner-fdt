// Gemeinsame Abläufe der Paritätstests von Paket E1-02f (R-5-01; Vertrag E1-02f, Notiz «Ausarbeitung Schritt 2»
// Abschnitte E, G, H1, J). PDF im selben Browser-Tab erzeugen (pdfWoche), als Artefakt `e1-02f-edge-<fall>`
// ablegen (H1) und mit readPdf lesen; Wochenansicht zeigen, auf «bereit» warten, messen und vergleichen.
import { expect, type Page } from '@playwright/test';
import { ausBase64 } from '../../../wap/pdf/writer/support/seite-json';
import { pdfArtefakt } from '../../../wap/support/pdf/artefakt';
import { type PdfInfo, readPdf } from '../../../wap/support/pdf/read';
import type { Konsolenmeldung } from '../../render/support/messen';
import {
  messeWoche,
  pdfWoche,
  type SeiteGemessen,
  setzePlan,
  warteBereit,
  zeigeWoche,
} from './messen-woche';
import type { SeitenFakt } from './node-seite';
import { type Abweichung, vergleicheSeiten } from './vergleich';
import type { WochenOptionen } from './wochen-harness-api';

export interface EdgePdf {
  readonly bytes: Uint8Array;
  readonly pageCount: number;
  readonly fallbacks: number;
  readonly info: PdfInfo;
}

/**
 * Setzt den Plan, erzeugt das Wochen-PDF in Edge und liest es. Erste Erwartung: `pdfWoche` ergibt `ok` true
 * (Rot-Nachweis J: im Stub `ok` false mit «nicht implementiert: pdf.plan.…»).
 */
export async function edgePdf(
  page: Page,
  plan: unknown,
  weekId: string,
  fall: string,
  opts: WochenOptionen = {},
): Promise<EdgePdf> {
  await setzePlan(page, plan);
  const r = await pdfWoche(page, { ...opts, weekId });
  // Ohne eigene Meldung: Die Rot-Phase erkennt Playwright-Erwartungen an der ersten Zeile «Error: expect(»
  // (scripts/wap-gate/red-phase.mjs, ADR-010 §3.3).
  expect(r).toEqual(expect.objectContaining({ ok: true }));
  const bytes = r?.ok === true ? ausBase64(r.base64) : new Uint8Array(0);
  await pdfArtefakt(`e1-02f-edge-${fall}`, bytes);
  const info = await readPdf(bytes);
  return {
    bytes,
    pageCount: r?.ok === true ? r.pageCount : -1,
    fallbacks: r?.ok === true ? r.fallbacks : -1,
    info,
  };
}

/** Zeigt die Woche bei `scale`, wartet auf «bereit» und misst alle Seiten. */
export async function zeigeUndMiss(
  page: Page,
  plan: unknown,
  weekId: string,
  seiten: readonly SeitenFakt[],
  scale: number,
): Promise<SeiteGemessen[]> {
  await setzePlan(page, plan);
  const z = await zeigeWoche(page, { weekId, scale });
  expect(z, 'zeigeWoche').toEqual({ ok: true });
  await warteBereit(page, seiten, scale);
  return messeWoche(page, scale);
}

/** Abweichungen als kurze Zeilen für die Fehlermeldung (nur Zahlen und Codes, G9). */
export function liste(a: readonly Abweichung[]): string {
  return a
    .slice(0, 20)
    .map(
      (x) => `${x.art}/${x.klasse} S${String(x.seite)} #${String(x.index)}: ${x.soll} | ${x.ist}`,
    )
    .join('\n');
}

/** Parität einer Woche bei einer Zoomstufe: Containerzahl = pageCount = Seiten von readPdf, keine Abweichung. */
export function pruefeParitaet(gemessen: readonly SeiteGemessen[], pdf: EdgePdf, wo: string): void {
  expect(pdf.pageCount, `${wo}: pageCount = Seiten von readPdf`).toBe(pdf.info.pages.length);
  expect(gemessen.length, `${wo}: Container = pageCount`).toBe(pdf.pageCount);
  const abw = vergleicheSeiten(gemessen, pdf.info);
  expect(abw, `${wo}: Abweichungen\n${liste(abw)}`).toEqual([]);
}

/** Keine Konsolenausgabe (TR-E102c-06): Liste der mitgeschnittenen Meldungen muss leer sein. */
export function keineKonsole(k: readonly Konsolenmeldung[]): void {
  expect(k).toEqual([]);
}
