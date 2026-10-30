// @vitest-environment jsdom
// Paket E1-02f: Gesamt-PDF aller Wochen (R-10-03; Vertrag E1-02f Notiz «Ausarbeitung Schritt 2» B1, B2, B4, H1,
// J P1 bis P4; V12; Leitplanke 4). Nur readPdf: Seitenzahl, Reihenfolge, Seitengleichheit mit den Wochen-PDF,
// Determinismus und Metadaten. Pseudonymisierte KVK-Fixture, KVK+ (E1-02e), synthetischer Plan (E1-02a) und
// fiktive Varianten. Die Wochen-PDF von KVK, KVK+ und Fortsetzungsvariante sind die festen Artefakte für
// Gate S und die Golden-Kandidaten (H1, I).
import { describe, expect, it } from 'vitest';
import { renderPlanPdf, renderWeekPdf } from '../../../../src/io/wap-pdf';
import { formatDate } from '../../../../src/model/wap/calendar';
import { layoutWeekPage } from '../../../../src/model/wap/layout/page/compose';
import { kpTemplate } from '../../../../src/model/wap/template';
import type { Plan } from '../../../../src/model/wap/types';
import { KVK_WOCHE, kvk, kvkPlus, wappenPng } from '../../support/page/varianten';
import type { PdfInfo, PdfTextRun } from '../../support/pdf/read';
import { syntheticPlan } from '../../support/synthetic-plan';
import { einmal, gesamtPdf, pruefeSeitengleichheit, sha256, wochenPdf } from './support/pdf-plan';
import {
  DREI_WOCHEN,
  dreiWochen,
  fortsetzung,
  mitWappen,
  optionen,
  PDF_TITEL,
} from './support/plaene';

/** Titel der Wochenseite nach der Kp-Vorlage (B-Kp, «{unit} Arbeitsplan {weekLabel}»). */
function wochentitel(plan: Plan, label: string): string {
  return kpTemplate().titlePattern.replace('{unit}', plan.unit).replace('{weekLabel}', label);
}

/** Titel einer Fortsetzungsseite (R-10-42). */
function fortsetzungstitel(label: string): string {
  return `Fortsetzung – ${label}`;
}

/** Je Seite die Läufe, deren Text (ohne Rand) ein Wochen- oder Fortsetzungstitel einer Woche des Plans ist. */
function titelJeSeite(info: PdfInfo, plan: Plan): string[][] {
  const titel = new Set(
    plan.weeks.flatMap((w) => [wochentitel(plan, w.label), fortsetzungstitel(w.label)]),
  );
  return info.pages.map((_, i) =>
    info.texts
      .filter((t) => t.page === i + 1 && titel.has(t.text.trim()))
      .map((t) => t.text.trim()),
  );
}

const synthetisch = einmal(async () => {
  const plan = syntheticPlan();
  const gesamt = await gesamtPdf('plan-synthetisch', plan);
  const wochen = [];
  for (const w of plan.weeks) {
    wochen.push({ name: w.label, ...(await wochenPdf(`synthetisch-${w.id}`, plan, w.id)) });
  }
  return { plan, gesamt, wochen };
});

const drei = einmal(async () => {
  const plan = dreiWochen();
  const gesamt = await gesamtPdf('drei-wochen', plan);
  const wochen = [];
  for (const w of plan.weeks) {
    wochen.push({ name: w.label, ...(await wochenPdf(`drei-wochen-${w.id}`, plan, w.id)) });
  }
  return { plan, gesamt, wochen };
});

describe('Gesamt-PDF: Seitenzahl und Reihenfolge (R-10-03; B2, J P1, P2)', () => {
  // F-FLAKY (FL-01): keine Zeitanforderung; erzeugt als erster Test der Datei Gesamt- und Wochen-PDF des synthetischen
  // Plans (einmal, für alle Tests) und liest sie aus; in der eigenen Suite bis 4,7 s gemessen – Zeitlimit als Schutz
  // vor Hängern statt der Vitest-Vorgabe 5 s; die PDF-Dauer misst die Leistungssuite (R-11-16).
  it('[R-10-03] synthetischer Plan: pageCount = Seiten von readPdf = Summe der Wochen-PDF; Titelläufe je Woche in Planreihenfolge, danach je Fortsetzungsseite «Fortsetzung – ‹label›»', async () => {
    const { plan, gesamt, wochen } = await synthetisch();
    const summe = wochen.reduce((s, w) => s + w.pdf.pageCount, 0);
    expect(gesamt.pdf.pageCount).toBe(gesamt.info.pages.length);
    expect(gesamt.pdf.pageCount).toBe(summe);
    expect(plan.weeks.length).toBe(4);
    for (const w of wochen) expect(w.pdf.pageCount, w.name).toBe(w.info.pages.length);
    const soll = plan.weeks.flatMap((w, i) => [
      [wochentitel(plan, w.label)],
      ...Array.from({ length: (wochen[i]?.pdf.pageCount ?? 1) - 1 }, () => [
        fortsetzungstitel(w.label),
      ]),
    ]);
    expect(titelJeSeite(gesamt.info, plan)).toEqual(soll);
  }, 120_000);

  it('[R-10-03] Drei-Wochen-Plan A, B (40 Tagesbemerkungen am Mo), C: Seitenfolge A, B, «Fortsetzung – Woche B», C; pageCount 4; fallbacks = Summe von layoutWeekPage(…).fallbacks.length ≥ 1', async () => {
    const { plan, gesamt } = await drei();
    expect(gesamt.pdf.pageCount).toBe(4);
    expect(gesamt.info.pages.length).toBe(4);
    expect(titelJeSeite(gesamt.info, plan)).toEqual([
      [wochentitel(plan, DREI_WOCHEN.a.label)],
      [wochentitel(plan, DREI_WOCHEN.b.label)],
      [fortsetzungstitel(DREI_WOCHEN.b.label)],
      [wochentitel(plan, DREI_WOCHEN.c.label)],
    ]);
    const summe = plan.weeks.reduce(
      (s, w) => s + layoutWeekPage(plan, w.id, optionen()).fallbacks.length,
      0,
    );
    expect(summe).toBeGreaterThanOrEqual(1);
    expect(gesamt.pdf.fallbacks).toBe(summe);
  });

  it('[R-10-03] Drei-Wochen-Plan mit standOverride 01.10.2026: jede Seite trägt neben «Stand» dieses Datum, keine das Stand-Datum des Plans', async () => {
    const plan = dreiWochen();
    const { info } = await gesamtPdf(
      'drei-wochen-stand',
      plan,
      optionen({ standOverride: { date: '2026-10-01', version: 3 } }),
    );
    expect(info.pages.length).toBe(4);
    const planDatum = plan.stand === null ? null : formatDate(plan.stand.date, 'long');
    expect(planDatum).not.toBe('01.10.2026');
    for (let s = 1; s <= info.pages.length; s++) {
      const stand = info.texts.filter((t) => t.page === s && t.text.trim() === 'Stand');
      expect(stand.length, `Seite ${String(s)}: «Stand»`).toBe(1);
      const zeile = (stand[0] as PdfTextRun).baselineY;
      const daten = info.texts
        .filter(
          (t) =>
            t.page === s &&
            Math.abs(t.baselineY - zeile) <= 0.01 &&
            /^\d{2}\.\d{2}\.\d{4}$/.test(t.text.trim()),
        )
        .map((t) => t.text.trim());
      expect(daten, `Seite ${String(s)}: Stand-Datum`).toEqual(['01.10.2026']);
    }
  });
});

describe('Gesamt-PDF: Seiten gleich den Wochen-PDF (R-10-03; B2, B4, J P3, V12)', () => {
  it('[R-10-03] synthetischer Plan (vier Wochen): Seite s_w + j des Gesamt-PDF = Seite j des Wochen-PDF (Texte, Striche, Bildlagen, Reihenfolge exakt)', async () => {
    const { gesamt, wochen } = await synthetisch();
    pruefeSeitengleichheit(gesamt.info, wochen);
  });

  it('[R-10-03] Drei-Wochen-Plan mit Fortsetzungsseite: Seite s_w + j des Gesamt-PDF = Seite j des Wochen-PDF', async () => {
    const { gesamt, wochen } = await drei();
    expect(wochen.map((w) => w.info.pages.length)).toEqual([1, 2, 1]);
    pruefeSeitengleichheit(gesamt.info, wochen);
  });

  const einzeln: readonly { fall: string; plan: () => Plan }[] = [
    { fall: 'kvk', plan: kvk },
    { fall: 'kvk-plus', plan: kvkPlus },
    { fall: 'kvk-fortsetzung', plan: fortsetzung },
  ];
  for (const e of einzeln) {
    it(`[R-10-03] Plan aus einer Woche (${e.fall}): Gesamt-PDF = Wochen-PDF Seite für Seite; Wochen-PDF als Artefakt für Gate S`, async () => {
      const plan = e.plan();
      expect(plan.weeks.map((w) => w.id)).toEqual([KVK_WOCHE]);
      const artefakt = e.fall === 'kvk' ? 'kvk-woche' : e.fall;
      const w = await wochenPdf(artefakt, plan, KVK_WOCHE);
      const g = await gesamtPdf(`${e.fall}-gesamt`, plan);
      expect(w.pdf.pageCount).toBe(e.fall === 'kvk-fortsetzung' ? 2 : 1);
      expect(g.pdf.pageCount).toBe(w.pdf.pageCount);
      pruefeSeitengleichheit(g.info, [{ name: e.fall, info: w.info }]);
      if (e.fall === 'kvk-plus') expect(w.info.images).toBe(1);
    });
  }
});

describe('Gesamt-PDF: Determinismus und Metadaten (R-10-03; B4, J P4, H1, T-1)', () => {
  it('[R-10-03] zweimal renderPlanPdf und zweimal renderWeekPdf (drei Wochen mit Wappen) → gleiche SHA-256; Title = übergebener Titel, Producer und Creator «WAP-Planer»', async () => {
    const plan = mitWappen(dreiWochen(), 'image/png', wappenPng());
    const a = await renderPlanPdf(plan, optionen(), PDF_TITEL);
    const b = await renderPlanPdf(plan, optionen(), PDF_TITEL);
    expect(sha256(b.bytes)).toBe(sha256(a.bytes));
    const wa = await renderWeekPdf(plan, DREI_WOCHEN.b.id, optionen(), PDF_TITEL);
    const wb = await renderWeekPdf(plan, DREI_WOCHEN.b.id, optionen(), PDF_TITEL);
    expect(sha256(wb.bytes)).toBe(sha256(wa.bytes));
    const g = await gesamtPdf('drei-wochen-wappen', plan);
    expect(sha256(g.pdf.bytes)).toBe(sha256(a.bytes));
    expect(g.info.metadata.Title).toBe(PDF_TITEL);
    expect(g.info.metadata.Producer).toBe('WAP-Planer');
    expect(g.info.metadata.Creator).toBe('WAP-Planer');
    const w = await wochenPdf('drei-wochen-wappen-b', plan, DREI_WOCHEN.b.id);
    expect(w.info.metadata.Title).toBe(PDF_TITEL);
    expect(w.info.metadata.Producer).toBe('WAP-Planer');
    expect(w.info.metadata.Creator).toBe('WAP-Planer');
  });

  it('[R-10-03] Gesamt-PDF des synthetischen Plans und des Drei-Wochen-Plans: jede Schrift höchstens einmal, Menge = fontName der Läufe, eingebettet mit toUnicode (genau ein writePdf)', async () => {
    const faelle = [
      { name: 'synthetisch', info: (await synthetisch()).gesamt.info },
      { name: 'drei Wochen', info: (await drei()).gesamt.info },
    ];
    for (const f of faelle) {
      const namen = f.info.fonts.map((x) => x.name);
      expect(namen.length, `${f.name}: jede Schrift höchstens einmal`).toBe(new Set(namen).size);
      expect([...new Set(namen)].sort(), f.name).toEqual(
        [...new Set(f.info.texts.map((t) => t.fontName))].sort(),
      );
      expect([...new Set(namen)].sort(), f.name).toEqual(['Arimo', 'Arimo-Bold']);
      for (const x of f.info.fonts) {
        expect(x.embedded, `${f.name} ${x.name}: eingebettet`).toBe(true);
        expect(x.toUnicode, `${f.name} ${x.name}: toUnicode`).toBe(true);
      }
    }
  });
});

describe('Planreihenfolge statt Datumsfolge (R-10-03; B2, R-4.1-16, F-16; Notiz Test-Review Runde 1 Nr 4, P11)', () => {
  it('[R-10-03] Drei-Wochen-Plan mit weeks = [C, A, B]: Titelläufe C, A, B, «Fortsetzung – Woche B»; Seite s_w + j = Seite j des Wochen-PDF', async () => {
    const p = dreiWochen();
    const [a, b, c] = p.weeks;
    expect(c).toBeDefined();
    if (a === undefined || b === undefined || c === undefined) return;
    const plan: Plan = { ...p, weeks: [c, a, b] };
    const g = await gesamtPdf('reihenfolge-cab', plan);
    expect(g.pdf.pageCount).toBe(4);
    expect(titelJeSeite(g.info, plan)).toEqual([
      [wochentitel(plan, c.label)],
      [wochentitel(plan, a.label)],
      [wochentitel(plan, b.label)],
      [fortsetzungstitel(b.label)],
    ]);
    const wochen = [];
    for (const w of plan.weeks) {
      wochen.push({
        name: w.label,
        info: (await wochenPdf(`reihenfolge-cab-${w.id}`, plan, w.id)).info,
      });
    }
    pruefeSeitengleichheit(g.info, wochen);
  });
});
