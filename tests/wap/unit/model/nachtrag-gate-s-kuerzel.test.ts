// @vitest-environment jsdom
// Kürzelliste nach Gate S: Tn und Tenue nur mit «drucken» (Q-023), Teilaufgaben zählen (Vertrag E1-02h
// Abschnitt 3a, 9; R-4.7-18, R-4.7-19; Arbeitsannahmen V-02h-5 / Q-046 und Q-045 (c)). Alle Inhalte fiktiv.
import { describe, expect, it } from 'vitest';
import { abbreviationsForWeek } from '../../../../src/model/wap/derive/abbreviations';
import type { Entry, Plan, Week } from '../../../../src/model/wap/types';
import {
  basePlan,
  beso,
  block,
  days,
  KVK_SETS,
  rapport,
  rt,
  week,
  withEntries,
} from '../../support/model/builders';
import { blockMitTeilaufgaben, teilaufgabe } from '../../support/model/teilaufgaben';

/** Plan mit dem gewählten Kürzel «Ukft» (R-4.7-14) und den Einträgen; Woche w26 ab 28.09.2026. */
function planUkft(entries: readonly Entry[], over: Partial<Plan> = {}): Plan {
  return withEntries(basePlan({ abbreviationsSelected: ['Ukft'], ...over }), entries);
}

/** Enthält die Kürzelliste von w26 «Ukft»? */
function ukftInW26(entries: readonly Entry[], over: Partial<Plan> = {}): boolean {
  return abbreviationsForWeek(planUkft(entries, over), 'w26').includes('Ukft');
}

describe('Kürzelliste: Tn und Tenue nur mit «drucken» (R-4.7-18, Q-023)', () => {
  it('[R-4.7-18] gewähltes Kürzel nur in Tn bzw. Tenue eines Blocks: Häkchen «drucken» aus → nicht in der Liste, an → in der Liste; übrige Felder unverändert (V-02h-5)', () => {
    // G (V-02h-5, unverändert): Tpt des Blocks, Tn und Ort eines Rapports, Beso mit Freitext.
    expect(ukftInW26([block('e1', 1, { tpt: 'Ukft' })])).toBe(true);
    expect(ukftInW26([rapport('e1', 1, { tn: 'Zfhr Ukft' })])).toBe(true);
    expect(ukftInW26([rapport('e1', 1, { ort: 'Ukft Nord' })])).toBe(true);
    expect(
      ukftInW26([beso('e1', 1, { title: rt('Bezug Ukft'), agendaOverride: 'Kontrl Fz' })]),
    ).toBe(true);
    expect(ukftInW26([beso('e1', 1, { title: rt('Kontrl'), agendaOverride: 'Bezug Ukft' })])).toBe(
      true,
    );
    // G: mit Häkchen zählen Tn und Tenue.
    expect(ukftInW26([block('e1', 1, { tn: 'Zfhr Ukft', printTn: true })])).toBe(true);
    expect(ukftInW26([block('e1', 1, { tenue: 'Ukft Tenue', printTenue: true })])).toBe(true);
    // R: ohne Häkchen zählen Tn und Tenue nicht.
    expect(ukftInW26([block('e1', 1, { tn: 'Zfhr Ukft', printTn: false })])).toBe(false);
    expect(ukftInW26([block('e1', 1, { tenue: 'Ukft Tenue', printTenue: false })])).toBe(false);
    // Häkchen beim jeweils anderen Feld genügt nicht.
    expect(ukftInW26([block('e1', 1, { tn: 'Ukft', printTn: false, printTenue: true })])).toBe(
      false,
    );
    expect(ukftInW26([block('e1', 1, { tenue: 'Ukft', printTn: true, printTenue: false })])).toBe(
      false,
    );
    // Planvorgabe ersetzt das Häkchen des Eintrags nicht.
    expect(
      ukftInW26([block('e1', 1, { tn: 'Ukft', printTn: false })], {
        printDefaults: { printTn: true, printTenue: true },
      }),
    ).toBe(false);
  });

  it('[R-4.7-18] Titel zählt, interne Notiz nie; Titel eines Blocks an einem ausgeblendeten Tag zählt (Q-045 (c)); Rapportkürzel jedes Status; Tn ohne Häkchen auch an Rapport-Tag nicht', () => {
    // G:
    expect(ukftInW26([block('e1', 1, { title: rt('Bezug Ukft', true) })])).toBe(true);
    expect(ukftInW26([block('e1', 1, { internalNote: 'Ukft prüfen' })])).toBe(false);
    const [mo, di, mi, dO, fr, sa, so] = days(KVK_SETS);
    const ausgeblendet: Week['days'] = [{ ...mo, display: 'hidden' }, di, mi, dO, fr, sa, so];
    const mitAusgeblendetemMontag = {
      weeks: [
        week('w26', '2026-09-28', { days: ausgeblendet }),
        week('w27', '2026-10-05'),
        week('w28', '2026-10-12'),
      ],
    };
    expect(
      ukftInW26(
        [block('e1', 1, { date: '2026-09-28', title: rt('Bezug Ukft') })],
        mitAusgeblendetemMontag,
      ),
    ).toBe(true);
    const plan = planUkft([
      rapport('e1', 1, { code: 'KR', status: 'cancelled' }),
      rapport('e2', 2, { code: 'DR', status: 'open' }),
      rapport('e3', 3, { code: 'AR1', status: 'confirmed' }),
    ]);
    expect(abbreviationsForWeek(plan, 'w26')).toEqual(['AR1', 'DR', 'KR']);
    // R: ausgeblendeter Tag ändert die Häkchen-Regel nicht; Tn ohne Häkchen neben Rapport.
    expect(
      ukftInW26(
        [block('e1', 1, { date: '2026-09-28', tenue: 'Ukft', printTenue: false })],
        mitAusgeblendetemMontag,
      ),
    ).toBe(false);
    expect(
      abbreviationsForWeek(
        planUkft([
          rapport('e1', 1, { code: 'KR' }),
          block('e2', 2, { date: '2026-09-29', tn: 'Zfhr Ukft', printTn: false }),
        ]),
        'w26',
      ),
    ).toEqual(['KR']);
  });
});

describe('Kürzelliste: Teilaufgaben zählen (R-4.7-19)', () => {
  it('[R-4.7-19] gewähltes Kürzel nur im Titel, nur in der Ltg bzw. nur im Ort einer Teilaufgabe → in der Liste der Woche des Blocks; nicht in einer anderen Woche; nur als ganzes Wort', () => {
    const imTitel = blockMitTeilaufgaben('e1', 1, [
      teilaufgabe('Fsg Fz', 'Zfhr'),
      teilaufgabe([
        { text: 'Fahrer Rep', bold: true },
        { text: ' anschl Vs Ukft', bold: false },
      ]),
    ]);
    const inLtg = blockMitTeilaufgaben('e1', 1, [teilaufgabe('Fsg Fz', 'Four Ukft')]);
    const imOrt = blockMitTeilaufgaben('e1', 1, [teilaufgabe('Fsg Fz', '', 'Ukft Halle 3')]);
    // G: nicht in einer anderen Woche; Ganzwort-Regel («Ukftx» zählt nicht).
    for (const b of [imTitel, inLtg, imOrt]) {
      expect(abbreviationsForWeek(planUkft([b]), 'w27')).toEqual([]);
    }
    expect(
      ukftInW26([blockMitTeilaufgaben('e1', 1, [teilaufgabe('Ukftx', 'UkftRep', 'xUkft')])]),
    ).toBe(false);
    // R:
    expect(abbreviationsForWeek(planUkft([imTitel]), 'w26')).toEqual(['Ukft']);
    expect(abbreviationsForWeek(planUkft([inLtg]), 'w26')).toEqual(['Ukft']);
    expect(abbreviationsForWeek(planUkft([imOrt]), 'w26')).toEqual(['Ukft']);
    // Block in der zweiten Woche: nur dort.
    const spaeter = blockMitTeilaufgaben('e1', 1, [teilaufgabe('Fsg Fz', '', 'Ukft')], {
      date: '2026-10-06',
    });
    expect(abbreviationsForWeek(planUkft([spaeter]), 'w27')).toEqual(['Ukft']);
    expect(abbreviationsForWeek(planUkft([spaeter]), 'w26')).toEqual([]);
  });
});
