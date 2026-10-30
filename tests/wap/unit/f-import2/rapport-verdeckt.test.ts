// @vitest-environment jsdom
// F-IMPORT2 (Q-042, Auftraggeber 19.10.2026: teilweise verdeckte Einträge einheitlich mit der sichtbaren Zeit):
// Derselbe Rapport in Rap- und Planungsspalte ist ein Objekt nur bei gleicher Zeit (normalisierung.md 5.4
// «gleiches Kürzel, gleiche Zeit»). Ist die Form in der Planungsspalte teilweise verdeckt und dadurch gekürzt,
// bleibt sie ein eigener Rapport mit ihrer sichtbaren Zeit und dem Bericht «teilweise verdeckt»
// (R-8.2-40, R-8.2-41). Fiktive Arbeitsmappe.
import { describe, expect, it } from 'vitest';
import { block, bold, emptyWeek } from '../../fixtures/import/kp-workbook';
import { importWeeks, rows } from '../import/support';

const RAP = 3;
const KDO = 0;

function rapports(cover: boolean) {
  const o = importWeeks([
    emptyWeek({
      shapes: [
        block(0, [RAP, RAP], '2000', '2200', [[bold('KR')]]),
        block(0, [KDO, KDO], '2000', '2200', [[bold('KR')]]),
        ...(cover ? [block(0, [KDO, KDO], '2130', '2300', [[bold('Nachtübung')]])] : []),
      ],
    }),
  ]);
  return {
    o,
    list: rows(o.result.plan)
      .filter((r) => r.typ === 'Rapport')
      .map((r) => `${r.spalten} ${r.von}-${r.bis}`)
      .sort(),
  };
}

describe('Rapport in Rap- und Planungsspalte bei teilweiser Verdeckung', () => {
  it('[R-8.2-41] gleiche Zeit, nicht verdeckt: ein Rapport in Rap und Planungsspalte', () => {
    expect(rapports(false).list).toEqual(['Rap|Kdo 2000-2200']);
  });

  it('[R-8.2-41] Form in der Planungsspalte unten verdeckt: eigener Rapport mit der sichtbaren Zeit, Rap unverändert', () => {
    const { o, list } = rapports(true);
    expect(list).toEqual(['Kdo 2000-2130', 'Rap 2000-2200']);
    const partly = o.report.items.filter((i) => i.kind === 'partlyHidden');
    expect(partly).toHaveLength(1);
    const target = rows(o.result.plan).find((r) => r.entryId === partly[0]?.target.entryId);
    expect(`${target?.typ} ${target?.spalten} ${target?.von}-${target?.bis}`).toBe(
      'Rapport Kdo 2000-2130',
    );
  });
});
