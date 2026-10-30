// @vitest-environment jsdom
// Teilaufgaben im Modell: Validierung und Fabriken (Vertrag E1-02h Abschnitt 1c, 2a, 2b, 6, 9; Gate S A1;
// R-4.6-63, R-4.6-64; Arbeitsannahmen Q-038, Q-045 (a), (g)). Alle Inhalte fiktiv.
import { describe, expect, it } from 'vitest';
import {
  newBeso,
  newBlock,
  newDayRemark,
  newMarker,
  newMultiDayRemark,
  newQuerbalken,
  newRapport,
} from '../../../../src/model/wap/factories';
import type { Block, Entry, RichText } from '../../../../src/model/wap/types';
import {
  checkEntryStructure,
  type ValidationIssue,
  validateEntry,
} from '../../../../src/model/wap/validate';
import {
  basePlan,
  beso,
  besoInput,
  block,
  blockInput,
  CAT,
  dayRemark,
  dayRemarkInput,
  expectModelError,
  marker,
  markerInput,
  multiDayRemark,
  multiDayRemarkInput,
  querbalken,
  querbalkenInput,
  rapport,
  rapportInput,
  rt,
  withEntries,
} from '../../support/model/builders';
import {
  blockMitTeilaufgaben,
  fahrerRep,
  fsgFz,
  mitFeld,
  teilaufgabe,
  zweiTeilaufgaben,
} from '../../support/model/teilaufgaben';

/** Befunde ohne Meldung (Tests prüfen nur code und field, Vertrag E1-02a §4). */
function befunde(issues: readonly ValidationIssue[]): { code: string; field: string }[] {
  return issues.map((i) => ({ code: i.code, field: i.field }));
}

/** Prüft beide Funktionen aus Abschnitt 2b mit derselben Erwartung (ohne Plan-Bezug). */
function expectBeide(e: Entry, erwartet: { code: string; field: string }[]): void {
  const plan = withEntries(basePlan(), [beso('e9', 9)]);
  expect(befunde(validateEntry(plan, e)), 'validateEntry').toEqual(erwartet);
  expect(befunde(checkEntryStructure(e)), 'checkEntryStructure').toEqual(erwartet);
}

const titel = (field: string) => ({ code: 'missingField', field });

describe('Teilaufgaben eines Blocks – Validierung (R-4.6-63)', () => {
  it('[R-4.6-63] Teilaufgabe mit leerem Titel (leer, nur Leerzeichen, nur U+00A0, nur leere Läufe) → genau missingField subtasks[i].title; Titel nur aus Beso-Verweis gültig; zwei Teilaufgaben mit Fett- und Normallauf, eine ohne Ltg, gültig', () => {
    // G: gültiger Block mit zwei Teilaufgaben (eine mit Ltg und Ort, eine ohne Ltg).
    expectBeide(blockMitTeilaufgaben('e1', 1), []);
    expectBeide(blockMitTeilaufgaben('e1', 1, [fahrerRep()]), []);
    // R: leere Titel nach Trimmen (E1-02a N-3, inkl. U+00A0).
    const leer: readonly RichText[] = [
      [],
      rt(''),
      rt('   '),
      rt('\u00a0\u00a0'),
      rt(' \u00a0\t', true),
      [
        { text: '', bold: true },
        { text: '', bold: false },
      ],
      [
        { text: ' ', bold: true },
        { text: '\u00a0', bold: false },
      ],
    ];
    for (const title of leer) {
      expectBeide(blockMitTeilaufgaben('e1', 1, [fsgFz(), teilaufgabe(title, 'Zfhr')]), [
        titel('subtasks[1].title'),
      ]);
      expectBeide(blockMitTeilaufgaben('e1', 1, [teilaufgabe(title)]), [
        titel('subtasks[0].title'),
      ]);
    }
    // Titel nur aus einem Lauf mit besoRef → gültig.
    expectBeide(
      blockMitTeilaufgaben('e1', 1, [teilaufgabe([{ text: '', bold: false, besoRef: 'e9' }])]),
      [],
    );
  });

  it('[R-4.6-63] Struktur: subtasks [] → emptySubtasks; kein Array → missingField subtasks; Element kein Objekt → subtasks[i]; Titel, Ltg, Ort ungültig → je ein Befund in Feldreihenfolge, nach allen übrigen Befunden des Blocks', () => {
    const roh = (value: unknown, over: Partial<Block> = {}): Block =>
      mitFeld(block('e1', 1, over), 'subtasks', value);
    // G: Feld fehlt oder undefined → kein Befund.
    expectBeide(block('e1', 1), []);
    expectBeide(roh(undefined), []);
    // R:
    expectBeide(roh([]), [{ code: 'emptySubtasks', field: 'subtasks' }]);
    expectBeide(roh('Fsg Fz'), [{ code: 'missingField', field: 'subtasks' }]);
    expectBeide(roh(null), [{ code: 'missingField', field: 'subtasks' }]);
    expectBeide(roh({ 0: fsgFz() }), [{ code: 'missingField', field: 'subtasks' }]);
    expectBeide(roh([null]), [{ code: 'missingField', field: 'subtasks[0]' }]);
    expectBeide(roh([fsgFz(), 'Fsg Fz', fahrerRep(), 7]), [
      { code: 'missingField', field: 'subtasks[1]' },
      { code: 'missingField', field: 'subtasks[3]' },
    ]);
    expectBeide(roh([null, { title: rt(' '), ltg: '', ort: '' }]), [
      { code: 'missingField', field: 'subtasks[0]' },
      titel('subtasks[1].title'),
    ]);
    // Titel kein Array, Lauf kein Objekt, Lauf ohne Text als String.
    expectBeide(roh([{ title: 'Fsg Fz', ltg: '', ort: '' }]), [titel('subtasks[0].title')]);
    expectBeide(roh([{ title: ['Fsg Fz'], ltg: '', ort: '' }]), [titel('subtasks[0].title')]);
    expectBeide(roh([{ title: [{ text: 5, bold: false }], ltg: '', ort: '' }]), [
      titel('subtasks[0].title'),
    ]);
    expectBeide(roh([{ title: [{ text: 'Fsg', bold: true }, null], ltg: '', ort: '' }]), [
      titel('subtasks[0].title'),
    ]);
    // Ltg und Ort keine Strings bzw. fehlend; '' ist gültig.
    expectBeide(roh([{ title: rt('Fsg Fz'), ltg: 3, ort: '' }]), [
      { code: 'missingField', field: 'subtasks[0].ltg' },
    ]);
    expectBeide(roh([{ title: rt('Fsg Fz'), ltg: '' }]), [
      { code: 'missingField', field: 'subtasks[0].ort' },
    ]);
    expectBeide(roh([fsgFz(), { title: rt('Fsg Fz'), ort: null }]), [
      { code: 'missingField', field: 'subtasks[1].ltg' },
      { code: 'missingField', field: 'subtasks[1].ort' },
    ]);
    // Reihenfolge je Element: title, ltg, ort; je Feld höchstens ein Befund.
    expectBeide(roh([{ title: [{ text: 1 }, { text: 2 }], ltg: null, ort: 4 }]), [
      titel('subtasks[0].title'),
      { code: 'missingField', field: 'subtasks[0].ltg' },
      { code: 'missingField', field: 'subtasks[0].ort' },
    ]);
    // Nach allen übrigen Befunden des Blocks (nach secondCategoryId).
    expectBeide(roh([], { categoryId: CAT.kp, secondCategoryId: CAT.kp }), [
      { code: 'sameSecondCategory', field: 'secondCategoryId' },
      { code: 'emptySubtasks', field: 'subtasks' },
    ]);
    expectBeide(roh([teilaufgabe(' ')], { date: '2026-02-30', categoryId: '' }), [
      { code: 'invalidDate', field: 'date' },
      { code: 'missingField', field: 'categoryId' },
      titel('subtasks[0].title'),
    ]);
  });

  it('[R-4.6-63] newBlock: leerer Teilaufgaben-Titel → ModelError invalidEntry (subtasks[0].title), leere Liste → invalidEntry (subtasks); gültige Teilaufgaben bleiben in Reihenfolge erhalten', () => {
    // G: gültige Teilaufgaben übernimmt die Fabrik unverändert.
    const gueltig = newBlock(blockInput({ subtasks: zweiTeilaufgaben() }), 'e1', 1);
    expect(gueltig.subtasks).toEqual(zweiTeilaufgaben());
    expect('subtasks' in newBlock(blockInput(), 'e2', 2)).toBe(false);
    // R:
    expectModelError(() => newBlock(blockInput({ subtasks: [teilaufgabe(' \u00a0 ')] }), 'e1', 1), {
      code: 'invalidEntry',
      field: 'subtasks[0].title',
    });
    expectModelError(() => newBlock(blockInput({ subtasks: [] }), 'e1', 1), {
      code: 'invalidEntry',
      field: 'subtasks',
    });
    expectModelError(
      () => newBlock(blockInput({ subtasks: [fsgFz(), teilaufgabe('')] }), 'e1', 1),
      { code: 'invalidEntry', field: 'subtasks[1].title' },
    );
  });
});

describe('Teilaufgaben nur bei Blöcken (R-4.6-64, Arbeitsannahme Q-038)', () => {
  const andere: readonly Entry[] = [
    querbalken('e2', 2),
    marker('e3', 3),
    rapport('e4', 4),
    beso('e5', 5),
    dayRemark('e6', 6),
    multiDayRemark('e7', 7),
  ];
  const nichtErlaubt = { code: 'subtasksNotAllowed', field: 'subtasks' };

  it('[R-4.6-64] Querbalken, Marker, Rapport, Beso, Ganztägige und Mehrtägige Bemerkung mit subtasks (gültige Teilaufgabe oder []) → genau ein zusätzlicher Befund subtasksNotAllowed am Ende; Block gültig', () => {
    // G: Block mit Teilaufgaben gültig; die übrigen Einträge ohne Feld gültig.
    expectBeide(blockMitTeilaufgaben('e1', 1), []);
    for (const e of andere) expectBeide(e, []);
    // R:
    for (const e of andere) {
      expectBeide(mitFeld(e, 'subtasks', [fsgFz()]), [nichtErlaubt]);
      expectBeide(mitFeld(e, 'subtasks', []), [nichtErlaubt]);
      expectBeide(mitFeld(e, 'subtasks', 'Fsg Fz'), [nichtErlaubt]);
    }
    // Am Ende, nach den übrigen Befunden des Eintrags.
    expectBeide(mitFeld(rapport('e4', 4, { code: ' ' }), 'subtasks', [fsgFz()]), [
      { code: 'missingField', field: 'code' },
      nichtErlaubt,
    ]);
    expectBeide(mitFeld(dayRemark('e6', 6, { date: '' }), 'subtasks', []), [
      { code: 'missingField', field: 'date' },
      nichtErlaubt,
    ]);
  });

  it('[R-4.6-64] Fabriken newQuerbalken … newMultiDayRemark mit subtasks → ModelError invalidEntry (subtasks)', () => {
    const mit = <T extends object>(input: T): T => ({ ...input, subtasks: [fsgFz()] });
    // G: ohne Feld entstehen die Einträge.
    expect(newRapport(rapportInput(), 'e4', 4).type).toBe('rapport');
    // R:
    const faelle: readonly (() => unknown)[] = [
      () => newQuerbalken(mit(querbalkenInput()), 'e2', 2),
      () => newMarker(mit(markerInput()), 'e3', 3),
      () => newRapport(mit(rapportInput()), 'e4', 4),
      () => newBeso(mit(besoInput()), 'e5', 5),
      () => newDayRemark(mit(dayRemarkInput()), 'e6', 6),
      () => newMultiDayRemark(mit(multiDayRemarkInput()), 'e7', 7),
    ];
    for (const fall of faelle) expectModelError(fall, { code: 'invalidEntry', field: 'subtasks' });
  });
});
