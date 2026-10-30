// Golden-Kandidaten der PDF-Seiten (R-H-20, Prompt §7 Ebene 3, ADR-010 §7.3; Paket F-TOOLS). Nur
// pseudonymisierte bzw. fiktive Daten: die KVK-Fixture (E1-02a), ihre Fortsetzungsvariante mit fiktiven
// Tagesbemerkungen (E1-02f) und die erste Woche des synthetischen Plans mit festem Startwert (E1-02a).
// Optionen wie in den PDF-Tests von E1-02f (A4, Status an, mitgelieferte Vorlagen).
import { renderWeekPdf } from '../../../../src/io/wap-pdf';
import { fortsetzung, optionen } from '../../pdf/plan/support/plaene';
import { KVK_WOCHE, kvk } from '../../support/page/varianten';
import { syntheticPlan } from '../../support/synthetic-plan';
import type { GoldenBildInfo } from './golden';

/** Fester PDF-Titel der Golden-Kandidaten. */
const TITEL = 'WAP-Planer Golden';

export interface PdfKandidat extends GoldenBildInfo {
  /** Seite des PDF (ab 1). */
  readonly seite: number;
  /** Erzeugt das PDF aus dem Fixture (deterministisch). */
  pdf(): Promise<Uint8Array>;
}

async function kvkWoche(): Promise<Uint8Array> {
  return (await renderWeekPdf(kvk(), KVK_WOCHE, optionen(), TITEL)).bytes;
}

async function kvkFortsetzung(): Promise<Uint8Array> {
  return (await renderWeekPdf(fortsetzung(), KVK_WOCHE, optionen(), TITEL)).bytes;
}

async function synthWoche(): Promise<Uint8Array> {
  const plan = syntheticPlan();
  const erste = plan.weeks[0];
  if (erste === undefined) throw new Error('synthetischer Plan ohne Woche');
  return (await renderWeekPdf(plan, erste.id, optionen(), TITEL)).bytes;
}

/** Alle PDF-Kandidaten; der Name ist zugleich der Dateiname der Baseline (baselines/<name>.png). */
export const PDF_KANDIDATEN: readonly PdfKandidat[] = [
  {
    name: 'kvk-woche-s1',
    beschreibung: 'KVK-Woche, Wochenseite',
    anforderungen: ['R-H-20'],
    seite: 1,
    pdf: kvkWoche,
  },
  {
    name: 'kvk-fortsetzung-s1',
    beschreibung: 'KVK-Woche mit 40 Tagesbemerkungen, Wochenseite',
    anforderungen: ['R-H-20'],
    seite: 1,
    pdf: kvkFortsetzung,
  },
  {
    name: 'kvk-fortsetzung-s2',
    beschreibung: 'KVK-Woche mit 40 Tagesbemerkungen, Fortsetzungsseite',
    anforderungen: ['R-H-20'],
    seite: 2,
    pdf: kvkFortsetzung,
  },
  {
    name: 'synth-woche-1-s1',
    beschreibung: 'synthetischer Plan (Startwert 20260928), erste Woche, Wochenseite',
    anforderungen: ['R-H-20'],
    seite: 1,
    pdf: synthWoche,
  },
];
