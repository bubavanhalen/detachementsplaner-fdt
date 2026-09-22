import { derivePisa, groupPeople } from '../model';
import type { Person, Project } from '../model/types';
import { searchText } from './text';
import { XLSX } from './workbook';

export function download(name: string, content: BlobPart, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
export function exportName(project: Project, extension: string): string {
  return `${
    project.name
      .replace(/[^\wÄÖÜäöü -]/g, '')
      .trim()
      .replace(/\s+/g, '_') || 'Planung'
  }_${new Date().toISOString().slice(0, 10)}.${extension}`;
}
export function exportJson(project: Project): void {
  download(exportName(project, 'json'), JSON.stringify(project, null, 2), 'application/json');
}
export function bundleHtml(template: string, project: Project): string {
  if (!template.includes('data-offline="true"'))
    throw new Error(
      'Die eigenständige HTML-Ausgabe ist im Produktionsbuild verfügbar. Im Entwicklungsmodus bitte JSON sichern.',
    );
  const parsed = new DOMParser().parseFromString(template, 'text/html');
  parsed.getElementById('boot-data')?.remove();
  const application = parsed.querySelector('script');
  if (!application) throw new Error('Offline-Vorlage unvollständig. Bitte JSON sichern.');
  const data = JSON.stringify(project).replace(/</g, '\\u003c');
  const embedded = parsed.createElement('script');
  embedded.id = 'boot-data';
  embedded.textContent = `window.__BOOTDATA=${data};`;
  application.before(embedded);
  return `<!DOCTYPE html>\n${parsed.documentElement.outerHTML}`;
}
export function contactNames(person: Person): { first: string; last: string } {
  const first = person.vorname?.trim() || '',
    last = person.nachname?.trim() || '';
  return (first || last) && searchText([first, last].join(' ')) === searchText(person.name)
    ? { first, last }
    : { first: person.name, last: '' };
}
export function hasContactData(person: Person): boolean {
  return !!(person.tel?.trim() || person.mail?.trim());
}
export function contactWarnings(person: Person): string[] {
  const issues: string[] = [];
  if (!hasContactData(person)) issues.push('Telefon und E-Mail fehlen');
  if (person.tel && !/^\+[\d\s().-]{6,}$/.test(person.tel)) issues.push('Telefonformat prüfen');
  if (person.mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(person.mail)) issues.push('E-Mail prüfen');
  return issues;
}
export interface ContactOptions {
  rank: boolean;
  groups: boolean;
  label: string;
}
export function contactRows(
  project: Project,
  people: Person[],
  options: ContactOptions,
): string[][] {
  return [
    [
      'Name Prefix',
      'First Name',
      'Last Name',
      'Email 1 - Label',
      'Email 1 - Value',
      'Phone 1 - Label',
      'Phone 1 - Value',
      'Labels',
    ],
    ...people.map((person) => {
      const names = contactNames(person);
      const groups = options.groups
        ? project.dets
            .filter((group) => groupPeople(project, group.id).some((p) => p.id === person.id))
            .map((group) => group.name)
        : [];
      return [
        options.rank ? person.grad : '',
        names.first,
        names.last,
        '',
        person.mail || '',
        person.tel ? 'Mobile' : '',
        person.tel || '',
        [...new Set([options.label, ...groups].filter(Boolean))].join(' ::: '),
      ];
    }),
  ];
}
export function contactCsv(project: Project, people: Person[], options: ContactOptions): string {
  if (!people.length) throw new Error('Bitte zuerst Kontakte auswählen.');
  if (people.length > 3000)
    throw new Error('Höchstens 3000 Kontakte pro Datei. Bitte die Auswahl einschränken.');
  return (
    '\uFEFF' +
    contactRows(project, people, options)
      .map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(','))
      .join('\r\n')
  );
}
export function createWorkbook(project: Project): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new(),
    entries = derivePisa(project);
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(
      project.persons.map((person) => ({
        Grad: person.grad,
        Name: person.name,
        'Versicherten-Nr.': person.pnr || '',
        Teilnahme: person.planning.status,
        Begründung: person.planning.reason,
        Funktion: person.funktion,
        Telefon: person.tel || '',
        'E-Mail': person.mail || '',
        ...Object.fromEntries(
          Object.entries(person.raw).map(([key, value]) => [`Quelle: ${key}`, value]),
        ),
      })),
    ),
    'Personal',
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(
      entries.map((entry) => ({
        EC: entry.ec,
        Detachement: entry.name,
        Einrückdatum: entry.details.datum,
        Einrückzeit: entry.details.von,
        Einrückort: entry.details.ort,
        Treffpunkt: entry.details.treffpunkt,
        Anzug: entry.details.anzug,
        Entlassungsdatum: entry.details.bisDatum,
        Entlassungsort: entry.details.entlassungsort,
        Bemerkung: entry.details.bem,
        'Zusatz-EC': entry.extraIds
          .map((id) => entries.find((item) => item.id === id)?.ec || 'EC offen')
          .join(', '),
        Aufgebotsart: project.orderPolicy.mode,
      })),
    ),
    'Einrückungsdetails',
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(
      entries.flatMap((entry) =>
        entry.personIds.map((id) => {
          const person = project.persons.find((item) => item.id === id);
          return {
            'Haupt-EC': entry.ec,
            Hauptdetachement: entry.name,
            'Zusatz-EC': entry.extraIds
              .map((extra) => entries.find((item) => item.id === extra)?.ec || '')
              .join(', '),
            Name: person?.name || '',
            'Versicherten-Nr.': person?.pnr || '',
          };
        }),
      ),
    ),
    'PISA-Zuteilungen',
  );
  return workbook;
}
export function exportWorkbook(project: Project): void {
  XLSX.writeFile(createWorkbook(project), exportName(project, 'xlsx'));
}
