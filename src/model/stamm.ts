// Master data of a service (ADR-0001): every item is maintained once here and read
// by planning, Tagesbefehle and later the WAP-Planer. The service name stays in
// Project.name and the period in Project.service, so neither is duplicated.
import type { Person, Project } from './types';

export type NameOrder = 'vornameName' | 'nameVorname';
export type KaderRolle = 'kdt' | 'kdtStv';
export const KADER_ROLLEN: readonly KaderRolle[] = ['kdt', 'kdtStv'];
export const KADER_LABELS: Record<KaderRolle, string> = {
  kdt: 'Kommandant',
  kdtStv: 'Kommandant Stellvertreter',
};

export interface KaderEintrag {
  rolle: KaderRolle;
  /** Person id from project.persons when taken from the person list, otherwise ''. */
  personId: string;
  grad: string;
  vorname: string;
  name: string;
  funktion: string;
  /** Set by the migration from the former free text; cleared once the user saves. */
  pruefen?: boolean;
}

/** A locally stored PNG (base64), e.g. the prepared signature. */
export interface StammBild {
  name: string;
  base64: string;
  savedAt: string;
}

export interface Stamm {
  einheit: string;
  uebergeordneteEinheit: string;
  uebungsname: string;
  /** File name suffix, e.g. "FDT_2026" → Tagesbefehle_KVK_FDT_2026.xlsx */
  dateikuerzel: string;
  standort: string;
  klassifizierung: string;
  motto: string;
  nameOrder: NameOrder;
  /** At most one entry per role. */
  kader: KaderEintrag[];
  grafiken: { unterschrift?: StammBild; wappen?: StammBild };
}

/** Pictures are kept in the project; larger files would strain the browser storage. */
export const MAX_BILD_BYTES = 512 * 1024;

export function createStamm(): Stamm {
  return {
    einheit: '',
    uebergeordneteEinheit: '',
    uebungsname: '',
    dateikuerzel: '',
    standort: '',
    klassifizierung: '',
    motto: '',
    nameOrder: 'vornameName',
    kader: [],
    grafiken: {},
  };
}

/** Fields of the former free-text settings that S2 moves into the master data. */
export interface LegacyStamm {
  eigeneEinheit?: unknown;
  kdtName?: unknown;
  kdtFunktion?: unknown;
  dienstleistung?: unknown;
}

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const str = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : typeof value === 'number' ? String(value) : fallback;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

function bild(value: unknown): StammBild | undefined {
  const item = record(value);
  if (typeof item.base64 !== 'string' || !BASE64.test(item.base64)) return undefined;
  return { name: str(item.name), base64: item.base64, savedAt: str(item.savedAt) };
}

function kaderEintrag(value: unknown): KaderEintrag | undefined {
  const item = record(value);
  if (item.rolle !== 'kdt' && item.rolle !== 'kdtStv') return undefined;
  return {
    rolle: item.rolle,
    personId: str(item.personId),
    grad: str(item.grad),
    vorname: str(item.vorname),
    name: str(item.name),
    funktion: str(item.funktion),
    ...(item.pruefen === true ? { pruefen: true } : {}),
  };
}

const GRADE =
  /^(Rekr|Sdt|Gfr|Obgfr|Kpl|Wm|Obwm|Fw|Four|Hptfw|Adj|Stabsadj|Hptadj|Chefadj|Lt|Oblt|Hptm|Maj|Oberstlt|Oberst|Br|Div|KKdt|Fachof)\.?$/i;

/**
 * Splits the former free text "Grad Vorname Name" (Tagesbefehl placeholder). The
 * split is lossless: joined again in the default order it gives the same text, so
 * existing Tagesbefehle do not change. The user checks the fields afterwards.
 */
export function splitLegacyName(text: string): Pick<KaderEintrag, 'grad' | 'vorname' | 'name'> {
  const parts = text.trim().split(/\s+/).filter(Boolean);
  const grad = parts.length > 1 && GRADE.test(parts[0]) ? (parts.shift() ?? '') : '';
  const name = parts.pop() ?? '';
  return { grad, vorname: parts.join(' '), name };
}

/** Tolerant: unknown or broken parts fall back to defaults instead of rejecting the project. */
export function normalizeStamm(value: unknown, legacy: LegacyStamm = {}): Stamm {
  const base = createStamm();
  if (value != null) {
    const input = record(value),
      grafiken = record(input.grafiken);
    const kader: KaderEintrag[] = [];
    for (const item of Array.isArray(input.kader) ? input.kader : []) {
      const entry = kaderEintrag(item);
      if (entry && !kader.some((other) => other.rolle === entry.rolle)) kader.push(entry);
    }
    const unterschrift = bild(grafiken.unterschrift),
      wappen = bild(grafiken.wappen);
    return {
      einheit: str(input.einheit),
      uebergeordneteEinheit: str(input.uebergeordneteEinheit),
      uebungsname: str(input.uebungsname),
      dateikuerzel: str(input.dateikuerzel),
      standort: str(input.standort),
      klassifizierung: str(input.klassifizierung),
      motto: str(input.motto),
      nameOrder: input.nameOrder === 'nameVorname' ? 'nameVorname' : 'vornameName',
      kader,
      grafiken: { ...(unterschrift ? { unterschrift } : {}), ...(wappen ? { wappen } : {}) },
    };
  }
  // Project format v5: take over the former settings of planning and Tagesbefehl.
  const kdtName = str(legacy.kdtName).trim(),
    kdtFunktion = str(legacy.kdtFunktion, KADER_LABELS.kdt);
  return {
    ...base,
    einheit: str(legacy.eigeneEinheit),
    dateikuerzel: str(legacy.dienstleistung),
    kader:
      kdtName || kdtFunktion !== KADER_LABELS.kdt
        ? [
            {
              rolle: 'kdt',
              personId: '',
              ...splitLegacyName(kdtName),
              funktion: kdtFunktion,
              ...(kdtName ? { pruefen: true } : {}),
            },
          ]
        : [],
  };
}

export const kaderOf = (stamm: Stamm, rolle: KaderRolle): KaderEintrag | undefined =>
  stamm.kader.find((entry) => entry.rolle === rolle);

/** "Grad Vorname Name" or "Grad Name Vorname", as chosen for the service. */
export function kaderName(entry: KaderEintrag | undefined, order: NameOrder): string {
  if (!entry) return '';
  const names = order === 'nameVorname' ? [entry.name, entry.vorname] : [entry.vorname, entry.name];
  return [entry.grad, ...names]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ');
}

/** Signature block of documents: the commander, or the default function without a name. */
export function commanderSignature(stamm: Stamm): { name: string; funktion: string } {
  const kdt = kaderOf(stamm, 'kdt');
  return { name: kaderName(kdt, stamm.nameOrder), funktion: kdt ? kdt.funktion : KADER_LABELS.kdt };
}

/** Copy of the person's fields; the link allows later comparison with the person list. */
export function kaderFromPerson(person: Person, rolle: KaderRolle, funktion: string): KaderEintrag {
  const fallback = splitLegacyName(person.name);
  return {
    rolle,
    personId: person.id,
    grad: person.grad,
    vorname: person.vorname ?? fallback.vorname,
    name: person.nachname ?? fallback.name,
    funktion,
  };
}

/** Fields that differ from the linked person (never silently overwritten, ADR-0001). */
export function kaderAbweichungen(entry: KaderEintrag, persons: readonly Person[]): string[] {
  if (!entry.personId) return [];
  const person = persons.find((item) => item.id === entry.personId);
  if (!person) return ['Person nicht mehr in der Personenliste'];
  const copy = kaderFromPerson(person, entry.rolle, entry.funktion);
  return (['grad', 'vorname', 'name'] as const)
    .filter((key) => copy[key].trim() !== entry[key].trim())
    .map((key) => ({ grad: 'Grad', vorname: 'Vorname', name: 'Name' })[key]);
}

export const unitOf = (project: Project): string => project.stamm.einheit;
