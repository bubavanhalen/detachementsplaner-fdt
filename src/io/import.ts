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
export function guessMapping(headers: string[]): ImportMapping {
  const mapping: ImportMapping = {};
  for (const field of IMPORT_FIELDS) {
    const column = headers.findIndex(
      (text, i) => field.pattern.test(text) && !Object.values(mapping).includes(i),
    );
    if (column >= 0) mapping[field.key] = column;
  }
  return mapping;
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
/** Parses into the supplied draft; caller commits only after the whole import succeeds. */
export function importRows(
  project: Project,
  source: Source,
  rows: string[][],
  header: number,
  mapping: ImportMapping,
  filename: string,
  allowNames = false,
): { added: number; updated: number } {
  if (project.archive) throw new Error('Archivstand ist schreibgeschützt.');
  if (mapping.name === undefined) throw new Error('Bitte die Namensspalte zuordnen.');
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
  let added = 0,
    updated = 0;
  for (const row of rows.slice(header + 1)) {
    const get = (key: ImportKey) => {
      const i = mapping[key];
      return i === undefined ? '' : String(row[i] ?? '').trim();
    };
    const names = splitName(get('name'));
    if (!names.name) continue;
    const number = identifier(get('pnr'));
    const matches = number
      ? project.persons.filter((person) => identifier(person.pnr) === number)
      : [];
    let person: Person | undefined = matches.length === 1 ? matches[0] : undefined;
    if (!person && !matches.length && allowNames) {
      const candidates = project.persons.filter(
        (item) =>
          searchText(item.name) === searchText(names.name) &&
          (!number || !identifier(item.pnr) || number === identifier(item.pnr)),
      );
      if (candidates.length === 1) {
        person = candidates[0];
        person.identityReview = 'Nur über den Namen zugeordnet. Identität prüfen.';
      }
    }
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
    const master = source === 'pisa';
    for (const key of [
      'grad',
      'pnr',
      'funktion',
      'dt',
      'einteilung',
      'zug',
      'mail',
      'wohnort',
    ] as const) {
      const value = get(key);
      if (value && (master || !person[key])) person[key] = value;
    }
    const phone = get('tel');
    if (phone && (master || !person.tel)) person.tel = normalizePhone(phone);
    if (master || (!person.vorname && !person.nachname)) {
      person.name = names.name;
      person.vorname = names.first;
      person.nachname = names.last;
    }
    const licenses = get('lics')
      .split(/[;\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (licenses.length && (master || !person.lics.length)) person.lics = licenses;
    const raw: Record<string, string> = Object.fromEntries(
      headers.map((name, i) => [name, String(row[i] ?? '').trim()]).filter(([, value]) => value),
    );
    person.raw = { ...person.raw, ...raw };
    person.rawSources = { ...person.rawSources, [source]: raw };
    person[source] = true;
    person.key = searchText(person.name);
  }
  project.src[source] = { datei: filename, zeit: new Date().toISOString(), anz: added + updated };
  return { added, updated };
}
