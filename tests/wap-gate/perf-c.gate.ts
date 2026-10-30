// Leistung (R-H-22; ADR-010 §8, Prompt §7, Beschrieb 11): comparePerf mit Drosselung, Budgettabelle
// docs/wap-planer/perf/budgets.json (Schema V22), Baseline, Regression (E7 a) und details; Hilfen medianOf5 und
// recordMetric; Harness-Register (registerPerfEntries, registrierteEintraege, messeEintrag); Bau der
// Leistungs-Harness im Produktionsmodus.
// Vertrag: docs/wap-planer/plan/vertraege/E1-01c.md §2.3, §3 (Grundlage E1-01 §2, §4, §6, §9 Nr 2 und Nr 14).
// Übernommen aus dem Entwurf perf.gate.entwurf.ts (Vertrag E1-01c §3 «Entwürfe»). Eingabedateien liegen in
// temporären Ordnern; die versionierten drosselung.json und budgets.json werden nur gelesen. Nur fiktive Werte.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  arbeitsstandKlon,
  aufraeumen,
  KURZ,
  LANG,
  lauf,
  neueSandbox,
  type Sandbox,
  schrittText,
  WT,
  writeText,
} from './support/umgebung';
import { perfHarness } from './support/vertrag';
import {
  BUDGETS,
  baselineJson,
  budgetsJson,
  DROSSEL_MELDUNG,
  DROSSELUNG,
  drosselungJson,
  harnessModul,
  type Messwert,
  messungenJson,
  PDF_WOCHE,
  type PerfEntryC,
  perfCompareC,
  perfDetails,
  perfSupport,
  type Regel,
  versionierteBudgets,
  WOCHENWECHSEL,
} from './support/vertrag-c';

afterEach(aufraeumen);

// ---------------------------------------------------------------------------------------------------------
// comparePerf

interface Eingaben {
  messungen: string | null;
  baseline: string;
  drosselung: string;
  budgets: string;
}

let zaehler = 0;

/** Schreibt Messungen, Baseline und Drosselung in die Sandbox; Budgets = versionierte Tabelle. */
function eingaben(
  sb: Sandbox,
  m: Record<string, Messwert> | null,
  b: Record<string, Messwert>,
  o: { drosselung?: string; budgets?: string; baselineDrosselung?: string | number } = {},
): Eingaben {
  zaehler += 1;
  const n = String(zaehler);
  return {
    messungen: m === null ? null : writeText(sb.base, `perf-${n}.json`, messungenJson(m)),
    baseline: writeText(
      sb.base,
      `perf-baseline-${n}.json`,
      baselineJson(b, o.baselineDrosselung ?? '1.5'),
    ),
    drosselung: writeText(
      sb.base,
      `drosselung-${n}.json`,
      o.drosselung ?? drosselungJson(1.5, 'festgelegt'),
    ),
    budgets: o.budgets ?? BUDGETS,
  };
}

async function vergleiche(e: Eingaben, regel: Regel = 'prozent10oder2ms') {
  const { comparePerf } = await perfCompareC();
  return comparePerf({ ...e, regel });
}

describe('comparePerf: Drosselungsfaktor (§2.3 Schritt 1)', () => {
  it('[R-H-22] faktor null mit status «offen» → rot «Drosselungsfaktor nicht festgelegt (Umgebungsprobe ausstehend)»', async () => {
    const sb = neueSandbox();
    const e = eingaben(
      sb,
      { pdfWoche: PDF_WOCHE(100) },
      { pdfWoche: PDF_WOCHE(100) },
      { drosselung: drosselungJson(null, 'offen') },
    );
    const r = await vergleiche(e);
    expect(r.ok).toBe(false);
    expect(r.ursache ?? '').toContain(DROSSEL_MELDUNG);
    expect((r.naechsterSchritt ?? '').length).toBeGreaterThan(0);
  });

  it('[R-H-22] Zahl als Faktor mit status «offen» → rot mit derselben Meldung', async () => {
    const sb = neueSandbox();
    const e = eingaben(
      sb,
      { pdfWoche: PDF_WOCHE(100) },
      { pdfWoche: PDF_WOCHE(100) },
      { drosselung: drosselungJson(1.5, 'offen') },
    );
    const r = await vergleiche(e);
    expect(r.ok).toBe(false);
    expect(r.ursache ?? '').toContain(DROSSEL_MELDUNG);
  });

  it('[R-H-22] faktor null mit status «festgelegt» → rot mit derselben Meldung', async () => {
    const sb = neueSandbox();
    const e = eingaben(
      sb,
      { pdfWoche: PDF_WOCHE(100) },
      { pdfWoche: PDF_WOCHE(100) },
      { drosselung: drosselungJson(null, 'festgelegt') },
    );
    const r = await vergleiche(e);
    expect(r.ok).toBe(false);
    expect(r.ursache ?? '').toContain(DROSSEL_MELDUNG);
  });

  it('[R-H-22] Faktor 0,99 (unter 1) mit status «festgelegt» → rot; Faktor genau 1 → grün', async () => {
    const sb = neueSandbox();
    const unter = eingaben(
      sb,
      { pdfWoche: PDF_WOCHE(100) },
      { pdfWoche: PDF_WOCHE(100) },
      { drosselung: drosselungJson(0.99, 'festgelegt'), baselineDrosselung: 0.99 },
    );
    const r1 = await vergleiche(unter);
    expect(r1.ok).toBe(false);
    expect(r1.ursache ?? '').toContain(DROSSEL_MELDUNG);
    const eins = eingaben(
      sb,
      { pdfWoche: PDF_WOCHE(100) },
      { pdfWoche: PDF_WOCHE(100) },
      { drosselung: drosselungJson(1, 'festgelegt'), baselineDrosselung: 1 },
    );
    const r2 = await vergleiche(eins);
    expect(r2.ok, schrittText(r2)).toBe(true);
  });

  it('[R-H-22] versionierte drosselung.json (nur gelesen): Faktor nach §6 Nr 7 hergeleitet, passende Baseline und unveränderter Messwert → grün', async () => {
    const sb = neueSandbox();
    const dokument = JSON.parse(readFileSync(DROSSELUNG, 'utf8')) as {
      faktor: number;
      messung: { lokalMedianMs: number };
    };
    expect(
      typeof dokument.messung === 'object' && dokument.messung !== null,
      'Bezugswert-Dokumentation fehlt',
    ).toBe(true);
    const median = dokument.messung.lokalMedianMs;
    expect(Number.isFinite(median) && median > 0, 'lokaler Bezugsmedian fehlt').toBe(true);
    // Unabhängige Vertragsrechnung; kein Erwartungswert aus comparePerf.
    const faktor = Math.max(1, Math.ceil((132.7 / median) * 2) / 2);
    expect(dokument.faktor, 'Kalibrierung nach Vertrag §6 Nr 7').toBe(faktor);
    const e = eingaben(
      sb,
      { pdfWoche: PDF_WOCHE(2500) },
      { pdfWoche: PDF_WOCHE(2500) },
      { baselineDrosselung: faktor },
    );
    const r = await vergleiche({ ...e, drosselung: DROSSELUNG });
    expect(r.ok, schrittText(r)).toBe(true);
    expect(perfDetails(r).faktor).toBe(faktor);
  });

  it('[R-H-22] Reihenfolge: Drosselung nicht festgelegt und Budgettabelle fehlt → Ursache nennt die Drosselung', async () => {
    const sb = neueSandbox();
    const e = eingaben(
      sb,
      { pdfWoche: PDF_WOCHE(100) },
      { pdfWoche: PDF_WOCHE(100) },
      { drosselung: drosselungJson(null, 'offen'), budgets: join(sb.base, 'fehlt-budgets.json') },
    );
    const r = await vergleiche(e);
    expect(r.ok).toBe(false);
    expect(r.ursache ?? '').toContain(DROSSEL_MELDUNG);
    expect(r.ursache ?? '').not.toContain('budgets.json');
  });
});

describe('comparePerf: Budgettabelle (§2.3 Schritt 2, Schema V22)', () => {
  it('[R-H-22] Budgettabelle fehlt → rot', async () => {
    const sb = neueSandbox();
    const e = eingaben(
      sb,
      { pdfWoche: PDF_WOCHE(100) },
      {},
      { budgets: join(sb.base, 'gibt-es-nicht.json') },
    );
    const r = await vergleiche(e);
    expect(r.ok).toBe(false);
    expect((r.ursache ?? '').length).toBeGreaterThan(0);
  });

  const GUELTIG = () => versionierteBudgets();
  const FAELLE: [string, () => string][] = [
    ['version ist nicht 1', () => budgetsJson(GUELTIG(), 2)],
    ['budgets ist ein leeres Array', () => budgetsJson([])],
    ['budgets ist kein Array', () => budgetsJson({ 'R-11-12': 300 })],
    [
      'anforderung passt nicht auf das Muster (R-11-1)',
      () => budgetsJson([...GUELTIG(), { anforderung: 'R-11-1', budgetMs: 10 }]),
    ],
    ['budgetMs ist 0', () => budgetsJson([...GUELTIG(), { anforderung: 'R-11-13', budgetMs: 0 }])],
    [
      'budgetMs ist negativ',
      () => budgetsJson([...GUELTIG(), { anforderung: 'R-11-13', budgetMs: -1 }]),
    ],
    [
      'budgetMs ist kein endlicher Zahlenwert (Text)',
      () => budgetsJson([...GUELTIG(), { anforderung: 'R-11-13', budgetMs: '300' }]),
    ],
    [
      'budgetMs ist null',
      () => budgetsJson([...GUELTIG(), { anforderung: 'R-11-13', budgetMs: null }]),
    ],
    [
      'endung ist gesetzt und leer',
      () => budgetsJson([...GUELTIG(), { anforderung: 'R-11-13', endung: '', budgetMs: 300 }]),
    ],
    [
      'endung ist kein Text',
      () => budgetsJson([...GUELTIG(), { anforderung: 'R-11-13', endung: 5, budgetMs: 300 }]),
    ],
    [
      'Paar (anforderung, endung) doppelt',
      () =>
        budgetsJson([...GUELTIG(), { anforderung: 'R-11-11', endung: 'Bildzeit', budgetMs: 16.7 }]),
    ],
    [
      'Anforderung mit und ohne endung',
      () => budgetsJson([...GUELTIG(), { anforderung: 'R-11-11', budgetMs: 16.7 }]),
    ],
    [
      'mehr als ein Eintrag ohne endung für dieselbe Anforderung',
      () => budgetsJson([...GUELTIG(), { anforderung: 'R-11-12', budgetMs: 300 }]),
    ],
  ];

  it.each(FAELLE)(
    '[R-H-22] Budgettabelle ungültig (%s) → rot «budgets.json ungültig: …»',
    async (_regel, inhalt) => {
      const sb = neueSandbox();
      const budgets = writeText(sb.base, 'budgets-ungueltig.json', inhalt());
      const e = eingaben(sb, { pdfWoche: PDF_WOCHE(100) }, {}, { budgets });
      const r = await vergleiche(e);
      expect(r.ok).toBe(false);
      expect(r.ursache ?? '').toContain('budgets.json ungültig: ');
    },
  );

  it('[R-H-22] Kopie der versionierten Budgettabelle in einem temporären Ordner ist gültig → grün', async () => {
    const sb = neueSandbox();
    const budgets = writeText(sb.base, 'budgets.json', readFileSync(BUDGETS, 'utf8'));
    const e = eingaben(sb, { pdfWoche: PDF_WOCHE(100) }, {}, { budgets });
    const r = await vergleiche(e);
    expect(r.ok, schrittText(r)).toBe(true);
  });

  it('[R-H-22] gültige, aber abweichende Budgettabelle (R-11-15 = 2500): Messung mit 2500 → grün, mit 3000 → «Budget nicht nach ADR-010 §8: pdfWoche» (keine fest eingebauten Werte, TR-E101c-07)', async () => {
    const sb = neueSandbox();
    const anders = versionierteBudgets().map((b) =>
      b.anforderung === 'R-11-15' ? { ...b, budgetMs: 2500 } : b,
    );
    const budgets = writeText(sb.base, 'budgets-anders.json', budgetsJson(anders));
    const passt = await vergleiche(
      eingaben(sb, { pdfWoche: PDF_WOCHE(100, 2500) }, {}, { budgets }),
    );
    expect(passt.ok, schrittText(passt)).toBe(true);
    const alt = await vergleiche(eingaben(sb, { pdfWoche: PDF_WOCHE(100, 3000) }, {}, { budgets }));
    expect(alt.ok).toBe(false);
    expect(alt.ursache ?? '').toContain('Budget nicht nach ADR-010 §8: pdfWoche');
  });
});

describe('comparePerf: Budget nach Tabelle und harte Grenze (§2.3 Schritt 6)', () => {
  it('[R-H-22] Budget weicht von der Tabelle ab (R-11-15 mit 2999 ms) → rot «Budget nicht nach ADR-010 §8: pdfWoche»', async () => {
    const sb = neueSandbox();
    const r = await vergleiche(eingaben(sb, { pdfWoche: PDF_WOCHE(100, 2999) }, {}));
    expect(r.ok).toBe(false);
    expect(r.ursache ?? '').toContain('Budget nicht nach ADR-010 §8: pdfWoche');
  });

  it('[R-H-22] unbekannte Anforderung (R-11-13, erst Etappe 2) → rot «Budget nicht nach ADR-010 §8»', async () => {
    const sb = neueSandbox();
    const r = await vergleiche(
      eingaben(sb, { filterZeit: { medianMs: 10, budgetMs: 300, anforderung: 'R-11-13' } }, {}),
    );
    expect(r.ok).toBe(false);
    expect(r.ursache ?? '').toContain('Budget nicht nach ADR-010 §8: filterZeit');
  });

  it('[R-H-22] R-11-11 ohne Endung Bildzeit bzw. Aufgabe → rot; Endung mit fremdem Budget → rot; mit Endungen und passenden Budgets → grün', async () => {
    const sb = neueSandbox();
    const ohne = await vergleiche(
      eingaben(sb, { ziehen: { medianMs: 10, budgetMs: 16.7, anforderung: 'R-11-11' } }, {}),
    );
    expect(ohne.ok).toBe(false);
    expect(ohne.ursache ?? '').toContain('Budget nicht nach ADR-010 §8: ziehen');
    const vertauscht = await vergleiche(
      eingaben(sb, { ziehenAufgabe: { medianMs: 10, budgetMs: 16.7, anforderung: 'R-11-11' } }, {}),
    );
    expect(vertauscht.ok).toBe(false);
    expect(vertauscht.ursache ?? '').toContain('Budget nicht nach ADR-010 §8: ziehenAufgabe');
    const mit = await vergleiche(
      eingaben(
        sb,
        {
          ziehenBildzeit: { medianMs: 12, budgetMs: 16.7, anforderung: 'R-11-11' },
          ziehenAufgabe: { medianMs: 30, budgetMs: 50, anforderung: 'R-11-11' },
        },
        {},
      ),
    );
    expect(mit.ok, schrittText(mit)).toBe(true);
  });

  it('[R-H-22] Median über dem harten Budget (3001 > 3000) → rot mit Messgrösse', async () => {
    const sb = neueSandbox();
    const r = await vergleiche(eingaben(sb, { pdfWoche: PDF_WOCHE(3001) }, {}));
    expect(r.ok).toBe(false);
    expect(r.ursache ?? '').toContain('pdfWoche');
  });

  it('[R-H-22] Median genau am Budget (3000) und ohne Baseline-Eintrag → grün, details.ohneBaseline nennt die Messgrösse', async () => {
    const sb = neueSandbox();
    const r = await vergleiche(eingaben(sb, { pdfWoche: PDF_WOCHE(3000) }, {}));
    expect(r.ok, schrittText(r)).toBe(true);
    const d = perfDetails(r);
    expect(d.ohneBaseline).toEqual(['pdfWoche']);
    expect(d.messgroessen).toBe(1);
  });

  it('[R-H-22] höchstens 20 Namen in der Ursache bei 25 Budgetüberschreitungen', async () => {
    const sb = neueSandbox();
    const m: Record<string, Messwert> = {};
    for (let i = 1; i <= 25; i++) m[`zzMessung${String(i).padStart(2, '0')}`] = PDF_WOCHE(3500);
    const r = await vergleiche(eingaben(sb, m, {}));
    expect(r.ok).toBe(false);
    const genannt = Object.keys(m).filter((n) => (r.ursache ?? '').includes(n));
    expect(genannt.length).toBeGreaterThan(0);
    expect(genannt.length).toBeLessThanOrEqual(20);
  });
});

describe('comparePerf: Baseline und Regression (§2.3 Schritte 3, 4, 6, 7; Vertrag E1-01 §9 Nr 14)', () => {
  it('[R-H-22] künstliche Verlangsamung (doppelter Median, unter dem Budget) → rot mit Messgrösse', async () => {
    const sb = neueSandbox();
    const r = await vergleiche(
      eingaben(sb, { pdfWoche: PDF_WOCHE(800) }, { pdfWoche: PDF_WOCHE(400) }),
    );
    expect(r.ok).toBe(false);
    expect(r.ursache ?? '').toContain('pdfWoche');
  });

  it('[R-H-22] Regel prozent10: genau 1,10 × Baseline → grün, 110,1 bei Baseline 100 → rot', async () => {
    const sb = neueSandbox();
    const gut = eingaben(sb, { pdfWoche: PDF_WOCHE(110) }, { pdfWoche: PDF_WOCHE(100) });
    const r1 = await vergleiche(gut, 'prozent10');
    expect(r1.ok, schrittText(r1)).toBe(true);
    const schlecht = eingaben(sb, { pdfWoche: PDF_WOCHE(110.1) }, { pdfWoche: PDF_WOCHE(100) });
    expect((await vergleiche(schlecht, 'prozent10')).ok).toBe(false);
  });

  it('[R-H-22] Regel prozent10oder2ms (E7 a): Baseline 10 ms → 11,9 ms grün, 12,1 ms rot; prozent10 → 11,9 ms rot', async () => {
    const sb = neueSandbox();
    const a = eingaben(
      sb,
      { wochenwechsel: WOCHENWECHSEL(11.9) },
      { wochenwechsel: WOCHENWECHSEL(10) },
    );
    const r1 = await vergleiche(a, 'prozent10oder2ms');
    expect(r1.ok, schrittText(r1)).toBe(true);
    expect((await vergleiche(a, 'prozent10')).ok).toBe(false);
    const b = eingaben(
      sb,
      { wochenwechsel: WOCHENWECHSEL(12.1) },
      { wochenwechsel: WOCHENWECHSEL(10) },
    );
    expect((await vergleiche(b, 'prozent10oder2ms')).ok).toBe(false);
  });

  it('[R-H-22] Verbesserung gegenüber der Baseline → grün, details.verbesserungen nennt die Messgrösse', async () => {
    const sb = neueSandbox();
    const r = await vergleiche(
      eingaben(sb, { pdfWoche: PDF_WOCHE(200) }, { pdfWoche: PDF_WOCHE(400) }),
    );
    expect(r.ok, schrittText(r)).toBe(true);
    const d = perfDetails(r);
    expect(d.verbesserungen).toEqual(['pdfWoche']);
    expect(d.ohneBaseline).toEqual([]);
  });

  it('[R-H-22] details: { faktor, messgroessen, ohneBaseline, verbesserungen, strom } mit strom Netz, Akku oder unbekannt', async () => {
    const sb = neueSandbox();
    const r = await vergleiche(
      eingaben(
        sb,
        { pdfWoche: PDF_WOCHE(400), wochenwechsel: WOCHENWECHSEL(50) },
        { pdfWoche: PDF_WOCHE(400) },
      ),
    );
    expect(r.ok, schrittText(r)).toBe(true);
    const d = perfDetails(r);
    expect(Object.keys(d).sort()).toEqual(
      ['faktor', 'messgroessen', 'ohneBaseline', 'strom', 'verbesserungen'].sort(),
    );
    expect(d.faktor).toBe(1.5);
    expect(d.messgroessen).toBe(2);
    expect(d.ohneBaseline).toEqual(['wochenwechsel']);
    expect(d.verbesserungen).toEqual([]);
    expect(['Netz', 'Akku', 'unbekannt']).toContain(d.strom);
  });

  it('[R-H-22] Budget der Messung weicht von der Baseline ab (Baseline 2500, Messung 3000 nach Tabelle) → rot «Budget weicht von der Baseline ab»', async () => {
    const sb = neueSandbox();
    const r = await vergleiche(
      eingaben(sb, { pdfWoche: PDF_WOCHE(100, 3000) }, { pdfWoche: PDF_WOCHE(100, 2500) }),
    );
    expect(r.ok).toBe(false);
    expect(r.ursache ?? '').toContain('Budget weicht von der Baseline ab');
  });

  it('[R-H-22] Anforderung der Messung weicht von der Baseline ab (R-11-16 statt R-11-15) → rot «Budget weicht von der Baseline ab»', async () => {
    const sb = neueSandbox();
    const r = await vergleiche(
      eingaben(
        sb,
        { pdfWoche: { medianMs: 100, budgetMs: 10000, anforderung: 'R-11-16' } },
        { pdfWoche: PDF_WOCHE(100) },
      ),
    );
    expect(r.ok).toBe(false);
    expect(r.ursache ?? '').toContain('Budget weicht von der Baseline ab');
  });

  it('[R-H-22] Baseline mit anderem Drosselungsfaktor (2 statt 1,5) → rot «Baseline mit anderem Drosselungsfaktor gemessen»', async () => {
    const sb = neueSandbox();
    const r = await vergleiche(
      eingaben(
        sb,
        { pdfWoche: PDF_WOCHE(100) },
        { pdfWoche: PDF_WOCHE(100) },
        { baselineDrosselung: '2' },
      ),
    );
    expect(r.ok).toBe(false);
    expect(r.ursache ?? '').toContain('Baseline mit anderem Drosselungsfaktor gemessen');
  });

  it('[R-H-22] Baseline ungültig (version 2 bzw. messwerte kein Objekt) → je rot mit Pfad', async () => {
    const sb = neueSandbox();
    const e = eingaben(sb, { pdfWoche: PDF_WOCHE(100) }, {});
    for (const [name, inhalt] of [
      ['baseline-v2.json', { version: 2, protokoll: { drosselung: 1.5 }, messwerte: {} }],
      ['baseline-liste.json', { version: 1, protokoll: { drosselung: 1.5 }, messwerte: [] }],
    ] as const) {
      const baseline = writeText(sb.base, name, `${JSON.stringify(inhalt)}\n`);
      const r = await vergleiche({ ...e, baseline });
      expect(r.ok, name).toBe(false);
      expect(schrittText(r), name).toContain(name);
    }
  });

  it('[R-H-22] messungen null mit leerer Baseline → grün, details.messgroessen 0', async () => {
    const sb = neueSandbox();
    const r = await vergleiche(eingaben(sb, null, {}));
    expect(r.ok, schrittText(r)).toBe(true);
    expect(perfDetails(r).messgroessen).toBe(0);
  });

  it('[R-H-22] messungen null mit nicht leerer Baseline → rot «Messgrösse fehlt: pdfWoche»', async () => {
    const sb = neueSandbox();
    const r = await vergleiche(eingaben(sb, null, { pdfWoche: PDF_WOCHE(100) }));
    expect(r.ok).toBe(false);
    expect(r.ursache ?? '').toContain('Messgrösse fehlt: pdfWoche');
  });

  it('[R-H-22] Baseline-Name ohne Messung → rot «Messgrösse fehlt: <name>»', async () => {
    const sb = neueSandbox();
    const r = await vergleiche(
      eingaben(
        sb,
        { pdfWoche: PDF_WOCHE(100) },
        { pdfWoche: PDF_WOCHE(100), wochenwechsel: WOCHENWECHSEL(20) },
      ),
    );
    expect(r.ok).toBe(false);
    expect(r.ursache ?? '').toContain('Messgrösse fehlt: wochenwechsel');
  });

  it('[R-H-22] fehlende Eingabedatei (Messungen, Baseline, Drosselung, Budgets) → je rot mit Ursache', async () => {
    const sb = neueSandbox();
    const e = eingaben(sb, { pdfWoche: PDF_WOCHE(100) }, { pdfWoche: PDF_WOCHE(100) });
    const gruen = await vergleiche(e);
    expect(gruen.ok, schrittText(gruen)).toBe(true);
    const fehlt = join(sb.base, 'fehlt.json');
    for (const teil of ['messungen', 'baseline', 'drosselung', 'budgets'] as const) {
      const r = await vergleiche({ ...e, [teil]: fehlt });
      expect(r.ok, teil).toBe(false);
      expect((r.ursache ?? '').length, teil).toBeGreaterThan(0);
      expect((r.naechsterSchritt ?? '').length, teil).toBeGreaterThan(0);
    }
  });
});

describe('comparePerf: Stromversorgung und CLI (§2.3 Nr 8, CR-E101c-V15, -V17)', () => {
  it(
    '[R-H-22] strom wird höchstens einmal je Prozess abgefragt: zweiter Aufruf ohne neuen PowerShell-Kindprozess (frischer Node-Prozess)',
    () => {
      const sb = neueSandbox();
      const e = eingaben(sb, { pdfWoche: PDF_WOCHE(100) }, { pdfWoche: PDF_WOCHE(100) });
      // Zähler für Kindprozesse mit «powershell» im Befehl, vor dem Laden des Moduls eingehängt.
      const zaehlerSkript = writeText(
        sb.base,
        'zaehler.mjs',
        [
          "import { createRequire, syncBuiltinESMExports } from 'node:module';",
          'const require = createRequire(import.meta.url);',
          "const cp = require('node:child_process');",
          'globalThis.__wapZzPowershell = 0;',
          "for (const n of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync']) {",
          '  const orig = cp[n];',
          '  cp[n] = function (...args) {',
          "    const text = args.filter((a) => typeof a === 'string' || Array.isArray(a)).flat().join(' ');",
          '    if (/powershell/i.test(text)) globalThis.__wapZzPowershell += 1;',
          '    return orig.apply(this, args);',
          '  };',
          '}',
          'syncBuiltinESMExports();',
          '',
        ].join('\n'),
      );
      const url = pathToFileURL(join(WT, 'scripts', 'wap-gate', 'perf-compare.mjs')).href;
      const haupt = writeText(
        sb.base,
        'zweimal.mjs',
        [
          `const e = JSON.parse(${JSON.stringify(JSON.stringify(e))});`,
          'try {',
          `  const { comparePerf } = await import(${JSON.stringify(url)});`,
          "  const a = comparePerf({ ...e, regel: 'prozent10oder2ms' });",
          '  const nachErstem = globalThis.__wapZzPowershell;',
          "  const b = comparePerf({ ...e, regel: 'prozent10oder2ms' });",
          '  process.stdout.write(JSON.stringify({ ok: [a.ok, b.ok], strom: [a.details?.strom, b.details?.strom], nachErstem, gesamt: globalThis.__wapZzPowershell }) + "\\n");',
          '} catch (err) {',
          '  process.stdout.write(JSON.stringify({ fehler: String(err instanceof Error ? err.message : err) }) + "\\n");',
          '}',
          '',
        ].join('\n'),
      );
      const r = spawnSync(
        process.execPath,
        ['--import', pathToFileURL(zaehlerSkript).href, haupt],
        { cwd: sb.base, env: sb.env, encoding: 'utf8', timeout: KURZ, windowsHide: true },
      );
      const zeile = r.stdout.split(/\r?\n/).find((z) => z.startsWith('{'));
      expect(zeile, `Kindprozess ohne Ergebnis: ${r.stderr.slice(0, 500)}`).toBeDefined();
      const erg = JSON.parse(zeile as string) as {
        fehler?: string;
        ok?: boolean[];
        strom?: string[];
        nachErstem?: number;
        gesamt?: number;
      };
      // Ein Stub-Fehler des Kindprozesses wird unverändert weitergereicht (fachlich rot, ADR-010 §3.3).
      if (erg.fehler !== undefined) throw new Error(erg.fehler);
      expect(erg.ok).toEqual([true, true]);
      expect(erg.nachErstem, 'PowerShell-Abfragen nach dem ersten Aufruf').toBe(1);
      expect(erg.gesamt, 'PowerShell-Abfragen nach dem zweiten Aufruf').toBe(1);
      expect(['Netz', 'Akku', 'unbekannt']).toContain(erg.strom?.[0]);
      expect(erg.strom?.[1]).toBe(erg.strom?.[0]);
    },
    KURZ,
  );

  it(
    '[R-H-22] perf-compare.mjs als Skript → Exit 1 «kein eigener Befehl: npm run wap:test:perf»',
    () => {
      const sb = neueSandbox();
      const r = lauf(process.execPath, [join(WT, 'scripts', 'wap-gate', 'perf-compare.mjs')], {
        cwd: sb.base,
        env: sb.env,
        timeout: KURZ,
      });
      expect(r.status).toBe(1);
      expect(r.out).toContain('kein eigener Befehl: npm run wap:test:perf');
    },
    KURZ,
  );
});

// ---------------------------------------------------------------------------------------------------------
// Hilfen medianOf5 und recordMetric (tests/wap-perf/support/perf.ts)

describe('medianOf5 (§2.3)', () => {
  it('[R-H-22] sechs Aufrufe nacheinander, erster verworfen; laeufe in Aufrufreihenfolge, median = drittkleinster', async () => {
    const { medianOf5 } = await perfSupport();
    const werte = [1000, 30, 10, 50, 20, 40];
    let i = 0;
    const r = await medianOf5(async () => werte[i++] ?? Number.NaN);
    expect(i).toBe(6);
    expect(r.laeufe).toEqual([30, 10, 50, 20, 40]);
    expect(r.median).toBe(30);
    const andere = [5, 9, 1, 7, 3, 8];
    let j = 0;
    const r2 = await medianOf5(async () => andere[j++] ?? Number.NaN);
    expect(r2).toEqual({ median: 7, laeufe: [9, 1, 7, 3, 8] });
  });

  it('[R-H-22] Aufrufe laufen nacheinander (kein paralleler Lauf)', async () => {
    const { medianOf5 } = await perfSupport();
    let aktiv = 0;
    let hoechst = 0;
    let aufrufe = 0;
    await medianOf5(async () => {
      aufrufe += 1;
      aktiv += 1;
      hoechst = Math.max(hoechst, aktiv);
      await new Promise((res) => setTimeout(res, 5));
      aktiv -= 1;
      return 1;
    });
    expect(aufrufe).toBe(6);
    expect(hoechst).toBe(1);
  });

  it.each([
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
  ])(
    '[R-H-22] nicht endlicher Messwert (%s) in einem gezählten Lauf → wirft «medianOf5: ungültiger Messwert»',
    async (_n, schlecht) => {
      const { medianOf5 } = await perfSupport();
      const werte = [1, 2, schlecht, 3, 4, 5];
      let i = 0;
      await expect(medianOf5(async () => werte[i++] ?? 0)).rejects.toThrow(
        'medianOf5: ungültiger Messwert',
      );
    },
  );
});

/** Führt `fn` mit `dir` als Arbeitsordner aus (recordMetric schreibt nach <cwd>/test-results/wap/perf.json). */
function imOrdner<T>(dir: string, fn: () => T): T {
  const alt = process.cwd();
  process.chdir(dir);
  try {
    return fn();
  } finally {
    process.chdir(alt);
  }
}

describe('recordMetric (§2.3, Vertrag E1-01 §9 Nr 2)', () => {
  it('[R-H-22] schreibt <cwd>/test-results/wap/perf.json (Ordner neu), ersetzt bzw. ergänzt Einträge; UTF-8, LF, zwei Leerzeichen Einzug', async () => {
    const sb = neueSandbox();
    const { recordMetric } = await perfSupport();
    imOrdner(sb.base, () => {
      recordMetric('zzErsteMessung', 'R-11-15', 99, 3000);
      recordMetric('zzZweiteMessung', 'R-11-12', 7.25, 300);
      recordMetric('zzErsteMessung', 'R-11-15', 12.5, 3000);
      recordMetric('zzZiehenBildzeit', 'R-11-11', 9.5, 16.7);
    });
    const datei = join(sb.base, 'test-results', 'wap', 'perf.json');
    expect(existsSync(datei)).toBe(true);
    const text = readFileSync(datei, 'utf8');
    expect(JSON.parse(text)).toStrictEqual({
      messwerte: {
        zzErsteMessung: { medianMs: 12.5, budgetMs: 3000, anforderung: 'R-11-15' },
        zzZweiteMessung: { medianMs: 7.25, budgetMs: 300, anforderung: 'R-11-12' },
        zzZiehenBildzeit: { medianMs: 9.5, budgetMs: 16.7, anforderung: 'R-11-11' },
      },
    });
    expect(text).not.toContain('\r');
    expect(text).toContain('\n  "messwerte"');
    expect(text.charCodeAt(0)).not.toBe(0xfeff);
  });

  it('[R-H-22] ergänzt eine vorhandene Datei; unlesbare Datei → wirft', async () => {
    const sb = neueSandbox();
    const { recordMetric } = await perfSupport();
    writeText(
      sb.base,
      'test-results/wap/perf.json',
      messungenJson({ zzAlt: { medianMs: 1, budgetMs: 500, anforderung: 'R-11-14' } }),
    );
    imOrdner(sb.base, () => recordMetric('zzNeu', 'R-11-17', 1000, 15000));
    const daten = JSON.parse(
      readFileSync(join(sb.base, 'test-results', 'wap', 'perf.json'), 'utf8'),
    ) as { messwerte: Record<string, Messwert> };
    expect(Object.keys(daten.messwerte).sort()).toEqual(['zzAlt', 'zzNeu']);
    const sb2 = neueSandbox();
    writeText(sb2.base, 'test-results/wap/perf.json', '{ kein JSON');
    expect(() => imOrdner(sb2.base, () => recordMetric('zzNeu', 'R-11-17', 1000, 15000))).toThrow();
  });

  it.each([
    ['Name mit Bindestrich', 'zz-name', 'R-11-15', 10, 3000],
    ['Name beginnt mit Ziffer', '1zz', 'R-11-15', 10, 3000],
    ['Anforderung ohne zweistellige Nummer', 'zzName', 'R-11-1', 10, 3000],
    ['budgetMs NaN', 'zzName', 'R-11-15', 10, Number.NaN],
    ['budgetMs 0', 'zzName', 'R-11-15', 10, 0],
    ['budgetMs −1', 'zzName', 'R-11-15', 10, -1],
    ['ungültiger Name und falsches Budget (Muster zuerst)', 'zz-name', 'R-11-15', 10, 2999],
  ])(
    '[R-H-22] ungültige Argumente (%s) → wirft genau «Leistungseintrag ungültig: <name>» (Nachtrag Nr 1), Datei unverändert (gültiger Aufruf davor wird geschrieben)',
    async (_f, name, anf, median, budget) => {
      const sb = neueSandbox();
      const { recordMetric } = await perfSupport();
      imOrdner(sb.base, () => recordMetric('zzGueltig', 'R-11-14', 1, 500));
      const datei = join(sb.base, 'test-results', 'wap', 'perf.json');
      const vorher = readFileSync(datei, 'utf8');
      expect(() => imOrdner(sb.base, () => recordMetric(name, anf, median, budget))).toThrow(
        new RegExp(`^Leistungseintrag ungültig: ${name}$`),
      );
      expect(readFileSync(datei, 'utf8')).toBe(vorher);
    },
  );

  it.each([
    ['Median negativ', -1],
    ['Median NaN', Number.NaN],
    ['Median unendlich', Number.POSITIVE_INFINITY],
  ])(
    '[R-H-22] ungültiger Median (%s) → wirft, Datei unverändert (gültiger Aufruf davor wird geschrieben)',
    async (_f, median) => {
      const sb = neueSandbox();
      const { recordMetric } = await perfSupport();
      imOrdner(sb.base, () => recordMetric('zzGueltig', 'R-11-14', 1, 500));
      const datei = join(sb.base, 'test-results', 'wap', 'perf.json');
      const vorher = readFileSync(datei, 'utf8');
      // Vertrag §2.3: «medianMs endlich ≥ 0 → sonst wirft»; eine Meldung ist nicht festgelegt.
      expect(() =>
        imOrdner(sb.base, () => recordMetric('zzName', 'R-11-15', median, 3000)),
      ).toThrow();
      expect(readFileSync(datei, 'utf8')).toBe(vorher);
    },
  );

  it.each([
    ['Wert abweichend (R-11-15 mit 2999)', 'zzPdfWoche', 'R-11-15', 2999],
    ['unbekannte Anforderung (R-11-13)', 'zzFilter', 'R-11-13', 300],
    ['R-11-11 ohne Endung', 'zzZiehen', 'R-11-11', 16.7],
  ])(
    '[R-H-22] Budget nicht nach Tabelle (%s) → wirft «Budget nicht nach ADR-010 §8: <name>»',
    async (_f, name, anf, budget) => {
      const sb = neueSandbox();
      const { recordMetric } = await perfSupport();
      expect(() => imOrdner(sb.base, () => recordMetric(name, anf, 1, budget))).toThrow(
        new RegExp(`^Budget nicht nach ADR-010 §8: ${name}$`),
      );
      expect(existsSync(join(sb.base, 'test-results', 'wap', 'perf.json'))).toBe(false);
    },
  );

  it('[R-H-22] Median 0 ist gültig (≥ 0)', async () => {
    const sb = neueSandbox();
    const { recordMetric } = await perfSupport();
    imOrdner(sb.base, () => recordMetric('zzNull', 'R-11-14', 0, 500));
    const daten = JSON.parse(
      readFileSync(join(sb.base, 'test-results', 'wap', 'perf.json'), 'utf8'),
    ) as { messwerte: Record<string, Messwert> };
    expect(daten.messwerte.zzNull?.medianMs).toBe(0);
  });
});

// ---------------------------------------------------------------------------------------------------------
// Register der Leistungs-Harness (tests/wap-perf/harness/harness.ts)

/** Frisches Harness-Modul (eigenes Register je Test). */
async function frischesHarness() {
  vi.resetModules();
  return harnessModul();
}

function eintrag(
  name: string,
  anforderung = 'R-11-12',
  budgetMs = 300,
  extra: Partial<PerfEntryC> = {},
): PerfEntryC {
  return {
    name,
    anforderung,
    budgetMs,
    prepare: async (seed: number) => seed,
    run: async () => {},
    ...extra,
  };
}

const warte = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

describe('registerPerfEntries, registrierteEintraege, messeEintrag (§2.3)', () => {
  it('[R-H-22] registrierte Einträge ohne Funktionen, sortiert nach name, auch über mehrere Aufrufe', async () => {
    const h = await frischesHarness();
    h.registerPerfEntries([eintrag('zzWoche'), eintrag('zzPdfWoche', 'R-11-15', 3000)]);
    h.registerPerfEntries([eintrag('zzAufgabe', 'R-11-14', 500)]);
    expect(h.registrierteEintraege()).toStrictEqual([
      { name: 'zzAufgabe', anforderung: 'R-11-14', budgetMs: 500 },
      { name: 'zzPdfWoche', anforderung: 'R-11-15', budgetMs: 3000 },
      { name: 'zzWoche', anforderung: 'R-11-12', budgetMs: 300 },
    ]);
  });

  it.each([
    ['Name mit Bindestrich', eintrag('zz-woche')],
    ['Name beginnt mit Ziffer', eintrag('1zz')],
    ['leerer Name', eintrag('')],
    ['Anforderung ohne Nummer', eintrag('zzWoche', 'R-11')],
    ['Anforderung klein geschrieben', eintrag('zzWoche', 'r-11-12')],
  ])(
    '[R-H-22] ungültiger Eintrag (%s) → wirft «Leistungseintrag ungültig: <name>»',
    async (_f, e) => {
      const h = await frischesHarness();
      expect(() => h.registerPerfEntries([e])).toThrow(`Leistungseintrag ungültig: ${e.name}`);
    },
  );

  it.each([
    ['Wert abweichend (R-11-12 mit 299)', eintrag('zzWoche', 'R-11-12', 299)],
    ['unbekannte Anforderung (R-11-13)', eintrag('zzFilter', 'R-11-13', 300)],
    ['R-11-11 ohne Endung', eintrag('zzZiehen', 'R-11-11', 16.7)],
    ['R-11-11 Aufgabe mit Budget der Bildzeit', eintrag('zzZiehenAufgabe', 'R-11-11', 16.7)],
  ])(
    '[R-H-22] Budget nicht nach Tabelle (%s) → wirft genau «Budget nicht nach ADR-010 §8: <name>» und registriert nichts',
    async (_f, e) => {
      const h = await frischesHarness();
      // Nachtrag 07.10.2026 Nr 1 (TR-E101c-06): genau diese Meldung.
      expect(() => h.registerPerfEntries([e])).toThrow(
        new RegExp(`^Budget nicht nach ADR-010 §8: ${e.name}$`),
      );
      expect(h.registrierteEintraege().map((x) => x.name)).not.toContain(e.name);
    },
  );

  it.each([
    ['budgetMs NaN', eintrag('zzWoche', 'R-11-12', Number.NaN)],
    ['budgetMs 0', eintrag('zzWoche', 'R-11-12', 0)],
    ['budgetMs −1', eintrag('zzWoche', 'R-11-12', -1)],
    ['budgetMs unendlich', eintrag('zzWoche', 'R-11-12', Number.POSITIVE_INFINITY)],
    ['ungültiger Name und falsches Budget (Muster zuerst)', eintrag('zz-woche', 'R-11-12', 299)],
    [
      'ungültige Anforderung und falsches Budget (Muster zuerst)',
      eintrag('zzWoche', 'R-11-1', 299),
    ],
  ])(
    '[R-H-22] %s → wirft genau «Leistungseintrag ungültig: <name>» (Nachtrag Nr 1)',
    async (_f, e) => {
      const h = await frischesHarness();
      expect(() => h.registerPerfEntries([e])).toThrow(
        new RegExp(`^Leistungseintrag ungültig: ${e.name}$`),
      );
    },
  );

  it('[R-H-22] Budgets nach Tabelle mit Endung (R-11-11 …Bildzeit 16,7 und …Aufgabe 50) → registriert', async () => {
    const h = await frischesHarness();
    h.registerPerfEntries([
      eintrag('zzZiehenBildzeit', 'R-11-11', 16.7),
      eintrag('zzZiehenAufgabe', 'R-11-11', 50),
    ]);
    expect(h.registrierteEintraege().map((x) => x.name)).toEqual([
      'zzZiehenAufgabe',
      'zzZiehenBildzeit',
    ]);
  });

  it('[R-H-22] doppelter Name im selben Aufruf bzw. über Aufrufe (Dateien) → wirft «Leistungseintrag doppelt: <name>»', async () => {
    const h = await frischesHarness();
    expect(() => h.registerPerfEntries([eintrag('zzWoche'), eintrag('zzWoche')])).toThrow(
      'Leistungseintrag doppelt: zzWoche',
    );
    const h2 = await frischesHarness();
    h2.registerPerfEntries([eintrag('zzWoche')]);
    expect(() => h2.registerPerfEntries([eintrag('zzWoche', 'R-11-14', 500)])).toThrow(
      'Leistungseintrag doppelt: zzWoche',
    );
  });

  it('[R-H-22] messeEintrag: unbekannter Name → Ablehnung «Leistungseintrag unbekannt: <name>»', async () => {
    const h = await frischesHarness();
    h.registerPerfEntries([eintrag('zzWoche')]);
    await expect(h.messeEintrag('zzGibtEsNicht', 1)).rejects.toThrow(
      'Leistungseintrag unbekannt: zzGibtEsNicht',
    );
  });

  it('[R-H-22] messeEintrag: prepare erhält den Startwert, run das Ergebnis von prepare; nur run zählt zur Dauer', async () => {
    const h = await frischesHarness();
    const seeds: number[] = [];
    let erhalten: unknown = null;
    h.registerPerfEntries([
      eintrag('zzDauer', 'R-11-12', 300, {
        prepare: async (seed: number) => {
          seeds.push(seed);
          await warte(250);
          return { seed };
        },
        run: async (p: unknown) => {
          erhalten = p;
          await warte(40);
        },
      }),
    ]);
    const ms = await h.messeEintrag('zzDauer', 20260928);
    expect(seeds).toEqual([20260928]);
    expect(erhalten).toEqual({ seed: 20260928 });
    expect(ms).toBeGreaterThanOrEqual(30);
    expect(ms).toBeLessThan(240);
  });
});

// ---------------------------------------------------------------------------------------------------------
// Bau der Leistungs-Harness

function alleDateien(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? alleDateien(p) : [p];
  });
}

const BEISPIEL_EINTRAG = [
  "import { registerPerfEntries } from '../harness';",
  '',
  'registerPerfEntries([',
  '  {',
  "    name: 'zzBeispielMessung',",
  "    anforderung: 'R-11-15',",
  '    budgetMs: 3000,',
  '    prepare: async (seed: number) => seed,',
  '    run: async () => {},',
  '  },',
  ']);',
  '',
].join('\n');

describe('buildPerfHarness (Produktionsmodus, entries/<paket>.ts)', () => {
  it(
    '[R-H-22] baut <outDir>/index.html (Titel «WAP-Planer Leistungs-Harness») mit dem Beispiel-Eintrag, ohne @vite/client und import.meta.hot; leert den Ordner vorher; details.eintraege nennt die Datei',
    async () => {
      const sb = neueSandbox();
      const k = arbeitsstandKlon(sb);
      writeText(k.root, 'tests/wap-perf/harness/entries/zz-beispiel.ts', BEISPIEL_EINTRAG);
      const outDir = join(sb.base, 'harness-dist');
      writeText(outDir, 'alt-fiktiv.txt', 'Rest eines früheren Laufs\n');
      const { buildPerfHarness } = await perfHarness();
      const r = await buildPerfHarness({ cwd: k.root, outDir });
      expect(r.ok, schrittText(r)).toBe(true);
      expect(existsSync(join(outDir, 'alt-fiktiv.txt')), 'Ordner nicht geleert').toBe(false);
      const html = join(outDir, 'index.html');
      expect(existsSync(html)).toBe(true);
      const text = alleDateien(outDir)
        .filter((d) => d.endsWith('.js') || d.endsWith('.html'))
        .map((d) => readFileSync(d, 'utf8'))
        .join('\n');
      expect(text).toContain('zzBeispielMessung');
      expect(text).not.toContain('@vite/client');
      expect(text).not.toContain('import.meta.hot');
      expect(readFileSync(html, 'utf8')).toContain('<title>WAP-Planer Leistungs-Harness</title>');
      const d = (r.details ?? {}) as { eintraege?: unknown };
      expect(Array.isArray(d.eintraege) ? d.eintraege : []).toContain('zz-beispiel.ts');
    },
    LANG,
  );

  it(
    '[R-H-22] Eintragsdatei mit Syntaxfehler → rot mit Ursache und nächstem Schritt',
    async () => {
      const sb = neueSandbox();
      const k = arbeitsstandKlon(sb);
      writeText(k.root, 'tests/wap-perf/harness/entries/zz-kaputt.ts', 'export const = ;\n');
      const { buildPerfHarness } = await perfHarness();
      const r = await buildPerfHarness({ cwd: k.root, outDir: join(sb.base, 'harness-dist') });
      expect(r.ok).toBe(false);
      expect((r.ursache ?? '').length).toBeGreaterThan(0);
      expect((r.naechsterSchritt ?? '').length).toBeGreaterThan(0);
    },
    LANG,
  );
});
