// @vitest-environment jsdom
// F-ABDECKUNG (FT-A-01): Import einer Arbeitsmappe in Grenz- und Fehlerfällen von Kopf, Spalten, Seitenleiste und
// Mappe (Beschrieb 8.2 Regeln 1, 7, 10; normalisierung 3, 7; Vertrag E1-08 §1): Stand-Datum in Text- und
// Datumszellen (auch 1904), Spalten ohne Rap/Beso, Zwischenspalte am Tagesanfang, Spaltenbreiten, Bemerkungs- und
// Kürzelzellen, ausgeblendete Blätter, Mappe ohne Wochenblatt, Lesefehler und Ablauf runImport mit Speicher-Port.
// Fiktive Arbeitsmappen.
import { describe, expect, it } from 'vitest';
import {
  IMPORT_MESSAGES,
  ImportError,
  type ImportOutcome,
  type ImportProgress,
  type ImportStore,
  importBytes,
  readImportWorkbook,
  runImport,
} from '../../../../src/io/wap-import/index';
import { isImportError } from '../../../../src/io/wap-import/run';
import { shortNameOf } from '../../../../src/io/wap-import/sheet';
import { kpTemplate } from '../../../../src/model/wap/template';
import type { MultiDayRemark, Plan } from '../../../../src/model/wap/types';
import {
  besoBox,
  block,
  bold,
  buildKpWorkbook,
  emptyWeek,
  geometryOf,
  KP_DAY,
  KP_DAY_GAP,
  normal,
  WEEKEND,
  type WeekDef,
} from '../../fixtures/import/kp-workbook';
import { blocks, ctx, entries, freshPlan } from '../import/support';
import { editedWorkbook, importEdited } from './support';

const SIDE = geometryOf(emptyWeek()).sideCol;
/** Fiktive Woche ohne Stand-Datum im Kopf. */
function ohneStand(over: Partial<WeekDef> = {}): WeekDef {
  const w: { -readonly [K in keyof WeekDef]: WeekDef[K] } = { ...emptyWeek(over) };
  delete w.stand;
  return w;
}
const kinds = (o: ImportOutcome) => o.report.items.map((i) => i.kind);
const columnsOfMonday = (plan: Plan) => {
  const setId = plan.weeks[0]?.days[0]?.columnSetId;
  return plan.columnSets.find((s) => s.id === setId)?.columns ?? [];
};

describe('F-ABDECKUNG Import: Kurzname und Stand-Datum (R-8.2-01, R-8.2-24)', () => {
  it('[R-8.2-01] Kurzname aus dem Blattnamen: «W3», «Wo. 4», «woche 5» → «Wo‹n›»; leer → «Woche»', () => {
    expect(shortNameOf('W3')).toBe('Wo3');
    expect(shortNameOf(' Wo. 4 ')).toBe('Wo4');
    expect(shortNameOf('woche 5')).toBe('Wo5');
    expect(shortNameOf('KVK')).toBe('KVK');
    expect(shortNameOf('   ')).toBe('Woche');
  });

  it('[R-8.2-24] Stand-Datum im Text der Zelle «Stand 17.09.99» (zweistelliges Jahr) → 17.09.2099', () => {
    const o = importEdited([ohneStand()], {
      cells: [{ row: 2, col: SIDE, text: 'Stand 17.09.99' }],
    });
    expect(o.result.plan.stand).toEqual({ date: '2099-09-17', version: 1 });
    expect(kinds(o)).not.toContain('missingHeader');
  });

  it('[R-8.2-24] Stand-Datum als Text in der Nachbarzelle; ungültiges Datum (31.02.) wird übergangen', () => {
    const o = importEdited([ohneStand()], {
      cells: [
        { row: 1, col: SIDE + 1, text: '31.02.2099' },
        { row: 3, col: SIDE, text: 'Stand:' },
        { row: 3, col: SIDE + 2, text: '18.09.2099' },
      ],
    });
    expect(o.result.plan.stand).toEqual({ date: '2099-09-18', version: 1 });
  });

  it('[R-8.2-24] 1904-Datumssystem: Seriennummer des Stands um 1462 Tage verschoben gelesen', () => {
    // Seriennummer im 1904-System für 17.09.2099: 1900-Seriennummer − 1462.
    const serial1900 = Math.round((Date.UTC(2099, 8, 17) - Date.UTC(1899, 11, 30)) / 86_400_000);
    const w = ohneStand({ monday: '2099-10-05' });
    const o = importEdited([w], {
      date1904: true,
      cells: [{ row: 1, col: SIDE + 1, value: serial1900 - 1462 }],
    });
    expect(o.result.plan.stand?.date).toBe('2099-09-17');
  });

  it('[R-8.2-23] Ohne Stand-Datum: kein Stand, Bericht «Kopfangabe fehlt» mit Ursache und nächstem Schritt', () => {
    const o = importEdited([ohneStand()], {});
    expect(o.result.plan.stand).toBeNull();
    const m = o.report.items.find((i) => i.kind === 'missingHeader');
    expect(m?.message.nextStep.length).toBeGreaterThan(5);
  });

  it('[R-8.2-01] Titel ohne «Arbeitsplan»: Bezeichnung = Blattname, Einheit leer', () => {
    const o = importEdited([emptyWeek({ sheet: 'Wo 1', title: 'Wochenplan fiktiv' })], {});
    expect(o.result.plan.weeks[0]?.label).toBe('Wo 1');
  });
});

describe('F-ABDECKUNG Import: Spalten (Regel 7, normalisierung 7)', () => {
  it('[R-8.2-19] Tag ohne Rap- und Beso-Spalte: beide Spalten ergänzt (Reihenfolge R-2-02), Block bleibt in seinen Spalten', () => {
    const days = [{ columns: ['Kdo', 'Alpha'] }, KP_DAY, KP_DAY, KP_DAY, KP_DAY, WEEKEND, WEEKEND];
    const o = importEdited(
      [emptyWeek({ days, shapes: [block(0, [1, 1], '0800', '0900', [[bold('Ausb')]])] })],
      {},
    );
    expect(columnsOfMonday(o.result.plan).map((c) => [c.name, c.kind])).toEqual([
      ['Kdo', 'planning'],
      ['Alpha', 'planning'],
      ['Rap', 'rap'],
      ['Beso', 'beso'],
    ]);
    const [b] = blocks(o.result.plan);
    const alpha = columnsOfMonday(o.result.plan)[1]?.id;
    expect(b?.columns).toEqual({ kind: 'ids', ids: [alpha] });
  });

  it('[R-8.2-19] Unbeschriftete Spalte am Tagesanfang: keine eigene Spalte, Bericht «Zwischenspalte»; Block in Kdo bleibt in Kdo', () => {
    const days = [
      { columns: ['', 'Kdo', 'Alpha', 'Rap', 'Beso'] },
      KP_DAY,
      KP_DAY,
      KP_DAY,
      KP_DAY,
      WEEKEND,
      WEEKEND,
    ];
    const o = importEdited(
      [emptyWeek({ days, shapes: [block(0, [1, 1], '0800', '0900', [[bold('Kdo')]])] })],
      {},
    );
    expect(columnsOfMonday(o.result.plan).map((c) => c.name)).toEqual([
      'Kdo',
      'Alpha',
      'Rap',
      'Beso',
    ]);
    expect(kinds(o)).toEqual(['gapColumnMerged']);
    expect(blocks(o.result.plan)[0]?.columns).toEqual({
      kind: 'ids',
      ids: [columnsOfMonday(o.result.plan)[0]?.id],
    });
  });

  it('[R-8.2-19][FA-06] Block ganz in der Zwischenspalte → Block der linken Nachbarspalte «Bravo», keine Nebenspalte, Bericht «Zwischenspalte»', () => {
    // Soll (normalisierung 7, F-32): die Zwischenspalte gehört zur linken Nachbarspalte; der Block liegt in «Bravo».
    // Bis F-FIX verglich coveredColumns nur die Kernbreite der Spalten ohne die zugeschlagene Lücke; der Block landete
    // in einer neuen Nebenspalte «Det» mit der Meldung «ganz in der Rap-Spalte» (Befund FA-06).
    const o = importEdited(
      [
        emptyWeek({
          days: [KP_DAY_GAP, KP_DAY, KP_DAY, KP_DAY, KP_DAY, WEEKEND, WEEKEND],
          shapes: [block(0, [3, 3], '0800', '1000', [[bold('Nur Lücke')]])],
        }),
      ],
      {},
    );
    const cols = columnsOfMonday(o.result.plan);
    expect(cols.map((c) => c.name)).toEqual(['Kdo', 'Alpha', 'Bravo', 'Rap', 'Beso']);
    expect(blocks(o.result.plan)[0]?.columns).toEqual({ kind: 'ids', ids: [cols[2]?.id] });
    expect(kinds(o)).toEqual(['gapColumnMerged']);
  });

  it('[R-4.4-01] Spaltenbreiten: unter 70 % der üblichen → schmal, über 145 % → breit', () => {
    // Mo beginnt in Spalte 1 (Kdo), 2 (Alpha), 3 (Bravo).
    const o = importEdited([emptyWeek()], { widths: { 1: 6, 3: 20 } });
    const cols = columnsOfMonday(o.result.plan);
    expect(cols.slice(0, 3).map((c) => [c.name, c.weight])).toEqual([
      ['Kdo', 'narrow'],
      ['Alpha', 'normal'],
      ['Bravo', 'wide'],
    ]);
  });
});

describe('F-ABDECKUNG Import: Zellen der Seitenleiste (R-8.2-20; Beschrieb 4.2, 4.7)', () => {
  it('[R-4.2-07] Bemerkungen als Zellen: Nummer und Text, ohne Nummer nur Text; Kopf «Nr / Was» entfällt', () => {
    const o = importEdited([emptyWeek()], {
      cells: [
        { row: 46, col: SIDE, text: '3' },
        { row: 46, col: SIDE + 1, text: 'Fiktive Zellbemerkung' },
        { row: 48, col: SIDE, text: 'Ohne Nummer fiktiv' },
      ],
    });
    const rs = entries(o.result.plan).filter(
      (e): e is MultiDayRemark => e.type === 'multiDayRemark',
    );
    expect(rs.map((r) => [r.number, r.text])).toEqual([
      [3, 'Fiktive Zellbemerkung'],
      [null, 'Ohne Nummer fiktiv'],
    ]);
  });

  it('[R-4.7-21] Kürzelliste in Zellen: Kürzel mit längerer Bedeutung rechts daneben → eigene Bedeutung des Plans', () => {
    const o = importEdited([emptyWeek()], {
      cells: [
        { row: 62, col: SIDE, text: 'Tw' },
        { row: 62, col: SIDE + 1, text: 'Tagwache fiktiv' },
        { row: 64, col: SIDE, text: 'Xy' },
        { row: 64, col: SIDE + 1, text: 'X' },
      ],
    });
    expect(o.result.plan.abbreviationMeanings).toMatchObject({
      KR: 'Kp Rapport fiktiv',
      Tw: 'Tagwache fiktiv',
    });
    expect(o.result.plan.abbreviationMeanings?.Xy).toBeUndefined();
  });
});

describe('F-ABDECKUNG Import: Mappe (Vertrag E1-08 §1)', () => {
  it('[R-8.2-01] Ausgeblendetes Blatt wird nicht importiert', () => {
    const o = importEdited(
      [
        emptyWeek({ sheet: 'Wo 1', monday: '2099-10-05' }),
        emptyWeek({ sheet: 'Wo 2', monday: '2099-10-12' }),
      ],
      { hiddenSheets: [1] },
    );
    expect(o.result.plan.weeks.map((w) => w.shortName)).toEqual(['Wo1']);
    expect(o.report.sheets.map((s) => s.sheet)).toEqual(['Wo 1']);
  });

  it('[R-8.2-01] Fehlerpfad: kein Blatt mit WAP-Woche → ImportError «noWeekSheets» mit Meldung', () => {
    const bytes = editedWorkbook([emptyWeek()], { hiddenSheets: [0] });
    const target = freshPlan();
    try {
      importBytes(
        target,
        bytes,
        'fiktiv.xlsx',
        { template: kpTemplate(), persons: [], functionList: [] },
        ctx,
      );
      throw new Error('kein Fehler');
    } catch (e) {
      expect(e).toBeInstanceOf(ImportError);
      expect((e as ImportError).code).toBe('noWeekSheets');
      expect((e as ImportError).userMessage).toEqual(IMPORT_MESSAGES.noWeekSheets);
    }
  });

  it('[R-5.7-04] Lesefehler: altes .xls (OLE-Kopf) → «oldXlsFormat»; Zufallsbytes → «notXlsx»; Prüfung isImportError', () => {
    const ole = Uint8Array.from([
      0xd0,
      0xcf,
      0x11,
      0xe0,
      0xa1,
      0xb1,
      0x1a,
      0xe1,
      ...new Array<number>(504).fill(0),
    ]);
    const err = (b: Uint8Array): unknown => {
      try {
        readImportWorkbook(b);
      } catch (e) {
        return e;
      }
      return null;
    };
    expect(err(ole)).toMatchObject({ code: 'oldXlsFormat' });
    const zufall = err(Uint8Array.from([1, 2, 3, 4]));
    expect(zufall).toMatchObject({ code: 'notXlsx' });
    expect(isImportError(zufall)).toBe(true);
    expect(isImportError(new Error('x'))).toBe(false);
    expect(isImportError(null)).toBe(false);
  });
});

describe('F-ABDECKUNG runImport über den Speicher-Port (Vertrag E1-08 §1; R-5.6-05)', () => {
  const options = (plan: Plan) => ({
    template: kpTemplate(),
    persons: [],
    functionList: plan.functionList,
  });
  const uhr = { now: () => new Date('2099-10-01T12:00:00.000Z') };
  const renderer = {
    week: async () => Uint8Array.from([1]),
    plan: async () => Uint8Array.from([2]),
  };
  function speicher(plan: Plan | null): ImportStore & { commits: unknown[] } {
    const commits: unknown[] = [];
    return {
      commits,
      load: async () => (plan === null ? null : { plan, revision: 7 }),
      standRecords: async () => [],
      commitAtomic: async (_id, write) => {
        commits.push(write);
        return { savedAt: '2099-10-01T12:00:00.000Z', revision: 8, seq: 1 };
      },
    };
  }
  const mappe = (stand = true) => {
    const over: Partial<WeekDef> = {
      shapes: [
        block(0, [0, 1], '0800', '1000', [[bold('Ausb fiktiv')]]),
        besoBox(0, 4, '0900', 10),
      ],
      agenda: [{ day: 0, paragraphs: [[normal('10 0900: Besuch fiktiv.')]] }],
    };
    return buildKpWorkbook([stand ? emptyWeek(over) : ohneStand(over)]);
  };

  it('[R-5.6-05] Ohne Stand-Datum: kein Stand-PDF, Schreibauftrag ohne Stand; Fortschritt read → import → write; onWriting einmal', async () => {
    const plan = freshPlan();
    const store = speicher(plan);
    const steps: ImportProgress['step'][] = [];
    let writing = 0;
    const out = await runImport(
      store,
      plan.id,
      mappe(false),
      'fiktiv.xlsx',
      options(plan),
      renderer,
      uhr,
      {
        ctx,
        onProgress: (p) => steps.push(p.step),
        onWriting: () => {
          writing += 1;
        },
      },
    );
    expect(steps).toEqual(['read', 'import', 'write']);
    expect(writing).toBe(1);
    expect(store.commits).toHaveLength(1);
    expect(store.commits[0]).toMatchObject({ expectedRevision: 7, restorePoint: 'import' });
    expect(store.commits[0]).not.toHaveProperty('standRecord');
    expect(out).toMatchObject({ revision: 8, seq: 1 });
  });

  it('[R-8.2-24] Mit Stand-Datum: je Woche und Gesamtplan ein PDF; Fortschritt «render» zählt bis zum Ende', async () => {
    const plan = freshPlan();
    const store = speicher(plan);
    const renders: [number, number][] = [];
    await runImport(store, plan.id, mappe(), 'fiktiv.xlsx', options(plan), renderer, uhr, {
      ctx,
      onProgress: (p) => {
        if (p.step === 'render') renders.push([p.done, p.total]);
      },
    });
    expect(renders).toEqual([
      [0, 2],
      [1, 2],
      [2, 2],
    ]);
    const w = store.commits[0] as {
      standRecord: { pdfs: Map<string, Uint8Array>; version: number };
    };
    expect([...w.standRecord.pdfs.values()]).toEqual([Uint8Array.from([1]), Uint8Array.from([2])]);
    expect(w.standRecord.version).toBe(1);
  });

  it('[R-5.6-05] Fehlerpfade: schon abgebrochen → «aborted» ohne Laden; Plan fehlt → «planNotFound»; nichts geschrieben', async () => {
    const plan = freshPlan();
    const store = speicher(plan);
    const c = new AbortController();
    c.abort();
    await expect(
      runImport(store, plan.id, mappe(), 'x.xlsx', options(plan), renderer, uhr, {
        ctx,
        signal: c.signal,
      }),
    ).rejects.toMatchObject({ code: 'aborted' });
    const leer = speicher(null);
    await expect(
      runImport(leer, 'p-weg', mappe(), 'x.xlsx', options(plan), renderer, uhr, { ctx }),
    ).rejects.toMatchObject({
      code: 'planNotFound',
    });
    expect(store.commits).toEqual([]);
    expect(leer.commits).toEqual([]);
  });

  it('[R-5.6-05] Renderer liefert keine Bytes bzw. wirft → «standRenderFailed»; ein ImportError des Renderers bleibt', async () => {
    const plan = freshPlan();
    const falsch = { week: async () => 'kein PDF' as unknown as Uint8Array, plan: renderer.plan };
    const wirft = {
      week: async () => Promise.reject(new Error('Renderer fiktiv')),
      plan: renderer.plan,
    };
    const abbruch = {
      week: async () => Promise.reject(new ImportError('aborted')),
      plan: renderer.plan,
    };
    for (const [r, code] of [
      [falsch, 'standRenderFailed'],
      [wirft, 'standRenderFailed'],
      [abbruch, 'aborted'],
    ] as const) {
      const store = speicher(plan);
      await expect(
        runImport(store, plan.id, mappe(), 'x.xlsx', options(plan), r, uhr, { ctx }),
      ).rejects.toMatchObject({
        code,
      });
      expect(store.commits).toEqual([]);
    }
  });

  it('[R-5.6-05] Abbruch während des Ladens beendet sofort mit «aborted»', async () => {
    const plan = freshPlan();
    const c = new AbortController();
    const store: ImportStore = {
      load: () => {
        c.abort();
        return new Promise(() => {});
      },
      standRecords: async () => [],
      commitAtomic: async () => ({ savedAt: '', revision: 0, seq: 0 }),
    };
    await expect(
      runImport(store, plan.id, mappe(), 'x.xlsx', options(plan), renderer, uhr, {
        ctx,
        signal: c.signal,
      }),
    ).rejects.toMatchObject({ code: 'aborted' });
  });
});
