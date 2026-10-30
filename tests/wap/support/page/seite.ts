// Testhilfen der Seitenkomposition (Paket E1-02e, Vertrag docs/wap-planer/plan/vertraege/E1-02e.md, Notiz
// «Ausarbeitung Schritt 2» Abschnitt A, G3, H1). Erzeugt aus einem fiktiven bzw. pseudonymisierten Plan die
// Wochenseite (`layoutWeekPage`), schreibt sie mit dem Schreiber von E1-02c als PDF, legt das PDF als Artefakt
// `e1-02e-<fall>` ab (E1-01b-02) und liest es mit `readPdf` (E1-01b, Nachtrag P). PDF-Tests prüfen nur das
// Gelesene (H1); das Seitenmodell dient dort nur zum Erzeugen der Bytes.
// Kein `beforeAll` mit Stub-Aufruf: Fehler im Aufbau wären nicht fachlich rot (ADR-010 §3.3). Die Hilfen werden
// deshalb im Test selbst aufgerufen; `einmal` merkt sich das Ergebnis je Testdatei.
import { expect } from 'vitest';
import { writePdf } from '../../../../src/io/wap-pdf/writer';
import { layoutWeekPage } from '../../../../src/model/wap/layout/page/compose';
import type { PageOptions, WeekPageLayout } from '../../../../src/model/wap/layout/page/types';
import { builtInTemplates } from '../../../../src/model/wap/template';
import type { Id, Plan } from '../../../../src/model/wap/types';
import { pdfArtefakt } from '../pdf/artefakt';
import { minFontSize } from '../pdf/checks';
import { type PdfInfo, readPdf } from '../pdf/read';
import { mindestgroesse } from './stile';

/** Fester Titel aller Test-PDF dieses Pakets (Vertrag G3). */
export const PDF_TITEL = 'E1-02e Test';

/** Optionen der Wochenseite: A4, Status an, mitgelieferte Vorlagen (Vertrag B). */
export function optionen(over: Partial<PageOptions> = {}): PageOptions {
  return { paper: 'A4', showStatus: true, templates: builtInTemplates(), ...over };
}

export interface SeitenPdf {
  readonly layout: WeekPageLayout;
  readonly bytes: Uint8Array;
  readonly info: PdfInfo;
}

/** Wochenseite des Plans (ruft den Vertrags-Stub `layoutWeekPage`). */
export function seite(plan: Plan, weekId: Id, opts: PageOptions = optionen()): WeekPageLayout {
  return layoutWeekPage(plan, weekId, opts);
}

/**
 * Wochenseite → PDF → `readPdf`. Legt das PDF als Artefakt `e1-02e-<fall>` ab und prüft für jedes PDF dieses
 * Pakets die Mindestgrösse (R-10-38, Vertrag J «je Test»).
 */
export async function seitePdf(
  fall: string,
  plan: Plan,
  weekId: Id,
  opts: PageOptions = optionen(),
): Promise<SeitenPdf> {
  const layout = seite(plan, weekId, opts);
  const bytes = await writePdf({ pages: layout.pages, title: PDF_TITEL });
  await pdfArtefakt(`e1-02e-${fall}`, bytes);
  const info = await readPdf(bytes);
  expect(minFontSize(info), `Mindestgrösse im PDF ${fall} (R-10-38)`).toBeGreaterThanOrEqual(
    mindestgroesse(),
  );
  return { layout, bytes, info };
}

/** Merkt sich das Ergebnis des ersten Aufrufs (auch eine Ablehnung) für alle Tests einer Datei. */
export function einmal<T>(f: () => Promise<T>): () => Promise<T> {
  let p: Promise<T> | undefined;
  return () => {
    p ??= f();
    return p;
  };
}

/** Text eines Laufs mit Grossbuchstaben-Hex wie «U+00AD». */
export function codePunkt(z: string): string {
  return `U+${(z.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}`;
}
