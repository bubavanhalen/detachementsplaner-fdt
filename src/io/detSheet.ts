import {
  listName,
  onsiteView,
  RANK_CATEGORY_LABELS,
  type RankCategory,
  rankCategory,
  sortByRank,
} from '../model';
import type { Detachment, Person, Project } from '../model/types';
import { download } from './exports';
import { XLSX } from './workbook';

// One derived sheet per detachement (or one of its on-site sub-groups) feeds the print
// preview, the Excel file and the copied text, so all three outputs always agree.

export type DetSheetColumn = 'funktion' | 'lics' | 'zug' | 'tel' | 'mail' | 'pnr';
export interface DetSheetOptions {
  /** 'all' or the id of one sub-group. */
  scope: string;
  /** One section per sub-group (when sub-groups exist). */
  grouped: boolean;
  /** Start every sub-group on a new printed page, e.g. to hand each leader their list. */
  pageBreaks: boolean;
  /** Empty box per person for roll call. */
  checkColumn: boolean;
  columns: Record<DetSheetColumn, boolean>;
}
export const DEFAULT_DET_SHEET_OPTIONS: DetSheetOptions = {
  scope: 'all',
  grouped: true,
  pageBreaks: false,
  checkColumn: true,
  columns: { funktion: true, lics: true, zug: false, tel: true, mail: false, pnr: false },
};
export interface SheetColumn {
  key: DetSheetColumn;
  label: string;
  value: (person: Person) => string;
}
export const DET_SHEET_COLUMNS: SheetColumn[] = [
  { key: 'funktion', label: 'Funktion', value: (person) => person.funktion },
  { key: 'lics', label: 'Fahrausweise', value: (person) => person.lics.join(', ') },
  { key: 'zug', label: 'Zug', value: (person) => person.zug ?? '' },
  { key: 'tel', label: 'Telefon', value: (person) => person.tel ?? '' },
  { key: 'mail', label: 'E-Mail', value: (person) => person.mail ?? '' },
  { key: 'pnr', label: 'Versicherten-Nr.', value: (person) => person.pnr ?? '' },
];

export interface DetSheetSection {
  /** Sub-group id, 'unassigned' or 'all'. */
  id: string;
  /** '' for an ungrouped list of the whole detachement. */
  title: string;
  chef?: Person;
  auftrag: string;
  people: Person[];
  bestand: string;
}
export interface DetSheet {
  title: string;
  ec: string;
  service: string;
  unit: string;
  details: [string, string][];
  sections: DetSheetSection[];
  total: number;
  bestand: string;
  licenses: [string, number][];
  columns: SheetColumn[];
  checkColumn: boolean;
  pageBreaks: boolean;
  /** File name without extension, also used as print title. */
  fileStem: string;
}

const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
function longDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  const weekday = Number.isNaN(date.getTime()) ? '' : `${WEEKDAYS[date.getDay()]} `;
  return `${weekday}${day}.${month}.${year}`;
}
const joined = (...parts: (string | undefined)[]): string =>
  parts
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' · ');

function details(group: Detachment): [string, string][] {
  const rows: [string, string][] = [
    [
      'Einrücken',
      joined(group.datum && longDate(group.datum), group.von && `${group.von} Uhr`, group.ort),
    ],
    ['Treffpunkt', group.treffpunkt],
    ['Anzug', group.anzug],
    ['Entlassung', joined(group.bisDatum && longDate(group.bisDatum), group.entlassungsort)],
    ['Bemerkungen', group.bem],
  ];
  return rows.filter(([, value]) => value.trim());
}

/** «2 Of · 3 Uof · 12 Mannschaft», the usual strength breakdown. */
export function bestand(people: Person[]): string {
  const counts = new Map<RankCategory, number>();
  for (const person of people) {
    const category = rankCategory(person.grad);
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  return (Object.keys(RANK_CATEGORY_LABELS) as RankCategory[])
    .filter((category) => counts.get(category))
    .map((category) => `${counts.get(category)} ${RANK_CATEGORY_LABELS[category]}`)
    .join(' · ');
}

export function fileStem(...parts: string[]): string {
  const stem = parts
    .map((part) =>
      part
        .replace(/[^\wÄÖÜäöü -]/g, '')
        .trim()
        .replace(/\s+/g, '_'),
    )
    .filter(Boolean)
    .join('_');
  return `${stem || 'Detachement'}_${new Date().toISOString().slice(0, 10)}`;
}

export function buildDetSheet(project: Project, detId: string, options: DetSheetOptions): DetSheet {
  const group = project.dets.find((item) => item.id === detId);
  if (!group) throw new Error('Das gewählte Detachement existiert nicht.');
  const view = onsiteView(project, detId);
  const scoped = view.groups.find((item) => item.sub.id === options.scope);
  const section = (
    id: string,
    title: string,
    people: Person[],
    extra: Partial<DetSheetSection> = {},
  ): DetSheetSection => ({ id, title, people, auftrag: '', bestand: bestand(people), ...extra });
  let sections: DetSheetSection[];
  if (scoped)
    sections = [
      section(scoped.sub.id, scoped.sub.name, scoped.people, {
        chef: scoped.chef,
        auftrag: scoped.sub.auftrag,
      }),
    ];
  else if (options.grouped && view.groups.length) {
    sections = view.groups.map((item) =>
      section(item.sub.id, item.sub.name, item.people, {
        chef: item.chef,
        auftrag: item.sub.auftrag,
      }),
    );
    if (view.unassigned.length)
      sections.push(section('unassigned', 'Nicht eingeteilt', view.unassigned));
  } else sections = [section('all', '', sortByRank(view.pool))];
  const people = sections.flatMap((item) => item.people);
  const licenses = new Map<string, number>();
  for (const person of people)
    for (const license of new Set(person.lics))
      if (license.trim()) licenses.set(license, (licenses.get(license) ?? 0) + 1);
  const title = scoped ? `${group.name} · ${scoped.sub.name}` : group.name;
  return {
    title,
    ec: group.ec,
    service: project.name,
    unit: project.settings.eigeneEinheit,
    details: details(group),
    sections,
    total: people.length,
    bestand: bestand(people),
    licenses: [...licenses].sort(([a], [b]) => a.localeCompare(b, 'de-CH')),
    columns: DET_SHEET_COLUMNS.filter((column) => options.columns[column.key]),
    checkColumn: options.checkColumn,
    pageBreaks: options.pageBreaks && sections.length > 1,
    fileStem: fileStem(group.name, scoped?.sub.name ?? ''),
  };
}

export function personLabel(person: Person): string {
  return [person.grad, listName(person)].filter(Boolean).join(' ');
}

/** Plain text for a briefing or a local note; the app itself never sends it anywhere. */
export function detSheetText(sheet: DetSheet): string {
  const lines = [
    `${sheet.title}${sheet.ec ? ` (EC ${sheet.ec})` : ''}`,
    joined(sheet.service, sheet.unit),
    ...sheet.details.map(([label, value]) => `${label}: ${value}`),
    `Bestand: ${sheet.total}${sheet.bestand ? ` (${sheet.bestand})` : ''}`,
  ].filter(Boolean);
  for (const section of sheet.sections) {
    lines.push('');
    if (section.title)
      lines.push(
        `${section.title} – ${section.people.length} Pers.${section.chef ? ` · Chef: ${personLabel(section.chef)}` : ''}`,
      );
    if (section.auftrag) lines.push(`Auftrag: ${section.auftrag}`);
    section.people.forEach((person, index) => {
      lines.push(
        `${index + 1}. ${joined(personLabel(person), ...sheet.columns.map((column) => column.value(person)))}`,
      );
    });
    if (!section.people.length) lines.push('(noch niemand eingeteilt)');
  }
  return lines.join('\n');
}

function sheetName(name: string, taken: Set<string>): string {
  const base =
    name
      .replace(/[[\]:*?/\\]/g, ' ')
      .trim()
      .slice(0, 28) || 'Liste';
  let candidate = base;
  for (let index = 2; taken.has(candidate.toLowerCase()); index++)
    candidate = `${base.slice(0, 26)} ${index}`;
  taken.add(candidate.toLowerCase());
  return candidate;
}

export function detSheetWorkbook(sheet: DetSheet): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new(),
    taken = new Set<string>();
  const grouped = sheet.sections.some((section) => section.title);
  const rows = (section: DetSheetSection, withGroup: boolean) =>
    section.people.map((person, index) => ({
      Nr: index + 1,
      ...(withGroup ? { Untergruppe: section.title } : {}),
      Rolle: section.chef?.id === person.id ? 'Chef' : '',
      Grad: person.grad,
      Name: listName(person),
      ...Object.fromEntries(sheet.columns.map((column) => [column.label, column.value(person)])),
      ...(sheet.checkColumn ? { Anwesend: '' } : {}),
    }));
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(sheet.sections.flatMap((section) => rows(section, grouped))),
    sheetName('Liste', taken),
  );
  if (sheet.sections.length > 1)
    for (const section of sheet.sections)
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(rows(section, false)),
        sheetName(section.title, taken),
      );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ['Detachement', sheet.title],
      ['EC', sheet.ec],
      ['Dienstleistung', sheet.service],
      ['Einheit', sheet.unit],
      ...sheet.details,
      ['Bestand', `${sheet.total}${sheet.bestand ? ` (${sheet.bestand})` : ''}`],
      ...sheet.licenses.map(([license, count]): [string, string] => [
        `Fahrausweis ${license}`,
        String(count),
      ]),
      [],
      ...sheet.sections
        .filter((section) => section.title)
        .map((section): string[] => [
          section.title,
          `${section.people.length} Pers.${section.bestand ? ` (${section.bestand})` : ''}`,
          section.chef ? `Chef: ${personLabel(section.chef)}` : '',
          section.auftrag,
        ]),
    ]),
    sheetName('Angaben', taken),
  );
  return workbook;
}

export function exportDetSheet(sheet: DetSheet): void {
  const bytes = XLSX.write(detSheetWorkbook(sheet), { bookType: 'xlsx', type: 'array' });
  download(
    `${sheet.fileStem}.xlsx`,
    bytes,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
}
