// @vitest-environment jsdom
// Paket E1-02f: Fehlerverhalten von renderWeekPdf und renderPlanPdf (R-10-03; Vertrag E1-02f Notiz «Ausarbeitung
// Schritt 2» B5, C «Fehlerverhalten», J P5, P6; T-2; V-02f-1). Jeder Fehler kommt als abgelehntes Promise, nie
// synchron. Meldungstexte stehen im Vertrag (Abschnitt C) und werden hier wörtlich erwartet. Pseudonymisierte
// KVK-Fixture und fiktive Varianten.
import { describe, expect, it } from 'vitest';
import {
  PdfWriteError,
  PlanPdfError,
  renderPlanPdf,
  renderWeekPdf,
} from '../../../../src/io/wap-pdf';
import { ModelError, WapError } from '../../../../src/model/wap/errors';
import type { Block, Plan } from '../../../../src/model/wap/types';
import { KVK_WOCHE, kvk } from '../../support/page/varianten';
import { mitEintrag, mitFolgewoche, optionen, PDF_TITEL } from './support/plaene';

/** Ruft `f` auf; ein synchroner Wurf und das Ergebnis werden getrennt festgehalten (T-2). */
function aufruf(f: () => Promise<unknown>): {
  readonly synchron: unknown;
  readonly ergebnis: Promise<unknown>;
} {
  try {
    return { synchron: null, ergebnis: f() };
  } catch (e) {
    return { synchron: e, ergebnis: Promise.resolve('synchron geworfen') };
  }
}

/** Fehler eines abgelehnten Promise; `null`, wenn es erfüllt wird. */
async function ablehnung(p: Promise<unknown>): Promise<unknown> {
  return p.then(
    () => null,
    (e: unknown) => e,
  );
}

/** Erster Block der KVK-Fixture (nach Id) mit Titel `text`. */
function mitBlocktitel(plan: Plan, text: string): Plan {
  const b = Object.values(plan.entries)
    .filter((e): e is Block => e.type === 'block')
    .sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0))[0];
  if (b === undefined) throw new Error('KVK-Fixture ohne Block');
  return mitEintrag(plan, { ...b, title: [{ text, bold: true }] });
}

describe('Fehler (R-10-03; C, J P5, T-2, V-02f-1)', () => {
  it('[R-10-03] (V-02f-1) Plan ohne Woche: renderPlanPdf lehnt mit PlanPdfError «noWeeks» ab (WapError, Ursache und nächster Schritt nach Vertrag C), kein synchroner Wurf', async () => {
    const r = aufruf(() => renderPlanPdf({ ...kvk(), weeks: [] }, optionen(), PDF_TITEL));
    expect(r.synchron).toBeNull();
    const e = await ablehnung(r.ergebnis);
    expect(e).toBeInstanceOf(PlanPdfError);
    expect(e).toBeInstanceOf(WapError);
    expect(e).toMatchObject({
      name: 'PlanPdfError',
      code: 'noWeeks',
      message: 'Der Plan enthält keine Woche. Ein Gesamt-PDF ist deshalb nicht möglich.',
      userMessage: {
        cause: 'Der Plan enthält keine Woche. Ein Gesamt-PDF ist deshalb nicht möglich.',
        nextStep: 'Zuerst eine Woche anlegen, dann das PDF erneut erzeugen.',
      },
    });
  });

  it('[R-10-03] unbekannte Woche: renderWeekPdf lehnt mit ModelError «unknownWeek» ab; der Aufruf selbst wirft nicht', async () => {
    const r = aufruf(() => renderWeekPdf(kvk(), 'w-fehlt', optionen(), PDF_TITEL));
    expect(r.synchron).toBeNull();
    const e = await ablehnung(r.ergebnis);
    expect(e).toBeInstanceOf(ModelError);
    expect(e).toMatchObject({ code: 'unknownWeek' });
  });

  const titel: readonly { readonly name: string; readonly wert: unknown }[] = [
    { name: 'leer', wert: '' },
    { name: 'nur Leerzeichen', wert: '   ' },
    { name: 'kein String', wert: undefined },
  ];
  for (const t of titel) {
    it(`[R-10-03] (T-2) Titel ${t.name}: RangeError «PDF-Titel fehlt» als abgelehntes Promise, bei renderWeekPdf und renderPlanPdf`, async () => {
      const w = aufruf(() => renderWeekPdf(kvk(), KVK_WOCHE, optionen(), t.wert as string));
      const g = aufruf(() => renderPlanPdf(kvk(), optionen(), t.wert as string));
      expect(w.synchron).toBeNull();
      expect(g.synchron).toBeNull();
      for (const e of [await ablehnung(w.ergebnis), await ablehnung(g.ergebnis)]) {
        expect(e).toBeInstanceOf(RangeError);
        expect((e as Error).message).toBe('PDF-Titel fehlt');
      }
    });
  }

  it('[R-10-03] (T-2) Plan ohne Woche und leerer Titel: zuerst wird der Titel geprüft (RangeError, nicht noWeeks)', async () => {
    const e = await ablehnung(renderPlanPdf({ ...kvk(), weeks: [] }, optionen(), ' '));
    expect(e).toBeInstanceOf(RangeError);
    expect((e as Error).message).toBe('PDF-Titel fehlt');
  });
});

describe('Ablehnung des Schreibers wird durchgereicht (R-10-03; B5, J P6)', () => {
  const faelle: readonly {
    readonly name: string;
    readonly titel: string;
    readonly code: 'missingGlyph' | 'invalidItem';
    readonly zeichen: string | null;
  }[] = [
    { name: '«✓» (U+2713)', titel: 'Kontrolle ✓', code: 'missingGlyph', zeichen: '✓' },
    {
      name: 'weiches Trennzeichen U+00AD',
      titel: `Kontrolle${String.fromCodePoint(0xad)}ergebnis`,
      code: 'invalidItem',
      zeichen: null,
    },
  ];
  for (const f of faelle) {
    it(`[R-10-03] Blocktitel mit ${f.name}: renderWeekPdf und renderPlanPdf lehnen mit PdfWriteError «${f.code}» ab`, async () => {
      const plan = mitBlocktitel(kvk(), f.titel);
      const zwei = mitFolgewoche(plan);
      const fehler = [
        await ablehnung(renderWeekPdf(plan, KVK_WOCHE, optionen(), PDF_TITEL)),
        await ablehnung(renderPlanPdf(plan, optionen(), PDF_TITEL)),
        await ablehnung(renderPlanPdf(zwei, optionen(), PDF_TITEL)),
      ];
      for (const e of fehler) {
        expect(e).toBeInstanceOf(PdfWriteError);
        expect(e).toMatchObject({ code: f.code });
        if (f.zeichen !== null) expect((e as PdfWriteError).character).toBe(f.zeichen);
      }
    });
  }
});
