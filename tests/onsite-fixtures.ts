// Wholly fictional people and detachements for the on-site tests.
import { connectGroups, createDetachment, createProject } from '../src/model';
import type { Person, Project } from '../src/model/types';

export function person(
  id: string,
  grad: string,
  vorname: string,
  nachname: string,
  extra: Partial<Person> = {},
): Person {
  return {
    id,
    grad,
    name: `${vorname} ${nachname}`,
    vorname,
    nachname,
    funktion: 'Testfunktion',
    lics: [],
    raw: {},
    planning: { status: 'included', reason: '' },
    ...extra,
  };
}
export function onsiteFixture(): Project {
  const project = createProject();
  project.name = 'Fiktiver WK';
  project.settings.eigeneEinheit = 'Fiktiv Kp 1';
  project.persons = [
    person('p-lt', 'Oblt', 'Anton', 'Fiktiv', { funktion: 'Zugführer' }),
    person('p-wm', 'Wm', 'Berta', 'Beispiel', {
      funktion: 'Mat Uof',
      lics: ['B', 'C'],
      tel: '+41 00 000 00 01',
    }),
    person('p-sdt1', 'Sdt', 'Carla', 'Muster', { funktion: 'Mat Sdt', lics: ['B'] }),
    person('p-sdt2', 'Gfr', 'Dario', 'Demo', { funktion: 'Motf', lics: ['C1'] }),
    person('p-four', 'Four', 'Emil', 'Test', { funktion: 'Four' }),
    person('p-main', 'Sdt', 'Fritz', 'Probe'),
  ];
  project.dets = [
    createDetachment({
      id: 'kvk',
      name: 'Fiktiv KVK',
      ec: 'K1',
      datum: '2027-04-26',
      von: '08:00',
      ort: 'Fiktivort',
      treffpunkt: 'Tor A',
      anzug: 'Tenue B',
      bisDatum: '2027-04-30',
      entlassungsort: 'Fiktivort',
    }),
    createDetachment({ id: 'wk', name: 'Fiktiv WK', ec: 'W1' }),
  ];
  project.assign = { kvk: ['p-lt', 'p-wm', 'p-sdt1', 'p-sdt2', 'p-four'], wk: ['p-main'] };
  connectGroups(project, 'kvk', 'wk');
  return project;
}

/** A second fictional KVK detachement with its own people and place. */
export function withSecondKvk(project: Project): Project {
  project.persons.push(
    person('p-ost1', 'Kpl', 'Gina', 'Ostwald', { funktion: 'Mat Uof', lics: ['C'] }),
    person('p-ost2', 'Sdt', 'Hugo', 'Ostwald', { funktion: 'Mat Sdt' }),
  );
  project.dets.push(
    createDetachment({
      id: 'kvk-ost',
      name: 'Fiktiv KVK Ost',
      ec: 'K2',
      datum: '2027-04-26',
      von: '09:00',
      ort: 'Fiktivdorf',
      treffpunkt: 'Tor A',
      anzug: 'Tenue B',
      bisDatum: '2027-04-30',
      entlassungsort: 'Fiktivdorf',
    }),
  );
  project.assign['kvk-ost'] = ['p-ost1', 'p-ost2'];
  return project;
}
