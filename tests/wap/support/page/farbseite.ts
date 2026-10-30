// Wochenseite mit Farbkennung als PDF für die Eigenschaftstests (Paket E1-02e, Vertrag E1-02e Notiz «Ausarbeitung
// Schritt 2» H4, G3). Erzeugt Seite, PDF (mit Artefakt) und Auswertung; nur das gelesene PDF wird geprüft.

import { expect } from 'vitest';
import { writePdf } from '../../../../src/io/wap-pdf/writer';
import type { WeekPageLayout } from '../../../../src/model/wap/layout/page/types';
import type { Plan } from '../../../../src/model/wap/types';
import { pdfArtefakt } from '../pdf/artefakt';
import { minFontSize } from '../pdf/checks';
import { type PdfInfo, readPdf } from '../pdf/read';
import { analysiere, type SeitenAnalyse } from './analyse';
import { optionen, PDF_TITEL, seite } from './seite';
import { mindestgroesse } from './stile';

export interface FarbSeite {
  readonly layout: WeekPageLayout;
  readonly info: PdfInfo;
  readonly an: SeitenAnalyse;
}

const zaehler = new Map<string, number>();

/** Seite der Woche w26 → PDF (Artefakt `e1-02e-fk-<fall>-<n>`) → readPdf → Auswertung von Seite 1. */
export async function farbSeite(fall: string, plan: Plan, weekId = 'w26'): Promise<FarbSeite> {
  const layout = seite(plan, weekId, optionen());
  const bytes = await writePdf({ pages: layout.pages, title: PDF_TITEL });
  const n = (zaehler.get(fall) ?? 0) + 1;
  zaehler.set(fall, n);
  await pdfArtefakt(`e1-02e-fk-${fall}-${n}`, bytes);
  const info = await readPdf(bytes);
  // Mindestgrösse in jedem PDF dieses Pakets (R-10-38, Vertrag J «je Test»), wie seitePdf.
  expect(minFontSize(info), `Mindestgrösse im PDF ${fall} (R-10-38)`).toBeGreaterThanOrEqual(
    mindestgroesse(),
  );
  return { layout, info, an: analysiere(info, plan, weekId) };
}
