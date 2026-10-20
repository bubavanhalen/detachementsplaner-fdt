import type { Source } from './types';

// One leading source per person field (ADR-0001 «Quelle + Abbild»). The leading source
// overwrites; the other source only fills an empty field. A differing value from the
// other source is shown in the import comparison and never written silently.

export type PersonField =
  | 'name'
  | 'grad'
  | 'pnr'
  | 'funktion'
  | 'lics'
  | 'einteilung'
  | 'zug'
  | 'dt'
  | 'tel'
  | 'mail'
  | 'wohnort'
  | 'geburtsdatum'
  | 'miloStatus';

export const FELDHOHEIT: Record<PersonField, Source> = {
  name: 'pisa',
  grad: 'pisa',
  pnr: 'pisa',
  funktion: 'pisa',
  lics: 'pisa',
  einteilung: 'pisa',
  zug: 'pisa',
  tel: 'pisa',
  mail: 'pisa',
  wohnort: 'pisa',
  // MILO is maintained daily during the service.
  dt: 'milo',
  geburtsdatum: 'milo',
  miloStatus: 'milo',
};

export const FIELD_LABELS: Record<PersonField, string> = {
  name: 'Name',
  grad: 'Grad',
  pnr: 'Versicherten-Nr.',
  funktion: 'Funktion',
  lics: 'Führerausweise',
  einteilung: 'Einheit',
  zug: 'Zug',
  dt: 'NZL',
  tel: 'Mobiltelefon',
  mail: 'E-Mail',
  wohnort: 'Wohnort',
  geburtsdatum: 'Geburtsdatum',
  miloStatus: 'Status MILO',
};

export function leads(source: Source, field: PersonField): boolean {
  return FELDHOHEIT[field] === source;
}
