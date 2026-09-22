import { assignPeople, connectGroups, createDetachment, createProject } from '../model';
import type { Project } from '../model/types';

/** Wholly fictional; never derived from imported files. */
export function demoProject(): Project {
  const project = createProject();
  project.name = 'Beispiel · WK 2027';
  project.settings.eigeneEinheit = 'Demo Kp';
  project.service = {
    start: '2027-05-03',
    end: '2027-05-21',
    note: 'Ausschliesslich erfundene Beispieldaten.',
  };
  project.dets = [
    createDetachment({
      id: 'demo-special',
      name: 'DET 1 · KVK',
      ec: 'K1',
      datum: '2027-04-26',
      bisDatum: '2027-04-30',
      von: '08:00',
      ort: 'Beispielort',
      treffpunkt: 'Tor A',
      anzug: 'Uniform',
      entlassungsort: 'Beispielort',
    }),
    createDetachment({
      id: 'demo-main',
      name: 'MAIN DET · WK',
      ec: 'W1',
      datum: '2027-05-03',
      bisDatum: '2027-05-21',
      von: '08:00',
      ort: 'Beispielort',
      treffpunkt: 'Tor A',
      anzug: 'Uniform',
      entlassungsort: 'Beispielort',
    }),
  ];
  project.persons = [
    'Alex Muster',
    'Kim Beispiel',
    'Robin Demo',
    'Noa Test',
    'Sam Muster',
    'Lou Beispiel',
  ].map((name, index) => ({
    id: `demo-person-${index}`,
    name,
    grad: ['Wm', 'Wm', 'Sdt', 'Gfr', 'Sdt', 'Sdt'][index],
    pnr: `DEMO-00${index}`,
    funktion: [
      'Gruppenführer',
      'Motorfahrer',
      'Inf Sdt',
      'Fahrzeugmechaniker',
      'Motorfahrer',
      'Inf Sdt',
    ][index],
    lics: index === 1 || index === 4 ? ['30 Lastwagen'] : [],
    zug: index < 3 ? 'Zug 1' : 'Zug 2',
    mail: `person${index}@example.invalid`,
    raw: { Hinweis: 'Fiktive Testperson' },
    planning: { status: 'unreviewed', reason: '' },
  }));
  assignPeople(project, 'demo-special', ['demo-person-0', 'demo-person-1']);
  assignPeople(project, 'demo-main', ['demo-person-2', 'demo-person-3']);
  connectGroups(project, 'demo-special', 'demo-main');
  return project;
}
