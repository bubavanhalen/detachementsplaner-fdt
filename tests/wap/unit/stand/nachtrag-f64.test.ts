// @vitest-environment jsdom
// Paket E1-05 Runde 2, Nachtrag N4 (Q-016 / F-64): nummernloser Beso beim Setzen eines Stands (Vertrag
// docs/wap-planer/plan/vertraege/E1-05.md, «Änderungsnotiz Runde 2» Abschnitt N4; requirements.md R-5.3-09
// Fälle (d) und (e), F-13, F-14, F-52, F-64; R-5.5-04). Mit dem Stand wird der gestrichene Beso entfernt; ein
// bisher nummernloser Beso des Tages erhält die frei gewordene Nummer nach F-13 (kleinste freie zuerst, aufsteigend
// nach Sortierzeit), schon im neuen Stand. Nummerierte Beso werden nicht umnummeriert (F-52).
// P17 (Prüfregel, E1-06) ist hier nicht Gegenstand; dafür gilt die Notiz an E1-06 im Vertrag.
// Prüf-Plan P, Double und Prüf-Renderer aus tests/wap/support/stand (eingefroren); alle Inhalte fiktiv.
import { applyPatches } from 'immer';
import { describe, expect, it } from 'vitest';
import { setNewStand } from '../../../../src/io/wap-plan/standStore';
import { applyStand } from '../../../../src/model/wap/stand/stand';
import type { Beso, Entry, Id, MilTime, Plan } from '../../../../src/model/wap/types';
import { StandStoreDouble } from '../../support/stand/double';
import { beobachte, kopie } from '../../support/stand/hilfen';
import {
  beso,
  clock,
  ctx,
  DATUM,
  KVK_MO,
  mitEintraegen,
  PLAN_ID,
  pruefPlan,
} from '../../support/stand/plan';
import { PruefRenderer } from '../../support/stand/renderer';

const P0 = pruefPlan();
/** Erster Stand (V1) vor dem neuen Stand am DATUM. */
const ERSTER_STAND = { date: '2026-09-10', version: 1 } as const;
/** Montag der ersten Woche: Nummernkreis 10–19 (R-5.3-02). */
const MO = KVK_MO;

/** IDs der zehn nummerierten Beso am Mo: e101 → 10, …, e110 → 19. */
const NUMMERIERT: readonly (readonly [Id, number])[] = Array.from({ length: 10 }, (_, i) => [
  `e${String(101 + i)}`,
  10 + i,
]);
const ID_NR_12: Id = 'e103';
const ID_NR_15: Id = 'e106';

/** Beso am Mo, ohne Nummer, ein Zeitfenster zur Sortierzeit `at` (Minuten ab Mitternacht). */
function nummernlos(id: Id, text: string, at: MilTime): Beso {
  const b = beso(P0, id, MO, text, null);
  return { ...b, windows: b.windows.map((w) => ({ ...w, time: { form: 'point', at } })) };
}

/**
 * Ausgangszustand nach dem ersten Stand: Mo belegt 10–19; die Beso mit den Nummern in `gestrichen` sind gestrichen;
 * dazu die nummernlosen Beso `ohneNummer`.
 */
function ausgang(gestrichen: readonly number[], ohneNummer: readonly Beso[]): Plan {
  const belegt: Entry[] = NUMMERIERT.map(([id, nr]) =>
    beso(
      P0,
      id,
      MO,
      `Besprechung ${String(nr)} (fiktiv)`,
      nr,
      gestrichen.includes(nr) ? { status: 'cancelled' } : {},
    ),
  );
  return mitEintraegen(P0, [...belegt, ...ohneNummer], { stand: ERSTER_STAND });
}

function nummer(plan: Plan, id: Id): number | null | undefined {
  const e = plan.entries[id];
  return e?.type === 'beso' ? e.besoNumber : undefined;
}

/** Nummern der übrigen (nicht gestrichenen) nummerierten Beso, Schlüssel = ID. */
function uebrigeNummern(plan: Plan, ohne: readonly Id[]): Record<Id, number | null | undefined> {
  const out: Record<Id, number | null | undefined> = {};
  for (const [id] of NUMMERIERT) if (!ohne.includes(id)) out[id] = nummer(plan, id);
  return out;
}

/** Erwartete übrige Nummern: unverändert wie im Ausgangszustand. */
function erwarteteUebrige(ohne: readonly Id[]): Record<Id, number> {
  const out: Record<Id, number> = {};
  for (const [id, nr] of NUMMERIERT) if (!ohne.includes(id)) out[id] = nr;
  return out;
}

describe('E1-05 Runde 2 N4: nummernloser Beso beim Setzen des Stands (Q-016, F-64)', () => {
  it('[R-5.3-09][R-5.5-04] N4-d (Fall d): Mo 10–19, Beso 12 gestrichen, X ohne Nummer → neuer Stand: X trägt 12 in der Arbeitsfassung und in der gespeicherten Aufzeichnung, Beso 12 entfernt, übrige Nummern unverändert; inverse Patches geben X wieder ohne Nummer', async () => {
    const X: Id = 'e120';
    const p = ausgang([12], [nummernlos(X, 'Besprechung X (fiktiv)', 600)]);
    const vorher = kopie(p);

    const r = applyStand(p, { date: DATUM }, ctx);

    expect(nummer(r.plan, X), 'X trägt die frei gewordene Nummer 12').toBe(12);
    expect(r.plan.entries[ID_NR_12], 'gestrichener Beso 12 entfernt').toBeUndefined();
    expect(uebrigeNummern(r.plan, [ID_NR_12]), 'übrige Nummern unverändert').toEqual(
      erwarteteUebrige([ID_NR_12]),
    );
    const fixiert = (plan: Plan): boolean | undefined => {
      const e = plan.entries[X];
      return e?.type === 'beso' ? e.numberFixed : undefined;
    };
    expect(fixiert(vorher), 'Testaufbau: X vorher nicht fixiert').toBe(false);
    expect(fixiert(r.plan), 'numberFixed von X wie vorher').toBe(fixiert(vorher));
    expect(r.plan.stand).toEqual({ date: DATUM, version: 2 });

    const zurueck = applyPatches(r.plan, [...r.inversePatches]);
    expect(nummer(zurueck, X), 'inverse Patches: X wieder ohne Nummer').toBeNull();
    expect(zurueck, 'inverse Patches: Ausgangszustand wiederhergestellt').toEqual(vorher);
    expect(p, 'Eingabe unverändert (R-5.5-04)').toEqual(vorher);

    // setNewStand mit dem Prüf-Renderer: der gespeicherte Stand enthält X mit 12.
    const store = new StandStoreDouble(PLAN_ID, p);
    const render = new PruefRenderer();
    const e = await beobachte(setNewStand(store, PLAN_ID, { date: DATUM }, render, clock, { ctx }))
      .erledigt;
    expect(e).toMatchObject({ ok: true });
    const aufz = await store.standRecords(PLAN_ID);
    expect(aufz).toHaveLength(1);
    const a = aufz[0];
    expect(nummer(a?.plan ?? p, X), 'Aufzeichnung: X trägt 12').toBe(12);
    expect(a?.plan.entries[ID_NR_12], 'Aufzeichnung: Beso 12 entfernt').toBeUndefined();
    expect(uebrigeNummern(a?.plan ?? p, [ID_NR_12]), 'Aufzeichnung: übrige Nummern').toEqual(
      erwarteteUebrige([ID_NR_12]),
    );
    expect(nummer(store.dokument(PLAN_ID), X), 'Arbeitsfassung nach dem Setzen: X trägt 12').toBe(
      12,
    );
    expect(render.aufrufe.length, 'PDF des Stands gerendert').toBeGreaterThan(0);
    expect(
      render.aufrufe.map((c) => nummer(c.plan, X)),
      'jedes PDF des Stands aus der Fassung mit X = 12',
    ).toEqual(render.aufrufe.map(() => 12));
  });

  it('[R-5.3-09][R-5.5-04] N4-e (Fall e, F-13): Mo 10–19, Beso 12 und 15 gestrichen, X (1400), Y (0800) und Z (1000) ohne Nummer → Y trägt 12, Z trägt 15, X bleibt ohne Nummer, übrige Nummern unverändert', () => {
    // Anlage-Reihenfolge X, Z, Y (aufsteigende ID und createdSeq) ist umgekehrt zur Sortierzeit Y 0800, Z 1000,
    // X 1400: die Vergabe muss der Sortierzeit folgen, nicht der Anlage.
    const X: Id = 'e121';
    const Z: Id = 'e122';
    const Y: Id = 'e123';
    const p = ausgang(
      [12, 15],
      [
        nummernlos(X, 'Besprechung X (fiktiv)', 840),
        nummernlos(Z, 'Besprechung Z (fiktiv)', 600),
        nummernlos(Y, 'Besprechung Y (fiktiv)', 480),
      ],
    );
    const vorher = kopie(p);

    const r = applyStand(p, { date: DATUM }, ctx);

    expect(
      { Y: nummer(r.plan, Y), Z: nummer(r.plan, Z), X: nummer(r.plan, X) },
      'kleinste freie Nummer zuerst, aufsteigend nach Sortierzeit; X ohne freie Nummer',
    ).toEqual({ Y: 12, Z: 15, X: null });
    expect(r.plan.entries[ID_NR_12], 'gestrichener Beso 12 entfernt').toBeUndefined();
    expect(r.plan.entries[ID_NR_15], 'gestrichener Beso 15 entfernt').toBeUndefined();
    expect(uebrigeNummern(r.plan, [ID_NR_12, ID_NR_15]), 'übrige Nummern unverändert').toEqual(
      erwarteteUebrige([ID_NR_12, ID_NR_15]),
    );
    expect(p, 'Eingabe unverändert (R-5.5-04)').toEqual(vorher);
  });

  it('[R-5.3-09][R-5.5-04] N4-g (Gegenfall): Mo 10–19 belegt, kein Beso gestrichen, X ohne Nummer (Beso 10 seit dem letzten Stand geändert) → X bleibt ohne Nummer, alle Nummern unverändert', () => {
    const X: Id = 'e120';
    const p0 = ausgang([], [nummernlos(X, 'Besprechung X (fiktiv)', 600)]);
    // Ein nummerierter Beso am Mo ist seit dem letzten Stand geändert, damit die Nummerierung des Tages läuft
    // (TR-E105-N4-01).
    const e101 = p0.entries['e101'];
    if (e101 === undefined) throw new Error('Testaufbau');
    const p: Plan = { ...p0, entries: { ...p0.entries, e101: { ...e101, changed: true } } };
    const vorher = kopie(p);

    const r = applyStand(p, { date: DATUM }, ctx);

    expect(r.plan.entries[X], 'X bleibt in der Arbeitsfassung').toBeDefined();
    expect(nummer(r.plan, X), 'X bleibt ohne Nummer (Kreis voll, F-14)').toBeNull();
    expect(uebrigeNummern(r.plan, []), 'alle Nummern unverändert').toEqual(erwarteteUebrige([]));
    expect(r.plan.stand).toEqual({ date: DATUM, version: 2 });
    expect(p, 'Eingabe unverändert (R-5.5-04)').toEqual(vorher);
  });
});
