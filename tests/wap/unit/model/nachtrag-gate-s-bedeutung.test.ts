// @vitest-environment jsdom
// Kürzelbedeutung: Kp-Vorlage mit Bedeutungen, Planfeld vor Vorlage, Prüfung des Planfelds (Vertrag E1-02h
// Abschnitt 1b, 1c K-6 bis K-8, 2c, 3b, 5, 9; V-02e-4; R-4.7-20, R-4.7-21; Arbeitsannahmen Q-045 (d), (h)).
// Werte der Kp-Vorlage nur nach der Arbeitsannahme R-4.7-20 (keine Werte aus der Referenz); übrige fiktiv.
import { describe, expect, it } from 'vitest';
import {
  abbreviationMeaning,
  abbreviationsForWeek,
} from '../../../../src/model/wap/derive/abbreviations';
import { createPlanFromTemplate } from '../../../../src/model/wap/factories';
import { kpTemplate, type LevelTemplate } from '../../../../src/model/wap/template';
import type { TemplateRapportCode } from '../../../../src/model/wap/template/types';
import type { Plan } from '../../../../src/model/wap/types';
import {
  type ValidationIssue,
  validateAbbreviationMeanings,
} from '../../../../src/model/wap/validate';
import { basePlan, rapport, roundTrip, withEntries } from '../../support/model/builders';

/** Eigene, fiktive Vorlage mit diesen Rapportkürzeln (übrige Felder wie die Kp-Vorlage). */
function eigeneVorlage(codes: readonly TemplateRapportCode[]): LevelTemplate {
  return { ...kpTemplate(), id: 'eigene', rapportCodes: codes };
}

/** Vorlage mit «DR» = «Dienstrapport Vorlage» und «KR» ohne Bedeutung (fiktiv). */
function vorlageDr(): LevelTemplate {
  return eigeneVorlage([
    { code: 'KR', categoryName: 'Ltg Kp' },
    { code: 'DR', categoryName: 'Ltg Kp', meaning: 'Dienstrapport Vorlage' },
  ]);
}

/** Plan mit Planfeld `abbreviationMeanings` als Laufzeitwert (auch ungültige Werte). */
function planMitBedeutungen(value: unknown): Plan {
  return { ...basePlan(), abbreviationMeanings: value } as unknown as Plan;
}

function befunde(issues: readonly ValidationIssue[]): { code: string; field: string }[] {
  return issues.map((i) => ({ code: i.code, field: i.field }));
}

const feld = (field: string) => ({ code: 'invalidAbbreviationMeanings', field });

describe('Kp-Vorlage mit Bedeutungen (R-4.7-20, Arbeitsannahme Q-045 (d))', () => {
  it('[R-4.7-20] neuer Kp-Plan: DR «Dienstrapport», AR1 «Arbeitsrapport 1», AR2 «Arbeitsrapport 2»; KR, ARK, BR 0–3 nach Gate B 28.10.2026 Nr 39 (KR 29.10.2026)', () => {
    const kp = kpTemplate();
    const plan = createPlanFromTemplate(kp, {
      planId: 'plan-test-bedeutung',
      startDate: '2026-09-28',
      weekCount: 2,
    });
    // G: die Fabrik kopiert keine Bedeutungen in den Plan (K-7, V-02h-3).
    expect('abbreviationMeanings' in plan).toBe(false);
    // R:
    const erwartet: Readonly<Record<string, string>> = {
      KR: 'Kompanierapport',
      DR: 'Dienstrapport',
      AR1: 'Arbeitsrapport 1',
      AR2: 'Arbeitsrapport 2',
      ARK: 'Ausbildungsrapport Kompanie',
      'BR 0': 'Bataillonsrapport KVK',
      'BR 1': 'Bataillonsrapport Wo 1',
      'BR 2': 'Bataillonsrapport Wo 2',
      'BR 3': 'Bataillonsrapport Wo 3',
    };
    const ist = Object.fromEntries(
      Object.keys(erwartet).map((code) => [code, abbreviationMeaning(plan, code, kpTemplate())]),
    );
    expect(ist).toEqual(erwartet);
  });

  it("[R-4.7-20] Vorlage ohne meaning, mit meaning '' oder nur Leerraum → '' ohne Fehler; Kürzel, das in der Vorlage fehlt → ''; Vorlagenwert getrimmt", () => {
    const vorlage = eigeneVorlage([
      { code: 'XR', categoryName: 'Ltg Kp' },
      { code: 'YR', categoryName: 'Ltg Kp', meaning: '' },
      { code: 'ZR', categoryName: 'Ltg Kp', meaning: '  \u00a0 ' },
      { code: 'WR', categoryName: 'Ltg Bat', meaning: '\u00a0Wochenrapport  Bat ' },
    ]);
    const plan = basePlan();
    expect(abbreviationMeaning(plan, 'XR', vorlage)).toBe('');
    expect(abbreviationMeaning(plan, 'YR', vorlage)).toBe('');
    expect(abbreviationMeaning(plan, 'ZR', vorlage)).toBe('');
    expect(abbreviationMeaning(plan, 'QR', vorlage)).toBe('');
    expect(abbreviationMeaning(plan, '', vorlage)).toBe('');
    expect(abbreviationMeaning(plan, 'WR', vorlage)).toBe('Wochenrapport  Bat');
    // Kürzel zeichengleich (Gross-/Kleinschreibung zählt).
    expect(abbreviationMeaning(plan, 'wr', vorlage)).toBe('');
    // Vorlage mit leerer Kürzelliste.
    expect(abbreviationMeaning(plan, 'DR', eigeneVorlage([]))).toBe('');
    // (TR-E102h-04) Doppeltes Kürzel in der Vorlage: das erste Element gilt (§3b Nr 2).
    const doppelt = eigeneVorlage([
      { code: 'XR', categoryName: 'Ltg Kp', meaning: 'Erste' },
      { code: 'XR', categoryName: 'Ltg Bat', meaning: 'Zweite' },
      { code: 'VR', categoryName: 'Ltg Kp' },
      { code: 'VR', categoryName: 'Ltg Kp', meaning: 'Zweite' },
    ]);
    expect(abbreviationMeaning(plan, 'XR', doppelt)).toBe('Erste');
    expect(abbreviationMeaning(plan, 'VR', doppelt)).toBe('');
  });
});

describe('Planfeld vor Vorlage (R-4.7-21, Arbeitsannahme Q-045 (h))', () => {
  it('[R-4.7-21] Planfeld fehlt → Vorlage; Planfeld gesetzt → dieser Text getrimmt, in jeder Woche gleich; gewähltes Kürzel ohne Vorlagen-Bedeutung → Planfeld; leerer Planwert → Vorlage; Prototyp-Schlüssel nie', () => {
    const vorlage = vorlageDr();
    // Planfeld fehlt → Vorlage.
    expect(abbreviationMeaning(basePlan(), 'DR', vorlage)).toBe('Dienstrapport Vorlage');
    expect(abbreviationMeaning(basePlan(), 'KR', vorlage)).toBe('');
    // Planfeld für DR → dieser Text (getrimmt, Leerraum inkl. U+00A0; innen bleibt er).
    const mitDr = withEntries(
      basePlan({
        abbreviationsSelected: ['Ukft'],
        abbreviationMeanings: { DR: ' \u00a0Dienstrapport  Kp\u00a0 ', Ukft: 'Unterkunft' },
      }),
      [
        rapport('e1', 1, { date: '2026-09-29', code: 'DR' }),
        rapport('e2', 2, { date: '2026-10-06', code: 'DR' }),
      ],
    );
    expect(abbreviationsForWeek(mitDr, 'w26')).toContain('DR');
    expect(abbreviationsForWeek(mitDr, 'w27')).toContain('DR');
    expect(abbreviationMeaning(mitDr, 'DR', vorlage)).toBe('Dienstrapport  Kp');
    expect(abbreviationMeaning(mitDr, 'DR', vorlage)).toBe(
      abbreviationMeaning(roundTrip(mitDr), 'DR', vorlage),
    );
    // Gewähltes Kürzel ohne Vorlagen-Bedeutung (fiktiv «Ukft» → «Unterkunft»).
    expect(abbreviationMeaning(mitDr, 'Ukft', vorlage)).toBe('Unterkunft');
    // Planfeld für KR (Vorlage ohne Bedeutung) → Planfeld.
    expect(
      abbreviationMeaning(
        basePlan({ abbreviationMeanings: { KR: 'Kaderrapport' } }),
        'KR',
        vorlage,
      ),
    ).toBe('Kaderrapport');
    // Planwert '' bzw. nur Leerraum → Vorlage.
    expect(abbreviationMeaning(basePlan({ abbreviationMeanings: { DR: '' } }), 'DR', vorlage)).toBe(
      'Dienstrapport Vorlage',
    );
    expect(
      abbreviationMeaning(basePlan({ abbreviationMeanings: { DR: ' \u00a0 ' } }), 'DR', vorlage),
    ).toBe('Dienstrapport Vorlage');
    // Planfeld nur für ein anderes Kürzel → Vorlage; Gross-/Kleinschreibung zählt.
    expect(
      abbreviationMeaning(basePlan({ abbreviationMeanings: { dr: 'klein' } }), 'DR', vorlage),
    ).toBe('Dienstrapport Vorlage');
    // Schlüssel nur über den Prototyp → nie als Planwert.
    expect(abbreviationMeaning(mitDr, 'toString', vorlage)).toBe('');
    expect(abbreviationMeaning(mitDr, 'constructor', vorlage)).toBe('');
    expect(abbreviationMeaning(basePlan(), 'hasOwnProperty', vorlage)).toBe('');
    // (TR-E102h-03) Geerbter Schlüssel (nur über den Prototyp) zählt nicht (Object.hasOwn) → Vorlage.
    expect(
      abbreviationMeaning(planMitBedeutungen(Object.create({ DR: 'geerbt' })), 'DR', vorlage),
    ).toBe('Dienstrapport Vorlage');
    expect(
      abbreviationMeaning(planMitBedeutungen(Object.create({ KR: 'geerbt' })), 'KR', vorlage),
    ).toBe('');
    // Ungültige Laufzeitwerte: wirft nie, Vorlage gilt.
    expect(abbreviationMeaning(planMitBedeutungen({ DR: 5 }), 'DR', vorlage)).toBe(
      'Dienstrapport Vorlage',
    );
    expect(abbreviationMeaning(planMitBedeutungen(null), 'DR', vorlage)).toBe(
      'Dienstrapport Vorlage',
    );
    expect(abbreviationMeaning(planMitBedeutungen('DR'), 'DR', vorlage)).toBe(
      'Dienstrapport Vorlage',
    );
  });

  it('[R-4.7-21] validateAbbreviationMeanings: fehlt oder gültig → []; {}, null, Array, String, fremder Prototyp → ein Befund abbreviationMeanings; Schlüssel leer, mit Randleerraum, Prototyp-Name oder Wert kein String → je ein Befund in Schlüsselreihenfolge; Leerwerte gültig', () => {
    // Feld fehlt bzw. gültig → [].
    expect(validateAbbreviationMeanings(basePlan())).toEqual([]);
    expect(
      validateAbbreviationMeanings(
        basePlan({ abbreviationMeanings: { DR: 'Dienstrapport Kp', Ukft: 'Unterkunft' } }),
      ),
    ).toEqual([]);
    expect(validateAbbreviationMeanings(planMitBedeutungen(undefined))).toEqual([]);
    // G-Fälle (bindet E1-04 und E1-14, K-6): Leerwerte und Leerraum im Innern des Schlüssels.
    expect(validateAbbreviationMeanings(basePlan({ abbreviationMeanings: { DR: '' } }))).toEqual(
      [],
    );
    expect(validateAbbreviationMeanings(basePlan({ abbreviationMeanings: { DR: '  ' } }))).toEqual(
      [],
    );
    expect(
      validateAbbreviationMeanings(basePlan({ abbreviationMeanings: { 'BR 0': 'x' } })),
    ).toEqual([]);
    const ohnePrototyp = Object.assign(Object.create(null) as Record<string, string>, {
      DR: 'Dienstrapport Kp',
    });
    expect(validateAbbreviationMeanings(planMitBedeutungen(ohnePrototyp))).toEqual([]);
    // Ganzes Feld ungültig → genau ein Befund.
    // (TR-E102h-02) Fremder Prototyp auch mit gültigem eigenem Schlüssel.
    const fremderPrototyp = Object.assign(Object.create({ geerbt: 'x' }) as object, {
      DR: 'Dienstrapport Kp',
    });
    for (const wert of [{}, null, [], ['DR'], 'DR', 5, new Map([['DR', 'x']]), fremderPrototyp]) {
      const issues = validateAbbreviationMeanings(planMitBedeutungen(wert));
      expect(befunde(issues)).toEqual([feld('abbreviationMeanings')]);
      expect(issues[0]?.message.cause.trim()).not.toBe('');
      expect(issues[0]?.message.nextStep.trim()).not.toBe('');
    }
    // Schlüssel und Werte: je höchstens ein Befund, in der Reihenfolge von Object.keys.
    const roh = JSON.parse(
      '{"": "a", " DR": "b", "__proto__": "c", "AR1": 5, "KR": "Kaderrapport", "constructor": "d", "prototype": "e", "  ": "f", "DR ": "g", "ARK": null, "\\u00a0BR 1": "h", "BR 2": ""}',
    ) as unknown;
    expect(befunde(validateAbbreviationMeanings(planMitBedeutungen(roh)))).toEqual([
      feld('abbreviationMeanings[]'),
      feld('abbreviationMeanings[ DR]'),
      feld('abbreviationMeanings[__proto__]'),
      feld('abbreviationMeanings[AR1]'),
      feld('abbreviationMeanings[constructor]'),
      feld('abbreviationMeanings[prototype]'),
      feld('abbreviationMeanings[  ]'),
      feld('abbreviationMeanings[DR ]'),
      feld('abbreviationMeanings[ARK]'),
      feld('abbreviationMeanings[\u00a0BR 1]'),
    ]);
    // Leerer Schlüssel mit ungültigem Wert: ein Befund für den Schlüssel.
    expect(befunde(validateAbbreviationMeanings(planMitBedeutungen({ '': 7 })))).toEqual([
      feld('abbreviationMeanings[]'),
    ]);
  });

  it('[R-4.7-21] Rundreise über JSON: Plan mit abbreviationMeanings strukturell gleich, schemaVersion 1, Bedeutung danach gleich', () => {
    const vorlage = vorlageDr();
    const plan = basePlan({
      abbreviationsSelected: ['Ukft'],
      abbreviationMeanings: { DR: 'Dienstrapport Kp', Ukft: 'Unterkunft' },
    });
    const geladen = roundTrip(plan);
    // G:
    expect(geladen).toStrictEqual(plan);
    expect(geladen.schemaVersion).toBe(1);
    expect(geladen.abbreviationMeanings).toEqual({ DR: 'Dienstrapport Kp', Ukft: 'Unterkunft' });
    // R:
    expect(validateAbbreviationMeanings(geladen)).toEqual([]);
    for (const code of ['DR', 'KR', 'Ukft', 'AR1']) {
      expect(abbreviationMeaning(geladen, code, vorlage)).toBe(
        abbreviationMeaning(plan, code, vorlage),
      );
    }
    expect(abbreviationMeaning(geladen, 'DR', vorlage)).toBe('Dienstrapport Kp');
    // Plan ohne Feld bleibt ohne Feld.
    expect('abbreviationMeanings' in roundTrip(basePlan())).toBe(false);
  });
});
