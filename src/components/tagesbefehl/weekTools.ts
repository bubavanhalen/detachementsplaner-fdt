// Pure helpers for the Tagesbefehle page. They only rearrange the reviewed week;
// the order content itself comes from the shared model (buildOrders).
import { newId } from '../../model/project';
import {
  applyRules,
  dayIndex,
  detectEntryConflicts,
  emptyWeek,
  isWeekend,
  TB_SECTION_HEADINGS,
  TB_WEEKDAYS,
  type TbConflict,
  type TbEntry,
  type TbLeitung,
  type TbSection,
  type TbState,
  type TbWeek,
  type TbWeekday,
  type WapParseResult,
} from '../../model/tagesbefehl';

export const LEITUNG_LABELS: Record<TbLeitung, string> = {
  bat: 'Leitung Bat',
  kp: 'Leitung Kp',
  zfhr: 'Leitung Zfhr',
  extern: 'Extern',
  s2: 'Ltg S2',
  '': 'Ohne Leitung',
};

/** All conflicts of a week: stored parse conflicts plus recomputed entry conflicts. */
export function weekConflicts(week: TbWeek): TbConflict[] {
  let detected: TbConflict[] = [];
  try {
    detected = detectEntryConflicts(week);
  } catch {
    detected = [];
  }
  const seen = new Set<string>();
  return [...week.parseConflicts, ...detected].filter((conflict) => {
    if (!conflict.id || seen.has(conflict.id)) return false;
    seen.add(conflict.id);
    return true;
  });
}

export const openConflicts = (week: TbWeek, conflicts: TbConflict[]): TbConflict[] =>
  conflicts.filter((conflict) => !week.dismissedConflicts.includes(conflict.id));

/** Days shown in the review: issued days plus any day that still has entries. */
export function reviewDays(week: TbWeek): TbWeekday[] {
  return TB_WEEKDAYS.filter(
    (day) => week.days.includes(day) || week.entries.some((entry) => entry.day === day),
  );
}

export interface ReviewBucket {
  key: string;
  section: TbSection;
  group: string;
  heading: string;
  /** False for sections the order does not print (Rapporte on weekends). */
  printed: boolean;
  entries: TbEntry[];
}

export const bucketKey = (section: TbSection, group = ''): string =>
  `${section}:${section === 'dienstbetrieb' ? group : ''}`;
export function parseBucketKey(key: string): { section: TbSection; group: string } {
  const index = key.indexOf(':');
  const section = key.slice(0, index) as TbSection;
  return { section, group: section === 'dienstbetrieb' ? key.slice(index + 1) : '' };
}

export function dayGroups(week: TbWeek, day: TbWeekday): string[] {
  const known = week.groups[day] ?? [];
  return [
    ...known,
    ...new Set(
      week.entries
        .filter((entry) => entry.day === day && entry.section === 'dienstbetrieb' && entry.group)
        .map((entry) => entry.group)
        .filter((group) => !known.includes(group)),
    ),
  ];
}

/** Same order as the Tagesbefehl (orderBlocks), including empty buckets for editing. */
export function reviewBuckets(week: TbWeek, day: TbWeekday): ReviewBucket[] {
  const entries = week.entries.filter((entry) => entry.day === day);
  const bucket = (section: TbSection, group: string, heading: string): ReviewBucket => ({
    key: bucketKey(section, group),
    section,
    group,
    heading,
    printed: !(isWeekend(day) && section === 'rapporte'),
    entries: entries.filter(
      (entry) =>
        entry.section === section && (section !== 'dienstbetrieb' || entry.group === group),
    ),
  });
  const buckets = [
    bucket('dienstbetrieb', '', TB_SECTION_HEADINGS.dienstbetrieb),
    ...dayGroups(week, day).map((group) => bucket('dienstbetrieb', group, group)),
    bucket('besonderes', '', TB_SECTION_HEADINGS.besonderes),
    bucket('rapporte', '', TB_SECTION_HEADINGS.rapporte),
  ];
  return buckets.filter((item) => item.printed || item.entries.length);
}

const sameBucket = (a: TbEntry, b: TbEntry): boolean =>
  a.day === b.day &&
  a.section === b.section &&
  (a.section !== 'dienstbetrieb' || a.group === b.group);

/** Swaps the entry with its neighbour in the same day/section/group. */
export function moveEntry(week: TbWeek, id: string, direction: -1 | 1): boolean {
  const index = week.entries.findIndex((entry) => entry.id === id);
  if (index < 0) return false;
  const entry = week.entries[index];
  let target = index + direction;
  while (target >= 0 && target < week.entries.length && !sameBucket(week.entries[target], entry))
    target += direction;
  if (target < 0 || target >= week.entries.length) return false;
  [week.entries[index], week.entries[target]] = [week.entries[target], entry];
  return true;
}

/** Inserts after the last entry of the same bucket so it appears at the end of it. */
export function insertEntry(week: TbWeek, entry: TbEntry): void {
  let last = -1;
  week.entries.forEach((item, index) => {
    if (sameBucket(item, entry)) last = index;
  });
  if (last < 0) week.entries.push(entry);
  else week.entries.splice(last + 1, 0, entry);
}

export function manualEntry(
  day: TbWeekday,
  section: TbSection,
  group = '',
  taetigkeit = '',
): TbEntry {
  return {
    id: newId('tbe'),
    day,
    section,
    group: section === 'dienstbetrieb' ? group : '',
    zeit: '',
    taetigkeit,
    verantwortlich: '',
    ort: '',
    source: { kind: 'manual', rawText: '' },
  };
}

/** Changes section/group and keeps the entry at the end of its new bucket. */
export function relocateEntry(week: TbWeek, id: string, key: string): void {
  const index = week.entries.findIndex((entry) => entry.id === id);
  if (index < 0) return;
  const { section, group } = parseBucketKey(key);
  const [entry] = week.entries.splice(index, 1);
  insertEntry(week, { ...entry, section, group });
}

export function applyRulesToWeek(week: TbWeek, tb: TbState): number {
  let changed = 0;
  week.entries = week.entries.map((entry) => {
    const next = applyRules(entry, tb.regeln);
    if (next.verantwortlich !== entry.verantwortlich || next.ort !== entry.ort) changed++;
    return next;
  });
  return changed;
}

// ---------------------------------------------------------------------------
// Week order, numbering and dates.

export function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export const isMonday = (iso: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(iso) && new Date(`${iso}T12:00:00Z`).getUTCDay() === 1;

/** Weeks in service order: by start date where known, otherwise in loading order. */
export function orderedWeeks(tb: TbState): TbWeek[] {
  const list = Object.values(tb.wochen);
  return list
    .map((week, index) => ({ week, index }))
    .sort((a, b) =>
      a.week.startDate && b.week.startDate && a.week.startDate !== b.week.startDate
        ? a.week.startDate.localeCompare(b.week.startDate)
        : a.index - b.index,
    )
    .map((item) => item.week);
}

/** The week before `sheet` (for number/date suggestions). */
export function previousWeek(tb: TbState, sheet: string, startDate = ''): TbWeek | undefined {
  const others = Object.values(tb.wochen).filter((week) => week.sheet !== sheet);
  if (startDate) {
    const earlier = others
      .filter((week) => week.startDate && week.startDate < startDate)
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
    if (earlier.length) return earlier.at(-1);
    if (others.some((week) => week.startDate)) return undefined;
  }
  const ordered = orderedWeeks(tb).map((week) => week.sheet);
  const position = ordered.indexOf(sheet);
  const before = position < 0 ? ordered : ordered.slice(0, position);
  const name = before.filter((item) => item !== sheet).at(-1);
  return name ? tb.wochen[name] : undefined;
}

/** Highest Tagesbefehl number a week issues (Mo = firstNumber … So = firstNumber + 6). */
export function lastNumber(week: TbWeek): number {
  const indices = week.days.map(dayIndex);
  return week.firstNumber + (indices.length ? Math.max(...indices) : 7) - 1;
}

/** KVK 1–7 → Wo 1 starts with 8. */
export function suggestFirstNumber(tb: TbState, sheet: string, startDate = ''): number {
  const previous = previousWeek(tb, sheet, startDate);
  return previous ? lastNumber(previous) + 1 : 1;
}

export function suggestStartDate(tb: TbState, sheet: string): string {
  const previous = previousWeek(tb, sheet);
  return previous?.startDate ? addDays(previous.startDate, 7) : '';
}

/**
 * New reviewed week from a parse result. Re-parsing replaces entries and
 * conflicts but keeps what the user set per week (dates, numbers, officers).
 */
export function weekFromParse(
  tb: TbState,
  result: WapParseResult,
  sourceFile: string,
  previous?: TbWeek,
  now = new Date(),
): TbWeek {
  const base = emptyWeek(result.sheet);
  const startDate = previous?.startDate || result.startDate || suggestStartDate(tb, result.sheet);
  return {
    ...base,
    sourceFile,
    parsedAt: now.toISOString(),
    startDate,
    firstNumber: previous?.firstNumber ?? suggestFirstNumber(tb, result.sheet, startDate),
    days: TB_WEEKDAYS.filter((day) => result.days.includes(day)),
    entries: result.entries.map((entry) => applyRules(entry, tb.regeln)),
    groups: structuredClone(result.groups),
    parseConflicts: structuredClone(result.conflicts),
    dismissedConflicts: [],
    notes: structuredClone(result.notes),
    officers: structuredClone(previous?.officers ?? {}),
    wachtOf: structuredClone(previous?.wachtOf ?? {}),
  };
}

// ---------------------------------------------------------------------------
// Display helpers.

export function clock(minutes: number | undefined): string {
  if (minutes == null || !Number.isFinite(minutes)) return '';
  const total = Math.round(minutes);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** Hover text with the WAP source of an entry (local interface only). */
export function sourceDetails(entry: TbEntry): string[] {
  const source = entry.source;
  if (!source) return [];
  if (source.kind === 'manual') return ['Manuell erfasst'];
  const lines = [
    `${source.kind === 'footnote' ? 'Fussnote' : 'WAP-Feld'}: ${source.rawText || '—'}`,
  ];
  if (source.rawStart != null)
    lines.push(
      `Position (ungerundet): ${clock(source.rawStart)}${source.rawEnd != null ? `–${clock(source.rawEnd)}` : ''}`,
    );
  if (source.leitung != null) lines.push(`Farbe: ${LEITUNG_LABELS[source.leitung]}`);
  if (source.columns?.length) lines.push(`Spalten: ${source.columns.join(', ')}`);
  if (source.footnote) lines.push(`Fussnote ${source.footnote}`);
  if (source.flags?.length) lines.push(`Hinweise: ${source.flags.join('; ')}`);
  return lines;
}
