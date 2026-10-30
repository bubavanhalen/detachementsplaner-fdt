// @vitest-environment jsdom
// Paket E1-04: Plan-Datei lesen – neuere Version, Lesefehler, Strenge des Schemas, Vergleich mit dem lokalen Plan,
// Wappen (Vertrag docs/wap-planer/plan/vertraege/E1-04.md, Notiz «Ausarbeitung Schritt 2» Abschnitte C2, C4, D2, E1–E6,
// G2, L R-5.6-17 Nr 1, 5–8; Beschrieb 5.6 Punkt 7; F-21; CR-E102h-04, CR-E103-07, CR-E102a-07; Notizen E1-02f V17 und
// CR-03). Dateien werden als Objekt gebaut und mit TextEncoder kodiert (M1). Alle Inhalte fiktiv.
import { crc32 } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
  compareWithLocal,
  FORMAT_VERSION,
  type PlanFile,
  parsePlanFile,
} from '../../../../src/io/wap-plan/planFile';
import type { Plan, Querbalken } from '../../../../src/model/wap/types';
import { checkEntryStructure, validateColumnSet } from '../../../../src/model/wap/validate';
import { sha256 } from '../../support/stand/hilfen';
import { dbHash, neueFabrik, oeffnen } from '../../support/storage/datenbank';
import { FIXTURE_PLAN_ID, fixtureBytes } from '../../support/storage/fixture';
import { KENNWORT, mottoMigration, testFormatV2 } from '../../support/storage/format';
import { DATEI_MELDUNG, neuereVersionMeldung } from '../../support/storage/meldungen';
import {
  A,
  alsText,
  base64,
  bytesKopie,
  dateiStand,
  erstes,
  jsonBytes,
  jsonKopie,
  planA,
  planDatei,
  rohDatei,
  rohEintrag,
  textBytes,
} from '../../support/storage/plaene';
import { dateiFehler, gleich, gleicheBytes, vorhanden, wurf } from '../../support/storage/pruefen';
import { TestUhr, zeitpunkt } from '../../support/storage/uhr';

/** Gültige rohe Datei mit Plan A, einem Stand (zwei Wochen-PDF und 'plan') und Teilaufgaben an e101. */
function gueltigRoh(): Record<string, unknown> {
  const plan: Plan = {
    ...planA(),
    abbreviationMeanings: { DR: 'Dienstrapport (fiktiv)' },
  };
  const roh = rohDatei(planDatei(plan, { stands: [dateiStand(planA(), 'stand-1')] }));
  const e101 = rohEintrag(roh, 'e101');
  e101.subtasks = [{ title: [{ text: 'Teil (fiktiv)', bold: false }], ltg: 'Zfhr', ort: '' }];
  return roh;
}

function rohPlan(roh: Record<string, unknown>): Record<string, unknown> {
  return roh.plan as Record<string, unknown>;
}

function ersterStand(roh: Record<string, unknown>): Record<string, unknown> {
  return (roh.stands as Record<string, unknown>[])[0] ?? {};
}

/** Erwartet 'corrupt' mit exaktem Pfad (E5, Nachtrag F1); die Bytes bleiben unverändert. */
function erwarteKaputt(bytes: Uint8Array, pfad: string, fall: string): void {
  const vorher = bytesKopie(bytes);
  const e = dateiFehler(() => parsePlanFile(bytes), 'corrupt', DATEI_MELDUNG.corrupt);
  expect(e.path, fall).toBe(pfad);
  expect(bytesKopie(bytes), `${fall}: Bytes unverändert`).toEqual(vorher);
}

/** Ersetzt im JSON-Text die erste Stelle `nach` durch `nach` mit vorangestelltem Schlüssel (für __proto__ u.a.). */
function mitRohemSchluessel(
  roh: Record<string, unknown>,
  nach: string,
  einschub: string,
): Uint8Array {
  const text = JSON.stringify(roh);
  const i = text.indexOf(nach);
  if (i < 0) throw new Error('Testaufbau: Stelle fehlt');
  const j = i + nach.length;
  return textBytes(`${text.slice(0, j)}${einschub}${text.slice(j)}`);
}

/** PNG nur aus Signatur und IHDR-Chunk (nicht einbettbar, Notiz E1-02f CR-03). */
function pngNurIhdr(): string {
  const daten = Uint8Array.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]);
  const typ = textBytes('IHDR');
  const crc = crc32(Uint8Array.from([...typ, ...daten]));
  const laenge = [0, 0, 0, 13];
  const crcBytes = [(crc >>> 24) & 255, (crc >>> 16) & 255, (crc >>> 8) & 255, crc & 255];
  return base64(
    Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, ...laenge, ...typ, ...daten, ...crcBytes]),
  );
}

/** Ein einfaches Objekt im rohen Dateiobjekt: Pfad nach E5 und Weg dorthin. */
interface ObjektStelle {
  readonly pfad: string;
  readonly weg: readonly (string | number)[];
}

/** Freie Schlüssel haben nur `plan.entries` und `plan.abbreviationMeanings`, auch im Stand-Schnappschuss (E2). */
const FREIE_OBJEKTE = /^(stands\[\d+\]\.)?plan\.(entries|abbreviationMeanings)$/;

/** Sammelt jedes einfache Objekt (kein Array, nicht null) mit festem Schema, die Hülle eingeschlossen. */
function einfacheObjekte(
  wert: unknown,
  pfad: string,
  weg: readonly (string | number)[],
  out: ObjektStelle[],
): void {
  if (Array.isArray(wert)) {
    wert.forEach((x: unknown, i) => {
      einfacheObjekte(x, `${pfad}[${String(i)}]`, [...weg, i], out);
    });
    return;
  }
  if (wert === null || typeof wert !== 'object') return;
  if (!FREIE_OBJEKTE.test(pfad)) out.push({ pfad, weg });
  for (const [k, x] of Object.entries(wert)) {
    einfacheObjekte(x, pfad === '' ? k : `${pfad}.${k}`, [...weg, k], out);
  }
}

describe('Neuere Formatversion (R-5.6-17)', () => {
  it('[R-5.6-17] Datei mit version = FORMAT_VERSION + 1 → newerVersion mit Meldung, Datei und Speicher unverändert (Hash)', async () => {
    const f = neueFabrik();
    const store = await oeffnen(f);
    const uhr = new TestUhr(zeitpunkt('2026-10-07', 9));
    await store.create(planA(), uhr);
    const dbVorher = await dbHash(f);
    const roh = gueltigRoh();
    roh.version = FORMAT_VERSION + 1;
    const bytes = jsonBytes(roh);
    const shaVorher = sha256(bytes);

    const e = dateiFehler(() => parsePlanFile(bytes), 'newerVersion', neuereVersionMeldung(2, 1));
    expect(e.version).toBe(2);
    expect(e.path).toBeNull();
    expect(e.userMessage.cause).toContain('(Format 2); diese Version liest höchstens Format 1.');
    expect(sha256(bytes), 'Datei unverändert').toBe(shaVorher);
    expect(await dbHash(f), 'Speicher unverändert').toBe(dbVorher);
    expect(FORMAT_VERSION).toBe(1);
  });

  it('[R-5.6-17] neuere Datei, die sonst ungültig ist (unbekannter Schlüssel, Plan fehlt) → trotzdem newerVersion', () => {
    const roh = gueltigRoh();
    roh.version = 2;
    roh.neuesFeld = { kommt: 'aus Version 2 (fiktiv)' };
    rohPlan(roh).neuesPlanfeld = 1;
    dateiFehler(() => parsePlanFile(jsonBytes(roh)), 'newerVersion', neuereVersionMeldung(2, 1));
    const ohnePlan = { format: 'wap-planer-plan', version: 7 };
    const e = dateiFehler(() => parsePlanFile(jsonBytes(ohnePlan)), 'newerVersion');
    expect(e.version).toBe(7);
    expect(e.userMessage).toEqual(neuereVersionMeldung(7, 1));
  });

  it('[R-5.6-17] lesbare Version folgt dem Format: Datei Format 3 mit Testformat v2 → newerVersion (3, höchstens 2); Format 2 → gelesen', () => {
    const roh = gueltigRoh();
    roh.version = 3;
    const format = testFormatV2(mottoMigration, false);
    const e = dateiFehler(() => parsePlanFile(jsonBytes(roh), format), 'newerVersion');
    expect(e.userMessage).toEqual(neuereVersionMeldung(3, 2));
    roh.version = 2;
    const gelesen = parsePlanFile(jsonBytes(roh), format);
    expect(gelesen.version).toBe(2);
    expect(gelesen.plan.motto).toBe(planA().motto);
  });
});

describe('Lesefehler (E1)', () => {
  it('[R-5.6-17] ungültiges UTF-8 und kein JSON → invalidJson; Bytes unverändert', () => {
    const gueltig = jsonBytes(gueltigRoh());
    expect(parsePlanFile(gueltig).planId).toBe(A);
    const faelle: [string, Uint8Array][] = [
      ['ungültiges UTF-8', Uint8Array.from([0x7b, 0x22, 0xff, 0xfe, 0x22, 0x7d])],
      ['abgeschnittenes UTF-8', Uint8Array.from([...textBytes('{"a":"'), 0xc3])],
      ['kein JSON', textBytes('{nicht json')],
      ['leer', new Uint8Array(0)],
      ['abgeschnittene Datei', gueltig.slice(0, gueltig.length - 3)],
    ];
    for (const [fall, bytes] of faelle) {
      const vorher = bytesKopie(bytes);
      const e = dateiFehler(() => parsePlanFile(bytes), 'invalidJson', DATEI_MELDUNG.invalidJson);
      expect(e.path, fall).toBeNull();
      expect(bytesKopie(bytes), `${fall}: Bytes unverändert`).toEqual(vorher);
    }
  });

  it('[R-5.6-17] Array, Grundwert, null, format anders oder fehlend → notPlanFile', () => {
    expect(parsePlanFile(jsonBytes(gueltigRoh())).format).toBe('wap-planer-plan');
    const ohneFormat = gueltigRoh();
    delete ohneFormat.format;
    const faelle: [string, unknown][] = [
      ['Array', [gueltigRoh()]],
      ['Zahl', 42],
      ['Text', 'wap-planer-plan'],
      ['null', null],
      ['format anders', { ...gueltigRoh(), format: 'wap-planer-stand' }],
      ['format fehlt', ohneFormat],
      [
        'format nicht als eigener Schlüssel',
        JSON.parse('{"__proto__":{"format":"wap-planer-plan"},"version":1}'),
      ],
    ];
    for (const [fall, wert] of faelle) {
      const e = dateiFehler(
        () => parsePlanFile(jsonBytes(wert)),
        'notPlanFile',
        DATEI_MELDUNG.notPlanFile,
      );
      expect(e.path, fall).toBeNull();
    }
  });

  it('[R-5.6-17] version 0, 1,5, «1», fehlt → corrupt mit Pfad version; mit BOM gültig', () => {
    const mitBom = Uint8Array.from([0xef, 0xbb, 0xbf, ...jsonBytes(gueltigRoh())]);
    const gelesen = parsePlanFile(mitBom);
    expect(gelesen.planId).toBe(A);
    expect(gelesen.version).toBe(1);
    for (const v of [0, 1.5, '1', -1, null]) {
      const roh = gueltigRoh();
      roh.version = v;
      erwarteKaputt(jsonBytes(roh), 'version', `version ${JSON.stringify(v)}`);
    }
    const ohne = gueltigRoh();
    delete ohne.version;
    erwarteKaputt(jsonBytes(ohne), 'version', 'version fehlt');
  });
});

describe('Strenge beim Lesen (E2–E6)', () => {
  it('[R-5.6-17] gültige Datei: Plan, Stand und Bytes unverändert gelesen; Teilaufgaben und Kürzelbedeutung bleiben', () => {
    const roh = gueltigRoh();
    const bytes = jsonBytes(roh);
    const vorher = bytesKopie(bytes);
    const d = parsePlanFile(bytes);
    expect(bytesKopie(bytes)).toEqual(vorher);
    expect(d.format).toBe('wap-planer-plan');
    expect(d.version).toBe(1);
    expect(d.planId).toBe(A);
    expect(d.revision).toBe(3);
    expect(d.modifiedAt).toBe('2026-10-01T12:00:00.000Z');
    expect(d.savedAt).toBe('2026-10-02T12:00:00.000Z');
    expect(d.containsInternalNotes).toBe(false);
    gleich(d.plan, roh.plan);
    expect(d.stands).toHaveLength(1);
    const s = vorhanden(d.stands[0]);
    expect(s.standId).toBe('stand-1');
    expect(s.standsSameDay).toBe(1);
    gleich(s.plan, ersterStand(roh).plan);
    const erwartet = dateiStand(planA(), 'stand-1').pdfs;
    expect([...s.pdfs.keys()]).toEqual([...erwartet.keys()]);
    for (const [k, b] of erwartet) {
      expect(s.pdfs.get(k)).toBeInstanceOf(Uint8Array);
      gleicheBytes(s.pdfs.get(k), b);
    }
    expect(d.plan.entries.e101?.type === 'block' && d.plan.entries.e101.subtasks).toEqual([
      { title: [{ text: 'Teil (fiktiv)', bold: false }], ltg: 'Zfhr', ort: '' },
    ]);
    const e111 = d.plan.entries.e111;
    expect(e111 !== undefined && Object.hasOwn(e111, 'subtasks'), 'ohne subtasks bleibt ohne').toBe(
      false,
    );
    expect(d.plan.abbreviationMeanings).toEqual({ DR: 'Dienstrapport (fiktiv)' });
  });

  it('[R-5.6-17] unbekannter Schlüssel in Hülle, Plan, Eintrag, Teilaufgabe, TextRun, Zeitangabe, Stand und PDF-Eintrag → corrupt mit Pfad', () => {
    expect(parsePlanFile(jsonBytes(gueltigRoh())).stands).toHaveLength(1);
    const faelle: [string, (r: Record<string, unknown>) => void, string][] = [
      [
        'Hülle',
        (r) => {
          r.zusatz = 1;
        },
        'zusatz',
      ],
      [
        'Plan',
        (r) => {
          rohPlan(r).zusatz = 'x';
        },
        'plan.zusatz',
      ],
      [
        'Eintrag',
        (r) => {
          rohEintrag(r, 'e102').stufe = 'Zug';
        },
        'plan.entries.e102.stufe',
      ],
      [
        'Teilaufgabe «stufe»',
        (r) => {
          const st = rohEintrag(r, 'e101').subtasks as Record<string, unknown>[];
          if (st[0] !== undefined) st[0].stufe = 'Gruppe (fiktiv)';
        },
        'plan.entries.e101.subtasks[0].stufe',
      ],
      [
        'TextRun',
        (r) => {
          const t = rohEintrag(r, 'e101').title as Record<string, unknown>[];
          if (t[0] !== undefined) t[0].farbe = 'rot';
        },
        'plan.entries.e101.title[0].farbe',
      ],
      [
        'Zeitangabe',
        (r) => {
          (rohEintrag(r, 'e101').time as Record<string, unknown>).zone = 'MEZ';
        },
        'plan.entries.e101.time.zone',
      ],
      [
        'Stand',
        (r) => {
          ersterStand(r).zusatz = true;
        },
        'stands[0].zusatz',
      ],
      [
        'PDF-Eintrag',
        (r) => {
          const p = ersterStand(r).pdfs as Record<string, unknown>[];
          if (p[1] !== undefined) p[1].mime = 'application/pdf';
        },
        'stands[0].pdfs[1].mime',
      ],
      [
        'Woche',
        (r) => {
          const w = rohPlan(r).weeks as Record<string, unknown>[];
          if (w[0] !== undefined) w[0].farbe = 'blau';
        },
        'plan.weeks[0].farbe',
      ],
      [
        'subtasks an einem Beso',
        (r) => {
          rohEintrag(r, 'e102').subtasks = [
            { title: [{ text: 'X', bold: false }], ltg: '', ort: '' },
          ];
        },
        'plan.entries.e102.subtasks',
      ],
    ];
    for (const [fall, aendern, pfad] of faelle) {
      const roh = gueltigRoh();
      aendern(roh);
      erwarteKaputt(jsonBytes(roh), pfad, fall);
    }
  });

  // F-FLAKY (FL-01): keine Zeitanforderung; eine gelesene Datei je Objekt der Fixture, zusammen rund 2 s, unter
  // künstlicher Rechnerlast 8 s (19 Lastthreads) bis 53 s (60) gemessen – Zeitlimit als Schutz vor Hängern statt der
  // Vitest-Vorgabe 5 s; die Lesedauer selbst (rund 1 ms je Datei) ist keine Anforderung dieses Tests.
  it('[R-5.6-17] unbekannter Schlüssel in jedem Objekt der Migrations-Fixture (auch DayConfig, Spalte, Beso-Zeitfenster, Commander) → corrupt mit Pfad auf den Schlüssel, nie still entfernt (TR-E104-04)', () => {
    expect(parsePlanFile(fixtureBytes()).planId).toBe(FIXTURE_PLAN_ID);
    const text = alsText(fixtureBytes());
    const alle: ObjektStelle[] = [];
    einfacheObjekte(JSON.parse(text), '', [], alle);
    // Jedes Objekt von Hülle, Plan, Stand und PDF-Eintrag; im Stand-Schnappschuss (gleiches Schema Plan) je
    // Objektart das erste Objekt, damit die Laufzeit klein bleibt (ADR-010 §4.5). Die Art eines Eintrags und seiner
    // Teilobjekte richtet sich nach dem Eintragstyp (Hinweis Test-Review 2 zu TR-E104-04).
    const basis = JSON.parse(text) as {
      readonly stands: readonly {
        readonly plan: { readonly entries: Record<string, { type?: unknown }> };
      }[];
    };
    const artImStand = (p: string): string | null => {
      const m = /^stands\[(\d+)\]\.plan(?=\.|\[|$)/.exec(p);
      if (m === null) return null;
      const eintraege = basis.stands[Number(m[1])]?.plan.entries ?? {};
      return p
        .replace(/^stands\[\d+\]\./, '')
        .replace(/entries\.(\w+)/g, (_t, id: string) => `entries.<${String(eintraege[id]?.type)}>`)
        .replace(/\[\d+\]/g, '[]');
    };
    const gesehen = new Set<string>();
    const stellen = alle.filter(({ pfad }) => {
      const art = artImStand(pfad);
      if (art === null) return true;
      if (gesehen.has(art)) return false;
      gesehen.add(art);
      return true;
    });
    const pfade = stellen.map((s) => s.pfad);
    // Die Aufzählung erreicht jede Objektart aus E4 (je eine Stichprobe), in Plan und Stand-Schnappschuss.
    const arten: readonly RegExp[] = [
      /^$/,
      /^plan$/,
      /^plan\.commander$/,
      /^plan\.signatureImage$/,
      /^plan\.coatOfArms$/,
      /^plan\.persons\[0\]$/,
      /^plan\.functionList\[0\]$/,
      /^plan\.legend\[0\]$/,
      /^plan\.legend\[0\]\.color$/,
      /^plan\.rapportCodes\[0\]$/,
      /^plan\.markerLabels\[0\]$/,
      /^plan\.columnSets\[0\]$/,
      /^plan\.columnSets\[0\]\.columns\[0\]$/,
      /^plan\.weeks\[0\]$/,
      /^plan\.weeks\[0\]\.days\[0\]$/,
      /^plan\.weeks\[\d+\]\.weekGoals\[0\]$/,
      /^plan\.weeks\[0\]\.sunOverride$/,
      /^plan\.deletedWeeks\[0\]$/,
      /^plan\.deletedWeeks\[0\]\.week$/,
      /^plan\.deletedWeeks\[0\]\.entries\[0\]$/,
      /^plan\.entries\.\w+$/,
      /^plan\.entries\.\w+\.time$/,
      /^plan\.entries\.\w+\.columns$/,
      /^plan\.entries\.\w+\.title\[0\]$/,
      /^plan\.entries\.\w+\.subtasks\[0\]$/,
      /^plan\.entries\.\w+\.windows\[0\]$/,
      /^plan\.entries\.\w+\.windows\[0\]\.time$/,
      /^plan\.entries\.\w+\.displayColumns$/,
      /^plan\.entries\.\w+\.scope$/,
      /^plan\.displayRange$/,
      /^plan\.stand$/,
      /^plan\.printDefaults$/,
      /^plan\.acknowledgedFindings\[0\]$/,
      /^stands\[0\]$/,
      /^stands\[0\]\.pdfs\[0\]$/,
      /^stands\[0\]\.plan$/,
      /^stands\[0\]\.plan\.commander$/,
      /^stands\[0\]\.plan\.weeks\[0\]\.days\[0\]$/,
    ];
    for (const art of arten) {
      expect(
        pfade.some((p) => art.test(p)),
        `Objektart ${art.source} aufgezählt`,
      ).toBe(true);
    }
    for (const { pfad, weg } of stellen) {
      const roh: unknown = JSON.parse(text);
      let ziel = roh;
      for (const s of weg) ziel = (ziel as Record<string | number, unknown>)[s];
      (ziel as Record<string, unknown>).zzUnbekannt = 1;
      erwarteKaputt(
        jsonBytes(roh),
        pfad === '' ? 'zzUnbekannt' : `${pfad}.zzUnbekannt`,
        `zzUnbekannt in ${pfad === '' ? 'der Hülle' : pfad}`,
      );
    }
  }, 120_000);

  it('[R-5.6-17] __proto__, constructor und prototype als Schlüssel der Hülle und des Plans (per JSON.parse) → corrupt', () => {
    const roh = gueltigRoh();
    expect(parsePlanFile(jsonBytes(roh)).planId).toBe(A);
    const faelle: [string, string, string, string][] = [
      ['__proto__ in der Hülle', '{', '"__proto__":{"x":1},', '__proto__'],
      ['constructor in der Hülle', '{', '"constructor":{"x":1},', 'constructor'],
      ['__proto__ im Plan', '"plan":{', '"__proto__":{"motto":"x"},', 'plan.__proto__'],
      ['constructor im Plan', '"plan":{', '"constructor":"x",', 'plan.constructor'],
      ['prototype im Plan', '"plan":{', '"prototype":{},', 'plan.prototype'],
      [
        '__proto__ in einem Eintrag',
        '"e101":{',
        '"__proto__":{"status":"open"},',
        'plan.entries.e101.__proto__',
      ],
    ];
    for (const [fall, nach, einschub, pfad] of faelle) {
      erwarteKaputt(mitRohemSchluessel(roh, nach, einschub), pfad, fall);
    }
    erwarteKaputt(
      mitRohemSchluessel(roh, '"entries":{', '"__proto__":{"id":"__proto__"},'),
      'plan.entries.__proto__',
      '__proto__ als Eintragsschlüssel',
    );
  });

  it('[R-5.6-17] Schlüssel in entries ≠ id, unbekannte Aufzählungswerte, subtasks [], abbreviationMeanings {} → corrupt', () => {
    expect(parsePlanFile(jsonBytes(gueltigRoh())).plan.id).toBe(A);
    const anderenSchluessel = gueltigRoh();
    const entries = rohPlan(anderenSchluessel).entries as Record<string, unknown>;
    entries.e999 = entries.e101;
    delete entries.e101;
    erwarteKaputt(jsonBytes(anderenSchluessel), 'plan.entries.e999.id', 'Schlüssel ≠ id');

    const faelle: [string, (r: Record<string, unknown>) => void, string][] = [
      [
        'status «xyz»',
        (r) => {
          rohEintrag(r, 'e101').status = 'xyz';
        },
        'plan.entries.e101.status',
      ],
      [
        'Spalten-kind «foo»',
        (r) => {
          const sets = rohPlan(r).columnSets as Record<string, unknown>[];
          const cols = (sets[0]?.columns ?? []) as Record<string, unknown>[];
          if (cols[0] !== undefined) cols[0].kind = 'foo';
        },
        'plan.columnSets[0].columns[0].kind',
      ],
      [
        'level «zug»',
        (r) => {
          rohPlan(r).level = 'zug';
        },
        'plan.level',
      ],
      [
        'type unbekannt',
        (r) => {
          rohEintrag(r, 'e131').type = 'notiz';
        },
        'plan.entries.e131.type',
      ],
      [
        'subtasks []',
        (r) => {
          rohEintrag(r, 'e101').subtasks = [];
        },
        'plan.entries.e101.subtasks',
      ],
      [
        'abbreviationMeanings {}',
        (r) => {
          rohPlan(r).abbreviationMeanings = {};
        },
        'plan.abbreviationMeanings',
      ],
      [
        'schemaVersion 2',
        (r) => {
          rohPlan(r).schemaVersion = 2;
        },
        'plan.schemaVersion',
      ],
      [
        'revision −1',
        (r) => {
          r.revision = -1;
        },
        'revision',
      ],
      [
        'modifiedAt ohne Millisekunden',
        (r) => {
          r.modifiedAt = '2026-10-01T12:00:00Z';
        },
        'modifiedAt',
      ],
      [
        'savedAt kein Zeitpunkt',
        (r) => {
          r.savedAt = '2026-02-30T12:00:00.000Z';
        },
        'savedAt',
      ],
      [
        'startDate kein Montag',
        (r) => {
          const w = rohPlan(r).weeks as Record<string, unknown>[];
          if (w[0] !== undefined) w[0].startDate = '2026-09-15';
        },
        'plan.weeks[0].startDate',
      ],
    ];
    for (const [fall, aendern, pfad] of faelle) {
      const roh = gueltigRoh();
      aendern(roh);
      erwarteKaputt(jsonBytes(roh), pfad, fall);
    }
  });

  it('[R-5.6-17] unbekannter Eintragstyp → corrupt mit Pfad auf type, in plan.entries und in einer gelöschten Woche (TR-E104-14)', () => {
    const text = alsText(fixtureBytes());
    expect(parsePlanFile(fixtureBytes()).plan.deletedWeeks[0]?.entries[0]?.type).toBe('dayRemark');
    const geloescht = JSON.parse(text) as Record<string, unknown>;
    const wochen = rohPlan(geloescht).deletedWeeks as Record<string, unknown>[];
    const eintraege = (wochen[0]?.entries ?? []) as Record<string, unknown>[];
    expect(eintraege).toHaveLength(1);
    if (eintraege[0] !== undefined) eintraege[0].type = 'notiz';
    erwarteKaputt(
      jsonBytes(geloescht),
      'plan.deletedWeeks[0].entries[0].type',
      'type unbekannt in gelöschter Woche',
    );
    for (const typ of ['notiz', 'Block', '', 'constructor', '__proto__']) {
      const roh = JSON.parse(text) as Record<string, unknown>;
      rohEintrag(roh, 'e101').type = typ;
      erwarteKaputt(jsonBytes(roh), 'plan.entries.e101.type', `type «${typ}»`);
    }
  });

  it('[R-5.6-17] standsSameDay fehlt, 0, 1,5 → corrupt; 1 und 2 → gelesen und unverändert', () => {
    for (const n of [1, 2]) {
      const roh = gueltigRoh();
      ersterStand(roh).standsSameDay = n;
      expect(parsePlanFile(jsonBytes(roh)).stands[0]?.standsSameDay).toBe(n);
    }
    const ohne = gueltigRoh();
    delete ersterStand(ohne).standsSameDay;
    erwarteKaputt(jsonBytes(ohne), 'stands[0].standsSameDay', 'standsSameDay fehlt');
    for (const n of [0, 1.5, '2', null]) {
      const roh = gueltigRoh();
      ersterStand(roh).standsSameDay = n;
      erwarteKaputt(
        jsonBytes(roh),
        'stands[0].standsSameDay',
        `standsSameDay ${JSON.stringify(n)}`,
      );
    }
  });

  it('[R-5.6-17] Base64 ungültig, standId doppelt, keine PDF, PDF-Schlüssel doppelt → corrupt', () => {
    const gueltig = gueltigRoh();
    expect(parsePlanFile(jsonBytes(gueltig)).stands[0]?.pdfs.size).toBeGreaterThan(1);
    for (const b of ['@@@@', 'QUJD=', 'QU JD', 'QUJD\n', '', 'Q===', '=QUJ']) {
      const roh = gueltigRoh();
      const p = ersterStand(roh).pdfs as Record<string, unknown>[];
      if (p[0] !== undefined) p[0].base64 = b;
      erwarteKaputt(jsonBytes(roh), 'stands[0].pdfs[0].base64', `Base64 ${JSON.stringify(b)}`);
    }
    const doppelt = gueltigRoh();
    const staende = doppelt.stands as unknown[];
    staende.push(jsonKopie(staende[0]));
    erwarteKaputt(jsonBytes(doppelt), 'stands[1].standId', 'standId doppelt');
    const keine = gueltigRoh();
    ersterStand(keine).pdfs = [];
    erwarteKaputt(jsonBytes(keine), 'stands[0].pdfs', 'keine PDF');
    const schluesselDoppelt = gueltigRoh();
    const pdfs = ersterStand(schluesselDoppelt).pdfs as Record<string, unknown>[];
    pdfs.push({ ...(pdfs[0] ?? {}) });
    erwarteKaputt(
      jsonBytes(schluesselDoppelt),
      `stands[0].pdfs[${String(pdfs.length - 1)}].key`,
      'PDF-Schlüssel doppelt',
    );
  });

  it('[R-5.6-17] Zusatzregeln mit exaktem Pfad (Nachtrag F1): displayRange, Wochentage, gelöschte Woche, Zeitform, Spaltensatz, Kürzelbedeutung, Eintragsstruktur', () => {
    expect(parsePlanFile(jsonBytes(gueltigRoh())).plan.displayRange).toEqual(planA().displayRange);
    const wochen = (r: Record<string, unknown>): Record<string, unknown>[] =>
      rohPlan(r).weeks as Record<string, unknown>[];
    const tage = (r: Record<string, unknown>): Record<string, unknown>[] =>
      (wochen(r)[0]?.days ?? []) as Record<string, unknown>[];

    // Spaltensatz: Rap-Spalte an den Anfang; Pfad = Spaltensatz + field des ersten Befunds (Orakel validateColumnSet).
    const satz = jsonKopie(erstes(planA().columnSets));
    const rap = satz.columns.filter((c) => c.kind === 'rap');
    const umgestellt = {
      ...satz,
      columns: [...rap, ...satz.columns.filter((c) => c.kind !== 'rap')],
    };
    const satzBefund = erstes(validateColumnSet(umgestellt), 'Befund des Spaltensatzes');

    // Eintragsstruktur: Querbalken mit fromDate nach toDate (Orakel checkEntryStructure).
    const qb = planA().entries.e141 as Querbalken;
    const qbFalsch: Querbalken = { ...qb, fromDate: '2026-09-23', toDate: '2026-09-19' };
    const qbBefund = erstes(checkEntryStructure(qbFalsch), 'Befund des Querbalkens');

    const faelle: [string, (r: Record<string, unknown>) => void, string][] = [
      [
        'displayRange from = to',
        (r) => {
          rohPlan(r).displayRange = { from: 600, to: 600 };
        },
        'plan.displayRange',
      ],
      [
        'nur 6 Tage',
        (r) => {
          tage(r).pop();
        },
        'plan.weeks[0].days',
      ],
      [
        'erster Tag nicht Mo',
        (r) => {
          const t = tage(r)[0];
          if (t !== undefined) t.weekday = 'Di';
        },
        'plan.weeks[0].days[0].weekday',
      ],
      [
        'gelöschte Woche beginnt nicht am Montag',
        (r) => {
          const w = jsonKopie(wochen(r)[0] ?? {});
          w.startDate = '2026-10-13';
          rohPlan(r).deletedWeeks = [{ week: w, entries: [] }];
        },
        'plan.deletedWeeks[0].week.startDate',
      ],
      [
        'Block mit Zeitform deadline',
        (r) => {
          rohEintrag(r, 'e101').time = { form: 'deadline', to: 600 };
        },
        'plan.entries.e101.time',
      ],
      [
        'Zeitfenster mit leerer Spanne',
        (r) => {
          const w = rohEintrag(r, 'e102').windows as Record<string, unknown>[];
          if (w[0] !== undefined) w[0].time = { form: 'range', from: 600, to: 600 };
        },
        'plan.entries.e102.windows[0].time',
      ],
      [
        'Spaltensatz in falscher Reihenfolge',
        (r) => {
          (rohPlan(r).columnSets as unknown[])[0] = umgestellt;
        },
        `plan.columnSets[0].${satzBefund.field}`,
      ],
      [
        'Kürzel mit Leerraum am Rand',
        (r) => {
          rohPlan(r).abbreviationMeanings = { ' DR': 'Dienstrapport (fiktiv)' };
        },
        'plan.abbreviationMeanings[ DR]',
      ],
      [
        'Querbalken mit fromDate nach toDate',
        (r) => {
          const e = rohEintrag(r, 'e141');
          e.fromDate = qbFalsch.fromDate;
          e.toDate = qbFalsch.toDate;
        },
        `plan.entries.e141.${qbBefund.field}`,
      ],
    ];
    for (const [fall, aendern, pfad] of faelle) {
      const roh = gueltigRoh();
      aendern(roh);
      erwarteKaputt(jsonBytes(roh), pfad, fall);
    }
  });

  it('[R-5.6-17] planId ≠ plan.id und containsInternalNotes falsch → corrupt; containsInternalNotes richtig → gelesen', () => {
    const richtig = gueltigRoh();
    rohEintrag(richtig, 'e101').internalNote = 'Nur intern (fiktiv)';
    richtig.containsInternalNotes = true;
    expect(parsePlanFile(jsonBytes(richtig)).containsInternalNotes).toBe(true);

    const anderePlanId = gueltigRoh();
    anderePlanId.planId = 'p-anders';
    erwarteKaputt(jsonBytes(anderePlanId), 'planId', 'planId ≠ plan.id');
    const falsch = gueltigRoh();
    rohEintrag(falsch, 'e101').internalNote = 'Nur intern (fiktiv)';
    erwarteKaputt(
      jsonBytes(falsch),
      'containsInternalNotes',
      'containsInternalNotes false bei interner Notiz',
    );
    const falschWahr = gueltigRoh();
    falschWahr.containsInternalNotes = true;
    erwarteKaputt(
      jsonBytes(falschWahr),
      'containsInternalNotes',
      'containsInternalNotes true ohne interne Notiz',
    );
  });

  it('[R-5.6-17] Fehler einer Migration beim Lesen → corrupt mit Pfad plan bzw. stands[i].plan und Ursache', () => {
    const roh = gueltigRoh();
    const format = testFormatV2(mottoMigration, false);
    const gelesen = parsePlanFile(jsonBytes(roh), format);
    expect(gelesen.plan.motto).toBe(`${planA().motto} (v2)`);
    rohPlan(roh).motto = `Motto ${KENNWORT}`;
    const e = dateiFehler(() => parsePlanFile(jsonBytes(roh), format), 'corrupt');
    expect(e.path).toBe('plan');
    expect(e.cause).toBeInstanceOf(Error);

    // Der Schnappschuss eines Stands (Plan gültig): Pfad stands[0].plan (F2; TR-E104-13).
    const imStand = gueltigRoh();
    (ersterStand(imStand).plan as Record<string, unknown>).motto = `Motto ${KENNWORT}`;
    const bytes = jsonBytes(imStand);
    const vorher = bytesKopie(bytes);
    const s = dateiFehler(() => parsePlanFile(bytes, format), 'corrupt');
    expect(s.path).toBe('stands[0].plan');
    expect(s.cause).toBeInstanceOf(Error);
    expect(bytesKopie(bytes), 'Bytes unverändert').toEqual(vorher);
  });
});

describe('Vergleich mit dem lokalen Plan (C4, F-21)', () => {
  it('[R-5.6-17] compareWithLocal: noLocal, same, localNewer, localOlder; gleiche Zeit nach Revision; andere Plan-ID → RangeError', () => {
    const plan = planA();
    const datei: PlanFile = planDatei(plan, {
      revision: 5,
      modifiedAt: zeitpunkt('2026-10-05', 12),
    });
    expect(compareWithLocal(datei, null)).toBe('noLocal');
    const lokal = (revision: number, modifiedAt: string) => ({ plan, revision, modifiedAt });
    expect(compareWithLocal(datei, lokal(5, zeitpunkt('2026-10-05', 12)))).toBe('same');
    expect(
      compareWithLocal(datei, lokal(2, zeitpunkt('2026-10-05', 13))),
      'später, tiefere Revision',
    ).toBe('localNewer');
    expect(
      compareWithLocal(datei, lokal(9, zeitpunkt('2026-10-05', 11))),
      'früher, höhere Revision',
    ).toBe('localOlder');
    expect(compareWithLocal(datei, lokal(6, zeitpunkt('2026-10-05', 12)))).toBe('localNewer');
    expect(compareWithLocal(datei, lokal(4, zeitpunkt('2026-10-05', 12)))).toBe('localOlder');
    expect(
      compareWithLocal(datei, lokal(5, '2026-10-05T12:00:00.001Z')),
      'eine Millisekunde später',
    ).toBe('localNewer');
    const e = wurf(() =>
      compareWithLocal(datei, {
        plan: { ...plan, id: 'p-anders' },
        revision: 5,
        modifiedAt: datei.modifiedAt,
      }),
    );
    expect(e).toBeInstanceOf(RangeError);
  });
});

describe('Wappen ohne einbettbare Bilddaten (Notiz E1-02f CR-03)', () => {
  it('[R-5.6-17] Wappen nur aus IHDR: Datei wird gelesen; openFromFile, replaceFromFile und importAsCopy übernehmen coatOfArms unverändert', async () => {
    const wappen = { mime: 'image/png' as const, dataBase64: pngNurIhdr() };
    const plan: Plan = { ...planA(), coatOfArms: wappen };
    const datei = parsePlanFile(jsonBytes(rohDatei(planDatei(plan))));
    expect(datei.plan.coatOfArms).toEqual(wappen);
    const uhr = new TestUhr(zeitpunkt('2026-10-07', 9));

    const s1 = await oeffnen(neueFabrik());
    expect((await s1.openFromFile(datei, uhr)).plan.coatOfArms).toEqual(wappen);
    expect(vorhanden(await s1.load(A)).plan.coatOfArms).toEqual(wappen);

    const s2 = await oeffnen(neueFabrik());
    await s2.create(planA(), uhr);
    expect((await s2.replaceFromFile(A, datei, uhr)).plan.coatOfArms).toEqual(wappen);

    const kopie = await s2.importAsCopy(datei, uhr);
    expect(kopie.plan.coatOfArms).toEqual(wappen);
  });
});
