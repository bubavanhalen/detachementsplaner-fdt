// @vitest-environment jsdom
// Paket E1-02e: Eigenschaften der Einträge im fertigen PDF mit Farbkennung (R-4.6-54, R-4.6-59, R-4.7-04, R-7-06;
// Vertrag E1-02e Notiz «Ausarbeitung Schritt 2» H1, H3 bis H5, J; Vertrag E1-02d 2c–2f, R4-2, R5-2). Zufällige
// fiktive Wochen mit fester Startzahl 20261006 und 20 Läufen; jeder Rastereintrag hat seine eigene Farbe, so
// bestimmt die Füllfarbe im PDF den Eintrag. Dazu die Prüfung des Orakels gegen layoutGrid ([R-4.6-51][R-7-07],
// E1-02d ist eingefroren; im Rot-Nachweis grün).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { GridLayout } from '../../../../src/model/wap/layout/grid/types';
import { kpTemplate } from '../../../../src/model/wap/template';
import type { Entry, Id, Plan, Rgb } from '../../../../src/model/wap/types';
import { GRID_SEED, zufallsWoche } from '../../support/arbitraries/grid';
import {
  type FarbWoche,
  farbWoche,
  kennfarbe,
  PAGE_RUNS,
  PAGE_SEED,
} from '../../support/arbitraries/page';
import { lege, rasterPlan, satz } from '../../support/grid/build';
import { block, kpLegend, marker, rt } from '../../support/model/builders';
import { loadKvkPlan } from '../../support/model/kvk-fixture';
import { markerAchsen, tagSpalten, zeitFlaechen } from '../../support/page/analyse';
import { farbSeite } from '../../support/page/farbseite';
import {
  ausnahmen,
  blockartige,
  type TagSpalten,
  type ZeitFlaeche,
  zeitlageVerstoesse,
} from '../../support/page/orakel';
import {
  enthaeltPunkt,
  flaechen,
  gleicheFarbe,
  innerhalb,
  laeufe,
  mitte,
  schneidet,
  strichband,
  umriss,
} from '../../support/page/pdf-seite';
import { syntheticPlan } from '../../support/synthetic-plan';

// includeErrorInReport auch im Suite-Lauf (ohne vitest-setup.ts der WAP-Konfiguration): Ursache im Bericht.
const OPT = { seed: PAGE_SEED, numRuns: PAGE_RUNS, includeErrorInReport: true } as const;

/** Trägerfläche eines Laufs: zuletzt vor ihm gezeichnete gefüllte Fläche, die seine Mitte enthält (H8 a). */
function traeger<
  T extends { flaeche: { order: number; rect: { x: number; y: number; w: number; h: number } } },
>(eintraege: readonly T[], t: { order: number }, m: { x: number; y: number }): T | undefined {
  return eintraege
    .filter((e) => e.flaeche.order < t.order && enthaeltPunkt(e.flaeche.rect, m.x, m.y, 0.01))
    .sort((p, q) => q.flaeche.order - p.flaeche.order)[0];
}

describe('Beso-Kästchen über Blöcken (R-4.6-54)', () => {
  // F-FLAKY (FL-01): keine Zeitanforderung; 20 Läufe mit PDF erzeugen und auslesen, zusammen rund 1 s, unter
  // künstlicher Rechnerlast 5 s (19 Lastthreads) bis 35 s (60) gemessen – Zeitlimit als Schutz vor Hängern statt der
  // Vitest-Vorgabe 5 s; die PDF-Dauer misst die Leistungssuite (R-11-15).
  it('[R-4.6-54] Farbkennung: jedes Beso-Kästchen ist nach jeder Blockfläche gezeichnet, die es schneidet; kein Blocktext-Umriss schneidet ein Kästchen', async () => {
    await fc.assert(
      fc.asyncProperty(farbWoche(), async (w) => {
        const { info, an } = await farbSeite('beso', w.plan);
        const boxen = an.inhalt.eintraege.filter((e) => e.klasse === 'besoBox');
        const bloecke = an.inhalt.eintraege.filter((e) => e.klasse === 'block');
        for (const b of boxen) {
          for (const f of bloecke) {
            if (schneidet(b.flaeche.rect, f.flaeche.rect)) {
              expect(b.flaeche.order, 'Kästchen nach der Blockfläche').toBeGreaterThan(
                f.flaeche.order,
              );
            }
          }
        }
        for (const t of laeufe(info)) {
          const u = umriss(t);
          const tr = traeger(an.inhalt.eintraege, t, mitte(u));
          if (tr?.klasse !== 'block') continue;
          for (const b of boxen)
            expect(schneidet(u, b.flaeche.rect), `Blocktext «${t.text}»`).toBe(false);
        }
      }),
      OPT,
    );
  }, 120_000);
});

describe('Marker über Blöcken (R-4.6-59)', () => {
  // F-FLAKY (FL-01): keine Zeitanforderung; 20 Läufe mit PDF erzeugen und auslesen, zusammen rund 1 s, unter
  // künstlicher Rechnerlast 5 s (19 Lastthreads) bis 35 s (60) gemessen – Zeitlimit als Schutz vor Hängern statt der
  // Vitest-Vorgabe 5 s; die PDF-Dauer misst die Leistungssuite (R-11-15).
  it('[R-4.6-59] Farbkennung: kein Textumriss ausser der eigenen Beschriftung schneidet eine Markerlinie (Strichband) oder ein Feld; Markerelemente nach den Blockflächen, die sie schneiden', async () => {
    await fc.assert(
      fc.asyncProperty(farbWoche(), async (w) => {
        const { info, an } = await farbSeite('marker', w.plan);
        const felder = an.inhalt.eintraege.filter((e) => e.klasse === 'markerFeld');
        const bloecke = an.inhalt.eintraege.filter((e) => e.klasse === 'block');
        const baender = an.inhalt.markerLinien.map((l) => ({
          rect: strichband(l),
          order: l.order,
        }));
        for (const t of laeufe(info)) {
          const u = umriss(t);
          const tr = traeger(an.inhalt.eintraege, t, mitte(u));
          for (const b of baender)
            expect(schneidet(u, b.rect), `Text «${t.text}» über Markerlinie`).toBe(false);
          for (const f of felder) {
            if (tr === f) continue;
            expect(schneidet(u, f.flaeche.rect), `Text «${t.text}» über Markerfeld`).toBe(false);
          }
        }
        for (const m of [
          ...baender,
          ...felder.map((f) => ({ rect: f.flaeche.rect, order: f.flaeche.order })),
        ]) {
          for (const f of bloecke) {
            if (schneidet(m.rect, f.flaeche.rect)) expect(m.order).toBeGreaterThan(f.flaeche.order);
          }
        }
      }),
      OPT,
    );
  }, 120_000);
});

describe('Füllfarben nur aus der Legende (R-4.7-04)', () => {
  // F-FLAKY (FL-01): keine Zeitanforderung; 20 Läufe mit PDF erzeugen und auslesen, zusammen rund 1 s, unter
  // künstlicher Rechnerlast 5 s (19 Lastthreads) bis 35 s (60) gemessen – Zeitlimit als Schutz vor Hängern statt der
  // Vitest-Vorgabe 5 s; die PDF-Dauer misst die Leistungssuite (R-11-15).
  it('[R-4.7-04] Farbkennung: jede Füllfarbe im Raster und im Band ist eine Legendenfarbe oder neutral', async () => {
    await fc.assert(
      fc.asyncProperty(farbWoche(), async (w) => {
        const { info, an } = await farbSeite('legende', w.plan);
        // Band-Ereignisse aus dem eingefrorenen layoutGrid (E1-02d) mit Tagesbreite und Massstab aus dem PDF (H1).
        const band = new Set(
          lege(w.plan, { W: an.b.xSa - an.b.X0, ppm: an.skala.ptPerMinute, weekId: 'w26' })
            .fallbacks.filter((f) => f.region === 'band')
            .map((f) => f.entryId),
        );
        const erlaubt: Rgb[] = [...w.plan.legend.map((c) => c.color), { r: 255, g: 255, b: 255 }];
        const raster = {
          x: an.b.X0,
          y: an.b.yFrom,
          w: an.b.xSa - an.b.X0,
          h: an.b.yTo - an.b.yFrom,
        };
        const fl = flaechen(info).filter((f) => innerhalb(f.rect, raster, 0.01));
        for (const f of fl)
          expect(
            erlaubt.some((c) => gleicheFarbe(c, f.fill)),
            JSON.stringify(f.fill),
          ).toBe(true);
        // Jeder sichtbare Rastereintrag, der nach E1-02d eine Fläche haben muss, erscheint in seiner Kennfarbe:
        // Block bzw. Rapport-Block ohne Ausnahmen mit Spalten am Tag, Rapport-Kästchen und Beso-Kästchen an
        // einem Tag mit Rap- bzw. Beso-Spalte, Querbalken mit sichtbarem Tag mit Planungsspalten ohne Band-Ereignis.
        const tage = tagSpalten(an, w.plan, 'w26');
        const tmpl = kpTemplate();
        const mussFlaeche = new Set<Id>();
        for (const tag of tage) {
          const els = blockartige(w.plan, 'w26', tag.date, tmpl);
          for (const e of els) if (ausnahmen(e, els).length === 0) mussFlaeche.add(e.entryId);
          for (const e of Object.values(w.plan.entries)) {
            if (
              e.type === 'rapport' &&
              e.date === tag.date &&
              e.display !== 'onlyInColumns' &&
              tag.spalten.some((c) => c.kind === 'rap')
            )
              mussFlaeche.add(e.id);
            if (
              e.type === 'beso' &&
              e.date === tag.date &&
              tag.spalten.some((c) => c.kind === 'beso')
            )
              mussFlaeche.add(e.id);
            if (
              e.type === 'querbalken' &&
              e.fromDate <= tag.date &&
              tag.date <= e.toDate &&
              tag.spalten.some((c) => c.kind === 'planning') &&
              !band.has(e.id)
            )
              mussFlaeche.add(e.id);
          }
        }
        for (const id of mussFlaeche) {
          const c = w.farbe.get(id);
          expect(c, id).toBeDefined();
          expect(
            an.inhalt.eintraege.some((e) => gleicheFarbe(e.flaeche.fill, c ?? null)),
            `Eintrag ${id} ohne Fläche in seiner Kennfarbe`,
          ).toBe(true);
        }
      }),
      OPT,
    );
  }, 120_000);
});

/** Fiktiver Fall V04: zwei Ausnahmen verdecken zusammen den Anfang eines Blocks über drei Spalten. */
function zweiAusnahmenAmAnfang(): FarbWoche {
  const s = satz('s90', [
    { id: 'c91', kind: 'planning' },
    { id: 'c92', kind: 'planning' },
    { id: 'c93', kind: 'planning' },
    { id: 'c94', kind: 'rap' },
    { id: 'c95', kind: 'beso' },
  ]);
  const legende = [...kpLegend()];
  const farbe = new Map<Id, Rgb>();
  const entries: Entry[] = [];
  const mit = (e: Entry, i: number) => {
    const k = `kf${i}`;
    legende.push({
      id: k,
      name: `K${i}`,
      legendLabel: `K${i}`,
      color: kennfarbe(i),
      neutral: false,
      inLegend: false,
    });
    farbe.set(e.id, kennfarbe(i));
    entries.push({ ...e, categoryId: k } as Entry);
  };
  mit(
    block('e1', 1, {
      date: '2026-09-28',
      time: { form: 'range', from: 480, to: 600 },
      columns: { kind: 'ids', ids: ['c91', 'c92', 'c93'] },
      title: rt('Gesamt', true),
    }),
    0,
  );
  mit(
    block('e2', 2, {
      date: '2026-09-28',
      time: { form: 'range', from: 480, to: 540 },
      columns: { kind: 'ids', ids: ['c91'] },
      title: rt('A'),
    }),
    1,
  );
  mit(
    block('e3', 3, {
      date: '2026-09-28',
      time: { form: 'range', from: 480, to: 540 },
      columns: { kind: 'ids', ids: ['c92', 'c93'] },
      title: rt('B'),
    }),
    2,
  );
  entries.push(marker('e4', 4, { date: '2026-09-28', at: 720, columns: { kind: 'all' } }));
  const plan: Plan = { ...rasterPlan({ sets: [s], entries }), legend: legende };
  return {
    plan,
    farbe,
    raster: { sets: [s], tage: [], range: { from: 240, to: 1440 }, W: 180, ppm: 0.3 },
  };
}

describe('Lage aus dem Zeitfeld (R-7-06; H5)', () => {
  // F-FLAKY (FL-01): keine Zeitanforderung; 20 Läufe mit PDF erzeugen und auslesen, zusammen rund 1 s, unter
  // künstlicher Rechnerlast 5 s (19 Lastthreads) bis 35 s (60) gemessen – Zeitlimit als Schutz vor Hängern statt der
  // Vitest-Vorgabe 5 s; die PDF-Dauer misst die Leistungssuite (R-11-15).
  it('[R-7-06] Farbkennung nach H5 (a) bis (e), Toleranz 0,1 pt: Flächen der blockartigen Elemente decken je Spalte ihre gezeichnete Spanne (mit Ausnahmen), Kanten auf y(a), y(b) oder Ausnahmegrenzen; Kästchen auf ihren Spannen; Markerlinien auf y(min(max(at, V0), V1)); dazu zwei Ausnahmen, die den Anfang verdecken (V04)', async () => {
    const pruefe = async (w: FarbWoche, fall: string) => {
      const { an } = await farbSeite(fall, w.plan);
      const tage = tagSpalten(an, w.plan, 'w26');
      const fl = zeitFlaechen(an, w.farbe);
      expect(
        zeitlageVerstoesse(w.plan, 'w26', kpTemplate(), an.skala, tage, fl, markerAchsen(an), 0.1),
      ).toEqual([]);
    };
    await pruefe(zweiAusnahmenAmAnfang(), 'zeit-v04');
    await fc.assert(
      fc.asyncProperty(farbWoche(), async (w) => {
        await pruefe(w, 'zeit');
      }),
      OPT,
    );
  }, 120_000);
});

/** Flächen, Spalten und Markerachsen aus layoutGrid (E1-02d) für das Orakel. */
function ausGrid(L: GridLayout): {
  fl: ZeitFlaeche[];
  tage: TagSpalten[];
  achsen: { date: string; y: number }[];
} {
  const fl: ZeitFlaeche[] = [];
  const achsen: { date: string; y: number }[] = [];
  for (const g of L.entries) {
    for (const p of g.pieces) {
      if (p.kind === 'block' || p.kind === 'rapportBox' || p.kind === 'besoBox') {
        fl.push({ entryId: g.entryId, date: p.date, rect: p.rect, art: p.kind });
      }
      if (p.kind === 'markerLine') achsen.push({ date: p.date, y: p.rect.y + p.rect.h / 2 });
    }
  }
  const tage = L.days.map((d) => ({
    date: d.date,
    spalten: d.columns.map((c) => ({ id: c.columnId, kind: c.kind, x: c.x, w: c.w })),
  }));
  return { fl, tage, achsen };
}

describe('Orakel gegen layoutGrid (R-4.6-51, R-7-07)', () => {
  it('[R-4.6-51][R-7-07] das Orakel gezeichneteSpanne (E1-02d 2c mit R2-1, R2-2, R3-3, R4-1, R5-1, C1) stimmt mit layoutGrid überein: keine Verstösse nach H5 an zufälligen Wochen', () => {
    fc.assert(
      fc.property(zufallsWoche(), (w) => {
        const L = lege(w.plan, { W: w.raster.W, ppm: w.raster.ppm });
        const { fl, tage, achsen } = ausGrid(L);
        expect(
          zeitlageVerstoesse(w.plan, 'w26', kpTemplate(), L.timeScale, tage, fl, achsen, 0.1),
        ).toEqual([]);
      }),
      { seed: GRID_SEED, numRuns: 80 },
    );
  });

  // F-FLAKY (FL-01): keine Zeitanforderung; rund 0,4 s, unter künstlicher Rechnerlast (60 Lastthreads) über 7 s gemessen –
  // Zeitlimit als Schutz vor Hängern statt der Vitest-Vorgabe 5 s.
  it('[R-4.6-51][R-7-07] das Orakel stimmt auch an der KVK-Fixture und am synthetischen Plan (Aussparungen, Mitternacht) mit layoutGrid überein', () => {
    const kvkPlan = loadKvkPlan();
    const L = lege(kvkPlan, { W: 652.12, weekId: 'w26' });
    const a = ausGrid(L);
    expect(
      zeitlageVerstoesse(kvkPlan, 'w26', kpTemplate(), L.timeScale, a.tage, a.fl, a.achsen, 0.1),
    ).toEqual([]);
    const syn = syntheticPlan();
    for (const wk of syn.weeks) {
      const S = lege(syn, { W: 652.12, weekId: wk.id });
      const b = ausGrid(S);
      expect(
        zeitlageVerstoesse(syn, wk.id, kpTemplate(), S.timeScale, b.tage, b.fl, b.achsen, 0.1),
        wk.id,
      ).toEqual([]);
    }
  }, 120_000);

  it('[R-4.6-51][R-7-07] Gegenprobe: eine um 10 Minuten verschobene Fläche verletzt (b), eine fehlende Markerlinie (d)', () => {
    const w = zweiAusnahmenAmAnfang();
    const L = lege(w.plan, { W: 180, ppm: 0.3 });
    const { fl, tage, achsen } = ausGrid(L);
    expect(
      zeitlageVerstoesse(w.plan, 'w26', kpTemplate(), L.timeScale, tage, fl, achsen, 0.1),
    ).toEqual([]);
    const verschoben = fl.map((f, i) =>
      i === 0 ? { ...f, rect: { ...f.rect, y: f.rect.y + 3 } } : f,
    );
    expect(
      zeitlageVerstoesse(w.plan, 'w26', kpTemplate(), L.timeScale, tage, verschoben, achsen, 0.1)
        .length,
    ).toBeGreaterThan(0);
    expect(
      zeitlageVerstoesse(w.plan, 'w26', kpTemplate(), L.timeScale, tage, fl, [], 0.1).some((v) =>
        v.startsWith('(d)'),
      ),
    ).toBe(true);
  });
});
