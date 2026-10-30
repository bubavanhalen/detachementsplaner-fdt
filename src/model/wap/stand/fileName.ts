// Dateiname und PDF-Titel nach Konvention, rein (Vertrag E1-05, Notiz «Ausarbeitung Schritt 2» Abschnitte B, D2,
// D3; Beschrieb 6 «Dateiname»; R-6-10, R-6-11, R-6-12, R-10-46; F-24; V-05-1, V-05-2, V-02f-4).

import { formatDate } from '../calendar';
import { modelError } from '../errors';
import type { Id, IsoDate, Plan } from '../types';

/** Ziel eines PDF: eine Woche oder das Gesamt-PDF (Kurzname «Plan», R-6-11). */
export type PdfTarget = { readonly kind: 'week'; readonly weekId: Id } | { readonly kind: 'plan' };

/**
 * «‹Beilage mit _›_WAP_‹Dienst›_‹Kurzname›_Stand_‹yyyy-mm-dd›[_V‹Version›].pdf»; ohne Stand
 * «…_‹Kurzname›_Entwurf.pdf» ohne Datum (V-05-1). `_V‹Version›` nur bei standsSameDay ≥ 2. Abschnitt D2.
 */
export function pdfFileName(plan: Plan, target: PdfTarget, standsSameDay: number): string {
  if (!Number.isSafeInteger(standsSameDay) || standsSameDay < 1) {
    throw new RangeError('Die Anzahl Stände am selben Tag muss eine sichere ganze Zahl ab 1 sein.');
  }
  let shortName = 'Plan';
  if (target.kind === 'week') {
    const week = plan.weeks.find((w) => w.id === target.weekId);
    if (week === undefined) throw modelError('unknownWeek', { field: 'weekId' });
    shortName = sanitizeNamePart(week.shortName);
  }
  const suffix =
    plan.stand === null
      ? ['Entwurf']
      : [
          'Stand',
          formatDate(plan.stand.date, 'file'),
          standsSameDay >= 2 ? `V${plan.stand.version}` : '',
        ];
  return `${[fileNamePrefix(plan), shortName, ...suffix].filter((s) => s !== '').join('_')}.pdf`;
}

/**
 * Bereinigter Namensteil «N(s)» (V-05-2): unzulässige Zeichen und Steuerzeichen → Leerzeichen, trim, Leerraum → «_»,
 * mehrfache «_» → eins, «_» am Rand entfernt. Gemeinsame Regel für PDF, Plan-Datei und Sicherung (Abschnitt D2, V04).
 */
export function sanitizeNamePart(s: string): string {
  return Array.from(s, (character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127 || '\\/:*?"<>|'.includes(character) ? ' ' : character;
  })
    .join('')
    .trim()
    .replace(/\s+/gu, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/** «‹Beilage mit _›_WAP_‹Dienst›» aus den nicht leeren Teilen; enthält immer «WAP» (Abschnitt D2, V04; E1-04). */
export function fileNamePrefix(plan: Plan): string {
  const beilage = plan.beilage.match(/[0-9]+(?:-[0-9]+)*/)?.[0].replaceAll('-', '_') ?? '';
  return [beilage, 'WAP', sanitizeNamePart(plan.service)].filter((s) => s !== '').join('_');
}

/** 1 + Zahl der verschiedenen standId unter den übergebenen Aufzeichnungen mit diesem Datum. Abschnitt D3. */
export function standsSameDayFor(
  records: readonly { readonly standId: string; readonly date: IsoDate }[],
  date: IsoDate,
): number {
  return 1 + new Set(records.filter((r) => r.date === date).map((r) => r.standId)).size;
}
