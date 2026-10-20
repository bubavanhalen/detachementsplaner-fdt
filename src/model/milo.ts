import { addDays, daysBetween, isIsoDate, overlaps, within } from './dates';
import { groupPeople } from './planning';
import { licenseCategories } from './shortForms';
import type { Detachment, Person, Project } from './types';

// MILO is the leading source for service days, roster status, leave and commands.
// Everything here is derived locally from imported MILO lists; nothing is sent anywhere.
// Birth dates, status, leave and commands are host-only personal data (ADR-0002)
// and never part of a WAP plan.

export type MiloListe = 'urlaub' | 'kommandierung';
export interface MiloHerkunft {
  datei: string;
  zeit: string;
  anz: number;
}
export interface MiloAbsence {
  id: string;
  personId: string;
  /** Kind as listed in MILO, e.g. «Urlaub», «Persönlicher Urlaub». */
  art: string;
  von: string;
  bis: string;
}
export interface MiloCommand {
  id: string;
  personId: string;
  /** Command as listed in MILO, e.g. «Wache». */
  text: string;
  von: string;
  bis: string;
}
export interface MiloState {
  /** ISO date the last MILO personnel/roster list was valid on. '' before the first import. */
  stand: string;
  listen: Partial<Record<MiloListe, MiloHerkunft>>;
  absences: MiloAbsence[];
  commands: MiloCommand[];
  /** Roster status texts the user classified as «eingerückt» (true) or not (false). */
  statusEingerueckt: Record<string, boolean>;
}

export function createMilo(): MiloState {
  return { stand: '', listen: {}, absences: [], commands: [], statusEingerueckt: {} };
}

function loose(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
const str = (value: unknown): string => (typeof value === 'string' ? value : '');
const date = (value: unknown): string => (isIsoDate(value) ? value : '');
function herkunft(value: unknown): MiloHerkunft | undefined {
  const item = loose(value);
  if (!item) return undefined;
  return {
    datei: str(item.datei),
    zeit: str(item.zeit),
    anz: typeof item.anz === 'number' && Number.isFinite(item.anz) ? item.anz : 0,
  };
}
function ranged<T extends { id: string; personId: string; von: string; bis: string }>(
  input: unknown,
  build: (item: Record<string, unknown>) => T,
): T[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const result: T[] = [];
  for (const raw of input) {
    const item = loose(raw);
    if (!item || !str(item.id) || !str(item.personId) || seen.has(str(item.id))) continue;
    const entry = build(item);
    if (!entry.von && !entry.bis) continue;
    seen.add(entry.id);
    result.push(entry);
  }
  return result;
}

/** Tolerant: broken parts are dropped, the project is never rejected because of them. */
export function normalizeMilo(input: unknown): MiloState | undefined {
  const value = loose(input);
  if (!value) return undefined;
  const listen: MiloState['listen'] = {};
  const sources = loose(value.listen) ?? {};
  for (const key of ['urlaub', 'kommandierung'] as const) {
    const item = herkunft(sources[key]);
    if (item) listen[key] = item;
  }
  const status = loose(value.statusEingerueckt) ?? {};
  return {
    stand: date(value.stand),
    listen,
    absences: ranged(value.absences, (item) => ({
      id: str(item.id),
      personId: str(item.personId),
      art: str(item.art),
      von: date(item.von),
      bis: date(item.bis),
    })),
    commands: ranged(value.commands, (item) => ({
      id: str(item.id),
      personId: str(item.personId),
      text: str(item.text),
      von: date(item.von),
      bis: date(item.bis),
    })),
    statusEingerueckt: Object.fromEntries(
      Object.entries(status).filter(([, flag]) => typeof flag === 'boolean'),
    ) as Record<string, boolean>,
  };
}

// ---- Service days (NZL) ------------------------------------------------------------

export interface NzlInfo {
  /** NZL as listed in MILO on `stand`. */
  milo: number;
  stand: string;
  /** NZL today: the MILO value minus the service days since the list. */
  heute: number;
  /** Service days the app counted itself because no newer MILO list exists. */
  veraltetTage: number;
  /** Forecast of the last day of duty within this service; '' when beyond the service. */
  letzterDiensttag: string;
  /** First day without duty (Dienstvollender); '' when the person serves to the end. */
  dienstvollendAb: string;
}

/**
 * Reads the NZL. Assumption (to be confirmed with the owner): the MILO value is valid at
 * the start of the list's day, and every calendar day of the service counts as a service day.
 */
export function nzlInfo(project: Project, person: Person, heute: string): NzlInfo | null {
  const raw = String(person.dt ?? '').trim();
  if (!/^-?\d+$/.test(raw)) return null;
  const milo = Number(raw);
  const stand = date(person.dtStand) || project.milo?.stand || '';
  if (!stand) return null;
  const { start, end } = project.service;
  const from = isIsoDate(start) && start > stand ? start : stand;
  const last = milo > 0 ? addDays(from, milo - 1) : addDays(from, -1);
  const beyond = isIsoDate(end) && last >= end;
  const counted = isIsoDate(end) && heute > end ? addDays(end, 1) : heute;
  const served = Math.max(0, daysBetween(from, counted));
  return {
    milo,
    stand,
    heute: Math.max(0, milo - served),
    veraltetTage: served,
    letzterDiensttag: beyond ? '' : last,
    dienstvollendAb: beyond ? '' : addDays(last, 1),
  };
}

/** People whose NZL ends within the service, earliest first. */
export function dienstvollender(
  project: Project,
  heute: string,
): { person: Person; info: NzlInfo }[] {
  return project.persons
    .flatMap((person) => {
      const info = nzlInfo(project, person, heute);
      return info?.dienstvollendAb ? [{ person, info }] : [];
    })
    .sort((a, b) => a.info.dienstvollendAb.localeCompare(b.info.dienstvollendAb));
}

// ---- Roster status -----------------------------------------------------------------

const NOT_PRESENT = /nicht|abwesend|dispens|verschoben|fehlt|entlassen|ausgetreten/i;
const PRESENT = /eingerückt|eingerueckt|anwesend|präsent|praesent|im dienst/i;

export function statusKey(value: string): string {
  return value.trim().toLocaleLowerCase('de-CH');
}
/** A suggestion only; the user confirms or corrects each status text in the import. */
export function guessEingerueckt(value: string): boolean | undefined {
  if (!value.trim()) return undefined;
  if (NOT_PRESENT.test(value)) return false;
  if (PRESENT.test(value)) return true;
  return undefined;
}
/** true/false from the classified roster status; undefined without a roster status. */
export function eingerueckt(project: Project, person: Person): boolean | undefined {
  const status = person.miloStatus?.trim();
  if (!status) return undefined;
  const key = statusKey(status);
  const known = project.milo?.statusEingerueckt;
  return known && Object.hasOwn(known, key) ? known[key] : guessEingerueckt(status);
}

// ---- Availability ------------------------------------------------------------------

export type VerfuegbarkeitStatus =
  | 'verfuegbar'
  | 'dienstvollend'
  | 'nicht-eingerueckt'
  | 'urlaub'
  | 'kommandiert';
export interface Verfuegbarkeit {
  status: VerfuegbarkeitStatus;
  /** German reason for the local interface only. */
  grund: string;
  /** Roster status unknown: no MILO roster status for this person. */
  statusUnbekannt: boolean;
}

/** The one availability rule for selection, warnings, driver lists and officer rotation. */
export function verfuegbarkeit(
  project: Project,
  person: Person,
  day: string,
  heute = day,
): Verfuegbarkeit {
  const present = eingerueckt(project, person);
  const statusUnbekannt = present === undefined;
  const info = nzlInfo(project, person, heute);
  if (info?.dienstvollendAb && day >= info.dienstvollendAb)
    return {
      status: 'dienstvollend',
      grund: `Dienstvollend ab ${show(info.dienstvollendAb)}`,
      statusUnbekannt,
    };
  if (present === false)
    return { status: 'nicht-eingerueckt', grund: `MILO: ${person.miloStatus}`, statusUnbekannt };
  const absence = project.milo?.absences.find(
    (item) => item.personId === person.id && within(day, item.von, item.bis),
  );
  if (absence)
    return {
      status: 'urlaub',
      grund: `${absence.art || 'Urlaub'} ${range(absence.von, absence.bis)}`,
      statusUnbekannt,
    };
  const command = project.milo?.commands.find(
    (item) => item.personId === person.id && within(day, item.von, item.bis),
  );
  if (command)
    return {
      status: 'kommandiert',
      grund: `${command.text || 'Kommandiert'} ${range(command.von, command.bis)}`,
      statusUnbekannt,
    };
  return { status: 'verfuegbar', grund: '', statusUnbekannt };
}
function show(value: string): string {
  const [year, month, day] = value.split('-');
  return day ? `${day}.${month}.${year}` : value;
}
function range(von: string, bis: string): string {
  return von === bis || !bis ? show(von) : `${show(von)}–${show(bis)}`;
}

/** Calendar days of a detachement: from its date to its end date (or the same day). */
export function detDays(det: Detachment): string[] {
  if (!isIsoDate(det.datum)) return [];
  const end = isIsoDate(det.bisDatum) && det.bisDatum >= det.datum ? det.bisDatum : det.datum;
  const days: string[] = [];
  for (let day = det.datum; day <= end && days.length < 400; day = addDays(day, 1)) days.push(day);
  return days;
}

export interface Zuteilungskonflikt {
  person: Person;
  det: Detachment;
  /** First day the person is unavailable. */
  tag: string;
  verfuegbarkeit: Verfuegbarkeit;
}
/** Assigned people who are unavailable on at least one day of their detachement. */
export function zuteilungskonflikte(project: Project, heute: string): Zuteilungskonflikt[] {
  const result: Zuteilungskonflikt[] = [];
  for (const det of project.dets) {
    const days = detDays(det);
    if (!days.length) continue;
    for (const person of groupPeople(project, det.id)) {
      for (const day of days) {
        const state = verfuegbarkeit(project, person, day, heute);
        if (state.status !== 'verfuegbar') {
          result.push({ person, det, tag: day, verfuegbarkeit: state });
          break;
        }
      }
    }
  }
  return result;
}

// ---- Standard lists ----------------------------------------------------------------

export interface Geburtstag {
  person: Person;
  datum: string;
  alter: number;
}
/** Birthdays between `von` and `bis` (inclusive), with the age reached. 29 Feb → 28 Feb. */
export function geburtstage(project: Project, von: string, bis: string): Geburtstag[] {
  if (!isIsoDate(von) || !isIsoDate(bis) || bis < von) return [];
  const result: Geburtstag[] = [];
  for (const person of project.persons) {
    const born = date(person.geburtsdatum);
    if (!born) continue;
    const [, month, day] = born.split('-');
    for (let year = Number(von.slice(0, 4)); year <= Number(bis.slice(0, 4)); year++) {
      let datum = `${year}-${month}-${day}`;
      if (!isIsoDate(datum)) datum = `${year}-02-28`;
      if (datum >= von && datum <= bis && datum > born)
        result.push({ person, datum, alter: year - Number(born.slice(0, 4)) });
    }
  }
  return result.sort((a, b) => a.datum.localeCompare(b.datum));
}

export interface Fahrer {
  person: Person;
  kategorien: string[];
  verfuegbarkeit: Verfuegbarkeit;
}
/**
 * People with a military driving licence on `day`: available ones first; the others
 * keep their reason so the list can show why they are missing.
 */
export function fahrerliste(
  project: Project,
  day: string,
  heute = day,
): { verfuegbar: Fahrer[]; nichtVerfuegbar: Fahrer[] } {
  const verfuegbar: Fahrer[] = [],
    nichtVerfuegbar: Fahrer[] = [];
  for (const person of project.persons) {
    if (!person.lics.length || person.planning.status === 'excluded') continue;
    const driver = {
      person,
      kategorien: licenseCategories(project, person),
      verfuegbarkeit: verfuegbarkeit(project, person, day, heute),
    };
    (driver.verfuegbarkeit.status === 'verfuegbar' ? verfuegbar : nichtVerfuegbar).push(driver);
  }
  return { verfuegbar, nichtVerfuegbar };
}

// ---- Guard commands to enter in MILO -------------------------------------------------

export type NachfuehrungStatus = 'offen' | 'in-milo' | 'nur-in-milo';
export interface Nachfuehrung {
  /** Stable key for a later Pendenz (kanal 'milo'); identical for the same det and person. */
  ref: string;
  person: Person;
  det?: Detachment;
  von: string;
  bis: string;
  status: NachfuehrungStatus;
}

/**
 * Each person of a guard detachement marked «in MILO kommandieren» needs a MILO command
 * covering its dates. Derived on every view, so a changed plan or a new MILO list is
 * reflected at once and no second list can fall out of step.
 */
export function wacheNachfuehrung(project: Project): Nachfuehrung[] {
  const commands = project.milo?.commands ?? [];
  const result: Nachfuehrung[] = [];
  const covered = new Set<string>();
  for (const det of project.dets) {
    if (!det.miloKommandierung) continue;
    const von = det.datum,
      bis = isIsoDate(det.bisDatum) ? det.bisDatum : det.datum;
    for (const person of groupPeople(project, det.id)) {
      const match = commands.find(
        (command) =>
          command.personId === person.id && (!von || overlaps(command.von, command.bis, von, bis)),
      );
      if (match) covered.add(match.id);
      result.push({
        ref: `wache:${det.id}:${person.id}`,
        person,
        det,
        von,
        bis,
        status: match ? 'in-milo' : 'offen',
      });
    }
  }
  const persons = new Map(project.persons.map((person) => [person.id, person]));
  for (const command of commands) {
    const person = persons.get(command.personId);
    if (!person || covered.has(command.id) || !/wach/i.test(command.text)) continue;
    result.push({
      ref: `milo:${command.id}`,
      person,
      von: command.von,
      bis: command.bis,
      status: 'nur-in-milo',
    });
  }
  return result;
}
