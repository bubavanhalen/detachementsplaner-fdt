import type { Person, Project } from '../types';
import {
  isWeekend,
  TB_SECTION_HEADINGS,
  TB_WEEKDAY_NAMES,
  TB_WEEKDAYS,
  type TbEntry,
  type TbLeitung,
  type TbOfficerOverride,
  type TbOrder,
  type TbOrderBlock,
  type TbRule,
  type TbSection,
  type TbSettings,
  type TbState,
  type TbWeek,
  type TbWeekday,
} from './types';

export const DEFAULT_TB_SETTINGS: TbSettings = {
  lk: 'LK 1:50 000, Bl 217, 227',
  kdtName: '',
  kdtFunktion: 'Kommandant',
  gehtAn: ['Kader {Einheit}', '{Einheit} (via Anschlag)'],
  zK: [],
  dienstleistung: 'FDT_2026',
};

const rule = (
  id: string,
  match: string,
  verantwortlich: string,
  ort: string,
  leitung?: TbLeitung,
): TbRule => ({ id, match, verantwortlich, ort, ...(leitung ? { leitung } : {}) });

/** Seed from the Kp Kdt. Editable in the interface, persisted in project.tb.regeln. */
export const DEFAULT_TB_RULES: readonly TbRule[] = [
  rule('r_tagwache', 'Tagwache', 'Zfhr / Einh Fw', 'Ukft'),
  rule('r_verpflegung', 'MoE, MiE, NaE', 'Einh Four', 'Ukft'),
  rule('r_verlesen', 'AV, HV', 'Kp Kdt', 'AV Platz'),
  rule('r_rapport', 'KR, Kp Rap, DR, Dienstrapport', 'Kp Kdt', 'Rapportraum'),
  rule('r_dienst', 'PD, ID, Zi Ord', 'Zfhr / Einh Fw', 'Ukft'),
  rule('r_abv', 'ABV', 'Einh Fw', 'Ukft'),
  rule('r_ev', 'EV, z Vf Zfhr', 'Zfhr', 'Ukft'),
  rule('r_wpd', 'WPD, Einrichten Ukft, Einrichten Mag', 'Einh Fw', 'Ukft'),
  rule('r_avor', 'AVOR', 'Kp Kdt', 'Ukft'),
  rule('r_bat', '*', 'Bat', 'gem Bat', 'bat'),
];

export function createTbState(): TbState {
  return {
    settings: structuredClone(DEFAULT_TB_SETTINGS),
    regeln: structuredClone([...DEFAULT_TB_RULES]),
    wochen: {},
    offiziere: [],
    offiziereEntfernt: [],
    rotationStart: 0,
  };
}

export function emptyWeek(sheet: string): TbWeek {
  return {
    sheet,
    sourceFile: '',
    parsedAt: '',
    startDate: '',
    firstNumber: 1,
    days: [],
    entries: [],
    groups: {},
    parseConflicts: [],
    dismissedConflicts: [],
    notes: { wochenziele: [], bemerkungen: [] },
    officers: {},
    wachtOf: {},
  };
}

// ---------------------------------------------------------------------------
// Normalisation of the optional project.tb sub-object (old saves have none).

const obj = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const str = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : typeof value === 'number' ? String(value) : fallback;
const strList = (value: unknown, fallback: string[] = []): string[] =>
  Array.isArray(value) ? value.filter((item) => typeof item === 'string') : fallback;
const isDay = (value: unknown): value is TbWeekday =>
  typeof value === 'string' && (TB_WEEKDAYS as readonly string[]).includes(value);
const SECTIONS: readonly TbSection[] = ['dienstbetrieb', 'besonderes', 'rapporte'];
const LEITUNGEN: readonly TbLeitung[] = ['bat', 'kp', 'zfhr', 'extern', 's2', ''];
const leitung = (value: unknown): TbLeitung | undefined =>
  (LEITUNGEN as readonly unknown[]).includes(value) ? (value as TbLeitung) : undefined;
const num = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

function dayRecord<T>(value: unknown, map: (item: unknown) => T): Partial<Record<TbWeekday, T>> {
  return Object.fromEntries(
    Object.entries(obj(value))
      .filter(([key]) => isDay(key))
      .map(([key, item]) => [key, map(item)]),
  );
}

function normalizeEntry(input: unknown, index: number): TbEntry | null {
  const e = obj(input);
  if (!isDay(e.day)) return null;
  const source = e.source == null ? undefined : obj(e.source);
  return {
    id: str(e.id) || `tbe_${index}`,
    day: e.day,
    section: SECTIONS.includes(e.section as TbSection) ? (e.section as TbSection) : 'besonderes',
    group: e.section === 'dienstbetrieb' ? str(e.group) : '',
    zeit: str(e.zeit),
    taetigkeit: str(e.taetigkeit),
    verantwortlich: str(e.verantwortlich),
    ort: str(e.ort),
    ...(source
      ? {
          source: {
            kind: source.kind === 'footnote' || source.kind === 'manual' ? source.kind : 'box',
            rawText: str(source.rawText),
            ...(num(source.rawStart) != null ? { rawStart: num(source.rawStart) } : {}),
            ...(num(source.rawEnd) != null ? { rawEnd: num(source.rawEnd) } : {}),
            ...(leitung(source.leitung) != null ? { leitung: leitung(source.leitung) } : {}),
            ...(source.columns != null ? { columns: strList(source.columns) } : {}),
            ...(source.footnote != null ? { footnote: str(source.footnote) } : {}),
            ...(source.flags != null ? { flags: strList(source.flags) } : {}),
          },
        }
      : {}),
  };
}

function normalizeWeek(sheet: string, input: unknown): TbWeek {
  const w = obj(input),
    base = emptyWeek(sheet),
    notes = obj(w.notes);
  const entries = (Array.isArray(w.entries) ? w.entries : [])
    .map(normalizeEntry)
    .filter((entry): entry is TbEntry => entry !== null);
  return {
    ...base,
    sourceFile: str(w.sourceFile),
    parsedAt: str(w.parsedAt),
    startDate: /^\d{4}-\d{2}-\d{2}$/.test(str(w.startDate)) ? str(w.startDate) : '',
    firstNumber: Math.max(1, Math.round(num(w.firstNumber) ?? 1)),
    days: TB_WEEKDAYS.filter((day) => strList(w.days).includes(day)),
    entries,
    groups: dayRecord(w.groups, (item) => strList(item)),
    parseConflicts: (Array.isArray(w.parseConflicts) ? w.parseConflicts : [])
      .map((item) => obj(item))
      .filter((c) => isDay(c.day))
      .map((c) => ({
        id: str(c.id),
        day: c.day as TbWeekday,
        type: str(c.type) as TbWeek['parseConflicts'][number]['type'],
        message: str(c.message),
        entryIds: strList(c.entryIds),
      })),
    dismissedConflicts: strList(w.dismissedConflicts),
    notes: { wochenziele: strList(notes.wochenziele), bemerkungen: strList(notes.bemerkungen) },
    officers: dayRecord(w.officers, (item) => {
      const o = obj(item);
      return { personId: str(o.personId), text: str(o.text), tel: str(o.tel) };
    }),
    wachtOf: dayRecord(w.wachtOf, (item) => strList(item)),
  };
}

/** Tolerant: invalid parts fall back to defaults instead of rejecting the whole project. */
export function normalizeTbState(input: unknown): TbState {
  const t = obj(input),
    settings = obj(t.settings),
    base = createTbState();
  const regeln = Array.isArray(t.regeln)
    ? t.regeln.map((item, index) => {
        const r = obj(item);
        const l = leitung(r.leitung);
        return {
          id: str(r.id) || `r_${index}`,
          match: str(r.match),
          verantwortlich: str(r.verantwortlich),
          ort: str(r.ort),
          ...(l ? { leitung: l } : {}),
        };
      })
    : base.regeln;
  return {
    settings: {
      lk: str(settings.lk, base.settings.lk),
      kdtName: str(settings.kdtName),
      kdtFunktion: str(settings.kdtFunktion, base.settings.kdtFunktion),
      gehtAn: strList(settings.gehtAn, base.settings.gehtAn),
      zK: strList(settings.zK, base.settings.zK),
      dienstleistung: str(settings.dienstleistung, base.settings.dienstleistung),
    },
    regeln,
    wochen: Object.fromEntries(
      Object.entries(obj(t.wochen)).map(([sheet, week]) => [sheet, normalizeWeek(sheet, week)]),
    ),
    offiziere: strList(t.offiziere),
    offiziereEntfernt: strList(t.offiziereEntfernt),
    rotationStart: Math.max(0, Math.round(num(t.rotationStart) ?? 0)),
  };
}

// ---------------------------------------------------------------------------
// Default Verantwortlich / Ort from the rule table.

const fold = (value: string): string =>
  value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** True when one keyword of the rule starts a word of the activity text. */
export function ruleMatches(rule: TbRule, taetigkeit: string, leitungValue?: TbLeitung): boolean {
  if (rule.leitung && rule.leitung !== leitungValue) return false;
  const text = fold(taetigkeit);
  return rule.match
    .split(',')
    .map((keyword) => fold(keyword))
    .filter(Boolean)
    .some((keyword) => {
      if (keyword === '*') return true;
      const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`(?:^|[\\s/(])${escaped}(?=$|[\\s/),.:])`).test(text);
    });
}

/** Fills empty Verantwortlich / Ort from the first matching rule. Never overwrites values. */
export function applyRules<T extends Pick<TbEntry, 'taetigkeit' | 'verantwortlich' | 'ort'>>(
  entry: T & { source?: { leitung?: TbLeitung } },
  rules: readonly TbRule[],
): T {
  if (entry.verantwortlich && entry.ort) return entry;
  const specific = rules.filter((r) => r.match.trim() !== '*');
  const fallback = rules.filter((r) => r.match.trim() === '*');
  const hit = [...specific, ...fallback].find((r) =>
    ruleMatches(r, entry.taetigkeit, entry.source?.leitung),
  );
  if (!hit) return entry;
  return {
    ...entry,
    verantwortlich: entry.verantwortlich || hit.verantwortlich,
    ort: entry.ort || hit.ort,
  };
}

// ---------------------------------------------------------------------------
// Dates, numbering and Tagesoffizier rotation.

export const dayIndex = (day: TbWeekday): number => TB_WEEKDAYS.indexOf(day) + 1;

export function dayDate(week: Pick<TbWeek, 'startDate'>, day: TbWeekday): string {
  if (!week.startDate) return '';
  const date = new Date(`${week.startDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + dayIndex(day) - 1);
  return date.toISOString().slice(0, 10);
}
export const swissDate = (iso: string): string =>
  iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : '';
export const orderNumber = (week: Pick<TbWeek, 'firstNumber'>, day: TbWeekday): number =>
  week.firstNumber + dayIndex(day) - 1;
export function orderTitle(number: number, day: TbWeekday, iso: string): string {
  return `Tagesbefehl Nr ${number} für ${TB_WEEKDAY_NAMES[day]}${iso ? `, ${swissDate(iso)}` : ''}`;
}

/** Lowercase letters and digits only, umlauts folded: tolerant comparison of imported text. */
const compact = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const ROTATION_GRADES = new Set(['lt', 'oblt', 'leutnant', 'oberleutnant']);
/** Lt / Oblt in any common spelling ("Oblt.", "Oberleutnant", "Lt (…)"). */
export function isRotationGrade(grad: string): boolean {
  const first = grad.trim().split(/[\s(,/]+/)[0] ?? '';
  return ROTATION_GRADES.has(compact(grad)) || ROTATION_GRADES.has(compact(first));
}

/** Kdt and Kdt Stv in any common spelling ("Kdt Stv", "Stv Kdt", "Kommandant-Stellvertreter"). */
export function isCommanderFunction(funktion: string): boolean {
  return /kommandant|(?:^|[^a-zäöü])kdt(?:[^a-zäöü]|$)/i.test(funktion);
}

/** Same unit ignoring spaces, punctuation and case; a missing unit on either side never excludes. */
export function sameUnit(a: string | undefined, b: string | undefined): boolean {
  const left = compact(a ?? ''),
    right = compact(b ?? '');
  return !left || !right || left === right || left.includes(right) || right.includes(left);
}

/**
 * Planned officers for the rotation: Lt/Oblt of the own unit who are not marked as
 * not taking part in the planning, without Kdt / Kdt Stv. Ordered by Zug, then name.
 */
export function eligibleOfficers(project: Project): Person[] {
  const unit = project.settings.eigeneEinheit;
  return project.persons
    .filter(
      (p) =>
        p.planning.status !== 'excluded' &&
        isRotationGrade(p.grad) &&
        sameUnit(unit, p.einteilung) &&
        !isCommanderFunction(p.funktion),
    )
    .sort(
      (a, b) =>
        (a.zug ?? '').localeCompare(b.zug ?? '', 'de-CH', { numeric: true }) ||
        (a.nachname || a.name).localeCompare(b.nachname || b.name, 'de-CH'),
    );
}

/**
 * Effective rotation order: officers whose position the user fixed, then every other
 * planned officer automatically (unless removed). Persons not taking part are skipped.
 */
export function rotationOrder(project: Project, tb: TbState): string[] {
  const active = new Set(
    project.persons.filter((p) => p.planning.status !== 'excluded').map((p) => p.id),
  );
  const removed = new Set(tb.offiziereEntfernt);
  const fixed = [...new Set(tb.offiziere)].filter((id) => active.has(id));
  const automatic = eligibleOfficers(project)
    .map((p) => p.id)
    .filter((id) => !fixed.includes(id) && !removed.has(id));
  return [...fixed, ...automatic];
}

export function personLabel(person: Person): string {
  const full =
    person.vorname || person.nachname
      ? [person.vorname, person.nachname].filter(Boolean).join(' ')
      : person.name;
  return [person.grad, full].filter(Boolean).join(' ');
}

/** Weekdays (Mo–Fr) of all stored weeks in date order; rotation continues across weeks. */
function rotationSlots(tb: TbState): { sheet: string; day: TbWeekday }[] {
  return Object.values(tb.wochen)
    .slice()
    .sort((a, b) => (a.startDate || '9999').localeCompare(b.startDate || '9999'))
    .flatMap((week) =>
      week.days.filter((day) => !isWeekend(day)).map((day) => ({ sheet: week.sheet, day })),
    );
}

export function rotationOfficer(
  project: Project,
  tb: TbState,
  sheet: string,
  day: TbWeekday,
): string {
  const order = rotationOrder(project, tb);
  if (!order.length || isWeekend(day)) return '';
  const slot = rotationSlots(tb).findIndex((s) => s.sheet === sheet && s.day === day);
  if (slot < 0) return '';
  return order[(tb.rotationStart + slot) % order.length];
}

export function officerLines(
  project: Project,
  tb: TbState,
  week: TbWeek,
  day: TbWeekday,
): string[] {
  if (isWeekend(day)) return week.wachtOf[day] ?? [];
  const override: TbOfficerOverride | undefined = week.officers[day];
  const personId =
    override?.personId || (override?.text ? '' : rotationOfficer(project, tb, week.sheet, day));
  const person = project.persons.find((p) => p.id === personId);
  if (person) return [personLabel(person), override?.tel || person.tel || ''].filter(Boolean);
  if (override?.text) return [override.text, override.tel].filter(Boolean);
  return [];
}

// ---------------------------------------------------------------------------
// Order builder — the single source for xlsx, print view and PDF.

const withUnit = (line: string, unit: string): string => line.replaceAll('{Einheit}', unit);
const entryBlock = (entry: TbEntry): TbOrderBlock => ({
  kind: 'entry',
  entryId: entry.id,
  zeit: entry.zeit,
  taetigkeit: entry.taetigkeit,
  verantwortlich: entry.verantwortlich,
  ort: entry.ort,
});

export function orderBlocks(week: TbWeek, day: TbWeekday): TbOrderBlock[] {
  const entries = week.entries.filter((entry) => entry.day === day);
  const blocks: TbOrderBlock[] = [];
  const sections: TbSection[] = isWeekend(day)
    ? ['dienstbetrieb', 'besonderes']
    : ['dienstbetrieb', 'besonderes', 'rapporte'];
  for (const section of sections) {
    blocks.push({ kind: 'section', heading: TB_SECTION_HEADINGS[section] });
    const inSection = entries.filter((entry) => entry.section === section);
    const general = inSection.filter((entry) => section !== 'dienstbetrieb' || !entry.group);
    blocks.push(...general.map(entryBlock));
    if (section !== 'dienstbetrieb') continue;
    const known = week.groups[day] ?? [];
    const order = [
      ...known,
      ...new Set(inSection.map((e) => e.group).filter((g) => g && !known.includes(g))),
    ];
    for (const group of order) {
      const grouped = inSection.filter((entry) => entry.group === group);
      if (!grouped.length) continue;
      blocks.push({ kind: 'group', heading: group }, ...grouped.map(entryBlock));
    }
  }
  return blocks;
}

export function buildOrder(project: Project, tb: TbState, week: TbWeek, day: TbWeekday): TbOrder {
  const date = dayDate(week, day),
    number = orderNumber(week, day),
    einheit = project.settings.eigeneEinheit;
  return {
    day,
    index: dayIndex(day),
    date,
    number,
    title: orderTitle(number, day, date),
    lk: tb.settings.lk,
    einheit,
    weekend: isWeekend(day),
    blocks: orderBlocks(week, day),
    officer: {
      label: isWeekend(day) ? 'Wochenend Wacht Of' : 'Tagesoffizier',
      lines: officerLines(project, tb, week, day),
    },
    signature: { einheit, name: tb.settings.kdtName, funktion: tb.settings.kdtFunktion },
    verteiler: {
      gehtAn: tb.settings.gehtAn.map((line) => withUnit(line, einheit)).filter(Boolean),
      zK: tb.settings.zK.map((line) => withUnit(line, einheit)).filter(Boolean),
    },
  };
}

export function buildOrders(project: Project, tb: TbState, week: TbWeek): TbOrder[] {
  return week.days.map((day) => buildOrder(project, tb, week, day));
}

/** File label for a week: "KVK", "Wo 1" → "Wo_1". */
export const weekFileLabel = (sheet: string): string =>
  sheet
    .trim()
    .replace(/[^\wÄÖÜäöü]+/g, '_')
    .replace(/^_|_$/g, '') || 'Woche';
