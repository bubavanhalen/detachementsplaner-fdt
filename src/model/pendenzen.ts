import type { Project } from './types';

export type PendenzStatus = 'offen' | 'wartet' | 'erledigt' | 'verworfen';
export type PendenzPrio = 'hoch' | 'normal' | 'tief';
export type PendenzPhase = 'vordienstlich' | 'dienst' | 'nachdienstlich';
export type PendenzKanal =
  | 'mail'
  | 'whatsapp'
  | 'sms'
  | 'anruf'
  | 'planner'
  | 'teams'
  | 'persoenlich'
  | 'milo'
  | 'andere';
export type PendenzAutor = 'ich' | 'agent';

/** Where a Pendenz came from. `ref` is the channel's own id (message id, Planner task id …). */
export interface PendenzQuelle {
  kanal: PendenzKanal;
  ref: string;
  von: string;
  /** ISO timestamp or ''. */
  am: string;
  betreff: string;
}
/** One line of the «Stand der Sache». */
export interface PendenzEintrag {
  id: string;
  /** ISO timestamp. */
  am: string;
  autor: PendenzAutor;
  /** Name of the agent that wrote the entry. */
  agent?: string;
  text: string;
}
export interface Pendenz {
  [key: string]: unknown;
  id: string;
  titel: string;
  beschreibung: string;
  status: PendenzStatus;
  prio: PendenzPrio;
  /** Deliberate override; '' derives the phase from the due date and the service period. */
  phase: PendenzPhase | '';
  /** ISO date or ''. */
  faellig: string;
  /** Who has to act next (free text, e.g. «ich», «Fw», «KF»). */
  zustaendig: string;
  personIds: string[];
  detIds: string[];
  tags: string[];
  quellen: PendenzQuelle[];
  verlauf: PendenzEintrag[];
  erstellt: string;
  geaendert: string;
  erstelltVon: PendenzAutor;
  /** Changed by an agent and not yet seen by the user. */
  neu: boolean;
  /** Agent changes not applied because the Pendenz changed since the agent read it. */
  vorschlag?: PendenzVorschlag;
}
export interface PendenzVorschlag {
  felder: PendenzFields;
  agent: string;
  am: string;
}
/** Agent files already applied, so a file that could not be moved is never applied twice. */
export interface PendenzImport {
  datei: string;
  hash: string;
  am: string;
  anzahl: number;
}

export const PENDENZ_STATUS: Record<PendenzStatus, string> = {
  offen: 'Offen',
  wartet: 'Wartet',
  erledigt: 'Erledigt',
  verworfen: 'Verworfen',
};
export const PENDENZ_PRIO: Record<PendenzPrio, string> = {
  hoch: 'Hoch',
  normal: 'Normal',
  tief: 'Tief',
};
export const PENDENZ_PHASE: Record<PendenzPhase, string> = {
  vordienstlich: 'Vordienstlich',
  dienst: 'Im Dienst',
  nachdienstlich: 'Nachdienstlich',
};
export const PENDENZ_KANAL: Record<PendenzKanal, string> = {
  mail: 'Mail',
  whatsapp: 'WhatsApp',
  sms: 'SMS',
  anruf: 'Anruf',
  planner: 'Teams Planner',
  teams: 'Teams',
  persoenlich: 'Persönlich',
  milo: 'MILO',
  andere: 'Andere',
};
const IMPORT_LIMIT = 300;

const newEntryId = (prefix: string): string => `${prefix}_${crypto.randomUUID()}`;
const oneOf = <T extends string>(labels: Record<T, string>, value: unknown, fallback: T): T =>
  typeof value === 'string' && Object.hasOwn(labels, value) ? (value as T) : fallback;
function str(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}
function list(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === 'string' && !!item))]
    : [];
}
function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
const isoDate = (value: unknown): string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';

export function createPendenz(patch: Partial<Pendenz> = {}, now = new Date().toISOString()) {
  const pendenz: Pendenz = {
    id: newEntryId('pendenz'),
    titel: '',
    beschreibung: '',
    status: 'offen',
    prio: 'normal',
    phase: '',
    faellig: '',
    zustaendig: '',
    personIds: [],
    detIds: [],
    tags: [],
    quellen: [],
    verlauf: [],
    erstellt: now,
    geaendert: now,
    erstelltVon: 'ich',
    neu: false,
    ...patch,
  };
  return pendenz;
}
function quelle(input: unknown): PendenzQuelle {
  const q = obj(input);
  return {
    kanal: oneOf(PENDENZ_KANAL, q.kanal, 'andere'),
    ref: str(q.ref),
    von: str(q.von),
    am: str(q.am),
    betreff: str(q.betreff),
  };
}
function eintrag(input: unknown): PendenzEintrag {
  const e = obj(input);
  return {
    id: str(e.id) || newEntryId('eintrag'),
    am: str(e.am),
    autor: e.autor === 'agent' ? 'agent' : 'ich',
    ...(e.agent == null ? {} : { agent: str(e.agent) }),
    text: str(e.text),
  };
}
/** Normalizes stored Pendenzen without dropping unknown fields. */
export function normalizePendenzen(value: unknown): Pendenz[] {
  if (!Array.isArray(value))
    throw new Error(
      'Die Datei enthält kein gültiges Projekt. Der bisherige Stand bleibt erhalten.',
    );
  const seen = new Set<string>();
  return value.map((item) => {
    const p = obj(item);
    const id = str(p.id);
    if (!id || seen.has(id) || ['__proto__', 'constructor', 'prototype'].includes(id))
      throw new Error('Pendenzen haben fehlende oder doppelte IDs.');
    seen.add(id);
    return {
      ...p,
      ...createPendenz({}, str(p.erstellt)),
      id,
      titel: str(p.titel),
      beschreibung: str(p.beschreibung),
      status: oneOf(PENDENZ_STATUS, p.status, 'offen'),
      prio: oneOf(PENDENZ_PRIO, p.prio, 'normal'),
      phase: phaseValue(p.phase),
      faellig: isoDate(p.faellig),
      zustaendig: str(p.zustaendig),
      personIds: list(p.personIds),
      detIds: list(p.detIds),
      tags: list(p.tags),
      quellen: Array.isArray(p.quellen) ? p.quellen.map(quelle) : [],
      verlauf: Array.isArray(p.verlauf) ? p.verlauf.map(eintrag) : [],
      erstellt: str(p.erstellt),
      geaendert: str(p.geaendert) || str(p.erstellt),
      erstelltVon: p.erstelltVon === 'agent' ? 'agent' : 'ich',
      neu: p.neu === true,
      ...(p.vorschlag == null ? {} : { vorschlag: vorschlagValue(p.vorschlag) }),
    };
  });
}
function phaseValue(value: unknown): PendenzPhase | '' {
  return typeof value === 'string' && Object.hasOwn(PENDENZ_PHASE, value)
    ? (value as PendenzPhase)
    : '';
}
function vorschlagValue(value: unknown): PendenzVorschlag {
  const v = obj(value);
  const felder = obj(v.felder);
  return {
    felder: Object.fromEntries(
      PENDENZ_FIELDS.filter((key) => Object.hasOwn(felder, key)).map((key) => [key, felder[key]]),
    ) as PendenzFields,
    agent: str(v.agent),
    am: str(v.am),
  };
}
export function normalizePendenzImporte(value: unknown): PendenzImport[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const i = obj(item);
    return {
      datei: str(i.datei),
      hash: str(i.hash),
      am: str(i.am),
      anzahl: typeof i.anzahl === 'number' ? i.anzahl : 0,
    };
  });
}

export function pendenzenOf(project: Project): Pendenz[] {
  return project.pendenzen ?? [];
}
export const isActive = (pendenz: Pendenz): boolean =>
  pendenz.status === 'offen' || pendenz.status === 'wartet';
export function localDay(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
function addDays(day: string, days: number): string {
  const [year, month, date] = day.split('-').map(Number);
  return localDay(new Date(year, month - 1, date + days));
}

export type PendenzGroup = 'neu' | 'ueberfaellig' | 'heute' | 'woche' | 'spaeter' | 'ohne' | 'zu';
export const PENDENZ_GROUPS: Record<PendenzGroup, string> = {
  neu: 'Neu vom Agent',
  ueberfaellig: 'Überfällig',
  heute: 'Heute',
  woche: 'Nächste 7 Tage',
  spaeter: 'Später',
  ohne: 'Ohne Termin',
  zu: 'Abgeschlossen',
};
export function pendenzGroup(pendenz: Pendenz, today = localDay()): PendenzGroup {
  if (pendenz.neu) return 'neu';
  if (!isActive(pendenz)) return 'zu';
  if (!pendenz.faellig) return 'ohne';
  if (pendenz.faellig < today) return 'ueberfaellig';
  if (pendenz.faellig === today) return 'heute';
  return pendenz.faellig <= addDays(today, 7) ? 'woche' : 'spaeter';
}
const PRIO_ORDER: Record<PendenzPrio, number> = { hoch: 0, normal: 1, tief: 2 };
/** Groups in display order; inside a group by due date, priority, then last change. */
export function groupPendenzen(
  pendenzen: Pendenz[],
  today = localDay(),
): { group: PendenzGroup; items: Pendenz[] }[] {
  const order = Object.keys(PENDENZ_GROUPS) as PendenzGroup[];
  return order
    .map((group) => ({
      group,
      items: pendenzen
        .filter((pendenz) => pendenzGroup(pendenz, today) === group)
        .sort(
          (a, b) =>
            (group === 'zu' ? b.geaendert.localeCompare(a.geaendert) : 0) ||
            (a.faellig || '9999').localeCompare(b.faellig || '9999') ||
            PRIO_ORDER[a.prio] - PRIO_ORDER[b.prio] ||
            b.geaendert.localeCompare(a.geaendert),
        ),
    }))
    .filter((entry) => entry.items.length);
}
export function pendenzSummary(project: Project, today = localDay()) {
  const all = pendenzenOf(project);
  const active = all.filter(isActive);
  return {
    total: all.length,
    active: active.length,
    overdue: active.filter((pendenz) => pendenz.faellig && pendenz.faellig < today).length,
    neu: all.filter((pendenz) => pendenz.neu).length,
  };
}

/**
 * Phase of a Pendenz. An explicit override wins; otherwise it follows from the due date (or
 * today) relative to the service period, so moving the service never leaves stale phases.
 */
export function effectivePhase(
  project: Project,
  pendenz: Pendenz,
  today = localDay(),
): PendenzPhase | '' {
  if (pendenz.phase) return pendenz.phase;
  const day = pendenz.faellig || today;
  const { start, end } = project.service;
  if (start && day < start) return 'vordienstlich';
  if (end && day > end) return 'nachdienstlich';
  if (start || end) return 'dienst';
  return '';
}

/** Fields the user or an agent may change. */
export const PENDENZ_FIELDS = [
  'titel',
  'beschreibung',
  'status',
  'prio',
  'phase',
  'faellig',
  'zustaendig',
  'personIds',
  'detIds',
  'tags',
] as const;
export type PendenzFields = Partial<Pick<Pendenz, (typeof PENDENZ_FIELDS)[number]>>;

function describeChange(before: Pendenz, after: Pendenz): string[] {
  const lines: string[] = [];
  if (before.status !== after.status)
    lines.push(`Status: ${PENDENZ_STATUS[before.status]} → ${PENDENZ_STATUS[after.status]}`);
  if (before.faellig !== after.faellig)
    lines.push(`Fällig: ${after.faellig ? displayDay(after.faellig) : 'kein Termin'}`);
  if (before.prio !== after.prio) lines.push(`Priorität: ${PENDENZ_PRIO[after.prio]}`);
  if (before.zustaendig !== after.zustaendig)
    lines.push(`Zuständig: ${after.zustaendig || 'niemand'}`);
  return lines;
}
export function displayDay(value: string): string {
  const [year, month, day] = value.split('-');
  return day ? `${day}.${month}.${year}` : value;
}

function find(project: Project, id: string): Pendenz {
  const pendenz = pendenzenOf(project).find((item) => item.id === id);
  if (!pendenz) throw new Error('Die Pendenz ist nicht mehr vorhanden.');
  return pendenz;
}
function log(
  pendenz: Pendenz,
  text: string,
  by: { autor: PendenzAutor; agent?: string },
  now: string,
) {
  if (!text.trim()) return;
  pendenz.verlauf.push({
    id: newEntryId('eintrag'),
    am: now,
    autor: by.autor,
    ...(by.agent ? { agent: by.agent } : {}),
    text: text.trim(),
  });
}

export function addPendenz(
  project: Project,
  patch: PendenzFields & { quelle?: PendenzQuelle; notiz?: string },
  now = new Date().toISOString(),
): Pendenz {
  const { quelle: source, notiz, ...fields } = patch;
  const pendenz = createPendenz(
    { ...cleanFields(project, fields), quellen: source ? [source] : [] },
    now,
  );
  if (!pendenz.titel.trim()) throw new Error('Bitte einen Titel für die Pendenz erfassen.');
  log(pendenz, notiz ?? '', { autor: 'ich' }, now);
  project.pendenzen = [...pendenzenOf(project), pendenz];
  return pendenz;
}
/** Applies field changes; status, date, priority and owner changes are logged automatically. */
export function updatePendenz(
  project: Project,
  id: string,
  fields: PendenzFields,
  options: { notiz?: string; by?: { autor: PendenzAutor; agent?: string }; now?: string } = {},
): boolean {
  const pendenz = find(project, id);
  const now = options.now ?? new Date().toISOString();
  const by = options.by ?? { autor: 'ich' };
  const before = structuredClone(pendenz);
  Object.assign(pendenz, cleanFields(project, fields));
  if (!pendenz.titel.trim()) throw new Error('Bitte einen Titel für die Pendenz erfassen.');
  const lines = describeChange(before, pendenz);
  if (options.notiz?.trim()) lines.push(options.notiz.trim());
  if (lines.length) log(pendenz, lines.join('\n'), by, now);
  const changed = JSON.stringify(before) !== JSON.stringify(pendenz);
  if (changed) pendenz.geaendert = now;
  // The user's own edit counts as having seen the agent's change.
  pendenz.neu = by.autor === 'agent' ? changed || before.neu : false;
  return changed;
}
export function addPendenzNote(project: Project, id: string, text: string, now?: string): void {
  if (!text.trim()) throw new Error('Bitte einen Text für den Stand erfassen.');
  updatePendenz(project, id, {}, { notiz: text, now });
}
export function addPendenzSource(
  project: Project,
  id: string,
  source: PendenzQuelle,
  now = new Date().toISOString(),
): void {
  const pendenz = find(project, id);
  pendenz.quellen.push(source);
  pendenz.geaendert = now;
  pendenz.neu = false;
}
export function removePendenz(project: Project, id: string): void {
  find(project, id);
  project.pendenzen = pendenzenOf(project).filter((item) => item.id !== id);
}
export function markPendenzenSeen(project: Project, ids?: string[]): void {
  for (const pendenz of pendenzenOf(project))
    if (!ids || ids.includes(pendenz.id)) pendenz.neu = false;
}

/** Keeps only valid values; unknown persons or detachements are dropped. */
function cleanFields(project: Project, fields: Record<string, unknown>): PendenzFields {
  const persons = new Set(project.persons.map((person) => person.id));
  const dets = new Set(project.dets.map((det) => det.id));
  const out: PendenzFields = {};
  for (const key of PENDENZ_FIELDS) {
    if (!Object.hasOwn(fields, key) || fields[key] === undefined) continue;
    const value = fields[key];
    if (key === 'status') out.status = oneOf(PENDENZ_STATUS, value, 'offen');
    else if (key === 'prio') out.prio = oneOf(PENDENZ_PRIO, value, 'normal');
    else if (key === 'phase') out.phase = phaseValue(value);
    else if (key === 'faellig') out.faellig = isoDate(value);
    else if (key === 'personIds') out.personIds = list(value).filter((id) => persons.has(id));
    else if (key === 'detIds') out.detIds = list(value).filter((id) => dets.has(id));
    else if (key === 'tags') out.tags = list(value);
    else out[key] = str(value);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Agent exchange. The agent reads the full local state («Stand») and writes change files
// («Eingang») into the exchange folder; see docs/pendenzen-agent.md.

export const STAND_FORMAT = 'wk-suite/stand';
export const EINGANG_FORMAT = 'wk-suite/pendenzen-eingang';

export interface IntakeChange {
  aktion: 'neu' | 'aendern';
  id?: string;
  quelle?: PendenzQuelle;
  felder: PendenzFields;
  notiz: string;
  /** `geaendert` of the Pendenz as the agent saw it in the Stand. */
  basis?: string;
  /** Field values the agent saw; lets unrelated fields apply despite a newer change. */
  vorher?: PendenzFields;
}
export interface Intake {
  projektId: string;
  agent: string;
  aenderungen: IntakeChange[];
}
export interface IntakeResult {
  neu: number;
  geaendert: number;
  /** Known sources re-sent without any change. */
  unveraendert: number;
  /** Pendenzen with agent field changes kept as a proposal to check. */
  konflikte: number;
  uebersprungen: string[];
}

/** Reference file for the agent: the complete project plus orientation (owner decision). */
export function standDocument(project: Project, now = new Date().toISOString()) {
  const summary = pendenzSummary(project);
  return {
    format: STAND_FORMAT,
    version: 1,
    geschrieben: now,
    hinweis:
      'Lesereferenz der WK Suite. Nicht bearbeiten; Änderungen als Datei in eingang/ ablegen (siehe AGENT.md).',
    projektId: project.id,
    projektName: project.name,
    archiviert: Boolean(project.archive),
    pendenzenAktiv: summary.active,
    projekt: project,
  };
}

// Intake files come from an agent that reads untrusted mail and chats. They may only touch
// Pendenzen fields; anything unexpected rejects the whole file.
export const INTAKE_MAX_CHARS = 1_000_000;
const MAX_CHANGES = 200;
const MAX_TITLE = 300;
const MAX_TEXT = 8000;
const TOP_KEYS = ['format', 'version', 'projektId', 'agent', 'erstellt', 'aenderungen'];
const CHANGE_KEYS = ['aktion', 'id', 'quelle', 'pendenz', 'felder', 'notiz', 'basis', 'vorher'];
const SOURCE_KEYS = ['kanal', 'ref', 'von', 'am', 'betreff'];
const invalidIntake = (detail: string): never => {
  throw new Error(`Eingangsdatei ungültig: ${detail}`);
};
function strictRecord(value: unknown, keys: readonly string[], where: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return invalidIntake(`${where} muss ein Objekt sein.`);
  const extra = Object.keys(value).filter((key) => !keys.includes(key));
  if (extra.length) invalidIntake(`${where}: unzulässige Felder ${extra.join(', ')}.`);
  return value as Record<string, unknown>;
}
function strictText(value: unknown, where: string, max = MAX_TEXT): string {
  if (value == null) return '';
  if (typeof value !== 'string') return invalidIntake(`${where} muss Text sein.`);
  if (value.length > max) invalidIntake(`${where} ist zu lang.`);
  return value;
}
const ENUMS = { status: PENDENZ_STATUS, prio: PENDENZ_PRIO, phase: PENDENZ_PHASE } as const;
function strictFields(value: unknown, where: string): PendenzFields {
  if (value == null) return {};
  const input = strictRecord(value, PENDENZ_FIELDS, where);
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(input)) {
    const label = `${where}.${key}`;
    if (key === 'personIds' || key === 'detIds' || key === 'tags') {
      if (!Array.isArray(item) || item.some((entry) => typeof entry !== 'string'))
        invalidIntake(`${label} muss eine Liste von Texten sein.`);
      out[key] = item;
    } else if (key === 'status' || key === 'prio' || key === 'phase') {
      const known =
        typeof item === 'string' && (Object.hasOwn(ENUMS[key], item) || (key === 'phase' && !item));
      if (!known) invalidIntake(`${label}: unbekannter Wert.`);
      out[key] = item;
    } else if (key === 'faellig') {
      if (item !== '' && !isoDate(item)) invalidIntake(`${label} muss JJJJ-MM-TT sein.`);
      out[key] = item;
    } else out[key] = strictText(item, label, key === 'titel' ? MAX_TITLE : MAX_TEXT);
  }
  return out as PendenzFields;
}
function strictSource(value: unknown, where: string): PendenzQuelle {
  const input = strictRecord(value, SOURCE_KEYS, where);
  if (!(typeof input.kanal === 'string' && Object.hasOwn(PENDENZ_KANAL, input.kanal)))
    invalidIntake(`${where}.kanal: unbekannter Kanal.`);
  return {
    kanal: input.kanal as PendenzKanal,
    ref: strictText(input.ref, `${where}.ref`, MAX_TITLE),
    von: strictText(input.von, `${where}.von`, MAX_TITLE),
    am: strictText(input.am, `${where}.am`, 40),
    betreff: strictText(input.betreff, `${where}.betreff`),
  };
}
export function parseIntake(input: unknown): Intake {
  const value = strictRecord(input, TOP_KEYS, 'Datei');
  if (value.format !== EINGANG_FORMAT) invalidIntake(`«format» muss «${EINGANG_FORMAT}» sein.`);
  if (value.version !== 1) invalidIntake('«version» 1 erwartet.');
  if (!Array.isArray(value.aenderungen)) return invalidIntake('«aenderungen» fehlt.');
  if (value.aenderungen.length > MAX_CHANGES) invalidIntake('zu viele Änderungen in einer Datei.');
  const changes = value.aenderungen.map((item: unknown, index: number): IntakeChange => {
    const where = `Änderung ${index + 1}`;
    const change = strictRecord(item, CHANGE_KEYS, where);
    const aktion = change.aktion;
    if (aktion !== 'neu' && aktion !== 'aendern')
      return invalidIntake(`${where}: «aktion» muss «neu» oder «aendern» sein.`);
    if (aktion === 'neu' && change.felder != null)
      invalidIntake(`${where}: bei «neu» stehen die Felder unter «pendenz».`);
    if (aktion === 'aendern' && change.pendenz != null)
      invalidIntake(`${where}: bei «aendern» stehen die Felder unter «felder».`);
    if (aktion === 'aendern' && change.id == null && change.quelle == null)
      invalidIntake(`${where}: «id» oder «quelle» nötig.`);
    const felder = strictFields(aktion === 'neu' ? change.pendenz : change.felder, where);
    if (aktion === 'neu' && !felder.titel?.trim()) invalidIntake(`${where}: Titel fehlt.`);
    return {
      aktion,
      ...(change.id == null ? {} : { id: strictText(change.id, `${where}.id`, 120) }),
      ...(change.quelle == null ? {} : { quelle: strictSource(change.quelle, `${where}.quelle`) }),
      felder,
      notiz: strictText(change.notiz, `${where}.notiz`),
      ...(change.basis == null ? {} : { basis: strictText(change.basis, `${where}.basis`, 40) }),
      ...(change.vorher == null ? {} : { vorher: strictFields(change.vorher, `${where}.vorher`) }),
    };
  });
  return {
    projektId: strictText(value.projektId, 'projektId', 120),
    agent: strictText(value.agent, 'agent', 80) || 'Agent',
    aenderungen: changes,
  };
}
function bySource(project: Project, source?: PendenzQuelle): Pendenz | undefined {
  if (!source?.ref) return undefined;
  return pendenzenOf(project).find((pendenz) =>
    pendenz.quellen.some((item) => item.kanal === source.kanal && item.ref === source.ref),
  );
}
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? '') === JSON.stringify(b ?? '');
function fieldLines(fields: Record<string, unknown>): string {
  return Object.entries(fields)
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : String(value)}`)
    .join('; ');
}

export interface UpsertResult {
  pendenz: Pendenz;
  status: 'neu' | 'geaendert' | 'unveraendert';
  /** Fields kept as a proposal because the Pendenz changed since `basis`. */
  vorschlag: string[];
}
/**
 * Creates or updates a Pendenz by id or by source (kanal + ref) for agents and automatic
 * checks such as the MILO reconciliation. Fields apply in full only when the Pendenz is
 * unchanged since `basis`; otherwise fields whose `vorher` still matches apply and the rest
 * becomes a proposal for the user. A user's decision is never silently overwritten.
 */
export function upsertPendenz(
  project: Project,
  input: {
    id?: string;
    quelle?: PendenzQuelle;
    felder: PendenzFields;
    notiz?: string;
    basis?: string;
    vorher?: PendenzFields;
    /** Create when nothing matches (default true). */
    anlegen?: boolean;
  },
  by: { autor: PendenzAutor; agent?: string },
  now = new Date().toISOString(),
): UpsertResult | null {
  if (project.archive) throw new Error('Archivstand ist schreibgeschützt.');
  const target = input.id
    ? pendenzenOf(project).find((pendenz) => pendenz.id === input.id)
    : bySource(project, input.quelle);
  const notiz = input.notiz?.trim() ?? '';
  if (!target) {
    if (input.anlegen === false) return null;
    const fields = cleanFields(project, input.felder as Record<string, unknown>);
    if (!fields.titel?.trim()) throw new Error('Bitte einen Titel für die Pendenz erfassen.');
    const pendenz = createPendenz(
      {
        ...fields,
        quellen: input.quelle ? [input.quelle] : [],
        erstelltVon: by.autor,
        neu: by.autor === 'agent',
      },
      now,
    );
    log(pendenz, notiz, by, now);
    project.pendenzen = [...pendenzenOf(project), pendenz];
    return { pendenz, status: 'neu', vorschlag: [] };
  }
  const before = structuredClone(target);
  const wanted = cleanFields(project, input.felder as Record<string, unknown>);
  const vorher = input.vorher ? cleanFields(project, input.vorher as Record<string, unknown>) : {};
  const current = target as Record<string, unknown>;
  const fresh = input.basis != null && input.basis === target.geaendert;
  const apply: Record<string, unknown> = {};
  const proposal: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(wanted)) {
    if (same(current[key], value)) continue;
    const seen = Object.hasOwn(vorher, key);
    if (fresh || (seen && same(current[key], vorher[key as keyof PendenzFields])))
      apply[key] = value;
    // The same proposal reported again is not logged twice.
    else if (!same(target.vorschlag?.felder[key as keyof PendenzFields], value))
      proposal[key] = value;
  }
  if (Object.hasOwn(apply, 'titel') && !String(apply.titel).trim()) delete apply.titel;
  const notes = [notiz];
  if (Object.keys(proposal).length)
    notes.push(`Vorschlag zum Prüfen (inzwischen geändert): ${fieldLines(proposal)}`);
  updatePendenz(project, target.id, apply as PendenzFields, {
    notiz: notes.filter(Boolean).join('\n'),
    by,
    now,
  });
  if (Object.keys(proposal).length)
    target.vorschlag = {
      felder: { ...target.vorschlag?.felder, ...proposal } as PendenzFields,
      agent: by.agent ?? '',
      am: now,
    };
  const source = input.quelle;
  if (
    source?.ref &&
    !target.quellen.some((item) => item.kanal === source.kanal && item.ref === source.ref)
  )
    target.quellen.push(source);
  if (same(before, target)) return { pendenz: target, status: 'unveraendert', vorschlag: [] };
  target.geaendert = now;
  target.neu = by.autor === 'agent';
  return { pendenz: target, status: 'geaendert', vorschlag: Object.keys(proposal) };
}

/** Applies an agent file; see upsertPendenz for how conflicts are handled. */
export function applyIntake(
  project: Project,
  intake: Intake,
  now = new Date().toISOString(),
): IntakeResult {
  if (project.archive) throw new Error('Archivstand ist schreibgeschützt.');
  if (intake.projektId && intake.projektId !== project.id)
    throw new Error('Die Eingangsdatei gehört zu einer anderen Dienstleistung.');
  const by = { autor: 'agent' as const, agent: intake.agent };
  const result: IntakeResult = {
    neu: 0,
    geaendert: 0,
    unveraendert: 0,
    konflikte: 0,
    uebersprungen: [],
  };
  intake.aenderungen.forEach((change, index) => {
    // A later change in the same file builds on the earlier one.
    const known = change.id
      ? pendenzenOf(project).find((pendenz) => pendenz.id === change.id)
      : bySource(project, change.quelle);
    const basis = known && known.geaendert === now && known.neu ? now : change.basis;
    const outcome = upsertPendenz(
      project,
      {
        ...change,
        basis,
        anlegen: change.aktion === 'neu',
      },
      by,
      now,
    );
    if (!outcome) {
      result.uebersprungen.push(`Änderung ${index + 1}: Pendenz nicht gefunden.`);
      return;
    }
    if (outcome.vorschlag.length) result.konflikte++;
    if (outcome.status === 'neu') result.neu++;
    else if (outcome.status === 'geaendert') result.geaendert++;
    else result.unveraendert++;
  });
  return result;
}
/** Applies or drops the agent's pending proposal; both count as the user's decision. */
export function resolveProposal(project: Project, id: string, accept: boolean): void {
  const pendenz = find(project, id);
  const proposal = pendenz.vorschlag;
  if (!proposal) return;
  delete pendenz.vorschlag;
  updatePendenz(project, id, accept ? proposal.felder : {}, {
    notiz: accept ? '' : `Vorschlag von ${proposal.agent || 'Agent'} verworfen.`,
  });
}
export function recordImport(project: Project, entry: PendenzImport): void {
  project.pendenzenImporte = [entry, ...(project.pendenzenImporte ?? [])].slice(0, IMPORT_LIMIT);
}
export function alreadyImported(project: Project, hash: string): boolean {
  return (project.pendenzenImporte ?? []).some((entry) => entry.hash === hash);
}
/** Stable, non-cryptographic content hash (FNV-1a) to recognise a file applied before. */
export function contentHash(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${(hash >>> 0).toString(16).padStart(8, '0')}-${text.length}`;
}

export type IntakeFileOutcome =
  | { datei: string; status: 'angewendet'; result: IntakeResult }
  | { datei: string; status: 'bekannt' }
  | { datei: string; status: 'andereDienstleistung' }
  | { datei: string; status: 'ungueltig'; fehler: string };
/**
 * Applies agent files in name order. Files of another service stay in the folder; files
 * applied before (same content) are only reported so they can be moved away.
 */
export function applyIntakeFiles(
  project: Project,
  files: { datei: string; text: string }[],
  now = new Date().toISOString(),
): IntakeFileOutcome[] {
  return [...files]
    .sort((a, b) => a.datei.localeCompare(b.datei))
    .map((file): IntakeFileOutcome => {
      if (file.text.length > INTAKE_MAX_CHARS)
        return { datei: file.datei, status: 'ungueltig', fehler: 'Eingangsdatei ist zu gross.' };
      const hash = contentHash(file.text);
      if (alreadyImported(project, hash)) return { datei: file.datei, status: 'bekannt' };
      let intake: Intake;
      try {
        intake = parseIntake(JSON.parse(file.text));
      } catch (failure) {
        return {
          datei: file.datei,
          status: 'ungueltig',
          fehler:
            failure instanceof SyntaxError
              ? 'Eingangsdatei ist kein lesbares JSON.'
              : failure instanceof Error
                ? failure.message
                : 'Eingangsdatei ungültig.',
        };
      }
      if (intake.projektId && intake.projektId !== project.id)
        return { datei: file.datei, status: 'andereDienstleistung' };
      const result = applyIntake(project, intake, now);
      recordImport(project, {
        datei: file.datei,
        hash,
        am: now,
        anzahl: result.neu + result.geaendert,
      });
      return { datei: file.datei, status: 'angewendet', result };
    });
}
