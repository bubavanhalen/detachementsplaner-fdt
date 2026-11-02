// Fiktive Varianten der pseudonymisierten KVK-Fixture für die Seitentests (Paket E1-02e, Vertrag E1-02e Notiz
// «Ausarbeitung Schritt 2» Abschnitt G4, I «Fixture», J «Variante»). Alle Änderungen entstehen im Testcode aus
// der KVK-Fixture (E1-02a) bzw. aus den Bausteinen von tests/wap/support/model/builders.ts; alle neuen Texte
// sind erfunden.
import type {
  ColumnSet,
  DayConfig,
  DayDisplay,
  Entry,
  Id,
  IsoDate,
  Plan,
  Week,
} from '../../../../src/model/wap/types';
import {
  CAT,
  col,
  multiDayRemark,
  querbalken,
  rt,
  block as testBlock,
  WEEKDAYS,
} from '../model/builders';
import { loadKvkPlan } from '../model/kvk-fixture';
import { base64, pngEinfarbig } from './wappen';

/** Woche der KVK-Fixture. */
export const KVK_WOCHE = 'w26';
/** Tage der KVK-Woche (Mo 28.09.2026 bis So 04.10.2026). */
export const KVK_TAGE = [
  '2026-09-28',
  '2026-09-29',
  '2026-09-30',
  '2026-10-01',
  '2026-10-02',
  '2026-10-03',
  '2026-10-04',
] as const;
export const MO = KVK_TAGE[0];
export const MI = KVK_TAGE[2];
export const SA = KVK_TAGE[5];
export const SO = KVK_TAGE[6];

/** Wochentage ausgeschrieben (B-Kp-28, R-10-13). */
export const WOCHENTAG_LANG = [
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag',
  'Sonntag',
] as const;

/** Frische KVK-Fixture (pseudonymisiert, E1-02a). */
export function kvk(): Plan {
  return loadKvkPlan();
}

/** Woche `id` des Plans (Testfehler, wenn sie fehlt). */
export function woche(plan: Plan, id: Id = KVK_WOCHE): Week {
  const w = plan.weeks.find((x) => x.id === id);
  if (w === undefined) throw new Error(`Woche ${id} fehlt im Testplan`);
  return w;
}

/** Plan mit geänderter Woche. */
export function mitWoche(plan: Plan, id: Id, over: Partial<Week>): Plan {
  return { ...plan, weeks: plan.weeks.map((w) => (w.id === id ? { ...w, ...over } : w)) };
}

/** Plan mit geänderten Tagen der Woche (Index 0 = Mo). */
export function mitTagen(
  plan: Plan,
  id: Id,
  f: (d: DayConfig, i: number) => Partial<DayConfig>,
): Plan {
  const w = woche(plan, id);
  const d = (i: number): DayConfig => {
    const alt = w.days[i] as DayConfig;
    return { ...alt, ...f(alt, i) };
  };
  return mitWoche(plan, id, { days: [d(0), d(1), d(2), d(3), d(4), d(5), d(6)] });
}

/** Plan mit zusätzlichen bzw. ersetzten Einträgen. */
export function mitEintraegen(plan: Plan, entries: readonly Entry[]): Plan {
  const map: Record<Id, Entry> = { ...plan.entries };
  for (const e of entries) map[e.id] = e;
  return { ...plan, entries: map };
}

/** Plan ohne die Einträge der angegebenen Typen. */
export function ohneEintraege(plan: Plan, typen: readonly Entry['type'][]): Plan {
  const map: Record<Id, Entry> = {};
  for (const e of Object.values(plan.entries)) if (!typen.includes(e.type)) map[e.id] = e;
  return { ...plan, entries: map };
}

/** KVK-Fixture ohne Einträge, Wochenziele und Bereitschaft (Rahmen, Spaltensätze und Kopf bleiben). */
export function leererKvk(): Plan {
  const p = kvk();
  return mitWoche({ ...p, entries: {} }, KVK_WOCHE, { weekGoals: [], heightenedReadiness: '' });
}

/** Spaltensatz mit drei normalen Planungsspalten, Rap und Beso (fiktiv). */
export const EINTAG_SATZ: ColumnSet = {
  id: 's300',
  name: 'Eintag',
  columns: [
    col('c301', 'Zug 1', 'planning'),
    col('c302', 'Zug 2', 'planning'),
    col('c303', 'Zug 3', 'planning'),
    col('c304', 'Rap', 'rap'),
    col('c305', 'Beso', 'beso'),
  ],
};
export const EINTAG = {
  p1: 'c301',
  p2: 'c302',
  p3: 'c303',
  rap: 'c304',
  beso: 'c305',
} as const;

/**
 * Leerer KVK-Plan, in dem nur der Montag sichtbar ist (voller Tag mit `EINTAG_SATZ`); die übrigen Tage sind
 * ausgeblendet. Damit haben einzelne Einträge in den Varianten genug Platz.
 */
export function eintagPlan(entries: readonly Entry[] = [], satz: ColumnSet = EINTAG_SATZ): Plan {
  const p = leererKvk();
  const mitSatz: Plan = { ...p, columnSets: [...p.columnSets, satz] };
  const tage = mitTagen(mitSatz, KVK_WOCHE, (_, i) => ({
    columnSetId: i === 0 ? satz.id : null,
    display: (i === 0 ? 'full' : 'hidden') as DayDisplay,
  }));
  return mitEintraegen(tage, entries);
}

/** Wappen-PNG im Seitenverhältnis des Kastens nach B-Kp-82 (3,94 : 3,87), fiktiv einfarbig. */
export function wappenPng(): Uint8Array {
  return pngEinfarbig(394, 387);
}

/** Text der erhöhten Bereitschaft in KVK+ (Vertrag J R-4.2-06). */
export const BEREITSCHAFT = 'Zug 1 in Bereitschaft';
/** Klassifizierung in KVK+ (Vertrag I). */
export const KLASSIFIZIERUNG = 'INTERN';
/** Bemerkung mit Nummer in KVK+. */
export const NUMMER_BEMERKUNG = { id: 'e901', nummer: 2, text: 'Ruhezeiten im Ukft einhalten.' };
/** Querbalken in KVK+ (fehlt in der KVK-Fixture; B-Kp-69 bis -71). */
export const KVK_PLUS_QUERBALKEN = { id: 'e902', titel: 'Messe Test' };
/** Block mit neutraler Kategorie in KVK+ (B-Kp-97, R-15-04). */
export const KVK_PLUS_NEUTRAL = { id: 'e903', titel: 'Reserve' };

/**
 * Variante «KVK+» (Vertrag I): KVK-Fixture mit Bereitschaftstext, Klassifizierung «INTERN», PNG-Wappen, einer
 * Bemerkung mit Nummer, dazu ein Querbalken (Mi–Fr, Ltg S2) und ein Block mit neutraler Kategorie am Sa. Damit
 * die Seitenleiste ohne Fortsetzung passt, blendet die Woche die Bemerkungen der Fixture bis auf drei aus
 * (`hiddenRemarkIds`, R-4.2-08).
 */
export function kvkPlus(): Plan {
  const p = kvk();
  const bemerkungen = Object.values(p.entries)
    .filter((e) => e.type === 'multiDayRemark')
    .map((e) => e.id)
    .sort();
  const p2 = mitWoche(
    {
      ...p,
      classification: KLASSIFIZIERUNG,
      coatOfArms: { mime: 'image/png', dataBase64: base64(wappenPng()) },
    },
    KVK_WOCHE,
    { heightenedReadiness: BEREITSCHAFT, hiddenRemarkIds: bemerkungen.slice(3) },
  );
  return mitEintraegen(p2, [
    multiDayRemark(NUMMER_BEMERKUNG.id, 901, {
      text: NUMMER_BEMERKUNG.text,
      number: NUMMER_BEMERKUNG.nummer,
      scope: { kind: 'week', weekId: KVK_WOCHE },
    }),
    querbalken(KVK_PLUS_QUERBALKEN.id, 902, {
      title: rt(KVK_PLUS_QUERBALKEN.titel),
      fromDate: KVK_TAGE[2],
      toDate: KVK_TAGE[4],
      columns: { kind: 'all' },
      categoryId: CAT.s2,
    }),
    testBlock(KVK_PLUS_NEUTRAL.id, 903, {
      date: SA,
      time: { form: 'range', from: 600, to: 720 },
      columns: { kind: 'all' },
      title: rt(KVK_PLUS_NEUTRAL.titel, true),
      categoryId: CAT.neutral,
    }),
  ]);
}

/** Datum eines Wochentags (Index 0 = Mo) ab dem Montag `start`. */
export function tagDatum(start: IsoDate, i: number): IsoDate {
  const [y, m, d] = start.split('-').map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d + i));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(
    t.getUTCDate(),
  ).padStart(2, '0')}`;
}

/** Kürzel des Wochentags (Index 0 = Mo). */
export function wochentagKurz(i: number): string {
  return WEEKDAYS[i] ?? 'Mo';
}

/** Fiktiver Text mit `n` Zeichen aus Wörtern «WortNNN» (für die Abbruchfälle V01, V-02e-18). */
export function langerText(n: number, wort = 'Wort'): string {
  const teile: string[] = [];
  let laenge = 0;
  for (let i = 0; laenge < n; i++) {
    const w = `${wort}${String(i).padStart(3, '0')}`;
    teile.push(w);
    laenge += w.length + 1;
  }
  return teile.join(' ').slice(0, n).trim();
}
