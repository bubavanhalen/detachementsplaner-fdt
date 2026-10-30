// @vitest-environment jsdom
// Paket E1-02d: Eigenschaften der Einträge im Raster (Vertrag E1-02d Abschnitt 2b–2f; Prompt §7 «nie Überlappung
// von Kästchen, nie Text ausserhalb seines Rahmens, nie Schrift unter der Mindestgrösse ohne Befund P8»; R-7-07,
// R-4.6-44, R-4.6-51, R-4.6-53, R-6-04). Zufällige fiktive Wochen mit festem Startwert (ADR-010 §5).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { renumberDay } from '../../../../src/model/wap/commands/beso';
import type { CommandContext } from '../../../../src/model/wap/commands/command';
import type { GridLayout } from '../../../../src/model/wap/layout/grid/types';
import { builtInTemplates } from '../../../../src/model/wap/template';
import type { Beso, Entry, MilTime, TimeSpec } from '../../../../src/model/wap/types';
import {
  fensterZeit,
  GRID_RUNS,
  GRID_SEED,
  type ZufallsWoche,
  zufallsWoche,
} from '../../support/arbitraries/grid';
import {
  innerhalb,
  lege,
  MO,
  rasterPlan,
  STD,
  schnittFlaeche,
  texte,
  X0,
  Y0,
  zeileImRahmen,
  zeilenText,
} from '../../support/grid/build';
import { beso, win } from '../../support/model/builders';

const OPTIONEN = { seed: GRID_SEED, numRuns: GRID_RUNS } as const;
const ctx: CommandContext = { templates: builtInTemplates() };

function lay(w: ZufallsWoche): GridLayout {
  return lege(w.plan, { W: w.raster.W, ppm: w.raster.ppm });
}

const yAus = (w: ZufallsWoche, t: number) => Y0 + (t - w.raster.range.from) * w.raster.ppm;

/** Kp-Kästchenspanne als unabhängiges Orakel (Vertrag 2c, Vorlage fixed30). */
function kpSpanne(t: TimeSpec, displayFrom: MilTime): { from: number; to: number } {
  switch (t.form) {
    case 'point':
      return { from: t.at, to: t.at + 30 };
    case 'range':
    case 'from':
      return { from: t.from, to: t.from + 30 };
    case 'until':
      return { from: t.to - 30, to: t.to };
    case 'deadline':
      return t.to === undefined
        ? { from: displayFrom + 60, to: displayFrom + 90 }
        : { from: t.to - 30, to: t.to };
  }
}

/** Gezeichnete Spanne nach 2c (Zuschnitt auf [V0, V1], R2-1 unbegrenzt; Notiz R4-2). */
function gezeichnet(
  s: { from: number; to: number },
  V0: number,
  V1: number,
): { from: number; to: number } {
  const d = Math.min(s.to - s.from, 30);
  if (s.to <= V0) return { from: V0, to: V0 + d };
  if (s.from >= V1) return { from: V1 - d, to: V1 };
  return { from: Math.max(s.from, V0), to: Math.min(s.to, V1) };
}

describe('Einträge liegen im Raster (R-7-07)', () => {
  it('[R-7-07] (V-02d-13, V-02d-19, V-02d-20) zufällige Pläne mit Dauern ab 5 Min und Zeiten bis 2400: jedes Teilstück im Tag und zwischen y(from) und y(to), Markerlinie über ihre Achse; keine Ausnahme', () => {
    fc.assert(
      fc.property(zufallsWoche(), (w) => {
        const L = lay(w);
        const unten = yAus(w, w.raster.range.to);
        const rechts = X0 + w.raster.W;
        for (const g of L.entries) {
          for (const p of g.pieces) {
            const tag = L.days.find((d) => d.date === p.date);
            expect(tag, `${g.entryId}: Tag ${p.date} sichtbar`).toBeDefined();
            if (tag === undefined) continue;
            const r = p.rect;
            expect(r.w, `${g.entryId} Breite`).toBeGreaterThan(0);
            expect(r.h, `${g.entryId} Höhe`).toBeGreaterThan(0);
            expect(r.x, `${g.entryId} links`).toBeGreaterThanOrEqual(tag.x - 0.01);
            const ende = p.kind === 'querbalken' ? rechts : tag.x + tag.w;
            expect(r.x + r.w, `${g.entryId} rechts`).toBeLessThanOrEqual(ende + 0.01);
            if (p.kind === 'markerLine') {
              // V-02d-19 (a): Achse Y in [y(V0), y(V1)]; der halbe Strich darf darüber hinaus reichen.
              const achse = r.y + r.h / 2;
              // R5-2: Achse = y(min(max(at, V0), V1)).
              const mk = w.plan.entries[g.entryId];
              if (mk?.type === 'marker') {
                const V0 = w.raster.range.from + 60;
                const at = Math.min(Math.max(mk.at, V0), w.raster.range.to);
                expect(
                  Math.abs(achse - yAus(w, at)),
                  `${g.entryId} Achse = y(at)`,
                ).toBeLessThanOrEqual(0.1);
              }
              expect(achse, `${g.entryId} Achse oben`).toBeGreaterThanOrEqual(
                Y0 + 60 * w.raster.ppm - 0.01,
              );
              expect(achse, `${g.entryId} Achse unten`).toBeLessThanOrEqual(unten + 0.01);
            } else {
              expect(r.y, `${g.entryId} oben`).toBeGreaterThanOrEqual(Y0 - 0.01);
              // TR-E102d-01: ausser Querbalken nichts im Band (über y(V0)).
              if (p.kind !== 'querbalken') {
                expect(r.y, `${g.entryId} ${p.kind} nicht im Band`).toBeGreaterThanOrEqual(
                  Y0 + 60 * w.raster.ppm - 0.01,
                );
              }
              expect(r.y + r.h, `${g.entryId} unten`).toBeLessThanOrEqual(unten + 0.01);
            }
            if (p.kind === 'querbalken') {
              expect(innerhalb(r, L.band), `${g.entryId} im Band`).toBe(true);
            }
          }
        }
      }),
      OPTIONEN,
    );
  });

  it('[R-7-07] zufällige Pläne: jeder Text liegt in seinem frame, der frame in einem Teilstück des Eintrags; Schrift ≥ Mindestgrösse', () => {
    fc.assert(
      fc.property(zufallsWoche(), (w) => {
        const L = lay(w);
        for (const t of L.items) {
          if (t.kind !== 'text') continue;
          expect(t.entryId, 'Text mit entryId').toBeDefined();
          expect(t.sizePt).toBeGreaterThanOrEqual(4.5);
          zeileImRahmen(t);
          const g = L.entries.find((e) => e.entryId === t.entryId);
          expect(
            g?.pieces.some((p) => innerhalb(t.frame, p.rect, 0.01)),
            `frame von «${zeilenText(t)}» in einem Teilstück`,
          ).toBe(true);
        }
      }),
      OPTIONEN,
    );
  });

  it('[R-7-07] zufällige Pläne: jeder Rastereintrag an einem sichtbaren Tag genau einmal in entries, nach Erfassung', () => {
    fc.assert(
      fc.property(zufallsWoche(), (w) => {
        const L = lay(w);
        const ids = L.entries.map((e) => e.entryId);
        expect(new Set(ids).size).toBe(ids.length);
        const seq = (id: string) => (w.plan.entries[id] as Entry).createdSeq;
        for (let i = 1; i < ids.length; i++) {
          expect(seq(ids[i] as string)).toBeGreaterThan(seq(ids[i - 1] as string));
        }
        const sichtbar = new Set(L.days.map((d) => d.date));
        for (const e of Object.values(w.plan.entries)) {
          if (e.type === 'querbalken') {
            const da = [...sichtbar].some((d) => e.fromDate <= d && d <= e.toDate);
            expect(ids.includes(e.id), e.id).toBe(da);
          } else if (
            e.type !== 'dayRemark' &&
            e.type !== 'multiDayRemark' &&
            sichtbar.has(e.date)
          ) {
            expect(ids.includes(e.id), e.id).toBe(true);
          }
        }
      }),
      OPTIONEN,
    );
  });
});

describe('Kollisionsfreie Kästchen (R-4.6-51, R-4.6-53, R-6-04)', () => {
  it('[R-4.6-53][R-6-04] zufällige Pläne: Kästchen überlappen sich nie; jedes liegt in seiner Spalte', () => {
    fc.assert(
      fc.property(zufallsWoche(), (w) => {
        const L = lay(w);
        for (const tag of L.days) {
          const boxen = L.entries.flatMap((g) =>
            g.pieces
              .filter(
                (p) => p.date === tag.date && (p.kind === 'besoBox' || p.kind === 'rapportBox'),
              )
              .map((p) => ({ g, p })),
          );
          for (let i = 0; i < boxen.length; i++) {
            for (let j = i + 1; j < boxen.length; j++) {
              const a = boxen[i];
              const b = boxen[j];
              if (a === undefined || b === undefined || a.p.kind !== b.p.kind) continue;
              expect(
                schnittFlaeche(a.p.rect, b.p.rect),
                `${a.g.entryId}/${String(a.p.windowId)} und ${b.g.entryId}/${String(b.p.windowId)}`,
              ).toBeLessThanOrEqual(1e-4);
            }
          }
          for (const { g, p } of boxen) {
            const e = w.plan.entries[g.entryId] as Entry;
            if (p.kind === 'rapportBox') {
              const rap = tag.columns.find((c) => c.kind === 'rap');
              expect(
                rap !== undefined && innerhalb(p.rect, { ...rap, y: p.rect.y, h: p.rect.h }),
              ).toBe(true);
              continue;
            }
            if (e.type !== 'beso') continue;
            const f = e.windows.find((x) => x.id === p.windowId);
            const zielId =
              f?.columnId === null ||
              f?.columnId === undefined ||
              (f.time.form === 'deadline' && f.time.to === undefined)
                ? null
                : f.columnId;
            const ziel =
              tag.columns.find(
                (c) => c.columnId === zielId && (c.kind === 'planning' || c.kind === 'secondary'),
              ) ?? (zielId === null ? tag.columns.find((c) => c.kind === 'beso') : undefined);
            if (ziel === undefined) continue;
            expect(
              innerhalb(p.rect, { x: ziel.x, w: ziel.w, y: p.rect.y, h: p.rect.h }),
              `${g.entryId}/${String(p.windowId)} in ${ziel.columnId}`,
            ).toBe(true);
          }
        }
      }),
      OPTIONEN,
    );
  });

  it('[R-4.6-51][R-6-04] zufällige Pläne: Kästchen-y-Kanten = Abbildung der gezeichneten Spanne nach 2c (±0,1 pt, Notiz R4-2), auch bei Kollisionen', () => {
    let geprueft = 0;
    fc.assert(
      fc.property(zufallsWoche(), (w) => {
        const L = lay(w);
        const V0 = w.raster.range.from + 60;
        const V1 = w.raster.range.to;
        for (const g of L.entries) {
          const e = w.plan.entries[g.entryId] as Entry;
          if (e.type !== 'beso') continue;
          for (const p of g.pieces) {
            const f = e.windows.find((x) => x.id === p.windowId);
            if (f === undefined || p.date !== e.date) continue;
            const s = gezeichnet(kpSpanne(f.time, w.raster.range.from), V0, V1);
            // Unbegrenzte Spanne (R2-1); fixed30 wird nie über Mitternacht geteilt.
            expect(p.span, `${g.entryId} span`).toEqual(kpSpanne(f.time, w.raster.range.from));
            geprueft += 1;
            expect(Math.abs(p.rect.y - yAus(w, s.from)), `${g.entryId} oben`).toBeLessThanOrEqual(
              0.1,
            );
            expect(
              Math.abs(p.rect.y + p.rect.h - yAus(w, s.to)),
              `${g.entryId} unten`,
            ).toBeLessThanOrEqual(0.1);
          }
        }
      }),
      OPTIONEN,
    );
    // Nicht leer: über alle Läufe wurden Kästchen geprüft.
    expect(geprueft).toBeGreaterThan(0);
  });
});

describe('Kästchennummer (R-4.6-44)', () => {
  it('[R-4.6-44] (V-02d-12) zufällige Beso mit n Zeitfenstern nach renumberDay: jedes Kästchen mit Text zeigt String(besoNumber)', () => {
    const besoArb = fc.array(
      fc.array(
        fc.record({
          from: fc.integer({ min: 60, max: 276 }).map((n) => n * 5),
          spalte: fc.constantFrom<string | null>(null, null, STD.p1, STD.p2, STD.p3),
        }),
        { minLength: 1, maxLength: 3 },
      ),
      { minLength: 1, maxLength: 12 },
    );
    fc.assert(
      fc.property(
        besoArb.chain((liste) =>
          fc.tuple(
            ...liste.map((fenster) =>
              fc
                .tuple(...fenster.map((f) => fensterZeit(f.from)))
                .map((zeiten) =>
                  fenster.map((f, i) => ({ spalte: f.spalte, zeit: zeiten[i] as TimeSpec })),
                ),
            ),
          ),
        ),
        (liste) => {
          const entries: Beso[] = liste.map((fenster, k) =>
            beso(`e${k + 1}`, k + 1, {
              date: MO,
              windows: fenster.map((f, i) =>
                win(`t${k + 1}w${i}`, { time: f.zeit, columnId: f.spalte }),
              ),
              besoNumber: null,
            }),
          );
          const plan = renumberDay(rasterPlan({ entries }), MO, ctx).plan;
          const L = lege(plan, { W: 900 });
          let mitText = 0;
          for (const e of entries) {
            const nachher = plan.entries[e.id] as Beso;
            const soll = nachher.besoNumber === null ? '–' : String(nachher.besoNumber);
            const z = texte(L, e.id);
            for (const t of z) expect(zeilenText(t), e.id).toBe(soll);
            mitText += z.length;
          }
          expect(mitText).toBeGreaterThan(0);
        },
      ),
      { seed: GRID_SEED, numRuns: 60 },
    );
  });
});
