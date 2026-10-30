// @vitest-environment jsdom
// Paket E1-05: Dateiname und PDF-Titel nach Konvention, rein (Vertrag docs/wap-planer/plan/vertraege/E1-05.md,
// Notiz «Ausarbeitung Schritt 2» Abschnitte B, D2, D3, F, G). R-6-10 (Muster, Beilage-Teil F-24, Entwurf V-05-1,
// Namensteile V-05-2, sanitizeNamePart, fileNamePrefix), R-6-11 (Gesamt-PDF «Plan»), R-6-12 (Zusatz _V‹Version›,
// standsSameDayFor), R-10-46 (Datum yyyy-mm-dd, Verweis auf R-6-10). Prüf-Plan P nach Abschnitt H3; fiktiv.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ModelError } from '../../../../src/model/wap/errors';
import {
  fileNamePrefix,
  type PdfTarget,
  pdfFileName,
  sanitizeNamePart,
  standsSameDayFor,
} from '../../../../src/model/wap/stand/fileName';
import type { Plan } from '../../../../src/model/wap/types';
import { fehlerVon, kopie } from '../../support/stand/hilfen';
import { DATUM, pruefPlan, wocheId } from '../../support/stand/plan';

/** Geschütztes Leerzeichen U+00A0 (Leerraum nach s). */
const NBSP = String.fromCodePoint(0xa0);
const P0 = pruefPlan();
/** P mit Stand V1 vom 2026-09-17. */
const P1: Plan = { ...P0, stand: { date: DATUM, version: 1 } };
const WO1: PdfTarget = { kind: 'week', weekId: wocheId(P0, 'Wo1') };
const KVK: PdfTarget = { kind: 'week', weekId: wocheId(P0, 'KVK') };
const PLAN: PdfTarget = { kind: 'plan' };

function mitStand(plan: Plan, version: number, date = DATUM): Plan {
  return { ...plan, stand: { date, version } };
}

function mitKurzname(plan: Plan, kurzname: string): Plan {
  return {
    ...plan,
    weeks: plan.weeks.map((w) => (w.shortName === 'Wo1' ? { ...w, shortName: kurzname } : w)),
  };
}

describe('pdfFileName: Muster und Beilage-Teil (D2, F-24)', () => {
  it('[R-6-10] P, Woche «Wo1», Stand V1 vom 2026-09-17, n 1 → «01_02_WAP_FDT_2026_Wo1_Stand_2026-09-17.pdf»', () => {
    expect(pdfFileName(P1, WO1, 1)).toBe('01_02_WAP_FDT_2026_Wo1_Stand_2026-09-17.pdf');
    expect(pdfFileName(P1, KVK, 1)).toBe('01_02_WAP_FDT_2026_KVK_Stand_2026-09-17.pdf');
  });

  it('[R-6-10][R-10-46] Datumsteil yyyy-mm-dd mit führenden Nullen: Stand vom 2026-10-05 → «…_Stand_2026-10-05.pdf»', () => {
    const name = pdfFileName(mitStand(P0, 1, '2026-10-05'), WO1, 1);
    expect(name).toBe('01_02_WAP_FDT_2026_Wo1_Stand_2026-10-05.pdf');
    expect(name).not.toContain('05.10.2026');
  });

  it('[R-6-10] Beilage «01-02 zum Allgemeinen Befehl (fiktiv)» → Anfang «01_02_»', () => {
    const p = { ...P1, beilage: '01-02 zum Allgemeinen Befehl (fiktiv)' };
    expect(pdfFileName(p, WO1, 1)).toBe('01_02_WAP_FDT_2026_Wo1_Stand_2026-09-17.pdf');
  });

  it('[R-6-10] Beilage-Teil = erste Fundstelle Ziffern mit Bindestrichen: «Beilage 3 zu 01-02» → «3_…»; «Beilage 01-02-03» → «01_02_03_…»; «Beilage 7- (fiktiv)» → «7_…»', () => {
    expect(pdfFileName({ ...P1, beilage: 'Beilage 3 zu 01-02' }, WO1, 1)).toBe(
      '3_WAP_FDT_2026_Wo1_Stand_2026-09-17.pdf',
    );
    expect(pdfFileName({ ...P1, beilage: 'Beilage 01-02-03' }, WO1, 1)).toBe(
      '01_02_03_WAP_FDT_2026_Wo1_Stand_2026-09-17.pdf',
    );
    expect(pdfFileName({ ...P1, beilage: 'Beilage 7- (fiktiv)' }, WO1, 1)).toBe(
      '7_WAP_FDT_2026_Wo1_Stand_2026-09-17.pdf',
    );
  });

  it('[R-6-10] Beilage «» und «ohne Nummer» → Beilage-Teil entfällt: «WAP_FDT_2026_Wo1_Stand_2026-09-17.pdf»', () => {
    for (const beilage of ['', 'ohne Nummer']) {
      expect(pdfFileName({ ...P1, beilage }, WO1, 1)).toBe('WAP_FDT_2026_Wo1_Stand_2026-09-17.pdf');
    }
  });

  it('[R-6-10] (V-05-1) ohne Stand, n 1 und n 3 → «01_02_WAP_FDT_2026_Wo1_Entwurf.pdf» (ohne Datum)', () => {
    expect(pdfFileName(P0, WO1, 1)).toBe('01_02_WAP_FDT_2026_Wo1_Entwurf.pdf');
    expect(pdfFileName(P0, WO1, 3)).toBe('01_02_WAP_FDT_2026_Wo1_Entwurf.pdf');
  });

  it('[R-6-10] unbekannte weekId → ModelError unknownWeek, Feld weekId (mit und ohne Stand)', () => {
    for (const p of [P0, P1]) {
      const e = fehlerVon(() => pdfFileName(p, { kind: 'week', weekId: 'w-fehlt' }, 1));
      expect(e).toBeInstanceOf(ModelError);
      const f = e as ModelError;
      expect(f.code).toBe('unknownWeek');
      expect(f.field).toBe('weekId');
      expect(f.userMessage).toEqual({
        cause: 'Die Woche ist im Plan nicht vorhanden.',
        nextStep: 'Eine vorhandene Woche wählen.',
      });
    }
  });

  it('[R-6-10] n 0, 1.5, −1, NaN, Infinity, 2^53 → RangeError (Programmfehler), auch ohne Stand, für das Gesamt-PDF und vor unbekannter Woche', () => {
    for (const n of [0, 1.5, -1, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53]) {
      for (const [p, ziel] of [
        [P1, WO1],
        [P0, WO1],
        [P1, PLAN],
      ] as const) {
        const e = fehlerVon(() => pdfFileName(p, ziel, n));
        expect(e, `n = ${String(n)}`).toBeInstanceOf(RangeError);
        expect(e).not.toBeInstanceOf(ModelError);
      }
    }
    // Vorrang (TR-E105-06): ungültiges n vor unbekannter Woche.
    const e = fehlerVon(() => pdfFileName(P1, { kind: 'week', weekId: 'w-fehlt' }, 0));
    expect(e).toBeInstanceOf(RangeError);
    expect(e).not.toBeInstanceOf(ModelError);
  });

  it('[R-6-10] ungültiges Stand-Datum → ModelError invalidDate', () => {
    const e = fehlerVon(() => pdfFileName(mitStand(P0, 1, '2026-02-30'), WO1, 1));
    expect(e).toBeInstanceOf(ModelError);
    expect((e as ModelError).code).toBe('invalidDate');
  });

  it('[R-6-10] rein: der Plan bleibt unverändert', () => {
    const vorher = kopie(P1);
    pdfFileName(P1, WO1, 2);
    expect(P1).toEqual(vorher);
  });
});

describe('pdfFileName: Namensteile bereinigt (V-05-2, D2 «N»)', () => {
  it('[R-6-10] (V-05-2) Dienst « FDT  2026 » und «FDT/2026» → «FDT_2026»', () => {
    for (const service of [' FDT  2026 ', 'FDT/2026']) {
      expect(pdfFileName({ ...P1, service }, WO1, 1)).toBe(
        '01_02_WAP_FDT_2026_Wo1_Stand_2026-09-17.pdf',
      );
    }
  });

  it('[R-6-10] (V-05-2) Dienst «A_ :B» → «A_B»', () => {
    expect(pdfFileName({ ...P1, service: 'A_ :B' }, WO1, 1)).toBe(
      '01_02_WAP_A_B_Wo1_Stand_2026-09-17.pdf',
    );
  });

  it('[R-6-10] (V-05-2) Dienst «   » → Teil entfällt: «01_02_WAP_Wo1_Stand_2026-09-17.pdf»', () => {
    expect(pdfFileName({ ...P1, service: '   ' }, WO1, 1)).toBe(
      '01_02_WAP_Wo1_Stand_2026-09-17.pdf',
    );
  });

  it('[R-6-10] (V-05-2) Kurzname «Wo 1» → «Wo_1»; «?» → Teil entfällt', () => {
    expect(pdfFileName(mitKurzname(P1, 'Wo 1'), WO1, 1)).toBe(
      '01_02_WAP_FDT_2026_Wo_1_Stand_2026-09-17.pdf',
    );
    expect(pdfFileName(mitKurzname(P1, '?'), WO1, 1)).toBe(
      '01_02_WAP_FDT_2026_Stand_2026-09-17.pdf',
    );
  });

  it('[R-6-10] (V-05-2) Umlaute, «-» und «.» bleiben: Dienst «Übung-Süd 2026» → «Übung-Süd_2026»', () => {
    expect(pdfFileName({ ...P1, service: 'Übung-Süd 2026' }, WO1, 1)).toBe(
      '01_02_WAP_Übung-Süd_2026_Wo1_Stand_2026-09-17.pdf',
    );
    expect(pdfFileName(mitKurzname(P1, 'Wo.1-b'), WO1, 1)).toBe(
      '01_02_WAP_FDT_2026_Wo.1-b_Stand_2026-09-17.pdf',
    );
  });
});

describe('sanitizeNamePart und fileNamePrefix (D2, V04)', () => {
  it('[R-6-10] (V-05-2) sanitizeNamePart: « FDT  2026 » → «FDT_2026»; «A_ :B» → «A_B»; «__x__» → «x»; «Wo», Tabulator, «1» → «Wo_1»; «<>» → «»; «Übung-Süd.2026» unverändert', () => {
    expect(sanitizeNamePart(' FDT  2026 ')).toBe('FDT_2026');
    expect(sanitizeNamePart('A_ :B')).toBe('A_B');
    expect(sanitizeNamePart('__x__')).toBe('x');
    expect(sanitizeNamePart('Wo\u00091')).toBe('Wo_1');
    expect(sanitizeNamePart('<>')).toBe('');
    expect(sanitizeNamePart('Übung-Süd.2026')).toBe('Übung-Süd.2026');
  });

  it('[R-6-10] (V-05-2) sanitizeNamePart: jedes der Zeichen \\ / : * ? " < > | wird zu Leerraum und damit «_»', () => {
    const bs = String.fromCodePoint(0x5c);
    expect(sanitizeNamePart(`a${bs}b/c:d*e?f"g<h>i|j`)).toBe('a_b_c_d_e_f_g_h_i_j');
    expect(sanitizeNamePart(`Wo${bs}1`)).toBe('Wo_1');
    expect(sanitizeNamePart('|FDT|')).toBe('FDT');
  });

  it('[R-6-10] (V-05-2) sanitizeNamePart: Steuerzeichen U+0000–U+001F und U+007F werden zu «_», Leerraum wie U+00A0 ebenso', () => {
    expect(sanitizeNamePart('x\u0000y\u001Fz\u007Fw')).toBe('x_y_z_w');
    expect(sanitizeNamePart('Wo\n1\r')).toBe('Wo_1');
    expect(sanitizeNamePart(`a${NBSP}b`)).toBe('a_b');
    expect(sanitizeNamePart('')).toBe('');
    expect(sanitizeNamePart('_ _ _')).toBe('');
  });

  it('[R-6-10] (V-05-2) sanitizeNamePart ist idempotent; das Ergebnis enthält kein unzulässiges Zeichen, keinen Leerraum, kein «__» und kein «_» am Rand (fester Startwert)', () => {
    const steuer = [0x00, 0x09, 0x0a, 0x1f, 0x7f, 0xa0].map((c) => String.fromCodePoint(c));
    const liste = `${String.fromCodePoint(0x5c)}/:*?"<>|`;
    const zeichen = fc.constantFrom(...`aZ09äÜ-._ ${liste}`, ...steuer);
    /** Unzulässig im Ergebnis: Zeichen der Liste, Steuerzeichen U+0000–U+001F und U+007F. */
    const unzulaessig = (x: string): boolean => {
      const c = x.codePointAt(0) ?? 0;
      return liste.includes(x) || c <= 0x1f || c === 0x7f;
    };
    fc.assert(
      fc.property(
        fc.array(zeichen, { maxLength: 24 }).map((z) => z.join('')),
        (s) => {
          const n = sanitizeNamePart(s);
          expect(sanitizeNamePart(n)).toBe(n);
          expect([...n].filter(unzulaessig)).toEqual([]);
          expect(n).not.toMatch(/\s/u);
          expect(n).not.toContain('__');
          expect(n.startsWith('_')).toBe(false);
          expect(n.endsWith('_')).toBe(false);
        },
      ),
      { seed: 20260917, numRuns: 300 },
    );
  });

  it('[R-6-10] fileNamePrefix: P → «01_02_WAP_FDT_2026»; Beilage «» → «WAP_FDT_2026»; Dienst «   » → «01_02_WAP»; beides leer → «WAP»', () => {
    expect(fileNamePrefix(P0)).toBe('01_02_WAP_FDT_2026');
    expect(fileNamePrefix({ ...P0, beilage: '' })).toBe('WAP_FDT_2026');
    expect(fileNamePrefix({ ...P0, service: '   ' })).toBe('01_02_WAP');
    expect(fileNamePrefix({ ...P0, beilage: '', service: '' })).toBe('WAP');
    expect(fileNamePrefix({ ...P0, service: 'FDT/2026' })).toBe('01_02_WAP_FDT_2026');
  });

  it('[R-6-10] für jedes Ziel beginnt pdfFileName mit fileNamePrefix(plan) und «_» (mit und ohne Stand, Beilage leer, Dienst leer)', () => {
    const plaene = [P0, P1, { ...P1, beilage: '' }, { ...P1, service: '   ' }, mitStand(P0, 4)];
    const ziele: PdfTarget[] = [
      ...P0.weeks.map((w) => ({ kind: 'week' as const, weekId: w.id })),
      PLAN,
    ];
    for (const p of plaene) {
      for (const ziel of ziele) {
        for (const n of [1, 2]) {
          expect(pdfFileName(p, ziel, n).startsWith(`${fileNamePrefix(p)}_`)).toBe(true);
        }
      }
    }
  });
});

describe('pdfFileName: Gesamt-PDF (R-6-11)', () => {
  it('[R-6-11] Gesamt-PDF hat den Kurznamen «Plan»: «01_02_WAP_FDT_2026_Plan_Stand_2026-09-17.pdf»', () => {
    expect(pdfFileName(P1, PLAN, 1)).toBe('01_02_WAP_FDT_2026_Plan_Stand_2026-09-17.pdf');
  });

  it('[R-6-11] (V-05-1) Gesamt-PDF ohne Stand → «01_02_WAP_FDT_2026_Plan_Entwurf.pdf»', () => {
    expect(pdfFileName(P0, PLAN, 1)).toBe('01_02_WAP_FDT_2026_Plan_Entwurf.pdf');
  });

  it('[R-6-11] Gesamt-PDF, n 2, Version 4 → «01_02_WAP_FDT_2026_Plan_Stand_2026-09-17_V4.pdf»', () => {
    expect(pdfFileName(mitStand(P0, 4), PLAN, 2)).toBe(
      '01_02_WAP_FDT_2026_Plan_Stand_2026-09-17_V4.pdf',
    );
  });
});

describe('pdfFileName: mehrere Stände am selben Tag (R-6-12, F-24 b)', () => {
  it('[R-6-12] n 2, Version 4 → «…_Wo1_Stand_2026-09-17_V4.pdf»', () => {
    expect(pdfFileName(mitStand(P0, 4), WO1, 2)).toBe(
      '01_02_WAP_FDT_2026_Wo1_Stand_2026-09-17_V4.pdf',
    );
  });

  it('[R-6-12] n 1 → ohne «_V» (auch bei Version 4)', () => {
    const name = pdfFileName(mitStand(P0, 4), WO1, 1);
    expect(name).toBe('01_02_WAP_FDT_2026_Wo1_Stand_2026-09-17.pdf');
    expect(name).not.toContain('_V');
  });

  it('[R-6-12] die Zahl ist die Versionsnummer, nicht n: n 5, Version 9 → «_V9»; n 2, Version 1 → «_V1»; n 3, Version 12 → «_V12»', () => {
    expect(pdfFileName(mitStand(P0, 9), WO1, 5)).toBe(
      '01_02_WAP_FDT_2026_Wo1_Stand_2026-09-17_V9.pdf',
    );
    expect(pdfFileName(mitStand(P0, 1), WO1, 2)).toBe(
      '01_02_WAP_FDT_2026_Wo1_Stand_2026-09-17_V1.pdf',
    );
    expect(pdfFileName(mitStand(P0, 12), PLAN, 3)).toBe(
      '01_02_WAP_FDT_2026_Plan_Stand_2026-09-17_V12.pdf',
    );
  });
});

describe('standsSameDayFor (D3)', () => {
  it('[R-6-12] leer → 1', () => {
    expect(standsSameDayFor([], DATUM)).toBe(1);
  });

  it('[R-6-12] zwei verschiedene standId am Datum → 3', () => {
    expect(
      standsSameDayFor(
        [
          { standId: 'a', date: DATUM },
          { standId: 'b', date: DATUM },
        ],
        DATUM,
      ),
    ).toBe(3);
  });

  it('[R-6-12] dieselbe standId zweimal → 2', () => {
    expect(
      standsSameDayFor(
        [
          { standId: 'a', date: DATUM },
          { standId: 'a', date: DATUM },
        ],
        DATUM,
      ),
    ).toBe(2);
  });

  it('[R-6-12] anderes Datum zählt nicht; Reihenfolge egal', () => {
    const r = [
      { standId: 'x', date: '2026-09-16' },
      { standId: 'a', date: DATUM },
      { standId: 'y', date: '2026-09-18' },
      { standId: 'b', date: DATUM },
      { standId: 'a', date: DATUM },
    ];
    expect(standsSameDayFor(r, DATUM)).toBe(3);
    expect(standsSameDayFor([...r].reverse(), DATUM)).toBe(3);
    expect(standsSameDayFor(r, '2026-09-19')).toBe(1);
    expect(standsSameDayFor(r, '2026-09-16')).toBe(2);
  });
});
