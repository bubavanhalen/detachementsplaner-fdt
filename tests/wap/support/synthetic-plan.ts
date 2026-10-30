// Synthetischer Plan für Leistungsmessungen und Property-Tests auf Seitenebene
// (Vertrag E1-02a Abschnitt 6; ADR-010 §8). Rein und deterministisch: gleicher Startwert →
// gleicher Plan. Ohne Produktcode, damit Messungen und Seitentests nicht vom Modell abhängen.
// Alle Inhalte sind fiktiv.
import type {
  Beso,
  BesoTimeWindow,
  Block,
  Column,
  ColumnSet,
  DayConfig,
  DayRemark,
  Entry,
  EntryStatus,
  Id,
  IsoDate,
  LtgCategory,
  Marker,
  MarkerKind,
  Plan,
  Querbalken,
  Rapport,
  RichText,
  TimeSpec,
  Week,
  Weekday,
} from '../../../src/model/wap/types';

export const SYNTHETIC_SEED = 20260928;

/** Verteilung laut Vertrag E1-02a Abschnitt 6. */
export const SYNTHETIC_COUNTS = {
  weeks: 4,
  entries: 1000,
  blocks: 600,
  blocksWithCutout: 60,
  linkedBlocks: 40,
  beso: 120,
  besoPerDayMax: 8,
  rapports: 120,
  markers: 100,
  querbalken: 20,
  querbalkenAcrossWeeks: 5,
  dayRemarks: 40,
  planningColumnsMin: 5,
  planningColumnsMax: 8,
  daysWithSecondaryColumn: 6,
} as const;

const START: IsoDate = '2026-09-28';
const WEEKDAYS: readonly Weekday[] = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const DAY_COUNT = SYNTHETIC_COUNTS.weeks * 7;
/** Tage (Index ab Start) mit Nebenspalte. */
const SECONDARY_DAYS: readonly number[] = [0, 1, 8, 9, 15, 22];

/** Pseudozufall mulberry32 (deterministisch, ohne Math.random). */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function addDaysIso(d: IsoDate, n: number): IsoDate {
  const [y, m, day] = d.split('-').map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, day + n));
  const mm = String(t.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(t.getUTCDate()).padStart(2, '0');
  return `${t.getUTCFullYear()}-${mm}-${dd}`;
}

/** Verteilt `total` möglichst gleichmässig auf `n` Fächer; Überschuss auf zufällig gewählte Fächer. */
function distribute(
  total: number,
  n: number,
  rand: () => number,
  max = Number.POSITIVE_INFINITY,
): number[] {
  const out = new Array<number>(n).fill(Math.floor(total / n));
  let rest = total - Math.floor(total / n) * n;
  const order = shuffle(
    Array.from({ length: n }, (_, i) => i),
    rand,
  );
  for (const i of order) {
    if (rest === 0) break;
    if ((out[i] ?? 0) < max) {
      out[i] = (out[i] ?? 0) + 1;
      rest--;
    }
  }
  return out;
}

function shuffle<T>(list: T[], rand: () => number): T[] {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const a = list[i] as T;
    list[i] = list[j] as T;
    list[j] = a;
  }
  return list;
}

function pick<T>(list: readonly T[], rand: () => number): T {
  return list[Math.floor(rand() * list.length)] as T;
}

function text(t: string, bold = false): RichText {
  return [{ text: t, bold }];
}

const LEGEND: readonly Omit<LtgCategory, 'id'>[] = [
  {
    name: 'Ltg Bat',
    legendLabel: 'Leitung Bat',
    color: { r: 204, g: 236, b: 255 },
    neutral: false,
    inLegend: true,
  },
  {
    name: 'Ltg Kp',
    legendLabel: 'Leitung Kp',
    color: { r: 255, g: 255, b: 153 },
    neutral: false,
    inLegend: true,
  },
  {
    name: 'Ltg Zfhr',
    legendLabel: 'Leitung Zfhr',
    color: { r: 253, g: 234, b: 218 },
    neutral: false,
    inLegend: true,
  },
  {
    name: 'Extern',
    legendLabel: 'Extern',
    color: { r: 191, g: 191, b: 191 },
    neutral: false,
    inLegend: true,
  },
  {
    name: 'Ltg S2',
    legendLabel: 'Ltg S2',
    color: { r: 255, g: 204, b: 153 },
    neutral: false,
    inLegend: true,
  },
  {
    name: 'neutral',
    legendLabel: 'neutral',
    color: { r: 255, g: 255, b: 255 },
    neutral: true,
    inLegend: false,
  },
];

const PLANNING_NAMES = ['Kdo', 'Zug 1', 'Zug 2', 'Zug 3', 'Zug 4', 'Mö', 'Sph', 'Trp'];
const BLOCK_TITLES = [
  'Ausb Thema',
  'AVOR',
  'MiE',
  'NaE',
  'Sport',
  'Vs',
  'Insp DB',
  'WPD',
  'Fsg Mat',
  'Schiessen',
];
const BESO_TITLES = ['Log Absprache', 'Lage Rap', 'Fsg Mun', 'Begehung', 'Ausb Det', 'Kontrl Fsg'];
const RAPPORT_CODES = ['KR', 'DR', 'AR1', 'AR2', 'ARK', 'BR 0', 'BR 1'];

/**
 * Synthetischer Plan: 4 Wochen ab 28.09.2026, 1000 Einträge (600 Blöcke, davon 60 mit Aussparung
 * und 40 verknüpft; 120 Beso mit 1–3 Zeitfenstern, höchstens 8 je Tag; 120 Rapporte; 100 Marker;
 * 20 Querbalken, davon 5 über eine Wochengrenze; 40 ganztägige Bemerkungen); je Tag 5–8
 * Planungsspalten, Nebenspalte an 6 Tagen.
 */
export function syntheticPlan(seed: number = SYNTHETIC_SEED): Plan {
  const rand = rng(seed);
  let nextId = 1;
  const id = (prefix: string): Id => `${prefix}${nextId++}`;
  let seq = 1;

  const legend: LtgCategory[] = LEGEND.map((c) => ({ ...c, id: id('k') }));
  const catIds = legend.map((c) => c.id);
  const activeCats = catIds.slice(0, 5);
  const neutralId = catIds[5] as Id;

  // Spaltensätze: 5–8 Planungsspalten ohne Nebenspalte, dazu zwei mit Nebenspalte «Det».
  const columnSets: ColumnSet[] = [];
  const makeSet = (planning: number, secondary: boolean): ColumnSet => {
    const setId = id('s');
    const columns: Column[] = [];
    for (let i = 0; i < planning; i++) {
      columns.push({
        id: id('c'),
        name: PLANNING_NAMES[i] as string,
        kind: 'planning',
        weight: i === 0 ? 'wide' : i % 3 === 2 ? 'narrow' : 'normal',
        labelOrientation: i % 4 === 3 ? 'vertical' : 'horizontal',
        defaultCategoryId: null,
        origin: 'manual',
      });
    }
    if (secondary) {
      columns.push({
        id: id('c'),
        name: 'Det',
        kind: 'secondary',
        weight: 'narrow',
        labelOrientation: 'horizontal',
        defaultCategoryId: null,
        origin: 'manual',
      });
    }
    for (const [name, kind] of [
      ['Rap', 'rap'],
      ['Beso', 'beso'],
    ] as const) {
      columns.push({
        id: id('c'),
        name,
        kind,
        weight: 'normal',
        labelOrientation: 'horizontal',
        defaultCategoryId: null,
        origin: 'manual',
      });
    }
    const set: ColumnSet = {
      id: setId,
      name: `${planning} Spalten${secondary ? ' mit Det' : ''}`,
      columns,
    };
    columnSets.push(set);
    return set;
  };
  const plainSets = [5, 6, 7, 8].map((n) => makeSet(n, false));
  const secondarySets = [makeSet(6, true), makeSet(8, true)];

  // Tage: Spaltensatz je Tag.
  const daySets: ColumnSet[] = [];
  for (let d = 0; d < DAY_COUNT; d++) {
    daySets.push(
      SECONDARY_DAYS.includes(d)
        ? (secondarySets[d % 2] as ColumnSet)
        : (plainSets[Math.floor(rand() * plainSets.length)] as ColumnSet),
    );
  }

  const weeks: Week[] = [];
  for (let w = 0; w < SYNTHETIC_COUNTS.weeks; w++) {
    const dayConfigs = WEEKDAYS.map(
      (weekday, i): DayConfig => ({
        weekday,
        columnSetId: (daySets[w * 7 + i] as ColumnSet).id,
        display: 'full',
        internalNote: '',
      }),
    ) as unknown as Week['days'];
    weeks.push({
      id: id('w'),
      label: w === 0 ? 'KVK' : `Woche ${w}`,
      shortName: w === 0 ? 'KVK' : `Wo${w}`,
      startDate: addDaysIso(START, 7 * w),
      days: dayConfigs,
      weekGoals: [],
      heightenedReadiness: '',
      sunOverride: { sunrise: null, sunset: null },
      agendaWeekend: 'auto',
      hiddenRemarkIds: [],
    });
  }

  const entries: Entry[] = [];
  const status = (): EntryStatus => {
    const r = rand();
    return r < 0.85 ? 'confirmed' : r < 0.95 ? 'open' : 'cancelled';
  };
  const common = () => ({
    status: status(),
    changed: false,
    createdSeq: seq++,
    internalNote: '',
    removedText: [] as readonly string[],
  });
  const category = (): Id => (rand() < 0.05 ? neutralId : pick(activeCats, rand));

  const pushBlock = (
    date: IsoDate,
    time: Block['time'],
    columns: Block['columns'],
    title: string,
  ): void => {
    const categoryId = category();
    const second = rand() < 0.05 ? (activeCats.find((c) => c !== categoryId) ?? null) : null;
    entries.push({
      ...common(),
      id: id('e'),
      type: 'block',
      date,
      time,
      columns,
      title: text(title, rand() < 0.7),
      supplement: rand() < 0.2 ? 'Teil 2' : '',
      ltg: rand() < 0.3 ? 'Einh Fw' : '',
      tn: rand() < 0.1 ? 'Zfhr' : '',
      tpt: '',
      ort: rand() < 0.4 ? 'Ukft' : '',
      tenue: '',
      printTn: false,
      printTenue: false,
      categoryId,
      secondCategoryId: second,
      textDirection: 'auto',
      openEnd: false,
    });
  };

  // Blöcke: je Tag Paare (breit mit Aussparung + Ausnahme), verknüpfte und einzelne Blöcke in Bändern.
  const pairs = distribute(SYNTHETIC_COUNTS.blocksWithCutout, DAY_COUNT, rand);
  const links = distribute(SYNTHETIC_COUNTS.linkedBlocks, DAY_COUNT, rand);
  const singlesTotal =
    SYNTHETIC_COUNTS.blocks - 2 * SYNTHETIC_COUNTS.blocksWithCutout - SYNTHETIC_COUNTS.linkedBlocks;
  const singles = distribute(singlesTotal, DAY_COUNT, rand);
  for (let d = 0; d < DAY_COUNT; d++) {
    const date = addDaysIso(START, d);
    const set = daySets[d] as ColumnSet;
    const planning = set.columns.filter((c) => c.kind === 'planning');
    const secondary = set.columns.find((c) => c.kind === 'secondary');
    type Band = { kind: 'pair' } | { kind: 'link' } | { kind: 'singles'; count: number };
    const bands: Band[] = [];
    for (let i = 0; i < (pairs[d] ?? 0); i++) bands.push({ kind: 'pair' });
    for (let i = 0; i < (links[d] ?? 0); i++) bands.push({ kind: 'link' });
    let rest = singles[d] ?? 0;
    const perBand = planning.length + (secondary ? 1 : 0);
    while (rest > 0) {
      const count = Math.min(rest, perBand);
      bands.push({ kind: 'singles', count });
      rest -= count;
    }
    shuffle(bands, rand);
    const cap = Math.floor((1440 - 360) / bands.length / 15) * 15;
    let cursor = 360;
    for (const band of bands) {
      const dur = Math.min(pick([45, 60, 75, 90, 120], rand), cap);
      const from = cursor;
      const to = cursor + dur;
      if (band.kind === 'pair') {
        pushBlock(date, { form: 'range', from, to }, { kind: 'all' }, pick(BLOCK_TITLES, rand));
        const start = Math.floor(rand() * (planning.length - 1));
        const ids = planning.slice(start, start + 1 + Math.floor(rand() * 2)).map((c) => c.id);
        pushBlock(
          date,
          { form: 'range', from: from + 15, to: to - 15 },
          { kind: 'ids', ids },
          'Ausnahme',
        );
      } else if (band.kind === 'link') {
        const i = Math.floor(rand() * (planning.length - 2));
        const j = i + 2 + Math.floor(rand() * (planning.length - i - 2));
        const ids = [(planning[i] as Column).id, (planning[j] as Column).id];
        pushBlock(
          date,
          { form: 'range', from, to },
          { kind: 'ids', ids },
          pick(BLOCK_TITLES, rand),
        );
      } else {
        const targets: Column[] = [...planning, ...(secondary ? [secondary] : [])];
        for (let k = 0; k < band.count; k++) {
          const c = targets[k] as Column;
          const r = rand();
          const time: Block['time'] =
            r < 0.9
              ? { form: 'range', from, to }
              : r < 0.94
                ? { form: 'point', at: from }
                : r < 0.97
                  ? { form: 'from', from }
                  : { form: 'until', to };
          pushBlock(date, time, { kind: 'ids', ids: [c.id] }, pick(BLOCK_TITLES, rand));
        }
      }
      cursor = to;
    }
  }

  // Beso: 120, höchstens 8 je Tag, Nummer = (Wochentag + 1) × 10 + laufende Nummer des Tages.
  const besoPerDay = distribute(
    SYNTHETIC_COUNTS.beso,
    DAY_COUNT,
    rand,
    SYNTHETIC_COUNTS.besoPerDayMax,
  );
  for (let d = 0; d < DAY_COUNT; d++) {
    const date = addDaysIso(START, d);
    const set = daySets[d] as ColumnSet;
    const planning = set.columns.filter((c) => c.kind === 'planning');
    for (let k = 0; k < (besoPerDay[d] ?? 0); k++) {
      const nWin = 1 + Math.floor(rand() * 3);
      const windows: BesoTimeWindow[] = [];
      for (let w = 0; w < nWin; w++) {
        const from = 420 + 15 * Math.floor(rand() * 56);
        const time: TimeSpec =
          rand() < 0.5 ? { form: 'point', at: from } : { form: 'range', from, to: from + 60 };
        windows.push({
          id: id('t'),
          time,
          columnId: rand() < 0.5 ? null : pick(planning, rand).id,
          supplement: nWin > 1 ? `Kp ${w + 1}` : '',
        });
      }
      const b: Beso = {
        ...common(),
        id: id('e'),
        type: 'beso',
        date,
        title: text(`${pick(BESO_TITLES, rand)} ${k + 1}`),
        windows,
        ltg: rand() < 0.5 ? 'S4' : '',
        tn: rand() < 0.3 ? 'Kader' : '',
        tpt: rand() < 0.2 ? 'Bus' : '',
        ort: rand() < 0.5 ? 'Kaserne' : '',
        categoryId: pick(activeCats, rand),
        besoNumber: ((d % 7) + 1) * 10 + k,
        numberFixed: false,
        agendaOverride: null,
      };
      entries.push(b);
    }
  }

  // Rapporte: 120.
  const rapPerDay = distribute(SYNTHETIC_COUNTS.rapports, DAY_COUNT, rand);
  const rapSlots: readonly [number, number][] = [
    [360, 390],
    [660, 720],
    [1050, 1080],
    [1200, 1260],
    [1290, 1320],
    [480, 510],
  ];
  for (let d = 0; d < DAY_COUNT; d++) {
    const date = addDaysIso(START, d);
    const planning = (daySets[d] as ColumnSet).columns.filter((c) => c.kind === 'planning');
    const slots = shuffle([...rapSlots], rand);
    for (let k = 0; k < (rapPerDay[d] ?? 0); k++) {
      const [from, to] = slots[k % slots.length] as [number, number];
      const r = rand();
      const display: Rapport['display'] =
        r < 0.8 ? 'rapColumn' : r < 0.9 ? 'alsoInColumns' : 'onlyInColumns';
      const rap: Rapport = {
        ...common(),
        id: id('e'),
        type: 'rapport',
        date,
        code: pick(RAPPORT_CODES, rand),
        time: rand() < 0.3 ? { form: 'point', at: from } : { form: 'range', from, to },
        ort: rand() < 0.3 ? 'KP' : '',
        tn: '',
        categoryId: pick(activeCats, rand),
        display,
        displayColumns:
          display === 'rapColumn'
            ? { kind: 'ids', ids: [] }
            : { kind: 'ids', ids: [(planning[0] as Column).id] },
      };
      entries.push(rap);
    }
  }

  // Marker: 100.
  const markerPerDay = distribute(SYNTHETIC_COUNTS.markers, DAY_COUNT, rand);
  const markerSlots: readonly [MarkerKind, number][] = [
    ['AV', 420],
    ['ABV', 1380],
    ['HV', 1140],
    ['custom', 780],
    ['ABV', 1440],
  ];
  for (let d = 0; d < DAY_COUNT; d++) {
    const date = addDaysIso(START, d);
    for (let k = 0; k < (markerPerDay[d] ?? 0); k++) {
      const [kind, at] = markerSlots[k % markerSlots.length] as [MarkerKind, number];
      const m: Marker = {
        ...common(),
        id: id('e'),
        type: 'marker',
        date,
        at,
        kind,
        customKind: kind === 'custom' ? 'Appell' : '',
        columns: { kind: 'all' },
        asFlatBlock: false,
      };
      entries.push(m);
    }
  }

  // Querbalken: 20, davon 5 über eine Wochengrenze (Freitag bis Dienstag der Folgewoche).
  for (let k = 0; k < SYNTHETIC_COUNTS.querbalken; k++) {
    let fromDay: number;
    let toDay: number;
    if (k < SYNTHETIC_COUNTS.querbalkenAcrossWeeks) {
      const w = k % (SYNTHETIC_COUNTS.weeks - 1);
      fromDay = w * 7 + 4;
      toDay = fromDay + 4;
    } else {
      const w = k % SYNTHETIC_COUNTS.weeks;
      fromDay = w * 7 + Math.floor(rand() * 3);
      toDay = fromDay + 1 + Math.floor(rand() * 3);
    }
    const q: Querbalken = {
      ...common(),
      id: id('e'),
      type: 'querbalken',
      title: text(`Anlass ${k + 1}`),
      fromDate: addDaysIso(START, fromDay),
      toDate: addDaysIso(START, toDay),
      columns: { kind: 'all' },
      categoryId: rand() < 0.5 ? neutralId : pick(activeCats, rand),
    };
    entries.push(q);
  }

  // Ganztägige Bemerkungen: 40.
  const remarkPerDay = distribute(SYNTHETIC_COUNTS.dayRemarks, DAY_COUNT, rand);
  for (let d = 0; d < DAY_COUNT; d++) {
    for (let k = 0; k < (remarkPerDay[d] ?? 0); k++) {
      const r: DayRemark = {
        ...common(),
        id: id('e'),
        type: 'dayRemark',
        date: addDaysIso(START, d),
        text: `Hinweis ${d + 1}.${k + 1}: Fz für die Verschiebung bereitstellen.`,
      };
      entries.push(r);
    }
  }

  const map: Record<Id, Entry> = {};
  for (const e of entries) map[e.id] = e;

  return {
    schemaVersion: 1,
    id: `synthetic-${seed}`,
    level: 'kp',
    templateId: 'kp',
    unit: 'Inf Kp 99/1',
    parentUnit: 'Inf Bat 99',
    service: 'FDT 2099',
    exerciseName: '',
    beilage: '01-02 zum Allgemeinen Befehl (fiktiv)',
    classification: '',
    sunLocation: '',
    commander: {
      grad: 'Hptm',
      name: 'Muster',
      vorname: 'Max',
      funktion: 'Kp Kdt',
      nameOrder: 'gradVornameName',
    },
    signatureImage: null,
    signatureEnabled: false,
    coatOfArms: null,
    motto: '',
    persons: [],
    functionList: [],
    legend,
    rapportCodes: RAPPORT_CODES.map((code) => ({
      code,
      categoryId: code.startsWith('BR') ? (catIds[0] as Id) : (catIds[1] as Id),
    })),
    abbreviationsSelected: [],
    markerLabels: [
      { kind: 'AV', withTime: false },
      { kind: 'ABV', withTime: true },
      { kind: 'HV', withTime: false },
      { kind: 'custom', withTime: false },
    ],
    columnSets,
    weeks,
    deletedWeeks: [],
    entries: map,
    displayRange: { from: 240, to: 1440 },
    stand: { date: '2026-09-17', version: 1 },
    nextSeq: seq,
    nextId,
    lastUsedCategoryId: null,
    printDefaults: { printTn: false, printTenue: false },
    acknowledgedFindings: [],
  };
}
