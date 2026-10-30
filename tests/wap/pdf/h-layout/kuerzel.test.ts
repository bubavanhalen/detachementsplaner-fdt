// @vitest-environment jsdom
// Paket H-LAYOUT, Zusatzbefund visual-qa (c) (R-10-55 sinngemäss für die Kürzelliste, R-10-53, R-7-11): Ein Kürzel
// der Kürzelliste wird nie mit «…» gekürzt. Passt es nicht in die Kürzelspalte, steht es vollständig in
// Mindestgrösse; die Bedeutung rückt dahinter; Befund P8. Variante der pseudonymisierten KVK-Fixture mit einem
// fiktiven langen Rapportkürzel.
import { describe, expect, it } from 'vitest';
import { runChecks } from '../../../../src/model/wap/checks/run';
import { layoutWeekPage } from '../../../../src/model/wap/layout/page/compose';
import { builtInTemplates } from '../../../../src/model/wap/template';
import type { Plan } from '../../../../src/model/wap/types';
import { rapport, withEntries } from '../../support/model/builders';
import { laeufe, zeilen } from '../../support/page/pdf-seite';
import { seitePdf } from '../../support/page/seite';
import { KVK_WOCHE, kvk, MO } from '../../support/page/varianten';

const LANG = 'Abschlussrapport';

function variante(): Plan {
  const p = kvk();
  const kp = p.legend.find((c) => c.name === 'Ltg Kp')?.id ?? '';
  return {
    ...withEntries(p, [
      rapport('h1', 900, {
        date: MO,
        code: LANG,
        categoryId: kp,
        time: { form: 'range', from: 1260, to: 1320 },
      }),
    ]),
    abbreviationMeanings: { [LANG]: 'Rapport zum Abschluss' },
  };
}

describe('Kürzelliste ohne Kürzung (R-10-55)', () => {
  it('[R-10-55][R-10-53] langes Kürzel: vollständig, kein «…» in der Seitenleiste, Bedeutung rechts dahinter ohne Überlappung, Schrift ≥ 4,5 pt', async () => {
    const { layout, info } = await seitePdf('h-layout-kuerzel', variante(), KVK_WOCHE);
    const leiste = layout.regions.sidebar;
    const z = zeilen(laeufe(info)).filter(
      (x) => x.umriss.x >= leiste.x - 0.5 && x.umriss.y >= leiste.y - 0.5,
    );
    const k = z.find((x) => x.text === LANG);
    expect(k, 'Kürzel vollständig').toBeDefined();
    expect(z.some((x) => x.text.includes('…'))).toBe(false);
    const b = z.find((x) => x.text === 'Rapport zum Abschluss');
    expect(b).toBeDefined();
    if (k === undefined || b === undefined) return;
    expect(k.sizePt).toBeGreaterThanOrEqual(4.5);
    expect(Math.abs(k.baselineY - b.baselineY)).toBeLessThan(0.01);
    expect(b.umriss.x).toBeGreaterThanOrEqual(k.umriss.x + k.umriss.w);
  });

  it('[R-7-11][R-10-55] das zu lange Kürzel ergibt genau einen Befund P8 der Kürzelliste mit Ursache und nächstem Schritt', () => {
    const plan = variante();
    const opts = { paper: 'A4' as const, showStatus: true, templates: builtInTemplates() };
    const p8 = runChecks({ plan, layoutFor: (id) => layoutWeekPage(plan, id, opts) }).filter(
      (f) => f.rule === 'P8' && f.region === 'sidebar',
    );
    expect(p8).toHaveLength(1);
    expect(p8[0]?.message.cause).toContain('Kürzelspalte');
    expect(p8[0]?.message.cause).toContain(`«${LANG}»`);
    expect(p8[0]?.message.nextStep).toContain('Kürzel kürzen');
  });

  it('[R-7-11][R-10-55] zwei zu lange Kürzel: je ein Befund P8, jeder nennt sein Kürzel', () => {
    const zweit = 'Zweitlangrapport';
    const p = variante();
    const kp = p.legend.find((c) => c.name === 'Ltg Kp')?.id ?? '';
    const plan = withEntries(p, [
      rapport('h2', 901, {
        date: MO,
        code: zweit,
        categoryId: kp,
        time: { form: 'range', from: 1140, to: 1200 },
      }),
    ]);
    const opts = { paper: 'A4' as const, showStatus: true, templates: builtInTemplates() };
    const p8 = runChecks({ plan, layoutFor: (id) => layoutWeekPage(plan, id, opts) }).filter(
      (f) => f.rule === 'P8' && f.region === 'sidebar',
    );
    expect(p8.map((f) => f.message.cause.match(/«([^»]+)»/)?.[1]).sort()).toEqual(
      [LANG, zweit].sort(),
    );
  });
});
