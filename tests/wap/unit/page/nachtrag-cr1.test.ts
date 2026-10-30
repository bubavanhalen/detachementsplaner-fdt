// @vitest-environment jsdom
// Paket E1-02e: Testnachtrag zum Code-Review Runde 1 (CR-E102e-01, -02, -05, -08). Seitenmodell; `fallbacks`,
// `texts` und `TextItem.frame` sind Rückgabewerte (Vertrag E1-02e E3, E4, E6 «fitSingleLine», «TextItem.frame»,
// F «Reihenfolge von fallbacks», S3-12, S3-20). Pseudonymisierte KVK-Fixture, fiktive Vorlagen und Texte.
import { describe, expect, it } from 'vitest';
import { GRID_CONSTANTS } from '../../../../src/model/wap/layout/grid';
import type { ColumnGeometry } from '../../../../src/model/wap/layout/grid/types';
import { pageGeometryFor } from '../../../../src/model/wap/layout/page/geometry';
import type {
  PageFallbackEvent,
  PageOptions,
  WeekPageLayout,
} from '../../../../src/model/wap/layout/page/types';
import type { PageModel, Rect, TextItem } from '../../../../src/model/wap/layout/pageModel';
import { measureRuns } from '../../../../src/model/wap/layout/text/measure';
import { ascentPt, lineHeightPt } from '../../../../src/model/wap/layout/text/metrics';
import { builtInTemplates } from '../../../../src/model/wap/template';
import type { FontSizes, LevelTemplate } from '../../../../src/model/wap/template/types';
import type { LtgCategory, Plan } from '../../../../src/model/wap/types';
import { dayRemark, multiDayRemark } from '../../support/model/builders';
import { optionen, seite } from '../../support/page/seite';
import {
  KVK_TAGE,
  KVK_WOCHE,
  kvk,
  leererKvk,
  MO,
  mitEintraegen,
  mitWoche,
} from '../../support/page/varianten';

const EPS = 0.01;
const ELLIPSE = String.fromCodePoint(0x2026);

/** Optionen mit der Kp-Vorlage, abgeändert um `over` (fiktive Vorlage, AR0-18: Vorlagen als Daten). */
function mitVorlage(over: Partial<LevelTemplate>): PageOptions {
  const ts = builtInTemplates();
  const kp = ts.get('kp') as LevelTemplate;
  return optionen({ templates: new Map([['kp', { ...kp, ...over }]]) });
}

function vorlageKp(): LevelTemplate {
  return builtInTemplates().get('kp') as LevelTemplate;
}

/** Alle Grössen gleich `s` (fiktive Vorlage mit grosser Mindestgrösse). */
function grossen(s: number): FontSizes {
  return { standard: s, blockTitle: s, besoNumber: s, rapportCode: s, min: s };
}

function textVon(t: TextItem): string {
  return t.runs.map((r) => r.text).join('');
}

/** Zeilenkasten eines TextItem (rotation 0: Grundlinienbeginn − ascent; 90: Grundlinienbeginn = linke untere Ecke). */
function kasten(t: TextItem): Rect {
  const w = measureRuns(t.runs, t.sizePt);
  const a = ascentPt(t.sizePt);
  const lh = lineHeightPt(t.sizePt);
  if (t.rotation === 0) return { x: t.x, y: t.baselineY - a, w, h: lh };
  return { x: t.x - a, y: t.baselineY - w, w: lh, h: w };
}

function imRahmen(t: TextItem): boolean {
  const b = kasten(t);
  const f = t.frame;
  return (
    b.x >= f.x - EPS &&
    b.y >= f.y - EPS &&
    b.x + b.w <= f.x + f.w + EPS &&
    b.y + b.h <= f.y + f.h + EPS
  );
}

function schneidet(a: Rect, b: Rect): boolean {
  const sx = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const sy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return sx > 0.001 && sy > 0.001;
}

function items(
  L: WeekPageLayout,
  kind: string,
): { page: number; date: string | null; t: TextItem }[] {
  return L.texts
    .filter((r) => r.kind === kind)
    .map((r) => ({
      page: r.page,
      date: r.date,
      t: (L.pages[r.page] as PageModel).items[r.item] as TextItem,
    }));
}

function felder(L: WeekPageLayout, field: string): PageFallbackEvent[] {
  return L.fallbacks.filter((e) => e.field === field);
}

describe('Bemerkungsnummer in der Nr-Spalte (CR-E102e-01; E4, E6, S3-12, F)', () => {
  const NR = 1234567;
  const LEGENDE_LANG =
    'Fiktive Kategorie mit einer ausserordentlich langen Legendenbeschriftung für alle Züge und Gruppen';
  function plan(): Plan {
    const p = leererKvk();
    const legend: LtgCategory[] = p.legend.map((c, i) =>
      i === 0 ? { ...c, legendLabel: LEGENDE_LANG } : c,
    );
    return mitEintraegen({ ...p, unit: 'Einheit '.repeat(25).slice(0, 200), legend }, [
      multiDayRemark('e990', 990, {
        text: 'Kurzer Hinweis.',
        number: NR,
        scope: { kind: 'week', weekId: KVK_WOCHE },
      }),
    ]);
  }

  it('[R-14.3-02][R-10-39] (CR-E102e-01) Nummer 1234567: bleibt in ihrem frame, überlappt keinen anderen Text; in der Grösse σ der Bemerkungen zu breit (S3-22 (c)) → «…» (längstes Anfangsstück) in σ mit Ereignis sidebar/remarkNumber, eingereiht nach dem Kopf und vor der Legende (F)', () => {
    const L = seite(plan(), KVK_WOCHE);
    const nummern = items(L, 'remarkNumber');
    const ev = felder(L, 'remarkNumber');
    expect(ev, 'genau ein Ereignis zur Nummer (E6: entryId, piece null)').toEqual([
      {
        kind: 'ellipsis',
        region: 'sidebar',
        weekId: KVK_WOCHE,
        date: null,
        entryId: null,
        piece: null,
        dropped: [],
        field: 'remarkNumber',
        columnId: null,
      },
    ]);
    const e = ev[0] as PageFallbackEvent;
    expect(nummern.length).toBe(1);
    const { page, t } = nummern[0] as { page: number; t: TextItem };
    // S3-22 (c): eingepasst mit { standard: σ, min: σ }, σ = gemeinsame Grösse der Bemerkungstexte (S3-12).
    const bem = items(L, 'remark').filter((x) => x.page === page);
    expect(bem.length).toBeGreaterThan(0);
    const sigma = (bem[0] as { t: TextItem }).t.sizePt;
    for (const x of bem) expect(x.t.sizePt).toBe(sigma);
    const nr = String(NR);
    const breite = (s: string) => measureRuns([{ text: s, weight: 'regular' }], sigma);
    // Vorbedingungen (Metriken): die volle Nummer ist in σ breiter als frame, «…» allein passt.
    expect(breite(nr)).toBeGreaterThan(t.frame.w + EPS);
    expect(breite(ELLIPSE)).toBeLessThanOrEqual(t.frame.w);
    // E6 Schritt 2 (wie E1-02d 2e) mit min = σ: längstes Anfangsstück plus «…» in σ.
    let k = nr.length - 1;
    while (k > 0 && breite(nr.slice(0, k) + ELLIPSE) > t.frame.w + 1e-6) k--;
    expect(textVon(t)).toBe(nr.slice(0, k) + ELLIPSE);
    expect(t.sizePt).toBe(sigma);
    expect(imRahmen(t), `Nummer «${textVon(t)}» in ihrem frame`).toBe(true);
    const k0 = kasten(t);
    const seiteItems = (L.pages[page] as PageModel).items.filter(
      (x): x is TextItem => x.kind === 'text' && x !== t && x.runs.length > 0,
    );
    for (const x of seiteItems)
      expect(schneidet(k0, kasten(x)), `Nummer überlappt «${textVon(x)}»`).toBe(false);
    // Reihenfolge F: Kopf vor der Seitenleiste; in der Seitenleiste Bemerkungen vor der Legende (B-Kp-72).
    const iNr = L.fallbacks.indexOf(e);
    const iKopf = L.fallbacks.findIndex((x) => x.region === 'header');
    const iLegende = L.fallbacks.findIndex((x) => x.field === 'legendLabel');
    expect(iKopf).toBeGreaterThanOrEqual(0);
    expect(iLegende).toBeGreaterThanOrEqual(0);
    expect(iKopf).toBeLessThan(iNr);
    expect(iNr).toBeLessThan(iLegende);
  });
});

describe('Köpfe im Terminbereich (CR-E102e-02; E3, E6 fitSingleLine, F)', () => {
  const vierzigAmMo = () =>
    Array.from({ length: 40 }, (_, i) =>
      dayRemark(`e${600 + i}`, 600 + i, {
        date: MO,
        text: `Bemerkung ${String(i + 1).padStart(2, '0')}`,
      }),
    );

  it('[R-10-39][R-10-42] (CR-E102e-02) überlanges «Termine» (agendaHeading) mit Fortsetzungsseite: genau ein Ereignis region agenda, field agendaLabel; kein zweites für die Fortsetzungsseite; jedes «Termine» in seinem frame', () => {
    const lang = Array.from(
      { length: 4 },
      (_, i) =>
        `Teil ${i + 1}: Termine und Anlässe der ganzen Woche für alle Züge, Gruppen und Detachemente`,
    ).join(' – ');
    const L = seite(
      mitEintraegen(kvk(), vierzigAmMo()),
      KVK_WOCHE,
      mitVorlage({ agendaHeading: lang }),
    );
    expect(L.pages.length).toBeGreaterThan(1);
    // Vorbedingung: der Text ist in Mindestgrösse länger als der ganze Terminbereich (senkrecht gesetzt).
    expect(
      measureRuns([{ text: lang, weight: 'bold' }], vorlageKp().fontSizes.min),
    ).toBeGreaterThan(L.frame.frame.h);
    expect(felder(L, 'agendaLabel'), 'genau ein Ereignis agendaLabel').toEqual([
      {
        kind: 'ellipsis',
        region: 'agenda',
        weekId: KVK_WOCHE,
        date: null,
        entryId: null,
        piece: null,
        dropped: [],
        field: 'agendaLabel',
        columnId: null,
      },
    ]);
    const min = vorlageKp().fontSizes.min;
    // S3-22 (b): Querabmessung von «Termine» = Achsbreite − 2·textInsetPt; Vorbedingung: «…» in Mindestgrösse passt quer.
    const quer = L.frame.grid.timeAxisWidthPt - 2 * GRID_CONSTANTS.textInsetPt;
    expect(lineHeightPt(min)).toBeLessThanOrEqual(quer + 1e-6);
    const termine = items(L, 'agendaLabel');
    expect(termine.length).toBeGreaterThan(0);
    for (const { t } of termine) {
      expect(textVon(t).endsWith(ELLIPSE), `«${textVon(t)}» endet mit «…»`).toBe(true);
      expect(lang.startsWith(textVon(t).slice(0, -1))).toBe(true);
      expect(t.sizePt).toBe(min);
      expect(t.frame.w).toBeLessThanOrEqual(quer + EPS);
      expect(imRahmen(t), `«${textVon(t)}» in seinem frame`).toBe(true);
    }
  });

  it('[R-10-39][R-10-42][R-14.3-02] (CR-E102e-02) «Was» passt nicht in die Kopfzeile (fiktive Vorlage, alle Grössen 24 pt, Sa/So getrennt): je Terminspalte genau ein Ereignis textOmitted agenda/agendaHead mit erstem Datum der Spalte, keine für Fortsetzungsseiten; kein «Was»-Text', () => {
    const S = 24;
    const p = mitWoche(mitEintraegen(kvk(), vierzigAmMo()), KVK_WOCHE, {
      agendaWeekend: 'separate',
    });
    const L = seite(p, KVK_WOCHE, mitVorlage({ fontSizes: grossen(S) }));
    expect(L.pages.length).toBeGreaterThan(1);
    const tage = L.grid.days;
    expect(tage.length).toBe(7);
    // Vorbedingung (E6: TextItem.frame = Zelle abzüglich Innenabstand, jede Zeile darin): Die «Was»-Kopfzeile ist
    // 0,47 h hoch (B-Kp-87), also niedriger als h; eine Zeile in 24 pt (= Mindestgrösse) ist höher als h.
    expect(lineHeightPt(S)).toBeGreaterThan(L.frame.h);
    expect(felder(L, 'agendaHead')).toEqual(
      tage.map((d) => ({
        kind: 'textOmitted',
        region: 'agenda',
        weekId: KVK_WOCHE,
        date: d.date,
        entryId: null,
        piece: null,
        dropped: [],
        field: 'agendaHead',
        columnId: null,
      })),
    );
    expect(items(L, 'agendaHead').filter(({ t }) => textVon(t).length > 0)).toEqual([]);
  });

  it('[R-10-39][R-10-42][R-14.3-02] (CR-E102e-02, S3-22 (b)) KVK in Standardgrösse: frame jedes «Was» auf Seite 0 ist die Kopfzelle der Terminspalte, oben und unten um die halbe Breite des Grenzstrichs + textInsetPt verkleinert (± 0,01)', () => {
    const L = seite(kvk(), KVK_WOCHE);
    const g = pageGeometryFor('kp');
    const inset = GRID_CONSTANTS.textInsetPt;
    const oben = L.frame.agenda.y + g.pageLines.agendaTop.widthPt / 2 + inset;
    const unten =
      L.frame.agenda.y +
      g.heightsH.agendaHead * L.frame.h -
      g.pageLines.agendaHeadBottom.widthPt / 2 -
      inset;
    const was = items(L, 'agendaHead').filter(({ page }) => page === 0);
    expect(was.length).toBeGreaterThan(0);
    for (const { t } of was) {
      expect(Math.abs(t.frame.y - oben), `frame.y von «${textVon(t)}»`).toBeLessThanOrEqual(EPS);
      expect(
        Math.abs(t.frame.y + t.frame.h - unten),
        `frame-Unterkante von «${textVon(t)}»`,
      ).toBeLessThanOrEqual(EPS);
    }
  });
});

describe('Kürzelüberschrift mit Fortsetzung (CR-E102e-05; E4 Nr 5, F)', () => {
  it('[R-10-39][R-10-42] (CR-E102e-05) überlange abbreviationHeading und 60 weitere Kategorien: Legende auf der Fortsetzungsseite, genau ein Ereignis ellipsis sidebar/sidebarHeading', () => {
    const p0 = kvk();
    const weitere: LtgCategory[] = Array.from({ length: 60 }, (_, i) => ({
      id: `kx${i + 1}`,
      name: `Kat ${i + 1}`,
      legendLabel: `Kategorie ${String(i + 1).padStart(2, '0')}`,
      color: { r: 10 + i, g: 120, b: 200 },
      neutral: false,
      inLegend: true,
    }));
    const kopf =
      'Legende der Rapportkürzel und Abkürzungen dieser Woche mit Bedeutung und ausführlicher Erläuterung';
    const L = seite(
      { ...p0, legend: [...p0.legend, ...weitere] },
      KVK_WOCHE,
      mitVorlage({ abbreviationHeading: kopf }),
    );
    expect(L.pages.length).toBeGreaterThan(1);
    expect(
      L.fallbacks.some((e) => e.kind === 'continuationPage' && e.field === 'legendLabel'),
    ).toBe(true);
    const ueberschriften = items(L, 'sidebarHeading');
    expect(ueberschriften.some(({ t }) => textVon(t) === kopf)).toBe(false);
    const gekuerzt = ueberschriften.filter(({ t }) => textVon(t).endsWith(ELLIPSE));
    expect(gekuerzt.some(({ page }) => page === 0)).toBe(true);
    for (const { t } of gekuerzt) {
      expect(kopf.startsWith(textVon(t).slice(0, -1))).toBe(true);
      expect(imRahmen(t)).toBe(true);
    }
    expect(felder(L, 'sidebarHeading')).toEqual([
      {
        kind: 'ellipsis',
        region: 'sidebar',
        weekId: KVK_WOCHE,
        date: null,
        entryId: null,
        piece: null,
        dropped: [],
        field: 'sidebarHeading',
        columnId: null,
      },
    ]);
  });
});

describe('Rap-Kopf bei grosser Mindestgrösse (CR-E102e-08; S3-20 Schritt 3, E6 TextItem.frame)', () => {
  it('[R-4.4-08][R-14.3-02] (CR-E102e-08, S3-20; E1-02l R1, Entscheid 14.10.2026) fiktive Vorlage mit Mindestgrösse 11 pt: Rap-Kopf passt an Mi–Fr nicht in die Rap-Spalte → kein Wegfall, «Rap» vollständig, Befund tooManyColumns am Tag; kein Spaltenkopf ausserhalb seines frame', () => {
    const S = 11;
    const L = seite(kvk(), KVK_WOCHE, mitVorlage({ fontSizes: grossen(S) }));
    const kopfH = L.frame.grid.columnHeaderHeightPt;
    const linien = L.frame.grid.lines;
    const rap = [{ text: 'Rap', weight: 'bold' as const }];
    const ellipse = [{ text: ELLIPSE, weight: 'bold' as const }];
    for (const date of KVK_TAGE.slice(2, 5)) {
      const tag = L.grid.days.find((d) => d.date === date);
      expect(tag).toBeDefined();
      const c = tag?.columns.find((x) => x.kind === 'rap') as ColumnGeometry;
      expect(c).toBeDefined();
      const nutz =
        c.w -
        2 * GRID_CONSTANTS.textInsetPt -
        (linien.rapSeparator.widthPt + linien.columnBorder.widthPt) / 2;
      // Vorbedingungen S3-20: Schritt 1 (keine Stufe ≥ min passt waagrecht) und Schritt 2 (senkrecht passt nicht)
      // scheitern; in Schritt 3 passt «…» in Mindestgrösse in die Breite, die Zeilenhöhe nicht in die Kopfhöhe.
      expect(measureRuns(rap, S)).toBeGreaterThan(nutz + 1e-6);
      expect(
        measureRuns(rap, S) > kopfH - 2 * GRID_CONSTANTS.textInsetPt + 1e-6 ||
          lineHeightPt(S) > nutz + 1e-6,
      ).toBe(true);
      expect(measureRuns(ellipse, S)).toBeLessThanOrEqual(nutz + 1e-6);
      expect(lineHeightPt(S)).toBeGreaterThan(kopfH - 2 * GRID_CONSTANTS.textInsetPt + 1e-6);
      // E1-02l R1 (TE-E102l-01): kein Wegfall, sondern Befund «zu viele Spalten für diesen Tag» am Tag.
      const ev = L.fallbacks.filter(
        (e) => e.region === 'gridHead' && e.field === 'columnHead' && e.date === date,
      );
      expect(ev.map((e) => [e.kind, e.field])).toEqual([['tooManyColumns', 'columnHead']]);
      expect(L.fallbacks.some((e) => e.kind === 'textOmitted' && e.field === 'columnHead')).toBe(
        false,
      );
      // Kein Wegfall: «Rap» steht vollständig als Kopf dieses Tags.
      const kopfTexte = items(L, 'columnHead')
        .filter(({ date: d }) => d === date)
        .map(({ t }) => textVon(t));
      expect(kopfTexte).toContain('Rap');
    }
    for (const { t } of items(L, 'columnHead'))
      expect(imRahmen(t), `Spaltenkopf «${textVon(t)}» in seinem frame`).toBe(true);
  });
});
