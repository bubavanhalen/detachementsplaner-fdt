// @vitest-environment jsdom
// I4 (E1-08): Zerlegung des Formtexts und der Terminzeilen (Beschrieb 8.2 Regel 12, 4.8; Gate S A1;
// Q-044 (a)–(c), Q-045 (g)). Fiktive Texte; Personen pseudonymisiert.
import { describe, expect, it } from 'vitest';
import { parseAgendaLine, parseShapeText } from '../../../../src/io/wap-import/index';
import type { ShapeTextRun } from '../../../../src/io/xlsx-drawing/index';
import { block, bold, emptyWeek, normal } from '../../fixtures/import/kp-workbook';
import { blocks, importWeeks, titleOf } from './support';

type Line = readonly { text: string; bold?: boolean; strike?: boolean; color?: string }[];

/** Läufe wie readShapeRuns: eine Zeile je Eintrag, leere Zeilen ohne Lauf. */
function runs(lines: readonly Line[]): ShapeTextRun[] {
  const out: ShapeTextRun[] = [];
  lines.forEach((l, line) => {
    for (const r of l)
      out.push({
        paragraph: line,
        line,
        text: r.text,
        bold: r.bold ?? false,
        strike: r.strike ?? false,
        color: r.color ?? null,
        sizePt: 8,
      });
  });
  return out;
}

const ctx = {
  persons: [{ id: 'r1', grad: 'Hptm', name: 'Beispiel', vorname: 'Anna', funktion: 'Kp Kdt' }],
  functionList: [
    { code: 'Einh Fw', categoryId: null, singleFunction: true },
    { code: 'Kp Kdt', categoryId: null, singleFunction: true },
    { code: 'Zfhr', categoryId: null, singleFunction: false },
  ],
  ltgInBlock: 'withOrt' as const,
};

describe('Regel 12: Formtext', () => {
  it('[R-8.2-29] fette erste Zeile wird Titel, Fett-Teile bleiben («AVOR Fahne»)', () => {
    const p = parseShapeText(
      runs([[{ text: 'AVOR', bold: true }, { text: ' Fahne' }], [{ text: 'Vorbereitung' }]]),
      ctx,
    );
    expect(p.title).toEqual([
      { text: 'AVOR', bold: true },
      { text: ' Fahne', bold: false },
    ]);
    expect(p.supplement).toBe('Vorbereitung');
  });

  it('[R-8.2-30] «(Ukft)» → Ort; «Kontrl Fsg (Beispiel)» mit Person «Beispiel» → Ltg', () => {
    const ort = parseShapeText(runs([[{ text: 'MiE', bold: true }, { text: ' (Ukft)' }]]), ctx);
    expect(ort.ort).toBe('Ukft');
    expect(ort.ltg).toBe('');
    const ltg = parseShapeText(
      runs([[{ text: 'Kontrl Fsg', bold: true }, { text: ' (Beispiel)' }]]),
      ctx,
    );
    expect(ltg.ltg).toBe('Beispiel');
    expect(ltg.ort).toBe('');
    expect(
      ltg.title
        .map((r) => r.text)
        .join('')
        .trim(),
    ).toBe('Kontrl Fsg');
  });

  it('[R-8.2-31] Kp «Einh Fw (Ukft)» → Ltg «Einh Fw», Ort «Ukft»; «Ltg: …» → Ltg', () => {
    const p = parseShapeText(
      runs([[{ text: 'Einrichten', bold: true }], [{ text: 'Einh Fw (Ukft)' }]]),
      ctx,
    );
    expect(p.ltg).toBe('Einh Fw');
    expect(p.ort).toBe('Ukft');
    const q = parseShapeText(
      runs([[{ text: 'Schiessen', bold: true }], [{ text: 'Ltg: Zfhr' }]]),
      ctx,
    );
    expect(q.ltg).toBe('Zfhr');
  });

  it('[R-8.2-32] Zeile «Tenue B» → Tenue «B»', () => {
    const p = parseShapeText(
      runs([[{ text: 'Antreten', bold: true }], [{ text: 'Tenue B' }]]),
      ctx,
    );
    expect(p.tenue).toBe('B');
    expect(p.supplement).toBe('');
  });

  it('[R-8.2-33] übrige Zeile wird Zusatz', () => {
    const p = parseShapeText(
      runs([[{ text: 'Marsch', bold: true }], [{ text: 'mit Gepäck' }]]),
      ctx,
    );
    expect(p.supplement).toBe('mit Gepäck');
  });

  it('[R-8.2-35] mehrdeutige Klammer → unsichere Zerlegung; im Import ein Berichtseintrag', () => {
    const p = parseShapeText(
      runs([[{ text: 'Übung', bold: true }], [{ text: 'Sektor (Beispiel)' }]]),
      ctx,
    );
    expect(p.uncertain).toBe(true);
    const o = importWeeks([
      emptyWeek({
        shapes: [
          block(0, [0, 2], '0800', '1000', [[bold('Übung')], [normal('Sektor (Hptm Muster)')]]),
        ],
      }),
    ]);
    expect(o.report.items.some((i) => i.kind === 'uncertainParse')).toBe(true);
  });

  it('[R-8.2-37] drei Gruppen, zwei mit normaler Zeile → Block mit Titel/Ltg der ersten Gruppe und 2 Teilaufgaben', () => {
    const p = parseShapeText(
      runs([
        [{ text: 'Fsg Mat', bold: true }],
        [{ text: 'Four' }],
        [],
        [{ text: 'Fsg Fz', bold: true }],
        [{ text: 'Lt Muster (Ukft)' }],
        [],
        [{ text: 'Fahrer Rep anschl Vs', bold: true }],
      ]),
      ctx,
    );
    expect(p.title).toEqual([{ text: 'Fsg Mat', bold: true }]);
    expect(p.ltg).toBe('Four');
    expect(p.subtasks).toHaveLength(2);
    // Gegenproben: eine Gruppe; Gruppen ohne Leerabsatz; zwei fette Teile ohne eigene Ltg.
    const one = parseShapeText(runs([[{ text: 'A', bold: true }], [{ text: 'Four' }]]), ctx);
    expect(one.subtasks).toEqual([]);
    const noBlank = parseShapeText(
      runs([
        [{ text: 'A', bold: true }],
        [{ text: 'Four' }],
        [{ text: 'B', bold: true }],
        [{ text: 'Zfhr' }],
      ]),
      ctx,
    );
    expect(noBlank.subtasks).toEqual([]);
    const boldOnly = parseShapeText(
      runs([[{ text: 'A', bold: true }], [], [{ text: 'B', bold: true }]]),
      ctx,
    );
    expect(boldOnly.subtasks).toEqual([]);
  });

  it('[R-8.2-38] Gruppe «Fsg Fz» + «Lt Muster (Ukft)» → Titel, Ltg, Ort; ohne Klammer ganze Zeile Ltg; nur fett → Ltg leer', () => {
    const p = parseShapeText(
      runs([
        [{ text: 'Kopf', bold: true }],
        [{ text: 'Four' }],
        [],
        [{ text: 'Fsg Fz', bold: true }],
        [{ text: 'Lt Muster (Ukft)' }],
        [],
        [{ text: 'Wache', bold: true }],
        [{ text: 'Wm Fiktiv' }],
        [],
        [{ text: 'Reinigung', bold: true }],
      ]),
      ctx,
    );
    expect(p.subtasks).toEqual([
      { title: [{ text: 'Fsg Fz', bold: true }], ltg: 'Lt Muster', ort: 'Ukft' },
      { title: [{ text: 'Wache', bold: true }], ltg: 'Wm Fiktiv', ort: '' },
      { title: [{ text: 'Reinigung', bold: true }], ltg: '', ort: '' },
    ]);
    // Dieselbe Zeile in einem Block ohne Teilaufgaben: Zerlegung nach R-8.2-31.
    const plain = parseShapeText(
      runs([[{ text: 'Fsg Fz', bold: true }], [{ text: 'Lt Muster (Ukft)' }]]),
      ctx,
    );
    expect(plain.subtasks).toEqual([]);
    expect(plain.ltg).toBe('Lt Muster');
    expect(plain.ort).toBe('Ukft');
  });

  it('[R-8.2-37] Import: Block mit Teilaufgaben im Plan', () => {
    const o = importWeeks([
      emptyWeek({
        shapes: [
          block(0, [0, 2], '0900', '1700', [
            [bold('Fsg Mat')],
            [normal('Four')],
            [],
            [bold('Fsg Fz')],
            [normal('Lt Muster (Ukft)')],
          ]),
        ],
      }),
    ]);
    const [b] = blocks(o.result.plan);
    expect(titleOf(b ?? { title: [] })).toBe('Fsg Mat');
    expect(b?.subtasks).toHaveLength(1);
  });
});

describe('Terminzeilen (Beschrieb 4.8)', () => {
  const line = (text: string, extra: Partial<ShapeTextRun> = {}): ShapeTextRun[] => [
    { paragraph: 0, line: 0, text, bold: false, strike: false, color: null, sizePt: 8, ...extra },
  ];

  it('[R-8.2-34] «24 1330: Kontrl Fsg, Ltg: Einh Fw, Ort: Säntisalp.» → Felder; anderer Text → Freitext', () => {
    const p = parseAgendaLine(line('24 1330: Kontrl Fsg, Ltg: Einh Fw, Ort: Säntisalp.'));
    expect(p).toMatchObject({
      number: 24,
      time: { form: 'point', at: 810 },
      title: 'Kontrl Fsg',
      ltg: 'Einh Fw',
      ort: 'Säntisalp',
      freeText: null,
    });
    const free = parseAgendaLine(line('25 Material gemäss Liste fassen'));
    expect(free.time).toBeNull();
    expect(free.freeText).toBe('Material gemäss Liste fassen');
  });

  it('[R-8.2-34] Zeitformen: von–bis, ab, bis, Frist; mehrere Zeitfenster', () => {
    expect(parseAgendaLine(line('10 0900-1200: A.')).time).toEqual({
      form: 'range',
      from: 540,
      to: 720,
    });
    expect(parseAgendaLine(line('22 ab 1000: B.')).time).toEqual({ form: 'from', from: 600 });
    expect(parseAgendaLine(line('13 bis 1200: C.')).time).toEqual({ form: 'until', to: 720 });
    const frist = parseAgendaLine(line('31 bis 21.10.: Unterlagen abgeben.'));
    expect(frist.time).toEqual({ form: 'deadline' });
    expect(frist.deadline).toEqual({ day: 21, month: 10, year: null });
    const multi = parseAgendaLine(
      line('13 Vorrevisionen: 0900-1200 Zug Alpha, 1300-1600 Zug Bravo'),
    );
    expect(multi.windows.map((w) => w.supplement)).toEqual(['Zug Alpha', 'Zug Bravo']);
    expect(multi.title).toBe('Vorrevisionen');
  });

  it('[R-8.2-34] Gedankenstrich nach Nummer oder Zeit wird übergangen', () => {
    const p = parseAgendaLine(line('10 — 0900: Antreten Halle.'));
    expect(p.time).toEqual({ form: 'point', at: 540 });
    expect(p.title).toBe('Antreten Halle');
    const q = parseAgendaLine(line('32 0930 - Besuch Werkstatt'));
    expect(q.title).toBe('Besuch Werkstatt');
  });
});
