// Neutraler Wochentag für den WAP-Import (Vertrag E1-07 §2b); ersetzt dort die
// Tagesbefehl-Typen TbWeekday/TB_WEEKDAYS, ohne src/model zu importieren.

export type SheetWeekday = 'Mo' | 'Di' | 'Mi' | 'Do' | 'Fr' | 'Sa' | 'So';

/** Montag bis Sonntag in dieser Reihenfolge. */
export const SHEET_WEEKDAYS: readonly SheetWeekday[] = Object.freeze([
  'Mo',
  'Di',
  'Mi',
  'Do',
  'Fr',
  'Sa',
  'So',
] as const);

/**
 * Je Wochentag eine benannte Gruppe; volle Namen vor den Kürzeln, damit «Montag» nicht als
 * «Mo» + «ntag» scheitert.
 */
const DAY_RE =
  /^\s*(?:(?<Mo>montag|mo)|(?<Di>dienstag|di)|(?<Mi>mittwoch|mi)|(?<Do>donnerstag|do)|(?<Fr>freitag|fr)|(?<Sa>samstag|sa)|(?<So>sonntag|so))(?=$|[\s.,:\d])/i;

/**
 * Wochentag am Anfang eines Kopftexts: «Montag», «Mo», «MO», «Mo 28.09.26», «Montag,» …
 * Führende Leerzeichen sind erlaubt; nach dem Namen folgt Textende, Leerraum, «.», «,», «:»
 * oder eine Ziffer. Sonst null («Mob», «Dorf», «Woche»).
 */
export function weekdayOfText(text: string): SheetWeekday | null {
  const groups = DAY_RE.exec(text)?.groups ?? {};
  return SHEET_WEEKDAYS.find((day) => groups[day] !== undefined) ?? null;
}
