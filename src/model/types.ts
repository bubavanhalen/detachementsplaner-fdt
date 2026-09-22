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
