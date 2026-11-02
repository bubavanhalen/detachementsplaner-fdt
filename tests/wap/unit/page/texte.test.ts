// @vitest-environment jsdom
// Paket E1-02e: Texte der Seite – Wochenzeile, Titel, Tagesköpfe, Stand, Einpassung einzeiliger Texte und
// weitere Vorlagen (R-6-05, R-10-13, R-4.9-16; Vertrag E1-02e Notiz «Ausarbeitung Schritt 2» B `weekTitle`,
// `weekRangeText`, `fitSingleLine`, E1, E2, E6, J; V-02e-5, V-02e-9, V-02e-10). Fiktive Pläne.
import { describe, expect, it } from 'vitest';
import { ModelError } from '../../../../src/model/wap/errors';
import { createPlanFromTemplate } from '../../../../src/model/wap/factories';
import {
  fitSingleLine,
  weekRangeText,
  weekTitle,
} from '../../../../src/model/wap/layout/page/texts';
import type { PageTextKind, WeekPageLayout } from '../../../../src/model/wap/layout/page/types';
import type { PageModel, TextItem } from '../../../../src/model/wap/layout/pageModel';
import { measureRuns } from '../../../../src/model/wap/layout/text/measure';
import type { StyledRun } from '../../../../src/model/wap/layout/text/types';
import {
  builtInTemplates,
  kpTemplate,
  type LevelTemplate,
} from '../../../../src/model/wap/template';
import type { Plan } from '../../../../src/model/wap/types';
import { basePlan, week } from '../../support/model/builders';
import { optionen, seite } from '../../support/page/seite';
import { KVK_WOCHE, kvk } from '../../support/page/varianten';

/** Geschütztes Leerzeichen U+00A0 (als Code, damit es sichtbar bleibt). */
const NBSP = String.fromCodePoint(0xa0);
const fett = (text: string): StyledRun => ({ text, weight: 'bold' });
const normal = (text: string): StyledRun => ({ text, weight: 'regular' });
const text = (runs: readonly { text: string }[]) => runs.map((r) => r.text).join('');

function texteDerArt(L: WeekPageLayout, art: PageTextKind, seiteNr = 0): string[] {
  return L.texts
    .filter((t) => t.kind === art && t.page === seiteNr)
    .map((t) => text(((L.pages[t.page] as PageModel).items[t.item] as TextItem).runs));
}

function planAb(start: string): Plan {
  return basePlan({ weeks: [week('w26', start), week('w27', '2026-10-05')] });
}

describe('Wochenzeile und Titel (R-6-05, R-4.9-01; V-02e-10)', () => {
  it('[R-6-05] weekRangeText: Start 28.09.2026 → «Woche vom 28.09.2026 bis 04.10.2026 KW 40»', () => {
    expect(weekRangeText(kvk(), KVK_WOCHE)).toBe('Woche vom 28.09.2026 bis 04.10.2026 KW 40');
  });

  it('[R-6-05] Startdatum geändert → Datum und KW neu: 05.10.2026 → KW 41; 28.12.2026 → bis 03.01.2027 KW 53; 29.12.2025 → KW 1 ohne führende Null (V-02e-10)', () => {
    expect(weekRangeText(planAb('2026-10-05'), 'w26')).toBe(
      'Woche vom 05.10.2026 bis 11.10.2026 KW 41',
    );
    expect(weekRangeText(planAb('2026-12-28'), 'w26')).toBe(
      'Woche vom 28.12.2026 bis 03.01.2027 KW 53',
    );
    expect(weekRangeText(planAb('2025-12-29'), 'w26')).toBe(
      'Woche vom 29.12.2025 bis 04.01.2026 KW 1',
    );
    expect(weekRangeText(planAb('2026-01-05'), 'w26')).toBe(
      'Woche vom 05.01.2026 bis 11.01.2026 KW 2',
    );
  });

  it('[R-6-05] weekRangeText und weekTitle mit unbekannter Woche → ModelError «unknownWeek»', () => {
    for (const f of [
      () => weekRangeText(kvk(), 'w99'),
      () => weekTitle(kvk(), 'w99', kpTemplate()),
    ]) {
      let e: unknown;
      try {
        f();
      } catch (x) {
        e = x;
      }
      expect(e).toBeInstanceOf(ModelError);
      expect((e as ModelError).code).toBe('unknownWeek');
    }
  });

  it('[R-6-05] weekTitle nach titlePattern: jedes {unit} und {weekLabel} ersetzt, übrige Zeichen wörtlich', () => {
    const p = kvk();
    expect(weekTitle(p, KVK_WOCHE, kpTemplate())).toBe('Inf Ustü Kp 61/4 Arbeitsplan KVK');
    const t: LevelTemplate = { ...kpTemplate(), titlePattern: '{weekLabel} – {unit} / {unit} {x}' };
    expect(weekTitle(p, KVK_WOCHE, t)).toBe('KVK – Inf Ustü Kp 61/4 / Inf Ustü Kp 61/4 {x}');
    const ohne: LevelTemplate = { ...kpTemplate(), titlePattern: 'Plan' };
    expect(weekTitle(p, KVK_WOCHE, ohne)).toBe('Plan');
  });
});

describe('Tagesköpfe und Stand im Seitenmodell (R-6-05)', () => {
  it('[R-6-05] Start 28.09.2026: Köpfe «Montag»/«28.09.2026» und «Sa 03.10.26»; Wochenzeile im Kopf', () => {
    const L = seite(kvk(), KVK_WOCHE);
    const koepfe = texteDerArt(L, 'dayHead');
    expect(koepfe).toContain('Montag');
    expect(koepfe).toContain('28.09.2026');
    expect(koepfe).toContain('Freitag');
    expect(koepfe).toContain('02.10.2026');
    expect(koepfe).toContain('Sa 03.10.26');
    expect(koepfe).toContain('So 04.10.26');
    expect(texteDerArt(L, 'weekLine')).toEqual(['Woche vom 28.09.2026 bis 04.10.2026 KW 40']);
  });

  it('[R-6-05] Startdatum 05.10.2026 → Köpfe «Montag»/«05.10.2026», «Sa 10.10.26», Wochenzeile KW 41', () => {
    const p = kvk();
    const verschoben: Plan = {
      ...p,
      weeks: p.weeks.map((w) => ({ ...w, startDate: '2026-10-05' })),
      entries: {},
    };
    const L = seite(verschoben, KVK_WOCHE);
    const koepfe = texteDerArt(L, 'dayHead');
    expect(koepfe).toContain('05.10.2026');
    expect(koepfe).toContain('Sa 10.10.26');
    expect(koepfe).not.toContain('28.09.2026');
    expect(texteDerArt(L, 'weekLine')).toEqual(['Woche vom 05.10.2026 bis 11.10.2026 KW 41']);
  });

  it('[R-6-05] Stand aus plan.stand «17.09.2026»; standOverride geht vor; ohne beides «Entwurf» (V-02e-5)', () => {
    const p = kvk();
    const stand = (L: WeekPageLayout) => texteDerArt(L, 'stand').join(' ');
    expect(stand(seite(p, KVK_WOCHE))).toContain('17.09.2026');
    const ueber = seite(
      p,
      KVK_WOCHE,
      optionen({ standOverride: { date: '2026-10-01', version: 3 } }),
    );
    expect(stand(ueber)).toContain('01.10.2026');
    expect(stand(ueber)).not.toContain('17.09.2026');
    const ohne = seite({ ...p, stand: null }, KVK_WOCHE);
    expect(stand(ohne)).toContain('Entwurf');
    expect(stand(ohne)).not.toMatch(/\d{2}\.\d{2}\.\d{4}/);
    const nurUeber = seite(
      { ...p, stand: null },
      KVK_WOCHE,
      optionen({ standOverride: { date: '2026-09-30', version: 1 } }),
    );
    expect(stand(nurUeber)).toContain('30.09.2026');
    expect(stand(nurUeber)).not.toContain('Entwurf');
  });
});

describe('fitSingleLine (R-10-13; E6, V-02e-9, V29)', () => {
  const S = { standard: 5, min: 4.5 };
  const montag = [fett('Montag')];
  const breite = (runs: readonly StyledRun[], s: number) => measureRuns(runs, s);

  it('[R-10-13] Breite in 5 pt → «fits» in 5 pt, Text unverändert', () => {
    const r = fitSingleLine(montag, breite(montag, 5), S);
    expect(r.result).toBe('fits');
    expect(r.sizePt).toBe(5);
    expect(r.runs).toEqual(montag);
  });

  it('[R-10-13] Breite zwischen 4,5 und 5 pt → «reduced» mit der grössten passenden 0,25-pt-Stufe', () => {
    const b475 = breite(montag, 4.75);
    const a = fitSingleLine(montag, b475 + 0.001, S);
    expect(a.result).toBe('reduced');
    expect(a.sizePt).toBe(4.75);
    expect(text(a.runs)).toBe('Montag');
    const b = fitSingleLine(montag, b475 - 0.001, S);
    expect(b.result).toBe('reduced');
    expect(b.sizePt).toBe(4.5);
    const c = fitSingleLine(montag, breite(montag, 5) - 0.001, S);
    expect(c.sizePt).toBe(4.75);
  });

  it('[R-10-13] Breite = Breite in 4,5 pt − 0,01 → «ellipsis» in 4,5 pt: längstes Anfangsstück plus «…», keine Kurzform', () => {
    const w = breite(montag, 4.5) - 0.01;
    const r = fitSingleLine(montag, w, S);
    expect(r.result).toBe('ellipsis');
    expect(r.sizePt).toBe(4.5);
    const t = text(r.runs);
    expect(t.endsWith('…')).toBe(true);
    expect(t).not.toBe('Mo');
    expect(measureRuns(r.runs, 4.5)).toBeLessThanOrEqual(w + 1e-6);
    const anfang = t.slice(0, -1);
    expect('Montag'.startsWith(anfang)).toBe(true);
    // Das nächstlängere Anfangsstück passt nicht mehr (längstes Anfangsstück).
    const laenger = `${'Montag'.slice(0, anfang.length + 1)}…`;
    expect(measureRuns([fett(laenger)], 4.5)).toBeGreaterThan(w);
    expect(r.runs.every((x) => x.weight === 'bold')).toBe(true);
  });

  it('[R-10-13] Breite unter «…» in 4,5 pt → «omitted», kein Text', () => {
    const w = measureRuns([fett('…')], 4.5) - 0.01;
    const r = fitSingleLine(montag, w, S);
    expect(r.result).toBe('omitted');
    expect(text(r.runs)).toBe('');
  });

  it('[R-10-13] Zeilenwechsel CR LF, CR, LF → Leerzeichen, Rand getrimmt (auch U+00A0); Schnitte bleiben', () => {
    const r = fitSingleLine([fett(' AVOR\r\n'), normal(`Fahne\rTeil\nB${NBSP}`)], 1000, S);
    expect(r.result).toBe('fits');
    expect(text(r.runs)).toBe('AVOR Fahne Teil B');
    expect(r.runs.filter((x) => x.weight === 'bold').map((x) => x.text.trim())).toEqual(['AVOR']);
  });

  it('[R-10-13] ungültige Breite oder Grössen → RangeError (NaN, 0, −1, ∞; min > standard, min ≤ 0)', () => {
    expect(fitSingleLine(montag, 50, S).result).toBe('fits');
    for (const w of [Number.NaN, 0, -1, Number.POSITIVE_INFINITY]) {
      expect(() => fitSingleLine(montag, w, S), `Breite ${w}`).toThrow(RangeError);
    }
    for (const g of [
      { standard: 4, min: 4.5 },
      { standard: 5, min: 0 },
      { standard: Number.NaN, min: 4.5 },
    ]) {
      expect(() => fitSingleLine(montag, 50, g), JSON.stringify(g)).toThrow(RangeError);
    }
  });
});

describe('Weitere Vorlagen als Daten (R-4.9-16)', () => {
  it('[R-4.9-16] fiktive Vorlage «stab» (titlePattern «Stabsplan {weekLabel}», 2 Kategorien, Seitengeometrie kp): Titel «Stabsplan KVK», genau 2 Legendenzeilen', () => {
    const kp = kpTemplate();
    const stab: LevelTemplate = {
      ...kp,
      id: 'stab',
      label: 'Stab',
      titlePattern: 'Stabsplan {weekLabel}',
      legend: [
        {
          name: 'Stab',
          legendLabel: 'Leitung Stab',
          color: { r: 200, g: 220, b: 240 },
          neutral: false,
          inLegend: true,
        },
        {
          name: 'Gast',
          legendLabel: 'Gäste',
          color: { r: 240, g: 220, b: 200 },
          neutral: false,
          inLegend: true,
        },
      ],
      functionList: [],
      rapportCodes: [{ code: 'SR', categoryName: 'Stab' }],
      columnSets: [
        {
          name: 'Stab',
          columns: [
            {
              name: 'Stab',
              kind: 'planning',
              weight: 'normal',
              labelOrientation: 'horizontal',
              origin: 'manual',
            },
            {
              name: 'Rap',
              kind: 'rap',
              weight: 'normal',
              labelOrientation: 'horizontal',
              origin: 'manual',
            },
            {
              name: 'Beso',
              kind: 'beso',
              weight: 'normal',
              labelOrientation: 'horizontal',
              origin: 'manual',
            },
          ],
        },
      ],
      pageGeometryId: 'kp',
    };
    const templates = new Map([...builtInTemplates(), [stab.id, stab]]);
    const plan = createPlanFromTemplate(stab, {
      planId: 'plan-stab',
      startDate: '2026-09-28',
      weekCount: 1,
      weekLabels: ['KVK'],
    });
    const w = plan.weeks[0];
    const L = seite(plan, w?.id ?? '', optionen({ templates }));
    expect(w).toBeDefined();
    expect(texteDerArt(L, 'title')).toEqual(['Stabsplan KVK']);
    expect(texteDerArt(L, 'legendLabel')).toEqual(['Leitung Stab', 'Gäste']);
    // Gegenprobe: dieselbe Woche mit der Kp-Vorlage ergibt den Kp-Titel.
    const kpPlan: Plan = { ...plan, templateId: 'kp' };
    expect(texteDerArt(seite(kpPlan, w?.id ?? '', optionen({ templates })), 'title')).toEqual([
      'Arbeitsplan KVK',
    ]);
  });
});
