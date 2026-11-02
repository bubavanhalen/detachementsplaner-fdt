// @vitest-environment jsdom
// Paket E1-02l (R-10-54, R-10-55; Auftraggeber R1/R2 vom 09.10.2026): Prüfung am fertigen PDF der realistischen
// Demowochen (pseudonymisierte KVK-Fixture, fiktive FDT-Woche) und einer Belastungswoche (fiktiv): kein «…» im
// Spaltenkopfbereich; jedes Rapportkürzel und jede Beso-Nummer steht vollständig als eigener Lauf. Nur das mit
// readPdf gelesene PDF wird geprüft (H1).
import { describe, expect, it } from 'vitest';
import type { Beso, Plan, Rapport } from '../../../../src/model/wap/types';
import { createE102lDemoPlans } from '../../../wap-e2e/e1-02l/support/demo';
import { analysiere } from '../../support/page/analyse';
import { bereiche, enthaeltPunkt, laeufe, mitte, umriss } from '../../support/page/pdf-seite';
import { seitePdf } from '../../support/page/seite';
import { tagDatum } from '../../support/page/varianten';

function sichtbareDaten(plan: Plan, weekId: string): Set<string> {
  const w = plan.weeks.find((x) => x.id === weekId);
  if (w === undefined) throw new Error('Woche fehlt');
  return new Set(
    w.days.flatMap((d, i) => (d.display === 'hidden' ? [] : [tagDatum(w.startDate, i)])),
  );
}

async function pruefeWoche(fall: string, plan: Plan, weekId: string): Promise<void> {
  const { info } = await seitePdf(fall, plan, weekId);
  const b = bereiche(info, 1);
  const runs = laeufe(info, 1);
  // (a) Kopfbereich der Spalten (zwischen Tageskopf und Rasterbeginn): kein «…».
  const kopf = runs.filter((t) => {
    const u = umriss(t);
    return u.y >= b.tageskopfUnten - 0.01 && u.y + u.h <= b.yFrom + 0.01;
  });
  expect(kopf.length, `${fall}: Spaltenköpfe gelesen`).toBeGreaterThan(0);
  for (const t of kopf) expect(t.text, `${fall}: Spaltenkopf`).not.toContain('…');
  // (b) Rapportkürzel und Beso-Nummern vollständig als Lauf; nie mit «…».
  const daten = sichtbareDaten(plan, weekId);
  const texte = runs.map((t) => t.text.trim());
  const eintraege = Object.values(plan.entries);
  const rapporte = eintraege.filter(
    (e): e is Rapport => e.type === 'rapport' && daten.has(e.date) && e.display !== 'onlyInColumns',
  );
  for (const r of rapporte) {
    expect(texte, `${fall}: Rapportkürzel «${r.code}»`).toContain(r.code.trim());
  }
  const beso = eintraege.filter(
    (e): e is Beso => e.type === 'beso' && daten.has(e.date) && e.besoNumber !== null,
  );
  for (const e of beso) {
    expect(
      texte.filter((t) => t === String(e.besoNumber)).length,
      `${fall}: Beso-Nummer ${String(e.besoNumber)}`,
    ).toBeGreaterThanOrEqual(1);
  }
  // (c) Kein Lauf mit «…» in einem Rapport- oder Beso-Kästchen (Blocktitel dürfen nach Beschrieb 10 gekürzt werden).
  const an = analysiere(info, plan, weekId);
  const kaesten = an.inhalt.eintraege
    .filter((e) => e.klasse === 'rapportBox' || e.klasse === 'besoBox')
    .map((e) => e.flaeche.rect);
  for (const t of runs) {
    if (!t.text.includes('…')) continue;
    const m = mitte(umriss(t));
    const imKaestchen = kaesten.some((r) => enthaeltPunkt(r, m.x, m.y, 0.01));
    expect(imKaestchen, `${fall}: «${t.text}» gekürzt in einem Kästchen`).toBe(false);
  }
}

describe('Fertiges PDF der Demowochen (R-10-54, R-10-55)', () => {
  it('[R-10-54][R-10-55] Realistisch KVK und FDT-Woche: kein «…» in Spaltenköpfen, Rapportkürzel und Beso-Nummern vollständig', async () => {
    const [real] = createE102lDemoPlans();
    const plan = real as Plan;
    for (const [i, week] of plan.weeks.entries()) {
      await pruefeWoche(`e1-02l-real-${String(i)}`, plan, week.id);
    }
  });

  it('[R-10-54][R-10-55] Belastungstest (alle Wochen): kein «…» in Spaltenköpfen, Rapportkürzel und Beso-Nummern vollständig', async () => {
    const [, stress] = createE102lDemoPlans();
    const plan = stress as Plan;
    for (const [i, week] of plan.weeks.entries()) {
      await pruefeWoche(`e1-02l-last-${String(i)}`, plan, week.id);
    }
  });
});
