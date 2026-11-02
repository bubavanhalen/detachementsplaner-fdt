// Kürzelliste einer Woche (Vertrag E1-02a Abschnitt 3 und 8 P-11; R-4.7-14).

import { addDays } from '../calendar';
import type { LevelTemplate } from '../template';
import type { Entry, Id, Plan, RichText } from '../types';
import { requireWeek } from './columns';
import { remarksForWeek } from './remarks';

/** Sortierung alphabetisch mit Zahlenfolge, «AR2» vor «AR10» (V-02a-3). */
const COLLATOR = new Intl.Collator('de-CH', { numeric: true });

function plainText(r: RichText): string {
  return r.map((run) => run.text).join('');
}

/**
 * Gedruckte Textfelder eines Eintrags; nie internalNote, nie removedText (R-6-08, F-30). Block: Tn nur bei
 * `printTn`, Tenue nur bei `printTenue` (Q-023, R-4.7-18); dazu Titel, Ltg und Ort jeder Teilaufgabe (R-4.7-19).
 * Die übrigen Felder zählen unverändert (Vertrag E1-02h Abschnitt 3a, V-02h-5).
 */
function printedTexts(e: Entry): readonly string[] {
  switch (e.type) {
    case 'block':
      return [
        plainText(e.title),
        e.supplement,
        e.ltg,
        ...(e.printTn ? [e.tn] : []),
        e.tpt,
        e.ort,
        ...(e.printTenue ? [e.tenue] : []),
        ...(e.subtasks ?? []).flatMap((s) => [plainText(s.title), s.ltg, s.ort]),
      ];
    case 'querbalken':
      return [plainText(e.title)];
    case 'marker':
      return e.kind === 'custom' ? [e.customKind] : [];
    case 'rapport':
      return [e.ort, e.tn];
    case 'beso':
      return [
        plainText(e.title),
        ...e.windows.map((w) => w.supplement),
        e.ltg,
        e.tn,
        e.tpt,
        e.ort,
        e.agendaOverride ?? '',
      ];
    case 'dayRemark':
    case 'multiDayRemark':
      return [e.text];
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Kürzel als ganzes Wort: Grenze = Anfang, Ende oder Zeichen ausser Buchstabe und Ziffer (P-11). */
function containsWord(texts: readonly string[], word: string): boolean {
  if (word === '') return false;
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(word)}(?![\\p{L}\\p{N}])`, 'u');
  return texts.some((t) => pattern.test(t));
}

/** Rapportkürzel der Woche und verwendete gewählte Kürzel; allgemeine Armeeabkürzungen nie automatisch. */
export function abbreviationsForWeek(plan: Plan, weekId: Id): readonly string[] {
  const week = requireWeek(plan, weekId);
  const first = week.startDate;
  const last = addDays(first, 6);
  const inWeek = (d: string): boolean => first <= d && d <= last;
  const weekEntries: Entry[] = Object.values(plan.entries).filter((e) => {
    switch (e.type) {
      case 'querbalken':
        return e.fromDate <= last && e.toDate >= first;
      case 'multiDayRemark':
        return false;
      default:
        return inWeek(e.date);
    }
  });
  const result = new Set<string>();
  for (const e of weekEntries) if (e.type === 'rapport') result.add(e.code);
  const texts = [...weekEntries, ...remarksForWeek(plan, weekId)].flatMap(printedTexts);
  for (const word of plan.abbreviationsSelected) {
    if (containsWord(texts, word)) result.add(word);
  }
  return [...result].sort(COLLATOR.compare);
}

/**
 * Bedeutung eines Kürzels (Vertrag E1-02h Abschnitt 3b; R-4.7-20, R-4.7-21): eigener, nach Trimmen nicht leerer
 * Wert aus `plan.abbreviationMeanings` (getrimmt), sonst `meaning` des gleichnamigen Rapportkürzels der Vorlage
 * (getrimmt), sonst ''. Kürzel zeichengleich (Gross-/Kleinschreibung zählt). Rein, wirft nie.
 */
export function abbreviationMeaning(plan: Plan, code: string, template: LevelTemplate): string {
  // Laufzeitsicht: das Planfeld kann in einer beschädigten Datei einen anderen Typ haben (wirft nie).
  const own: unknown = plan.abbreviationMeanings;
  if (typeof own === 'object' && own !== null && Object.hasOwn(own, code)) {
    const value: unknown = Object.getOwnPropertyDescriptor(own, code)?.value;
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
  }
  const meaning = template.rapportCodes.find((r) => r.code === code)?.meaning;
  return typeof meaning === 'string' ? meaning.trim() : '';
}
