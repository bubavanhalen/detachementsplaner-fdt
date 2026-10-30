// @vitest-environment node
// Paket F-LAYOUT2, HT-02 (Beschrieb 5.7 «Meldungen mit Ursache und nächstem Schritt»; Vertrag E1-06 P17; R-7-13):
// P17 meldet «Nummernkreis … ist voll» nur, wenn der Nummernkreis des Tages wirklich voll ist. Hat ein Beso an einem
// Tag mit freien Nummern keine Nummer (z.B. aus einer Plan-Datei), nennt die Meldung diese Ursache und den nächsten
// Schritt «Tag neu nummerieren». Fiktive Beso.
import { describe, expect, it } from 'vitest';
import { type Finding, runChecks } from '../../../../src/model/wap/checks';
import { layoutWeekPage } from '../../../../src/model/wap/layout/page/compose';
import type { Beso, Id, Plan } from '../../../../src/model/wap/types';
import { pageOptions } from '../../support/i3/seite';
import { besos, entry, kpPlan } from '../../support/i5/plan';

const p17 = (plan: Plan): readonly Finding[] =>
  runChecks({ plan, layoutFor: (w) => layoutWeekPage(plan, w, pageOptions()) }).filter(
    (f) => f.rule === 'P17',
  );

describe('F-LAYOUT2 HT-02: Meldung P17 mit passender Ursache', () => {
  it('[R-7-13] Beso ohne Nummer an einem Tag mit drei Beso: Ursache «noch freie Nummern», nicht «voll»; nächster Schritt Tag neu nummerieren', () => {
    const { plan: base, ids } = besos(kpPlan(1), 3);
    const id = ids[2] as Id;
    const b = entry(base, id) as Beso;
    const plan: Plan = { ...base, entries: { ...base.entries, [id]: { ...b, besoNumber: null } } };
    const [f] = p17(plan);
    expect(f?.entryId).toBe(id);
    expect(f?.message.cause).not.toContain('voll');
    expect(f?.message.cause).toContain('«Visite 3» hat keine Nummer («–»)');
    expect(f?.message.cause).toContain('10–19');
    expect(f?.message.cause).toContain('frei');
    expect(f?.message.nextStep).toContain('neu nummerieren');
  });

  it('[R-7-13] elf Beso an einem Tag: Ursache «Nummernkreis voll» wie bisher', () => {
    const { plan } = besos(kpPlan(1), 11);
    const [f] = p17(plan);
    expect(f?.message.cause).toContain('11 Beso');
    expect(f?.message.cause).toContain('der Nummernkreis 10–19 ist voll');
    expect(f?.message.nextStep).toBe(
      'Beso zusammenlegen, auf einen anderen Tag verschieben oder als Block erfassen.',
    );
  });
});
