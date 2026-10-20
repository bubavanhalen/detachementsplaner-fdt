import { isIsoDate, parseListDate, today } from '../model/dates';
import { FELDHOHEIT, leads, type PersonField } from '../model/feldhoheit';
import {
  createMilo,
  type MiloAbsence,
  type MiloCommand,
  type MiloListe,
  type MiloState,
} from '../model/milo';
import { matchPerson } from '../model/personMatch';
import { newId } from '../model/project';
import type { Person, Project, Source } from '../model/types';
import { identifier, searchText } from './text';

export const IMPORT_FIELDS = [
  { key: 'name', label: 'Name / Vorname', pattern: /name/i },
  { key: 'grad', label: 'Grad', pattern: /^grad|^gr\b|dienstgrad/i },
  {
    key: 'pnr',
    label: 'Versicherten-Nr.',
    pattern: /versicherten|ahv|pers.*nr|personalnr|sozial/i,
  },
  { key: 'funktion', label: 'Funktion', pattern: /funktion|fkt/i },
  {
    key: 'lics',
    label: 'Militärische Führerausweise',
    pattern: /führerschein|fuehrerschein|führerausweis|fahrzeug|kategorie|lenker|kat\b/i,
  },
  {
    key: 'einteilung',
    label: 'Einheit',
    pattern: /einteilung|einheit|truppenkörper|verband|kp\b/i,
  },
  { key: 'zug', label: 'Zug / Element', pattern: /^zug|zugs|gruppe|grp|stufe|niveau|element/i },
  { key: 'dt', label: 'Noch zu leistende Diensttage', pattern: /diensttage|nzl|\bdt\b|tage/i },
  { key: 'tel', label: 'Mobiltelefon', pattern: /tel|natel|mobile|handy/i },
  { key: 'mail', label: 'E-Mail', pattern: /mail/i },
  { key: 'wohnort', label: 'Wohnort', pattern: /wohnort|ort$/i },
  { key: 'geburtsdatum', label: 'Geburtsdatum', pattern: /geburt|geb\.?\s*dat/i },
  {
    key: 'miloStatus',
    label: 'Status (Bestandesliste)',
    pattern: /^status|bestand|präsenz|anwesenheit|eingerückt/i,
  },
] as const;
export type ImportKey = (typeof IMPORT_FIELDS)[number]['key'];
export type ImportMapping = Partial<Record<ImportKey, number>>;
export function findHeader(rows: string[][]): number {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    if (rows[i].filter(Boolean).length >= 2 && (rows[i + 1] || []).filter(Boolean).length >= 2)
      return i;
  }
  return 0;
}
function guess<K extends string>(
  fields: readonly { key: K; pattern: RegExp }[],
  headers: string[],
): Partial<Record<K, number>> {
  const mapping: Partial<Record<K, number>> = {};
  for (const field of fields) {
    const column = headers.findIndex(
      (text, i) => field.pattern.test(text) && !Object.values(mapping).includes(i),
    );
    if (column >= 0) mapping[field.key] = column;
  }
  return mapping;
}
export function guessMapping(headers: string[]): ImportMapping {
  return guess(IMPORT_FIELDS, headers);
}
export function splitName(raw: string): { first: string; last: string; name: string } {
  const clean = raw.replace(/\s+/g, ' ').trim();
  const comma = clean.indexOf(',');
  if (comma >= 0) {
    const last = clean.slice(0, comma).trim(),
      first = clean.slice(comma + 1).trim();
    return { first, last, name: [first, last].filter(Boolean).join(' ') };
  }
  // An unseparated name is retained intact, not guessed apart.
  return { first: clean, last: '', name: clean };
}
export function normalizePhone(value: string): string {
  const explicitCountry = /^\s*(?:\+|00)/.test(value);
  const digits = value.replace(/\D/g, '').replace(/^00/, '');
  if (explicitCountry && !digits.startsWith('41')) return value.trim();
  const national =
    digits.startsWith('41') && digits.length === 11
      ? digits.slice(2)
      : digits.startsWith('0') && digits.length === 10
        ? digits.slice(1)
        : digits;
  if (national.length !== 9 || !/^[1-9]/.test(national)) return value.trim();
  return `+41 ${national.slice(0, 2)} ${national.slice(2, 5)} ${national.slice(5, 7)} ${national.slice(7)}`;
}
export interface ImportOptions {
  /** ISO date the list was valid on (MILO: date of the export). Defaults to today. */
  stand?: string;
}
export interface Abweichung {
  personId: string;
  feld: PersonField;
  /** Value kept from the leading source. */
  wert: string;
  /** Differing value of this list, not taken over. */
  liste: string;
}
export interface ImportResult {
  added: number;
  updated: number;
  /** Values the other source leads; shown, never written. */
  abweichungen: Abweichung[];
  /** MILO only: people with the MILO mark that this list no longer contains. */
  nichtMehr: string[];
}
const TEXT_FIELDS = [
  'grad',
  'pnr',
  'funktion',
  'dt',
  'einteilung',
  'zug',
  'mail',
  'wohnort',
] as const;
function miloState(project: Project): MiloState {
  project.milo ??= createMilo();
  return project.milo;
}
function checkMapping(
  rows: string[][],
  header: number,
  mapping: Partial<Record<string, number>>,
): string[] {
  if (!Number.isInteger(header) || header < 0 || header >= rows.length)
    throw new Error('Bitte eine gültige Kopfzeile wählen.');
  const headers = rows[header].map((name, i) => name.trim() || `Spalte ${i + 1}`);
  if (
    Object.values(mapping).some(
      (index) =>
        index !== undefined && (!Number.isInteger(index) || index < 0 || index >= headers.length),
    )
  ) {
    throw new Error('Spaltenzuordnung ungültig. Bitte eine vorhandene Spalte auswählen.');
  }
  return headers;
}
/** Parses into the supplied draft; caller commits only after the whole import succeeds. */
export function importRows(
  project: Project,
  source: Source,
  rows: string[][],
  header: number,
  mapping: ImportMapping,
  filename: string,
  allowNames = false,
  options: ImportOptions = {},
): ImportResult {
  if (project.archive) throw new Error('Archivstand ist schreibgeschützt.');
  if (mapping.name === undefined) throw new Error('Bitte die Namensspalte zuordnen.');
  const headers = checkMapping(rows, header, mapping);
  const stand = isIsoDate(options.stand) ? options.stand : today();
  let added = 0,
    updated = 0;
  const abweichungen: Abweichung[] = [];
  const seen = new Set<string>();
  // The leading source overwrites; the other one only fills an empty field and reports a difference.
  const take = (person: Person, field: PersonField, value: string, current: string) => {
    if (!value) return false;
    if (leads(source, field) || !current) return true;
    const same = field === 'pnr' ? identifier(current) === identifier(value) : current === value;
    if (!same) abweichungen.push({ personId: person.id, feld: field, wert: current, liste: value });
    return false;
  };
  for (const row of rows.slice(header + 1)) {
    const get = (key: ImportKey) => {
      const i = mapping[key];
      return i === undefined ? '' : String(row[i] ?? '').trim();
    };
    const names = splitName(get('name'));
    if (!names.name) continue;
    const match = matchPerson(project.persons, { name: names.name, pnr: get('pnr') }, allowNames);
    let person = match.person;
    if (person && match.review) person.identityReview = match.review;
    if (!person) {
      person = {
        id: crypto.randomUUID(),
        name: names.name,
        grad: '',
        funktion: '',
        lics: [],
        raw: {},
        planning: { status: 'unreviewed', reason: '' },
      };
      project.persons.push(person);
      added++;
    } else updated++;
    seen.add(person.id);
    for (const key of TEXT_FIELDS) {
      const value = get(key);
      if (take(person, key, value, String(person[key] ?? ''))) {
        person[key] = value;
        if (key === 'dt') person.dtStand = stand;
      }
    }
    const phone = get('tel');
    if (phone) {
      const value = normalizePhone(phone);
      if (take(person, 'tel', value, person.tel ?? '')) person.tel = value;
    }
    const born = parseListDate(get('geburtsdatum'));
    if (take(person, 'geburtsdatum', born, person.geburtsdatum ?? '')) person.geburtsdatum = born;
    const status = get('miloStatus');
    if (source === 'milo' && take(person, 'miloStatus', status, person.miloStatus ?? ''))
      person.miloStatus = status;
    if (leads(source, 'name') || (!person.vorname && !person.nachname)) {
      person.name = names.name;
      person.vorname = names.first;
      person.nachname = names.last;
    }
    const licenses = get('lics')
      .split(/[;\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (take(person, 'lics', licenses.join('; '), person.lics.join('; '))) person.lics = licenses;
    const raw: Record<string, string> = Object.fromEntries(
      headers.map((name, i) => [name, String(row[i] ?? '').trim()]).filter(([, value]) => value),
    );
    person.raw = { ...person.raw, ...raw };
    person.rawSources = { ...person.rawSources, [source]: raw };
    person[source] = true;
    person.key = searchText(person.name);
  }
  const nichtMehr: string[] = [];
  if (source === 'milo') {
    // MILO is the roster: a person missing from it is marked, never deleted.
    for (const person of project.persons) {
      if (seen.has(person.id)) delete person.nichtInMilo;
      else if (person.milo) {
        person.nichtInMilo ??= stand;
        nichtMehr.push(person.id);
      }
    }
    miloState(project).stand = stand;
  }
  project.src[source] = { datei: filename, zeit: new Date().toISOString(), anz: added + updated };
  return { added, updated, abweichungen, nichtMehr };
}

// ---- MILO leave and command lists ------------------------------------------------------

export const LIST_FIELDS = [
  { key: 'name', label: 'Name / Vorname', pattern: /name/i },
  {
    key: 'pnr',
    label: 'Versicherten-Nr.',
    pattern: /versicherten|ahv|pers.*nr|personalnr|sozial/i,
  },
  { key: 'von', label: 'Von (oder Zeitraum)', pattern: /^von|beginn|^ab\b|start|zeitraum|datum/i },
  { key: 'bis', label: 'Bis', pattern: /^bis|ende|^end\b/i },
  {
    key: 'art',
    label: 'Art / Kommando',
    pattern: /art|typ|grund|kommand|bezeichnung|auftrag|text/i,
  },
] as const;
export type ListKey = (typeof LIST_FIELDS)[number]['key'];
export type ListMapping = Partial<Record<ListKey, number>>;
export const LIST_LABELS: Record<MiloListe, string> = {
  urlaub: 'Urlaubsliste',
  kommandierung: 'Kommandierungsliste',
};
export function guessListMapping(headers: string[]): ListMapping {
  return guess(LIST_FIELDS, headers);
}
/** «01.11.2026 – 05.11.2026» in one cell, or two cells. */
export function dateRange(von: string, bis: string): { von: string; bis: string } {
  if (!bis) {
    const parts = von.split(/\s*(?:–|—|\sbis\s|\s-\s)\s*/).filter(Boolean);
    if (parts.length === 2) {
      const first = parseListDate(parts[0]),
        second = parseListDate(parts[1]);
      if (first && second) return { von: first, bis: second };
    }
  }
  const start = parseListDate(von),
    end = parseListDate(bis) || start;
  return { von: start, bis: end };
}
export interface ListImportResult {
  count: number;
  /** Names of rows no person could be matched to; shown only in the local interface. */
  ohnePerson: string[];
  /** Rows without a readable date. */
  ohneDatum: number;
}
/**
 * Replaces the leave or command list with the MILO list: MILO is the source, so an
 * entry missing from a newer list is gone. People are never created from these lists.
 */
export function importMiloList(
  project: Project,
  kind: MiloListe,
  rows: string[][],
  header: number,
  mapping: ListMapping,
  filename: string,
  allowNames = false,
): ListImportResult {
  if (project.archive) throw new Error('Archivstand ist schreibgeschützt.');
  if (mapping.name === undefined && mapping.pnr === undefined)
    throw new Error('Bitte die Namens- oder Nummernspalte zuordnen.');
  if (mapping.von === undefined) throw new Error('Bitte die Datumsspalte «Von» zuordnen.');
  checkMapping(rows, header, mapping);
  const entries: (MiloAbsence | MiloCommand)[] = [];
  const ohnePerson: string[] = [];
  let ohneDatum = 0;
  for (const row of rows.slice(header + 1)) {
    const get = (key: ListKey) => {
      const i = mapping[key];
      return i === undefined ? '' : String(row[i] ?? '').trim();
    };
    const name = splitName(get('name')).name;
    if (!name && !get('pnr')) continue;
    const range = dateRange(get('von'), get('bis'));
    if (!range.von) {
      ohneDatum++;
      continue;
    }
    const { person } = matchPerson(project.persons, { name, pnr: get('pnr') }, allowNames);
    if (!person) {
      ohnePerson.push(name || get('pnr'));
      continue;
    }
    const base = { personId: person.id, von: range.von, bis: range.bis };
    entries.push(
      kind === 'urlaub'
        ? { id: newId('urlaub'), ...base, art: get('art') }
        : { id: newId('kdo'), ...base, text: get('art') },
    );
  }
  const state = miloState(project);
  if (kind === 'urlaub') state.absences = entries as MiloAbsence[];
  else state.commands = entries as MiloCommand[];
  state.listen[kind] = { datei: filename, zeit: new Date().toISOString(), anz: entries.length };
  return { count: entries.length, ohnePerson, ohneDatum };
}

// ---- Comparison before taking over a list ----------------------------------------------

export interface FieldChange {
  personId: string;
  feld: PersonField;
  alt: string;
  neu: string;
}
export interface ImportComparison {
  neu: string[];
  geaendert: FieldChange[];
  nichtMehr: string[];
  wiederInMilo: string[];
  eintraegeNeu: number;
  eintraegeEntfallen: number;
}
const COMPARED = Object.keys(FELDHOHEIT) as PersonField[];
function fieldText(person: Person, field: PersonField): string {
  const value = person[field];
  return Array.isArray(value) ? value.join('; ') : String(value ?? '');
}
function entryKeys(state: MiloState | undefined): Set<string> {
  return new Set(
    [...(state?.absences ?? []), ...(state?.commands ?? [])].map((entry) =>
      [entry.personId, entry.von, entry.bis, 'art' in entry ? entry.art : entry.text].join('|'),
    ),
  );
}
/** What a list would change: computed on a draft so the user confirms before anything is kept. */
export function compareImport(before: Project, after: Project): ImportComparison {
  const old = new Map(before.persons.map((person) => [person.id, person]));
  const result: ImportComparison = {
    neu: [],
    geaendert: [],
    nichtMehr: [],
    wiederInMilo: [],
    eintraegeNeu: 0,
    eintraegeEntfallen: 0,
  };
  for (const person of after.persons) {
    const previous = old.get(person.id);
    if (!previous) {
      result.neu.push(person.id);
      continue;
    }
    for (const feld of COMPARED) {
      const alt = fieldText(previous, feld),
        neu = fieldText(person, feld);
      if (alt !== neu) result.geaendert.push({ personId: person.id, feld, alt, neu });
    }
    if (person.nichtInMilo && !previous.nichtInMilo) result.nichtMehr.push(person.id);
    if (!person.nichtInMilo && previous.nichtInMilo) result.wiederInMilo.push(person.id);
  }
  const was = entryKeys(before.milo),
    now = entryKeys(after.milo);
  for (const key of now) if (!was.has(key)) result.eintraegeNeu++;
  for (const key of was) if (!now.has(key)) result.eintraegeEntfallen++;
  return result;
}
