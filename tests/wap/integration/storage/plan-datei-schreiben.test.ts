// @vitest-environment jsdom
// Paket E1-04: Plan-Datei schreiben – kanonische Form, Prüfung vor dem Schreiben, interne Notizen, Anzeigename,
// Dateiname (Vertrag docs/wap-planer/plan/vertraege/E1-04.md, Notiz «Ausarbeitung Schritt 2» Abschnitte C1, C5–C7,
// D1–D4, E4, G2 notSerializable, I2 exportPlanFile, L R-5.6-17 Nr 9; Beschrieb 5.6 Punkt 5; Q-010, Q-036, V-05-2;
// Vertragsprüfung R1 V05, V07, V08). Alle Inhalte fiktiv.
import { describe, expect, it } from 'vitest';
import {
  hasInternalNotes,
  PLAN_FILE_FORMAT,
  type PlanFileInput,
  parsePlanFile,
  planDisplayName,
  planFileName,
  serializePlanFile,
} from '../../../../src/io/wap-plan/planFile';
import { ModelError } from '../../../../src/model/wap/errors';
import type { Block, Plan } from '../../../../src/model/wap/types';
import { block, mitEintraegen, pruefPlan } from '../../support/stand/plan';
import { dbHash, neueFabrik, oeffnen } from '../../support/storage/datenbank';
import { mottoMigration, testFormatV2 } from '../../support/storage/format';
import { DATEI_MELDUNG } from '../../support/storage/meldungen';
import {
  A,
  alsText,
  base64,
  dateiStand,
  erstes,
  leeresErgebnis,
  planA,
} from '../../support/storage/plaene';
import { dateiFehler, gleich, gleicheBytes, vorhanden, wurf } from '../../support/storage/pruefen';
import { TestUhr, zeitpunkt } from '../../support/storage/uhr';

const HUELLE = [
  'format',
  'version',
  'planId',
  'revision',
  'modifiedAt',
  'savedAt',
  'containsInternalNotes',
  'plan',
  'stands',
];
const PLAN_SCHLUESSEL = [
  'schemaVersion',
  'id',
  'level',
  'templateId',
  'unit',
  'parentUnit',
  'service',
  'exerciseName',
  'beilage',
  'classification',
  'sunLocation',
  'commander',
  'signatureImage',
  'signatureEnabled',
  'coatOfArms',
  'motto',
  'persons',
  'functionList',
  'legend',
  'rapportCodes',
  'abbreviationsSelected',
  'abbreviationMeanings',
  'markerLabels',
  'columnSets',
  'weeks',
  'deletedWeeks',
  'entries',
  'displayRange',
  'stand',
  'nextSeq',
  'nextId',
  'lastUsedCategoryId',
  'printDefaults',
  'acknowledgedFindings',
];
const BLOCK_SCHLUESSEL = [
  'id',
  'status',
  'changed',
  'createdSeq',
  'internalNote',
  'removedText',
  'type',
  'date',
  'time',
  'columns',
  'title',
  'supplement',
  'ltg',
  'tn',
  'tpt',
  'ort',
  'tenue',
  'printTn',
  'printTenue',
  'categoryId',
  'secondCategoryId',
  'textDirection',
  'openEnd',
  'subtasks',
];

/** Tiefe Kopie mit umgekehrter Einfügereihenfolge der Schlüssel jedes Objekts (Arrays unverändert). */
function umgedreht<T>(wert: T): T {
  if (wert === null || typeof wert !== 'object') return wert;
  if (Array.isArray(wert)) return wert.map((x: unknown) => umgedreht(x)) as T;
  const o = wert as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(o).reverse()) out[k] = umgedreht(o[k]);
  return out as T;
}

function eingabe(plan: Plan, stands: PlanFileInput['stands'] = []): PlanFileInput {
  return { plan, revision: 4, modifiedAt: zeitpunkt('2026-10-06', 15), stands };
}

function geparst(bytes: Uint8Array): Record<string, unknown> {
  return JSON.parse(alsText(bytes)) as Record<string, unknown>;
}

const uhr = (): TestUhr => new TestUhr(zeitpunkt('2026-10-07', 12));

describe('serializePlanFile (C1, D1–D3)', () => {
  it('[R-5.6-17] Aufbau nach D1: Hülle in fester Reihenfolge, savedAt von der Uhr (genau ein Aufruf), UTF-8 ohne BOM und ohne Zeilenumbruch am Ende, eingerückt mit 2 Leerzeichen', () => {
    const plan = planA();
    const stand = dateiStand(plan, 'stand-1');
    const u = uhr();
    const bytes = serializePlanFile(eingabe(plan, [stand]), u);
    expect(u.aufrufe, 'genau ein clock.now()').toBe(1);
    expect(bytes[0], 'kein BOM').toBe(0x7b);
    expect(bytes[bytes.length - 1], 'kein Zeilenumbruch am Ende').toBe(0x7d);
    const text = alsText(bytes);
    const obj = geparst(bytes);
    expect(text).toBe(JSON.stringify(obj, null, 2));
    expect(Object.keys(obj)).toEqual(HUELLE);
    expect(obj.format).toBe(PLAN_FILE_FORMAT);
    expect(obj.version).toBe(1);
    expect(obj.planId).toBe(A);
    expect(obj.revision).toBe(4);
    expect(obj.modifiedAt).toBe(zeitpunkt('2026-10-06', 15));
    expect(obj.savedAt).toBe(zeitpunkt('2026-10-07', 12));
    expect(obj.containsInternalNotes).toBe(false);
    expect(Object.keys(obj.plan as object)).toEqual(
      PLAN_SCHLUESSEL.filter((k) => k !== 'abbreviationMeanings'),
    );
    const e101 = ((obj.plan as Record<string, unknown>).entries as Record<string, object>).e101;
    expect(Object.keys(e101 ?? {})).toEqual(BLOCK_SCHLUESSEL.filter((k) => k !== 'subtasks'));
    const s = erstes(obj.stands as Record<string, unknown>[]);
    expect(Object.keys(s)).toEqual(['standId', 'date', 'version', 'standsSameDay', 'plan', 'pdfs']);
    const pdfs = s.pdfs as Record<string, unknown>[];
    expect(pdfs.map((p) => Object.keys(p))).toEqual(pdfs.map(() => ['key', 'base64']));
    expect(pdfs.map((p) => p.key)).toEqual([...stand.pdfs.keys()]);
    expect(pdfs.map((p) => p.base64)).toEqual([...stand.pdfs.values()].map(base64));
  });

  it('[R-5.6-17] gleiche Eingabe, gleicher Zeitpunkt → dieselben Bytes, unabhängig von der Einfügereihenfolge der Schlüssel; Rundreise über parsePlanFile', () => {
    const plan: Plan = {
      ...planA(),
      abbreviationMeanings: { Ukft: 'Unterkunft (fiktiv)', DR: 'Dienstrapport (fiktiv)' },
    };
    const stand = dateiStand(planA(), 'stand-1');
    const a = serializePlanFile(eingabe(plan, [stand]), uhr());
    const b = serializePlanFile(
      eingabe(umgedreht(plan), [{ ...stand, plan: umgedreht(stand.plan) }]),
      uhr(),
    );
    expect(Array.from(b)).toEqual(Array.from(a));
    expect(Array.from(serializePlanFile(eingabe(plan, [stand]), uhr()))).toEqual(Array.from(a));
    const zurueck = parsePlanFile(a);
    gleich(zurueck.plan, plan);
    expect(zurueck.revision).toBe(4);
    for (const [k, v] of stand.pdfs) gleicheBytes(zurueck.stands[0]?.pdfs.get(k), v);
    const meanings = (geparst(a).plan as Record<string, unknown>).abbreviationMeanings;
    expect(Object.keys(meanings as object), 'Schlüssel aufsteigend nach UTF-16').toEqual([
      'DR',
      'Ukft',
    ]);
  });

  it('[R-5.6-17] Plan mit unbekanntem Schlüssel → wirft notSerializable mit Pfad und Meldung wörtlich', () => {
    expect(serializePlanFile(eingabe(planA()), uhr()).length).toBeGreaterThan(0);
    const mitZusatz = { ...planA(), zusatz: 'nicht im Schema' } as unknown as Plan;
    const e = dateiFehler(
      () => serializePlanFile(eingabe(mitZusatz), uhr()),
      'notSerializable',
      DATEI_MELDUNG.notSerializable,
    );
    expect(e.path).toBe('plan.zusatz');
    const ohneTitel = planA();
    const e101 = ohneTitel.entries.e101 as Block;
    const kaputt: Plan = {
      ...ohneTitel,
      entries: { ...ohneTitel.entries, e101: { ...e101, status: 'xyz' } as unknown as Block },
    };
    expect(
      dateiFehler(() => serializePlanFile(eingabe(kaputt), uhr()), 'notSerializable').path,
    ).toBe('plan.entries.e101.status');
  });

  it('[R-5.6-17] eigener Schlüssel mit undefined (Block.subtasks, TextRun.besoRef) gilt als fehlend: keine Ablehnung, Schlüssel fehlt in der Datei', () => {
    const p = planA();
    const e101 = p.entries.e101 as Block;
    const mitUndefined: Plan = {
      ...p,
      entries: {
        ...p.entries,
        e101: {
          ...e101,
          subtasks: undefined,
          title: [{ text: 'Titel (fiktiv)', bold: false, besoRef: undefined }],
        } as unknown as Block,
      },
    };
    const ohne: Plan = {
      ...p,
      entries: {
        ...p.entries,
        e101: { ...e101, title: [{ text: 'Titel (fiktiv)', bold: false }] },
      },
    };
    const a = serializePlanFile(eingabe(mitUndefined), uhr());
    expect(Array.from(a)).toEqual(Array.from(serializePlanFile(eingabe(ohne), uhr())));
    const eintrag = (
      (geparst(a).plan as Record<string, unknown>).entries as Record<
        string,
        Record<string, unknown>
      >
    ).e101;
    expect(Object.hasOwn(eintrag ?? {}, 'subtasks')).toBe(false);
    expect(Object.hasOwn(erstes(eintrag?.title as object[]), 'besoRef')).toBe(false);
  });

  it('[R-5.6-17] Schlüssel von entries aufsteigend nach UTF-16 («e10» vor «e9»); Block ohne subtasks und Plan ohne abbreviationMeanings → Schlüssel fehlen', () => {
    const p = pruefPlan();
    const plan = mitEintraegen(p, [
      block(p, 'e9', '2026-09-17', 'Neun (fiktiv)'),
      block(p, 'e10', '2026-09-18', 'Zehn (fiktiv)'),
    ]);
    expect(Object.keys(plan.entries)).toEqual(['e9', 'e10']);
    const bytes = serializePlanFile(eingabe(plan), uhr());
    const text = alsText(bytes);
    expect(text.indexOf('"e10": {')).toBeGreaterThan(0);
    expect(text.indexOf('"e10": {')).toBeLessThan(text.indexOf('"e9": {'));
    const obj = geparst(bytes).plan as Record<string, unknown>;
    expect(Object.keys(obj.entries as object)).toEqual(['e10', 'e9']);
    expect(Object.hasOwn(obj, 'abbreviationMeanings')).toBe(false);
    expect(Object.hasOwn((obj.entries as Record<string, object>).e9 ?? {}, 'subtasks')).toBe(false);
    expect(text).not.toContain('"subtasks"');
  });

  it('[R-5.6-17] Testformat v2: version der Datei = Version des Formats; ungültiges Format → RangeError', () => {
    const v2 = serializePlanFile(eingabe(planA()), uhr(), testFormatV2(mottoMigration, false));
    expect(geparst(v2).version).toBe(2);
    expect(
      wurf(() => serializePlanFile(eingabe(planA()), uhr(), { version: 2, migrations: [] })),
    ).toBeInstanceOf(RangeError);
    expect(
      wurf(() =>
        serializePlanFile(eingabe(planA()), uhr(), {
          version: 2,
          migrations: [{ fromVersion: 2, additive: true, migrate: (x: unknown) => x }],
        }),
      ),
    ).toBeInstanceOf(RangeError);
  });

  it('[R-5.6-17] exportPlanFile: notSerializable aus der Prüfung geht durch, Speicher unverändert', async () => {
    const f = neueFabrik();
    const store = await oeffnen(f);
    const u = uhr();
    const d0 = (await store.create(planA(), u)).plan;
    const kaputt = { ...d0, zusatz: 1 } as unknown as Plan;
    await store.commit(
      A,
      {
        ...leeresErgebnis(kaputt),
        label: 'Zusatz (fiktiv)',
        patches: [{ op: 'add', path: ['zusatz'], value: 1 }],
        inversePatches: [{ op: 'remove', path: ['zusatz'] }],
      },
      u,
    );
    const hash = await dbHash(f);
    let fehler: unknown;
    try {
      await store.exportPlanFile(A, u);
    } catch (e: unknown) {
      fehler = e;
    }
    const e = dateiFehler(
      () => {
        if (fehler !== undefined) throw fehler;
      },
      'notSerializable',
      DATEI_MELDUNG.notSerializable,
    );
    expect(e.path).toBe('plan.zusatz');
    expect(await dbHash(f)).toBe(hash);
    vorhanden(await store.undo(A, u));
    const exp = await store.exportPlanFile(A, u);
    gleich(parsePlanFile(exp.bytes).plan, d0);
  });
});

describe('Interne Notizen, Anzeigename, Dateiname (C5–C7)', () => {
  it('[R-5.6-17] hasInternalNotes: Eintrag, Tag, gelöschte Woche (Eintrag und Tag) → true; nur Leerraum oder keine → false; containsInternalNotes in der Datei', () => {
    const p = planA();
    expect(hasInternalNotes(p)).toBe(false);
    const e101 = p.entries.e101 as Block;
    const w = erstes(p.weeks);
    const mitTagNotiz = (notiz: string) => ({
      ...w,
      days: w.days.map((d, i) =>
        i === 2 ? { ...d, internalNote: notiz } : d,
      ) as unknown as typeof w.days,
    });
    const faelle: [string, Plan, boolean][] = [
      [
        'Eintrag',
        { ...p, entries: { ...p.entries, e101: { ...e101, internalNote: 'Notiz (fiktiv)' } } },
        true,
      ],
      [
        'Eintrag nur Leerraum',
        { ...p, entries: { ...p.entries, e101: { ...e101, internalNote: ' \n\t ' } } },
        false,
      ],
      ['Tag', { ...p, weeks: [mitTagNotiz('Tagesnotiz (fiktiv)'), ...p.weeks.slice(1)] }, true],
      ['Tag nur Leerraum', { ...p, weeks: [mitTagNotiz('   '), ...p.weeks.slice(1)] }, false],
      [
        'gelöschte Woche, Eintrag',
        { ...p, deletedWeeks: [{ week: w, entries: [{ ...e101, internalNote: 'Alt (fiktiv)' }] }] },
        true,
      ],
      [
        'gelöschte Woche, Tag',
        { ...p, deletedWeeks: [{ week: mitTagNotiz('Alt (fiktiv)'), entries: [] }] },
        true,
      ],
      ['gelöschte Woche ohne Notiz', { ...p, deletedWeeks: [{ week: w, entries: [e101] }] }, false],
    ];
    for (const [fall, plan, soll] of faelle) {
      expect(hasInternalNotes(plan), fall).toBe(soll);
      expect(geparst(serializePlanFile(eingabe(plan), uhr())).containsInternalNotes, fall).toBe(
        soll,
      );
    }
  });

  it('[R-5.6-17] planDisplayName: Dienst und Übungsname, nur Dienst, nur Übungsname, keiner', () => {
    const p = planA();
    expect(planDisplayName({ ...p, service: 'FDT 2026', exerciseName: 'BEISPIEL' })).toBe(
      'FDT 2026 «BEISPIEL»',
    );
    expect(planDisplayName({ ...p, service: '  FDT 2026 ', exerciseName: ' ' })).toBe('FDT 2026');
    expect(planDisplayName({ ...p, service: '', exerciseName: ' BEISPIEL ' })).toBe('«BEISPIEL»');
    expect(planDisplayName({ ...p, service: ' ', exerciseName: '' })).toBe('Plan ohne Namen');
  });

  it('[R-5.6-17] planFileName nach C7: Präfix aus Beilage und Dienst, Datum yyyy-mm-dd; «FDT/2026» bereinigt; ungültiges Datum → ModelError invalidDate', () => {
    const p = pruefPlan();
    expect(planFileName(p, '2026-10-07')).toBe('01_02_WAP_FDT_2026_Plan_2026-10-07.wap.json');
    expect(planFileName({ ...p, service: 'FDT/2026' }, '2026-10-07')).toBe(
      '01_02_WAP_FDT_2026_Plan_2026-10-07.wap.json',
    );
    expect(planFileName({ ...p, beilage: '', service: '' }, '2026-01-05')).toBe(
      'WAP_Plan_2026-01-05.wap.json',
    );
    const e = wurf(() => planFileName(p, '2026-02-30'));
    expect(e).toBeInstanceOf(ModelError);
    expect((e as ModelError).code).toBe('invalidDate');
  });
});
