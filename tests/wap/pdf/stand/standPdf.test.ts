// @vitest-environment jsdom
// Paket E1-05: gespeicherte Stand-PDF, geprüft am fertigen PDF mit readPdf (E1-01b) (Vertrag
// docs/wap-planer/plan/vertraege/E1-05.md, Notiz «Ausarbeitung Schritt 2» Abschnitte C1 Punkt 5, D5, G; Notiz
// E1-02f Pflichtfall (a)). R-5.5-05 (alle Wochen-PDF eines Stands tragen dasselbe Datum), R-6-10 (a) (PDF-Titel =
// Dateiname ohne «.pdf»), R-10-30 (gestrichener Eintrag nach dem Stand nicht mehr im PDF, im früheren Stand
// erhalten; F-28). Prüf-Renderer mit echtem writePdf (H2), In-Memory-Double (H1). Alle Inhalte fiktiv.
import { describe, expect, it } from 'vitest';
import { standPdf } from '../../../../src/io/wap-plan/standStore';
import type { PdfTarget } from '../../../../src/model/wap/stand/fileName';
import type { Plan } from '../../../../src/model/wap/types';
import { readPdf } from '../../support/pdf/read';
import { neuerStore, planMitInhalt, setzen, statusSetzen } from '../../support/stand/ablauf';
import { block, DATUM, mitEintraegen, PLAN_ID, pruefPlan, wocheId } from '../../support/stand/plan';
import { PruefRenderer, pruefPdf } from '../../support/stand/renderer';

const P = planMitInhalt();
const KVK: PdfTarget = { kind: 'week', weekId: wocheId(P, 'KVK') };
const WO3: PdfTarget = { kind: 'week', weekId: wocheId(P, 'Wo3') };
const ZIELE: PdfTarget[] = [
  ...P.weeks.map((w) => ({ kind: 'week' as const, weekId: w.id })),
  { kind: 'plan' },
];

/** Texte des PDF (Läufe in Zeichenreihenfolge). */
async function texte(bytes: Uint8Array): Promise<string[]> {
  return (await readPdf(bytes)).texts.map((t) => t.text);
}

/** Der Textlauf, der mit «Stand » beginnt (genau einer erwartet). */
async function standText(bytes: Uint8Array): Promise<string[]> {
  return (await texte(bytes)).filter((t) => t.startsWith('Stand '));
}

describe('Alle PDF eines Stands tragen dasselbe Datum (C1 Punkt 5)', () => {
  it('[R-5.5-05] KVK- und Wo3-PDF desselben Stands: der Textlauf «Stand …» ist in beiden «Stand 17.09.2026»', async () => {
    const store = neuerStore();
    const rec = await setzen(store, new PruefRenderer());
    const kvk = await standPdf(store, PLAN_ID, rec.standId, KVK);
    const wo3 = await standPdf(store, PLAN_ID, rec.standId, WO3);
    expect(await standText(kvk.bytes)).toEqual(['Stand 17.09.2026']);
    expect(await standText(wo3.bytes)).toEqual(['Stand 17.09.2026']);
  });

  it('[R-5.5-05] dasselbe für alle Wochen und das Gesamt-PDF; jeder Renderer-Aufruf erhielt stand { 2026-09-17, V1 }', async () => {
    const store = neuerStore();
    const render = new PruefRenderer();
    const rec = await setzen(store, render);
    for (const ziel of ZIELE) {
      const r = await standPdf(store, PLAN_ID, rec.standId, ziel);
      expect(await standText(r.bytes), JSON.stringify(ziel)).toEqual(['Stand 17.09.2026']);
    }
    expect(render.aufrufe).toHaveLength(5);
    for (const a of render.aufrufe) expect(a.stand).toEqual({ date: DATUM, version: 1 });
  });

  it('[R-5.5-05] Stand mit anderem Datum (V2 vom 2026-09-24 nach V1): alle PDF des zweiten Stands «Stand 24.09.2026», die des ersten weiter «Stand 17.09.2026»', async () => {
    const store = neuerStore();
    const s1 = await setzen(store, new PruefRenderer());
    const s2 = await setzen(store, new PruefRenderer(), { date: '2026-09-24' });
    for (const ziel of ZIELE) {
      expect(await standText((await standPdf(store, PLAN_ID, s2.standId, ziel)).bytes)).toEqual([
        'Stand 24.09.2026',
      ]);
      expect(await standText((await standPdf(store, PLAN_ID, s1.standId, ziel)).bytes)).toEqual([
        'Stand 17.09.2026',
      ]);
    }
  });
});

describe('PDF-Titel = Dateiname ohne «.pdf» (Notiz E1-02f Pflichtfall (a), ADR-005 Punkt 3)', () => {
  it('[R-6-10] für jedes gespeicherte Stand-PDF zweier Stände am selben Tag: readPdf(bytes).metadata.Title = standPdf(…).fileName ohne «.pdf»', async () => {
    const store = neuerStore();
    const a = await setzen(store, new PruefRenderer());
    const b = await setzen(store, new PruefRenderer());
    const titel: string[] = [];
    for (const s of [a, b]) {
      for (const ziel of ZIELE) {
        const r = await standPdf(store, PLAN_ID, s.standId, ziel);
        expect(r.fileName.endsWith('.pdf')).toBe(true);
        const t = (await readPdf(r.bytes)).metadata.Title;
        expect(t).toBe(r.fileName.slice(0, -'.pdf'.length));
        titel.push(t ?? '');
      }
    }
    expect(titel).toContain('01_02_WAP_FDT_2026_KVK_Stand_2026-09-17');
    expect(titel).toContain('01_02_WAP_FDT_2026_Plan_Stand_2026-09-17_V2');
  });
});

describe('Gestrichene Einträge nach dem Stand (D1 (b), F-28)', () => {
  /** P mit gestrichenem Block «Abgesagte Übung X» und bestätigtem Block «Schiessen Y» (fiktiv). */
  function planMitStreichung(): Plan {
    const p = pruefPlan();
    return mitEintraegen(p, [
      block(p, 'e301', DATUM, 'Abgesagte Übung X', { status: 'cancelled' }),
      block(p, 'e302', DATUM, 'Schiessen Y'),
    ]);
  }

  it('[R-10-30] Prüf-Renderer auf P enthält «Abgesagte Übung X»; nach setNewStand enthalten die gespeicherten PDF der Woche und das Gesamt-PDF den Text nicht mehr, «Schiessen Y» schon', async () => {
    const p = planMitStreichung();
    const kvk: PdfTarget = { kind: 'week', weekId: wocheId(p, 'KVK') };
    expect(await texte(await pruefPdf(p, kvk, 'Vorher'))).toContain('Abgesagte Übung X');
    const store = neuerStore(p);
    const rec = await setzen(store, new PruefRenderer());
    for (const ziel of [kvk, { kind: 'plan' } as const]) {
      const t = await texte((await standPdf(store, PLAN_ID, rec.standId, ziel)).bytes);
      expect(t).not.toContain('Abgesagte Übung X');
      expect(t).toContain('Schiessen Y');
    }
    expect(store.dokument(PLAN_ID).entries.e301).toBeUndefined();
  });

  it('[R-10-30] ein früherer Stand S0, gesetzt solange der Block bestätigt war, enthält ihn in standPdf weiterhin', async () => {
    const p0 = pruefPlan();
    const p = mitEintraegen(p0, [
      block(p0, 'e301', DATUM, 'Abgesagte Übung X'),
      block(p0, 'e302', DATUM, 'Schiessen Y'),
    ]);
    const kvk: PdfTarget = { kind: 'week', weekId: wocheId(p, 'KVK') };
    const store = neuerStore(p);
    const s0 = await setzen(store, new PruefRenderer());
    store.aendern(PLAN_ID, statusSetzen('e301', 'cancelled'));
    expect(await texte(await pruefPdf(store.dokument(PLAN_ID), kvk, 'Arbeitsfassung'))).toContain(
      'Abgesagte Übung X',
    );
    const s1 = await setzen(store, new PruefRenderer(), { date: '2026-09-18' });
    for (const ziel of [kvk, { kind: 'plan' } as const]) {
      const neu = await texte((await standPdf(store, PLAN_ID, s1.standId, ziel)).bytes);
      expect(neu).not.toContain('Abgesagte Übung X');
      expect(neu).toContain('Schiessen Y');
      const frueher = await texte((await standPdf(store, PLAN_ID, s0.standId, ziel)).bytes);
      expect(frueher).toContain('Abgesagte Übung X');
      expect(frueher).toContain('Schiessen Y');
    }
  });
});
