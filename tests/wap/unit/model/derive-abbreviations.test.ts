// @vitest-environment jsdom
// Kürzelliste einer Woche (Vertrag E1-02a Abschnitt 3 derive/abbreviations.ts, 8 P-11; Beschrieb 4.7).
import { describe, expect, it } from 'vitest';
import { abbreviationsForWeek } from '../../../../src/model/wap/derive/abbreviations';
import {
  basePlan,
  beso,
  block,
  dayRemark,
  expectModelError,
  rapport,
  rt,
  withEntries,
} from '../../support/model/builders';

describe('abbreviationsForWeek', () => {
  const entries = [
    rapport('e1', 1, { date: '2026-09-29', code: 'KR' }),
    rapport('e2', 2, { date: '2026-09-29', code: 'DR' }),
    rapport('e3', 3, { date: '2026-09-28', code: 'BR 0' }),
    rapport('e4', 4, { date: '2026-10-01', code: 'KR' }),
    rapport('e5', 5, { date: '2026-10-06', code: 'ARK' }),
    block('e6', 6, { date: '2026-09-28', title: rt('Bezug Ukft', true) }),
    block('e7', 7, { date: '2026-09-29', title: rt('ERK Spl'), ort: 'Spl/Ukft' }),
    block('e8', 8, { date: '2026-09-29', title: rt('AVOR') }),
  ];

  it('[R-4.7-14] Liste enthält die Rapportkürzel der Woche ohne Doppel; allgemeine Armeeabkürzungen im Titel erscheinen nicht', () => {
    const plan = withEntries(basePlan(), entries);
    expect(abbreviationsForWeek(plan, 'w26')).toEqual(['BR 0', 'DR', 'KR']);
    expect(abbreviationsForWeek(plan, 'w27')).toEqual(['ARK']);
    expect(abbreviationsForWeek(plan, 'w28')).toEqual([]);
  });

  it('[R-4.7-14] vom Bearbeiter gewählte Kürzel erscheinen, wenn sie in der Woche vorkommen', () => {
    const plan = withEntries(basePlan({ abbreviationsSelected: ['Ukft', 'AVOR', 'Fsg'] }), entries);
    expect(abbreviationsForWeek(plan, 'w26')).toEqual(['AVOR', 'BR 0', 'DR', 'KR', 'Ukft']);
    expect(abbreviationsForWeek(plan, 'w27')).toEqual(['ARK']);
  });

  it('[R-4.7-14] gewählte Kürzel nur als ganzes Wort mit Gross-/Kleinschreibung', () => {
    const plan = withEntries(basePlan({ abbreviationsSelected: ['Spl', 'Mun'] }), [
      block('e1', 1, { title: rt('Splitterschutz'), ltg: 'mun Of' }),
      block('e2', 2, { title: rt('Mun-Fsg') }),
    ]);
    expect(abbreviationsForWeek(plan, 'w26')).toEqual(['Mun']);
  });

  it('[R-4.7-14][R-4.7-18] gedruckte Felder zählen (Zusatz, Ltg, Tpt, Ort, Beso, Bemerkung; Tn/Tenue nur mit «drucken»); interne Notiz und entfernter Importtext nie', () => {
    const selected = [
      'Zus',
      'LtgK',
      'TnK',
      'TptK',
      'OrtK',
      'TenK',
      'BesoK',
      'BemK',
      'NotK',
      'ImpK',
    ];
    const plan = withEntries(basePlan({ abbreviationsSelected: selected }), [
      block('e1', 1, {
        supplement: 'mit Zus',
        ltg: 'LtgK',
        tn: 'TnK',
        tpt: 'TptK',
        ort: 'OrtK',
        tenue: 'TenK',
        printTn: false,
        printTenue: false,
        internalNote: 'NotK',
        removedText: ['ImpK'],
      }),
      beso('e2', 2, { title: rt('Fsg BesoK') }),
      dayRemark('e3', 3, { date: '2026-10-02', text: 'Hinweis BemK.' }),
    ]);
    expect(abbreviationsForWeek(plan, 'w26')).toEqual(
      ['BemK', 'BesoK', 'LtgK', 'OrtK', 'TptK', 'Zus'].sort(
        new Intl.Collator('de-CH', { numeric: true }).compare,
      ),
    );
  });

  it('[R-4.7-14] Rapporte jedes Status zählen; ein Kürzel aus Rapport und Auswahl erscheint einmal', () => {
    const plan = withEntries(basePlan({ abbreviationsSelected: ['KR'] }), [
      rapport('e1', 1, { code: 'KR', status: 'cancelled' }),
      rapport('e2', 2, { code: 'DR', status: 'open' }),
      block('e3', 3, { title: rt('Vs KR') }),
    ]);
    expect(abbreviationsForWeek(plan, 'w26')).toEqual(['DR', 'KR']);
  });

  it('[R-4.7-14] (V-02a-3) Sortierung alphabetisch mit Zahlenfolge (AR2 vor AR10)', () => {
    const plan = withEntries(basePlan(), [
      rapport('e1', 1, { code: 'AR10' }),
      rapport('e2', 2, { code: 'BR 0' }),
      rapport('e3', 3, { code: 'AR2' }),
      rapport('e4', 4, { code: 'ARK' }),
    ]);
    expect(abbreviationsForWeek(plan, 'w26')).toEqual(['AR2', 'AR10', 'ARK', 'BR 0']);
  });

  it('[R-4.7-14] unbekannte Woche → unknownWeek', () => {
    expectModelError(() => abbreviationsForWeek(basePlan(), 'w99'), { code: 'unknownWeek' });
  });
});
