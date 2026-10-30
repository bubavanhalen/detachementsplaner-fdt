// @vitest-environment jsdom
// Paket E1-05: «Neuen Stand setzen» als ein Befehl, rein (Vertrag docs/wap-planer/plan/vertraege/E1-05.md, Notiz
// «Ausarbeitung Schritt 2» Abschnitte B, D1, F, G). R-4.6-33 (Markierung «geändert»), R-5.5-03 (Datum und
// Version, F-47; V-05-3), R-5.5-04 (Eingabe unverändert), R-10-30 (gestrichene Einträge entfernt, F-28).
// Prüf-Plan P nach Abschnitt H3; alle Inhalte fiktiv.
import { applyPatches } from 'immer';
import { describe, expect, it } from 'vitest';
import { CommandError, type CommandResult } from '../../../../src/model/wap/commands/command';
import { updateEntry } from '../../../../src/model/wap/commands/entries';
import { resolveTitle } from '../../../../src/model/wap/derive/agenda';
import { WapError } from '../../../../src/model/wap/errors';
import { pdfFileName } from '../../../../src/model/wap/stand/fileName';
import { applyStand, type StandInput } from '../../../../src/model/wap/stand/stand';
import type { Beso, Block, Entry, Plan } from '../../../../src/model/wap/types';
import { fehlerVon, kopie } from '../../support/stand/hilfen';
import {
  bemerkung,
  beso,
  block,
  ctx,
  DATUM,
  marker,
  mitEintraegen,
  pruefPlan,
  querbalken,
  rapport,
  tagesBemerkung,
  wocheId,
} from '../../support/stand/plan';

const P0 = pruefPlan();

function stand(plan: Plan, input: StandInput): CommandResult {
  return applyStand(plan, input, ctx);
}

function eintrag(plan: Plan, id: string): Entry {
  const e = plan.entries[id];
  expect(e, `Eintrag ${id} vorhanden`).toBeDefined();
  return e as Entry;
}

/** Erwarteter CommandError von applyStand mit Code, Feld, entryId null und wörtlicher Meldung; Plan unverändert. */
function erwarteStandFehler(
  plan: Plan,
  input: StandInput,
  code: 'invalidDate' | 'invalidVersion' | 'versionNotIncreasing',
  field: 'date' | 'version',
  meldung: { cause: string; nextStep: string },
): void {
  const vorher = kopie(plan);
  const e = fehlerVon(() => applyStand(plan, input, ctx));
  expect(e).toBeInstanceOf(CommandError);
  expect(e).toBeInstanceOf(WapError);
  const f = e as CommandError<string>;
  expect(f.code).toBe(code);
  expect(f.field).toBe(field);
  expect(f.entryId).toBeNull();
  expect(f.userMessage).toEqual(meldung);
  expect(plan, 'Plan unverändert nach Fehler').toEqual(vorher);
}

const MELDUNG_DATUM = {
  cause: 'Das Datum des Stands ist kein gültiges Kalenderdatum.',
  nextStep: 'Das Datum als dd.mm.yyyy eingeben, z.B. 17.09.2026.',
};
const MELDUNG_VERSION = {
  cause: 'Die Version muss eine ganze Zahl ab 1 sein.',
  nextStep: 'Eine ganze Zahl ab 1 eingeben, z.B. 2.',
};

/** P mit Block A und Beso B «geändert», Marker C nicht (Abschnitt G, R-4.6-33 (1)). */
function planGeaendert(): Plan {
  return mitEintraegen(P0, [
    block(P0, 'e101', DATUM, 'Ausbildung Zug A (fiktiv)', { changed: true }),
    beso(P0, 'e102', DATUM, 'Besprechung Muster (fiktiv)', 40, { changed: true }),
    marker('e103', DATUM, 'AV', '', { changed: false }),
  ]);
}

describe('applyStand: Markierung «geändert» (D1 (c))', () => {
  it('[R-4.6-33] neuer Stand entfernt «geändert» bei Block A und Beso B; Marker C bleibt false; P selbst unverändert', () => {
    const p = planGeaendert();
    const vorher = kopie(p);
    const r = stand(p, { date: DATUM });
    expect(eintrag(r.plan, 'e101').changed).toBe(false);
    expect(eintrag(r.plan, 'e102').changed).toBe(false);
    expect(eintrag(r.plan, 'e103').changed).toBe(false);
    expect(eintrag(p, 'e101').changed, 'A im Eingabeplan weiter «geändert»').toBe(true);
    expect(p).toEqual(vorher);
  });

  it('[R-4.6-33] ohne neuen Stand bleibt «geändert» nach einer Titeländerung (updateEntry) erhalten; erst der Stand entfernt es', () => {
    const p = planGeaendert();
    const geaendert = updateEntry(
      p,
      'e101',
      'block',
      { title: [{ text: 'Ausbildung Zug B (fiktiv)', bold: false }] },
      ctx,
    ).plan;
    expect(eintrag(geaendert, 'e101').changed, 'ohne Stand weiter «geändert»').toBe(true);
    const r = stand(geaendert, { date: DATUM });
    expect(eintrag(r.plan, 'e101').changed).toBe(false);
    expect((eintrag(r.plan, 'e101') as Block).title).toEqual([
      { text: 'Ausbildung Zug B (fiktiv)', bold: false },
    ]);
  });

  it('[R-4.6-33] inverse Patches stellen «geändert» bei A und B wieder her (Undo, E1-04)', () => {
    const p = planGeaendert();
    const r = stand(p, { date: DATUM });
    const zurueck = applyPatches(r.plan, [...r.inversePatches]);
    expect(eintrag(zurueck, 'e101').changed).toBe(true);
    expect(eintrag(zurueck, 'e102').changed).toBe(true);
    expect(zurueck).toEqual(p);
    expect(applyPatches(p, [...r.patches])).toEqual(r.plan);
  });

  it('[R-4.6-33] Block «geändert» mit Kategorie «k-fehlt» (nicht in der Legende) → CommandError invalidEntry, Feld categoryId, entryId = Block; kein Stand, P unverändert', () => {
    const p = mitEintraegen(P0, [
      block(P0, 'e101', DATUM, 'Ausbildung Zug A (fiktiv)', {
        changed: true,
        categoryId: 'k-fehlt',
      }),
    ]);
    const vorher = kopie(p);
    const e = fehlerVon(() => applyStand(p, { date: DATUM }, ctx));
    expect(e).toBeInstanceOf(CommandError);
    const f = e as CommandError<string>;
    expect(f.code).toBe('invalidEntry');
    expect(f.field).toBe('categoryId');
    expect(f.entryId).toBe('e101');
    expect(f.userMessage.cause.trim()).not.toBe('');
    expect(f.userMessage.nextStep.trim()).not.toBe('');
    expect(p).toEqual(vorher);
    expect(p.stand).toBeNull();
  });
});

describe('applyStand: Datum und Version (D1, F-47)', () => {
  it('[R-5.5-03] ohne Stand und ohne Version → stand { date: 2026-09-17, version: 1 }; Bezeichnung «Stand V1 vom 17.09.2026 gesetzt»', () => {
    const r = stand(P0, { date: DATUM });
    expect(r.plan.stand).toEqual({ date: '2026-09-17', version: 1 });
    expect(r.label).toBe('Stand V1 vom 17.09.2026 gesetzt');
    expect(P0.stand).toBeNull();
  });

  it('[R-5.5-03] vorheriger Stand V3 ohne Version → Version 4', () => {
    const p = { ...P0, stand: { date: '2026-09-10', version: 3 } };
    const r = stand(p, { date: DATUM });
    expect(r.plan.stand).toEqual({ date: DATUM, version: 4 });
    expect(r.label).toBe('Stand V4 vom 17.09.2026 gesetzt');
  });

  it('[R-5.5-03] angegebene Version 7 wird übernommen, ohne und mit vorherigem Stand V3; Version 1 ohne Stand zulässig; grösste sichere ganze Zahl zulässig', () => {
    expect(stand(P0, { date: DATUM, version: 7 }).plan.stand).toEqual({ date: DATUM, version: 7 });
    const p3 = { ...P0, stand: { date: '2026-09-10', version: 3 } };
    expect(stand(p3, { date: DATUM, version: 7 }).plan.stand).toEqual({ date: DATUM, version: 7 });
    expect(stand(P0, { date: DATUM, version: 1 }).plan.stand).toEqual({ date: DATUM, version: 1 });
    expect(stand(p3, { date: DATUM, version: 4 }).plan.stand).toEqual({ date: DATUM, version: 4 });
    expect(stand(P0, { date: DATUM, version: Number.MAX_SAFE_INTEGER }).plan.stand?.version).toBe(
      Number.MAX_SAFE_INTEGER,
    );
  });

  it('[R-5.5-03] Bezeichnung mit mehrstelliger Version und Datum «long»: «Stand V12 vom 03.10.2026 gesetzt»', () => {
    expect(stand(P0, { date: '2026-10-03', version: 12 }).label).toBe(
      'Stand V12 vom 03.10.2026 gesetzt',
    );
  });

  it('[R-5.5-03] Stand V3 und Version 3 bzw. 2 → versionNotIncreasing, Feld version, Meldung «… (V3).» / «Version 4 oder höher eingeben.»', () => {
    const p = { ...P0, stand: { date: '2026-09-10', version: 3 } };
    const meldung = {
      cause: 'Die Version muss höher sein als die des letzten Stands (V3).',
      nextStep: 'Version 4 oder höher eingeben.',
    };
    erwarteStandFehler(p, { date: DATUM, version: 3 }, 'versionNotIncreasing', 'version', meldung);
    erwarteStandFehler(p, { date: DATUM, version: 2 }, 'versionNotIncreasing', 'version', meldung);
  });

  it('[R-5.5-03] versionNotIncreasing setzt die Platzhalter als Dezimalzahl ein: Stand V12, Version 5 → «(V12).» / «Version 13 oder höher eingeben.»', () => {
    const p = { ...P0, stand: { date: '2026-09-10', version: 12 } };
    erwarteStandFehler(p, { date: DATUM, version: 5 }, 'versionNotIncreasing', 'version', {
      cause: 'Die Version muss höher sein als die des letzten Stands (V12).',
      nextStep: 'Version 13 oder höher eingeben.',
    });
  });

  it('[R-5.5-03] Version 0, −1, 1.5, NaN, Infinity, 2^53 → invalidVersion, Feld version (auch bei vorherigem Stand V3)', () => {
    const p3 = { ...P0, stand: { date: '2026-09-10', version: 3 } };
    for (const version of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53]) {
      erwarteStandFehler(
        P0,
        { date: DATUM, version },
        'invalidVersion',
        'version',
        MELDUNG_VERSION,
      );
      erwarteStandFehler(
        p3,
        { date: DATUM, version },
        'invalidVersion',
        'version',
        MELDUNG_VERSION,
      );
    }
  });

  it('[R-5.5-03] Datum «2026-02-30», «17.09.2026», «» → invalidDate, Feld date; ungültiges Datum und ungültige Version zugleich → invalidDate', () => {
    for (const date of ['2026-02-30', '17.09.2026', '']) {
      erwarteStandFehler(P0, { date }, 'invalidDate', 'date', MELDUNG_DATUM);
    }
    erwarteStandFehler(
      P0,
      { date: '2026-02-30', version: 0 },
      'invalidDate',
      'date',
      MELDUNG_DATUM,
    );
    const p3 = { ...P0, stand: { date: '2026-09-10', version: 3 } };
    erwarteStandFehler(p3, { date: '', version: 2 }, 'invalidDate', 'date', MELDUNG_DATUM);
  });

  it('[R-5.5-03] (V-05-3) Datum frei wählbar: Stand V2 vom 2026-09-10 nach Stand V1 vom 2026-09-17 wird gesetzt', () => {
    const p1 = stand(P0, { date: DATUM }).plan;
    const r = stand(p1, { date: '2026-09-10', version: 2 });
    expect(r.plan.stand).toEqual({ date: '2026-09-10', version: 2 });
    expect(r.label).toBe('Stand V2 vom 10.09.2026 gesetzt');
  });

  it('[R-5.5-03] der Stand gilt für alle Wochen: pdfFileName(result.plan, Woche, 1) enthält für jede Woche von P «_Stand_2026-09-17»', () => {
    const r = stand(P0, { date: DATUM });
    expect(r.plan.weeks.map((w) => w.shortName)).toEqual(['KVK', 'Wo1', 'Wo2', 'Wo3']);
    for (const w of r.plan.weeks) {
      expect(pdfFileName(r.plan, { kind: 'week', weekId: w.id }, 1)).toContain('_Stand_2026-09-17');
    }
  });

  it('[R-5.5-03] sonst ändert sich nichts: nextId, nextSeq, Beso-Nummern und numberFixed, acknowledgedFindings, Woche und Legende bleiben', () => {
    const p = mitEintraegen(
      P0,
      [
        beso(P0, 'e110', DATUM, 'Besprechung Alpha (fiktiv)', 41, { numberFixed: true }),
        beso(P0, 'e111', DATUM, 'Besprechung Beta (fiktiv)', 43, { numberFixed: false }),
        beso(P0, 'e112', DATUM, 'Besprechung Gamma (fiktiv)', 40, { status: 'cancelled' }),
      ],
      { acknowledgedFindings: [{ key: 'P1:e110', reason: 'bewusst (fiktiv)', at: '2026-09-16' }] },
    );
    const r = stand(p, { date: DATUM });
    expect(r.plan.nextId).toBe(p.nextId);
    expect(r.plan.nextSeq).toBe(p.nextSeq);
    expect(r.plan.acknowledgedFindings).toEqual(p.acknowledgedFindings);
    expect(r.plan.weeks).toEqual(p.weeks);
    expect(r.plan.legend).toEqual(p.legend);
    expect(r.plan.deletedWeeks).toEqual(p.deletedWeeks);
    const b0 = eintrag(r.plan, 'e110') as Beso;
    const b1 = eintrag(r.plan, 'e111') as Beso;
    expect([b0.besoNumber, b0.numberFixed]).toEqual([41, true]);
    expect([b1.besoNumber, b1.numberFixed]).toEqual([43, false]);
    expect(b0).toEqual(p.entries.e110);
    expect(b1).toEqual(p.entries.e111);
  });

  it('[R-5.5-03] die Funktion wirft synchron und liefert das Ergebnis synchron (kein Promise)', () => {
    const r = stand(P0, { date: DATUM });
    expect(r).not.toBeInstanceOf(Promise);
    expect(r.plan.stand).toEqual({ date: DATUM, version: 1 });
  });
});

describe('applyStand: eingefrorene Fassung (R-5.5-04)', () => {
  it('[R-5.5-04] applyStand verändert die Eingabe nicht (strukturell gleich vorher/nachher), auch bei gestrichenen und geänderten Einträgen und im Fehlerfall', () => {
    const p = mitEintraegen(P0, [
      block(P0, 'e101', DATUM, 'Ausbildung Zug A (fiktiv)', { changed: true }),
      block(P0, 'e102', DATUM, 'Abgesagte Übung (fiktiv)', { status: 'cancelled', changed: true }),
      beso(P0, 'e103', DATUM, 'Besprechung Muster (fiktiv)', 42, { changed: true }),
    ]);
    const vorher = kopie(p);
    const r = stand(p, { date: DATUM });
    expect(p).toEqual(vorher);
    expect(r.plan).not.toEqual(p);
    fehlerVon(() => applyStand(p, { date: DATUM, version: 0 }, ctx));
    expect(p).toEqual(vorher);
  });
});

describe('applyStand: gestrichene Einträge (D1 (b), F-28)', () => {
  const kvk = wocheId(P0, 'KVK');
  /** Je ein gestrichener und ein bestätigter Eintrag aller sieben Typen, dazu ein offener Block. */
  function planAlleTypen(): Plan {
    const morgen = '2026-09-18';
    return mitEintraegen(
      P0,
      [
        block(P0, 'e201', DATUM, 'Abgesagte Übung X (fiktiv)', { status: 'cancelled' }),
        block(P0, 'e202', DATUM, 'Schiessen Y (fiktiv)'),
        block(P0, 'e203', DATUM, 'Offene Planung Z (fiktiv)', { status: 'open' }),
        querbalken('e211', DATUM, morgen, 'Gestrichener Querbalken (fiktiv)', {
          status: 'cancelled',
        }),
        querbalken('e212', DATUM, morgen, 'Querbalken Bestätigt (fiktiv)'),
        marker('e221', DATUM, 'HV', '', { status: 'cancelled' }),
        marker('e222', DATUM, 'custom', 'Frei (fiktiv)'),
        rapport(P0, 'e231', DATUM, 'KR', { status: 'cancelled' }),
        rapport(P0, 'e232', DATUM, 'DR'),
        beso(P0, 'e241', DATUM, 'Gestrichene Besprechung (fiktiv)', 40, { status: 'cancelled' }),
        beso(P0, 'e242', DATUM, 'Besprechung Bestätigt (fiktiv)', 42),
        tagesBemerkung('e251', DATUM, 'Gestrichene Tagesbemerkung (fiktiv)', {
          status: 'cancelled',
        }),
        tagesBemerkung('e252', DATUM, 'Tagesbemerkung Bestätigt (fiktiv)'),
        bemerkung('e261', { kind: 'week', weekId: kvk }, 'Gestrichene Bemerkung (fiktiv)', {
          status: 'cancelled',
        }),
        bemerkung('e262', { kind: 'range', fromDate: DATUM, toDate: morgen }, 'Bemerkung (fiktiv)'),
      ],
      {
        deletedWeeks: [
          {
            week: { ...P0.weeks[3], id: 'w900', startDate: '2026-10-12' } as Plan['weeks'][number],
            entries: [
              block(P0, 'e901', '2026-10-13', 'Gestrichen in gelöschter Woche (fiktiv)', {
                status: 'cancelled',
              }),
            ],
          },
        ],
      },
    );
  }

  it('[R-10-30] entfernt genau die gestrichenen Einträge aller sieben Typen; bestätigte und offene bleiben unverändert', () => {
    const p = planAlleTypen();
    const r = stand(p, { date: DATUM });
    expect(Object.keys(r.plan.entries).sort()).toEqual(
      ['e202', 'e203', 'e212', 'e222', 'e232', 'e242', 'e252', 'e262'].sort(),
    );
    for (const id of ['e202', 'e203', 'e212', 'e222', 'e232', 'e242', 'e252', 'e262']) {
      expect(r.plan.entries[id], id).toEqual(p.entries[id]);
    }
  });

  it('[R-10-30] gestrichener Eintrag mit «geändert» wird ebenfalls entfernt', () => {
    const p = mitEintraegen(P0, [
      block(P0, 'e201', DATUM, 'Abgesagte Übung X (fiktiv)', {
        status: 'cancelled',
        changed: true,
      }),
    ]);
    const r = stand(p, { date: DATUM });
    expect(r.plan.entries.e201).toBeUndefined();
  });

  it('[R-10-30] deletedWeeks bleibt unverändert, auch mit gestrichenem Eintrag darin', () => {
    const p = planAlleTypen();
    const r = stand(p, { date: DATUM });
    expect(r.plan.deletedWeeks).toEqual(p.deletedWeeks);
    expect(r.plan.deletedWeeks[0]?.entries.map((e) => e.id)).toEqual(['e901']);
  });

  it('[R-10-30] inverse Patches stellen die entfernten Einträge wieder her; Patches führen hin', () => {
    const p = planAlleTypen();
    const r = stand(p, { date: DATUM });
    expect(applyPatches(r.plan, [...r.inversePatches])).toEqual(p);
    expect(applyPatches(p, [...r.patches])).toEqual(r.plan);
  });

  it('[R-10-30] (V-03-5) ein Titelverweis auf einen entfernten Beso bleibt als Verweis stehen und zeigt «(–)»', () => {
    const p = mitEintraegen(P0, [
      beso(P0, 'e241', DATUM, 'Gestrichene Besprechung (fiktiv)', 40, { status: 'cancelled' }),
      block(P0, 'e202', DATUM, '', {
        title: [
          { text: 'Vorbereitung ', bold: false },
          { text: '', bold: false, besoRef: 'e241' },
        ],
      }),
    ]);
    const r = stand(p, { date: DATUM });
    expect(r.plan.entries.e241).toBeUndefined();
    const b = eintrag(r.plan, 'e202') as Block;
    expect(b.title).toEqual((p.entries.e202 as Block).title);
    expect(
      resolveTitle(r.plan, b.title)
        .map((x) => x.text)
        .join(''),
    ).toBe('Vorbereitung (–)');
  });
});
