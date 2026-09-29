import type { TbState } from './tagesbefehl/types';

export type Participation = 'unreviewed' | 'included' | 'excluded';
export type Source = 'pisa' | 'milo';
export interface Person {
  [key: string]: unknown;
  id: string;
  name: string;
  grad: string;
  funktion: string;
  lics: string[];
  raw: Record<string, string>;
  key?: string;
  pnr?: string;
  dt?: string;
  einteilung?: string;
  zug?: string;
  tel?: string;
  mail?: string;
  vorname?: string;
  nachname?: string;
  wohnort?: string;
  identityReview?: string;
  pisa?: boolean;
  milo?: boolean;
  rawSources?: Partial<Record<Source, Record<string, string>>>;
  planning: { status: Participation; reason: string };
}
export interface Detachment {
  [key: string]: unknown;
  id: string;
  name: string;
  ec: string;
  datum: string;
  von: string;
  bis: string;
  bisDatum: string;
  ort: string;
  treffpunkt: string;
  anzug: string;
  entlassungsort: string;
  bem: string;
  soll: string;
  fahrzeug: string;
  zusatzIds: string[];
  generatedFrom?: string;
}
/**
 * On-site sub-group of a planning card (e.g. «Det Mat» within the KVK detachement).
 * Purely for the service on site: it never feeds PISA entries, validation or signatures.
 */
export interface SubDetachment {
  [key: string]: unknown;
  id: string;
  parentId: string;
  name: string;
  /** Leader; '' or a member of personIds. */
  chefId: string;
  /** Free text such as task, place or vehicle. */
  auftrag: string;
  personIds: string[];
}
export interface Connection {
  id: string;
  from: string;
  to: string;
}
export type OrderMode = 'unconfirmed' | 'separate' | 'continuous';
export interface Confirmation {
  at: string;
  signature: string;
}
export interface Project {
  [key: string]: unknown;
  v: 5;
  id: string;
  name: string;
  persons: Person[];
  dets: Detachment[];
  assign: Record<string, string[]>;
  connections: Connection[];
  orderPolicy: { mode: OrderMode; confirmedBy: string; confirmedAt: string };
  generatedCodes: Record<string, string>;
  service: { start: string; end: string; year?: string; note: string };
  src: Record<Source, { datei: string; zeit: string; anz: number } | null>;
  maps: Record<string, Record<string, string>>;
  settings: { eigeneEinheit: string; puffer: number; nurMilo: boolean };
  pisa: { entered: Record<string, Confirmation>; verified: Confirmation | null };
  archive: { id: string; at: string } | null;
  migrationNotes: string[];
  board?: { positions: Record<string, { x: number; y: number }> };
  /** Optional on-site sub-groups; old saves have none. Not part of the PISA handover. */
  subDets?: SubDetachment[];
  /** Optional Tagesbefehl state; old saves have none. */
  tb?: TbState;
}
export interface PisaEntry {
  id: string;
  sourceId: string;
  name: string;
  ec: string;
  details: Detachment;
  extraIds: string[];
  personIds: string[];
  kind: 'main' | 'additional';
  generated: boolean;
}
export interface ValidationIssue {
  entryId?: string;
  code: string;
  message: string;
  personId?: string;
  groupId?: string;
}
