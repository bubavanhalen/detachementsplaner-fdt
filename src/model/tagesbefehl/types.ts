// Shared Tagesbefehl model. One reviewed week feeds the review table, the xlsx
// export, the print view and the per-day PDFs, so all outputs stay identical.

export type TbWeekday = 'Mo' | 'Di' | 'Mi' | 'Do' | 'Fr' | 'Sa' | 'So';
export const TB_WEEKDAYS: readonly TbWeekday[] = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
export const TB_WEEKDAY_NAMES: Record<TbWeekday, string> = {
  Mo: 'Montag',
  Di: 'Dienstag',
  Mi: 'Mittwoch',
  Do: 'Donnerstag',
  Fr: 'Freitag',
  Sa: 'Samstag',
  So: 'Sonntag',
};
export const isWeekend = (day: TbWeekday): boolean => day === 'Sa' || day === 'So';

/** Main sections of a Tagesbefehl. Group headings are sub-headings of `dienstbetrieb`. */
export type TbSection = 'dienstbetrieb' | 'besonderes' | 'rapporte';
export const TB_SECTION_HEADINGS: Record<TbSection, string> = {
  dienstbetrieb: '1 Dienstbetrieb / Ausbildung',
  besonderes: '2 Besonderes',
  rapporte: '3 Rapporte',
};

/** Leitung from the WAP legend (fill colour of the box). */
export type TbLeitung = 'bat' | 'kp' | 'zfhr' | 'extern' | 's2' | '';

/** Where a reviewed entry came from. Kept only for review (hover, conflicts). */
export interface TbEntrySource {
  kind: 'box' | 'footnote' | 'manual';
  /** Box text as in the WAP, paragraphs joined with " / ". */
  rawText: string;
  /** Unrounded minutes since 00:00 derived from the drawing position. */
  rawStart?: number;
  rawEnd?: number;
  leitung?: TbLeitung;
  /** Sub-column headers the box spans, e.g. ["COBRA 10", "COBRA 20"]. */
  columns?: string[];
  /** Footnote number (e.g. "21") when the entry stems from or merged a footnote. */
  footnote?: string;
  /** Short German review hints, e.g. "Zeit aus Fussnote", "Zeit aus Position". */
  flags?: string[];
}

export interface TbEntry {
  id: string;
  day: TbWeekday;
  section: TbSection;
  /** Sub-heading within "1 Dienstbetrieb / Ausbildung"; '' = general part of the section. */
  group: string;
  /** Display time: "0830", "1145 - 1245", "gz Tag", "anschl", "ab 1900" … */
  zeit: string;
  taetigkeit: string;
  verantwortlich: string;
  ort: string;
  source?: TbEntrySource;
}

export type TbConflictType =
  | 'label_vs_position'
  | 'footnote_vs_box'
  | 'footnote_missing_text'
  | 'footnote_missing_marker'
  | 'footnote_without_time'
  | 'overlap'
  | 'location_overlap'
  | 'unknown_abbreviation'
  | 'naming'
  | 'ambiguous';

export interface TbConflict {
  /** Stable within a week (derived from type + entries) so dismissals survive re-detection. */
  id: string;
  day: TbWeekday;
  type: TbConflictType;
  /** German message for the local interface only. Never logged. */
  message: string;
  entryIds: string[];
}

export interface TbOfficerOverride {
  /** Person id from project.persons, or '' when `text` is used. */
  personId: string;
  /** Free text, e.g. for an officer from another unit. */
  text: string;
  tel: string;
}

export interface TbWeek {
  /** WAP sheet name, e.g. "KVK", "Wo 1". Key in TbState.wochen. */
  sheet: string;
  sourceFile: string;
  parsedAt: string;
  /** ISO date (YYYY-MM-DD) of the Monday of this week. '' until known. */
  startDate: string;
  /** Tagesbefehl number of Monday; the other days count up from it (Di = +1 …). */
  firstNumber: number;
  /** Days for which a Tagesbefehl is issued (in weekday order). */
  days: TbWeekday[];
  /** Ordered entries. Order within (day, section, group) is the output order. */
  entries: TbEntry[];
  /** Ordered group headings per day (sub-headings of section 1). */
  groups: Partial<Record<TbWeekday, string[]>>;
  /** Conflicts found while parsing (position/label/footnote related). */
  parseConflicts: TbConflict[];
  /** Conflict ids the user marked as checked. */
  dismissedConflicts: string[];
  notes: { wochenziele: string[]; bemerkungen: string[] };
  /** Per-day Tagesoffizier override (weekdays). */
  officers: Partial<Record<TbWeekday, TbOfficerOverride>>;
  /** Weekend "Wochenend Wacht Of" lines per day, e.g. ["Wacht Of Kp 99/1", "Tel folgt"]. */
  wachtOf: Partial<Record<TbWeekday, string[]>>;
}

export interface TbRule {
  id: string;
  /** Comma separated activity keywords, matched at a word start, e.g. "MoE, MiE, NaE". */
  match: string;
  /** Only apply to boxes of this Leitung (e.g. "bat" for blue boxes without "Ltg:"). */
  leitung?: TbLeitung;
  verantwortlich: string;
  ort: string;
}

export interface TbSettings {
  /** "LK 1:50 000, Bl 217, 227" */
  lk: string;
  /** Signing commander, e.g. "Hptm Muster Hans". Personal data: starts empty. */
  kdtName: string;
  kdtFunktion: string;
  /** Verteiler lines; "{Einheit}" is replaced with project.settings.eigeneEinheit. */
  gehtAn: string[];
  zK: string[];
  /** Filename suffix, e.g. "FDT_2026" → Tagesbefehle_KVK_FDT_2026.xlsx */
  dienstleistung: string;
}

export interface TbState {
  settings: TbSettings;
  regeln: TbRule[];
  wochen: Record<string, TbWeek>;
  /**
   * Person ids whose rotation order the user fixed. Planned officers who are not
   * listed here (and not removed) join the rotation automatically after them.
   */
  offiziere: string[];
  /** Person ids the user removed from the automatic rotation. */
  offiziereEntfernt: string[];
  /** Rotation offset: which officer takes the first weekday of the earliest week. */
  rotationStart: number;
}

/** One rendered Tagesbefehl. xlsx, print view and PDF render exactly this. */
export type TbOrderBlock =
  | { kind: 'section'; heading: string }
  | { kind: 'group'; heading: string }
  | {
      kind: 'entry';
      entryId: string;
      zeit: string;
      taetigkeit: string;
      verantwortlich: string;
      ort: string;
    };

export interface TbOrder {
  day: TbWeekday;
  /** Weekday index Mo = 1 … So = 7 (used for PDF names 01_Mo … 07_So). */
  index: number;
  /** ISO date; '' when the week has no start date yet. */
  date: string;
  number: number;
  /** "Tagesbefehl Nr 3 für Mittwoch, 30.09.2026" */
  title: string;
  lk: string;
  einheit: string;
  weekend: boolean;
  blocks: TbOrderBlock[];
  /** Weekday: label "Tagesoffizier"; weekend: "Wochenend Wacht Of". */
  officer: { label: string; lines: string[] };
  signature: { einheit: string; name: string; funktion: string };
  verteiler: { gehtAn: string[]; zK: string[] };
}

/** Locally stored binary assets (separate localStorage key, never in project JSON). */
export interface TbAssets {
  /** Official template (.xlsx) as base64. */
  template?: { name: string; base64: string; savedAt: string };
  /** Signature PNG, already prepared (padded/thickened) as base64. */
  signature?: { name: string; base64: string; savedAt: string };
}

/** Result of parsing one WAP sheet. */
export interface WapParseResult {
  sheet: string;
  /** ISO Monday if the sheet states dates; '' otherwise. */
  startDate: string;
  days: TbWeekday[];
  entries: TbEntry[];
  groups: Partial<Record<TbWeekday, string[]>>;
  /** Sub-column headers per day as written in the sheet (optional, for heading aliases). */
  columns?: Partial<Record<TbWeekday, string[]>>;
  conflicts: TbConflict[];
  notes: { wochenziele: string[]; bemerkungen: string[] };
  /** Generic, data-free diagnostics (counts, detected layout) for the local UI. */
  diagnostics: string[];
}
