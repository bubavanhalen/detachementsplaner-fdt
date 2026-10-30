// @vitest-environment jsdom
// Paket E1-05, Nachtrag Runde 2 N1 (Befund E1-05-N01; Vertrag docs/wap-planer/plan/vertraege/E1-05.md, Änderungsnotiz
// «Runde 2», N1, und Notiz «aus Vertrag E1-02f, CR-03»): Ein Stand mit nicht einbettbarem Wappen wird gesetzt, und
// seine PDF bleiben als identische Bytes ausgebbar (R-5.5-06). Die Stand-PDF entstehen mit den echten Renderern
// (renderWeekPdf, renderPlanPdf; A4, Status rot wie G-12 a) und sind dann bytegleich zum Stand ohne Wappen
// (Vergleichsstand B). Das Wappen bleibt in Aufzeichnung und Arbeitsdokument erhalten (kein Datenverlust, geprüft
// gegen eine vor dem Ablauf gezogene Kopie, TR-E105-N1-01/-02). Gegenfall: gültiges
// Wappen wird tatsächlich gezeichnet. Je Bild wird genau einmal gerendert (`einmal` auf Modulebene, V20/V25).
// Kein `.resolves`/`.rejects` als Erwartung (V16). Alle Inhalte fiktiv bzw. pseudonymisiert (KVK-Fixture E1-02a).
import { describe, expect, it } from 'vitest';
import { renderPlanPdf, renderWeekPdf } from '../../../../src/io/wap-pdf';
import {
  type SetNewStandResult,
  type StandRenderers,
  setNewStand,
  standPdf,
} from '../../../../src/io/wap-plan/standStore';
import type { PdfTarget } from '../../../../src/model/wap/stand/fileName';
import type { Plan } from '../../../../src/model/wap/types';
import { einmal } from '../../pdf/plan/support/pdf-plan';
import { mitWappen, optionen, pngLeeresIdat, pngNurIhdr } from '../../pdf/plan/support/plaene';
import { KVK_WOCHE, kvkPlus, wappenPng } from '../../support/page/varianten';
import { readPdf } from '../../support/pdf/read';
import { StandStoreDouble } from '../../support/stand/double';
import { beobachte, kopie, sha256 } from '../../support/stand/hilfen';
import { clock, ctx, DATUM, PLAN_ID } from '../../support/stand/plan';

/** Test-Adapter (Vertrag N1): echte Renderer, Optionen A4 mit rotem Status; Warnungen gehen nicht in den Stand. */
const echteRenderer: StandRenderers = {
  week: async (plan, weekId, title) => (await renderWeekPdf(plan, weekId, optionen(), title)).bytes,
  plan: async (plan, title) => (await renderPlanPdf(plan, optionen(), title)).bytes,
};

/** Ziele: Woche KVK_WOCHE (Schlüssel KVK_WOCHE) und Gesamt-PDF (Schlüssel 'plan'). */
const ZIELE: readonly { readonly ziel: PdfTarget; readonly schluessel: string }[] = [
  { ziel: { kind: 'week', weekId: KVK_WOCHE }, schluessel: KVK_WOCHE },
  { ziel: { kind: 'plan' }, schluessel: 'plan' },
];

type Erledigt =
  | { readonly ok: true; readonly wert: SetNewStandResult }
  | { readonly ok: false; readonly fehler: unknown };

interface Lauf {
  readonly store: StandStoreDouble;
  readonly e: Erledigt;
  /** Der eingegebene Plan (V25). */
  readonly plan: Plan;
  /** Unabhängige Kopie des eingegebenen Wappens, vor dem Ablauf gezogen: Referenzwert für (3) (TR-E105-N1-01). */
  readonly wappen: Plan['coatOfArms'];
}

/** Ablauf «Neuen Stand setzen» mit dem Plan aus `erzeuge`, gemerkt mit `einmal`. */
function ablauf(erzeuge: () => Plan): () => Promise<Lauf> {
  return einmal(async () => {
    const plan = erzeuge();
    const wappen = kopie(plan.coatOfArms);
    const store = new StandStoreDouble(PLAN_ID, plan);
    const e = await beobachte(
      setNewStand(store, PLAN_ID, { date: DATUM }, echteRenderer, clock, { ctx }),
    ).erledigt;
    return { store, e, plan, wappen };
  });
}

/** Lauf je Bild (Vertrag N1 «Ablauf je Bild»): KVK+ mit PNG-Wappen aus `bild`. */
function lauf(bild: () => Uint8Array): () => Promise<Lauf> {
  return ablauf(() => mitWappen(kvkPlus(), 'image/png', bild()));
}

/** Je Bild genau ein Lauf, einmal auf Modulebene gebunden (V25). */
const LAUF = {
  nurIhdr: lauf(pngNurIhdr),
  leeresIdat: lauf(pngLeeresIdat),
  gueltig: lauf(wappenPng),
} as const;

/** Vergleichsstand B: derselbe Ablauf mit coatOfArms null, je Datei einmal. */
const VERGLEICH_B = ablauf(() => ({ ...kvkPlus(), coatOfArms: null }));

/** Wert eines erfüllten Laufs; nach Erwartung (1) ist der Lauf erfüllt. */
function wertVon(e: Erledigt): SetNewStandResult {
  if (!e.ok) throw new Error('Stand nicht gesetzt');
  return e.wert;
}

/** Vergleichsstand B (gleicher Ablauf mit coatOfArms null). */
async function vergleichsstand(): Promise<{ store: StandStoreDouble; r: SetNewStandResult }> {
  const { store, e } = await VERGLEICH_B();
  expect(e).toMatchObject({ ok: true });
  return { store, r: wertVon(e) };
}

/** Erwartung (2) für N1-a und N1-b: gespeicherte Bytes, kein Bild, bytegleich zu B, gleicher Dateiname. */
async function erwarteOhneBildWieB(store: StandStoreDouble, r: SetNewStandResult): Promise<void> {
  const b = await vergleichsstand();
  for (const { ziel, schluessel } of ZIELE) {
    const pdf = await standPdf(store, PLAN_ID, r.standId, ziel);
    expect(pdf.bytes, `Bytes ${schluessel}`).toEqual(r.pdfs.get(schluessel));
    expect((await readPdf(pdf.bytes)).images, `Bilder ${schluessel}`).toBe(0);
    const pdfB = await standPdf(b.store, PLAN_ID, b.r.standId, ziel);
    expect(sha256(pdf.bytes), `SHA-256 ${schluessel} gegen B`).toBe(sha256(pdfB.bytes));
    expect(pdf.fileName, `Dateiname ${schluessel}`).toBe(pdfB.fileName);
  }
}

/**
 * Erwartungen (3) und (4), kein Datenverlust gegen die Kopie `lf.wappen`: (3a) Wappen in der gespeicherten
 * Aufzeichnung, (3b) Wappen im Arbeitsdokument nach dem Setzen (TR-E105-N1-02); (4) genau eine Aufzeichnung.
 */
async function erwarteKeinVerlust(lf: Lauf, r: SetNewStandResult): Promise<void> {
  const aufzeichnungen = await lf.store.standRecords(PLAN_ID);
  const a = aufzeichnungen.find((x) => x.recordId === r.recordId);
  expect(a?.plan.coatOfArms, 'Aufzeichnung').toEqual(lf.wappen);
  expect(lf.store.dokument(PLAN_ID).coatOfArms, 'Arbeitsdokument').toEqual(lf.wappen);
  expect(aufzeichnungen).toHaveLength(1);
}

describe('E1-05 Nachtrag N1: Stand mit nicht einbettbarem Wappen', () => {
  it('[R-5.5-06] N1-a Wappen nur aus IHDR: Stand gesetzt, PDF ohne Bild und bytegleich zum Stand ohne Wappen, Wappen in der Aufzeichnung erhalten', async () => {
    const lf = await LAUF.nurIhdr();
    expect(lf.e).toMatchObject({ ok: true });
    const r = wertVon(lf.e);
    await erwarteOhneBildWieB(lf.store, r);
    await erwarteKeinVerlust(lf, r);
  });

  it('[R-5.5-06] N1-b Wappen mit leerem IDAT: Stand gesetzt, PDF ohne Bild und bytegleich zum Stand ohne Wappen, Wappen in der Aufzeichnung erhalten', async () => {
    const lf = await LAUF.leeresIdat();
    expect(lf.e).toMatchObject({ ok: true });
    const r = wertVon(lf.e);
    await erwarteOhneBildWieB(lf.store, r);
    await erwarteKeinVerlust(lf, r);
  });

  it('[R-5.5-06] N1-c Gegenfall gültiges Wappen: Stand-PDF mit genau einem Bild und verschieden vom Stand ohne Wappen', async () => {
    const lf = await LAUF.gueltig();
    expect(lf.e).toMatchObject({ ok: true });
    const r = wertVon(lf.e);
    const b = await vergleichsstand();
    for (const { ziel, schluessel } of ZIELE) {
      const pdf = await standPdf(lf.store, PLAN_ID, r.standId, ziel);
      expect(pdf.bytes, `Bytes ${schluessel}`).toEqual(r.pdfs.get(schluessel));
      expect((await readPdf(pdf.bytes)).images, `Bilder ${schluessel}`).toBe(1);
      const pdfB = await standPdf(b.store, PLAN_ID, b.r.standId, ziel);
      expect(sha256(pdf.bytes), `SHA-256 ${schluessel} gegen B`).not.toBe(sha256(pdfB.bytes));
    }
    await erwarteKeinVerlust(lf, r);
  });
});
