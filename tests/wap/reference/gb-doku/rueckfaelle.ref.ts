// @vitest-environment jsdom
// GB-DOKU (test-engineer; Gate B 28.10.2026 Nr 3 a, Auftrag Koordinator): Die bestätigte Liste der Rückfälle der
// echten Referenzwochen KVK, Wo 1–3 ist eingefroren (R-14.3-03; Gate S S-2, Q-032 Option A; Beschrieb 14.3).
// Ablauf wie die App: Import der Kp-Referenzmappe, Wochenseite A4 mit Status, Wochen-PDF. Geprüft je Woche:
//   – Zahl der Rückfallereignisse = bestätigte Zahl (KVK 8, Wo1 3, Wo2 5, Wo3 2; zusammen 18, Liste GB-LAYOUT);
//   – die Ereignisse sind dieselben wie in der bestätigten Liste (Schlüssel ohne Inhalte, lokale Datei);
//   – jedes Ereignis ist als Befund P8 sichtbar; eine Seite je Woche (keine Fortsetzungsseite);
//   – kein «…» ausserhalb der Liste (im Layout und im erzeugten PDF gleich viele).
// Eingaben nur lokal über WAP_REFERENCE_DIR (test:reference, Prompt §5.6; fehlt eine Datei, scheitert der Test):
//   01_02_WAP_FDT_2026.xlsx                        – Kp-Referenzmappe
//   anhaenge/rueckfaelle/rueckfaelle-etappe-1.csv  – bestätigte Liste als Schlüssel (Woche;Datum;Art;Bereich;Feld;
//                                                    Typ;Zeit), erzeugt aus der Liste von GB-LAYOUT (18, unverändert)
// Ausgaben und Meldungen nur als Zahlen und Schlüsselteile ohne Datum und Zeit, nie Inhalte (agent-regeln 3).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { importKpWorkbook } from '../../../../src/io/wap-import/index';
import { layoutWeekForOutput, renderWeekPdf } from '../../../../src/io/wap-pdf/index';
import { readWorkbook } from '../../../../src/io/xlsx-drawing/index';
import { addDays } from '../../../../src/model/wap/calendar';
import { runChecks } from '../../../../src/model/wap/checks/run';
import type { Finding } from '../../../../src/model/wap/checks/types';
import { createPlanFromTemplate } from '../../../../src/model/wap/factories';
import type {
  PageFallbackEvent,
  WeekPageLayout,
} from '../../../../src/model/wap/layout/page/types';
import type { PageModel } from '../../../../src/model/wap/layout/pageModel';
import { builtInTemplates, kpTemplate } from '../../../../src/model/wap/template';
import { formatTimeSpec } from '../../../../src/model/wap/time';
import type { Entry, Plan, TimeSpec } from '../../../../src/model/wap/types';
import { readPdf } from '../../support/pdf/read';

const DIR = process.env.WAP_REFERENCE_DIR ?? '';
const XLSX = join(DIR, '01_02_WAP_FDT_2026.xlsx');
const LISTE = join(DIR, 'anhaenge', 'rueckfaelle', 'rueckfaelle-etappe-1.csv');
const KOPF = 'Woche;Datum;Art;Bereich;Feld;Typ;Zeit';
/** Bestätigte Zahlen je Woche (Gate B 28.10.2026 Nr 3 a; `gates/gate-B.md`). */
const BESTAETIGT: Readonly<Record<string, number>> = { KVK: 8, Wo1: 3, Wo2: 5, Wo3: 2 };
const ELLIPSE = '…';

interface Woche {
  readonly kurz: string;
  readonly layout: WeekPageLayout;
  readonly pdfSeiten: number;
  readonly pdfRueckfaelle: number;
  readonly pdfEllipsen: number;
}

let plan: Plan;
let wochen: Woche[] = [];
let befunde: readonly Finding[] = [];

const templates = builtInTemplates();
const optionen = { paper: 'A4' as const, showStatus: true, templates };

function zeitVon(e: Entry | undefined): string {
  if (e === undefined) return '';
  const x = e as { time?: TimeSpec; windows?: readonly { time: TimeSpec }[]; date?: string };
  const t = x.time ?? x.windows?.[0]?.time;
  return t === undefined || x.date === undefined ? '' : formatTimeSpec(t, x.date);
}

/** Schlüssel eines Ereignisses ohne Inhalte: Woche, Datum, Art, Bereich, Feld bzw. entfallene Zeilen, Typ, Zeit. */
function schluessel(kurz: string, f: PageFallbackEvent): string {
  const e = f.entryId === null ? undefined : plan.entries[f.entryId];
  const feld = f.field ?? f.dropped.join('+');
  return [kurz, f.date ?? '', f.kind, f.region, feld, e?.type ?? '', zeitVon(e)].join(';');
}

/** Schlüsselteile für Meldungen: ohne Datum und Zeit. */
const kurzSchluessel = (k: string): string => {
  const [w, , art, bereich, feld, typ] = k.split(';');
  return [w, art, bereich, feld, typ].join('|');
};

function ellipsenImLayout(pages: readonly PageModel[]): number {
  let n = 0;
  for (const p of pages)
    for (const i of p.items)
      if (i.kind === 'text')
        n +=
          i.runs
            .map((r) => r.text)
            .join('')
            .split(ELLIPSE).length - 1;
  return n;
}

/** «…» in Quelltexten der Einträge dieser Woche (kein Rückfall, steht schon in der Mappe). */
function ellipsenImQuelltext(kurz: string): number {
  const week = plan.weeks.find((w) => w.shortName === kurz);
  if (week === undefined) return 0;
  const tage = [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(week.startDate, i));
  let n = 0;
  for (const e of Object.values(plan.entries)) {
    const s = JSON.stringify(e);
    if (tage.some((d) => s.includes(`"${d}"`))) n += s.split(ELLIPSE).length - 1;
  }
  return n;
}

beforeAll(async () => {
  expect(existsSync(XLSX), 'Referenzmappe vorhanden (WAP_REFERENCE_DIR)').toBe(true);
  expect(existsSync(LISTE), 'bestätigte Rückfallliste vorhanden (WAP_REFERENCE_DIR)').toBe(true);
  const template = kpTemplate();
  const target = createPlanFromTemplate(template, {
    planId: 'referenz',
    startDate: '2026-09-28',
    weekCount: 1,
  });
  plan = importKpWorkbook(
    target,
    readWorkbook(new Uint8Array(readFileSync(XLSX))),
    'referenz.xlsx',
    { template, persons: [], functionList: target.functionList },
    { templates },
  ).result.plan;
  const layouts = new Map<string, WeekPageLayout>();
  wochen = [];
  for (const w of plan.weeks) {
    const layout = (await layoutWeekForOutput(plan, w.id, optionen)).layout;
    layouts.set(w.id, layout);
    const pdf = await renderWeekPdf(plan, w.id, optionen, `Referenz ${w.shortName}`);
    const info = await readPdf(pdf.bytes);
    wochen.push({
      kurz: w.shortName,
      layout,
      pdfSeiten: pdf.pageCount,
      pdfRueckfaelle: pdf.fallbacks,
      pdfEllipsen:
        info.texts
          .map((t) => t.text)
          .join('')
          .split(ELLIPSE).length - 1,
    });
  }
  befunde = runChecks({
    plan,
    layoutFor: (id) => {
      const l = layouts.get(id);
      if (l === undefined) throw new Error('Woche ohne Layout');
      return l;
    },
  });
}, 120_000);

describe('GB-DOKU – bestätigte Rückfallliste der Referenzwochen (Gate B Nr 3 a)', () => {
  it('[R-14.3-03] Referenzwochen KVK, Wo1–Wo3: Zahl der Rückfallereignisse je Woche = bestätigte Liste (8, 3, 5, 2), im Layout und im PDF', () => {
    expect(wochen.map((w) => w.kurz)).toEqual(Object.keys(BESTAETIGT));
    expect(Object.fromEntries(wochen.map((w) => [w.kurz, w.layout.fallbacks.length]))).toEqual(
      BESTAETIGT,
    );
    expect(Object.fromEntries(wochen.map((w) => [w.kurz, w.pdfRueckfaelle]))).toEqual(BESTAETIGT);
  });

  it('[R-14.3-03] die Rückfallereignisse sind dieselben wie in der bestätigten Liste (Schlüssel ohne Inhalte)', () => {
    const text = readFileSync(LISTE, 'utf8').replace(/\r\n?/g, '\n').trim().split('\n');
    expect(text[0], 'Kopfzeile der Liste').toBe(KOPF);
    const soll = text
      .slice(1)
      .filter((z) => z !== '')
      .sort();
    const ist = wochen.flatMap((w) => w.layout.fallbacks.map((f) => schluessel(w.kurz, f))).sort();
    const rest = [...soll];
    const fehlend: string[] = [];
    for (const k of ist) {
      const i = rest.indexOf(k);
      if (i >= 0) rest.splice(i, 1);
      else fehlend.push(k);
    }
    expect(soll.length, 'Einträge der bestätigten Liste').toBe(18);
    expect(fehlend.map(kurzSchluessel), 'Ereignisse ausserhalb der bestätigten Liste').toEqual([]);
    expect(rest.map(kurzSchluessel), 'bestätigte Ereignisse, die fehlen').toEqual([]);
  });

  it('[R-14.3-03] jedes Rückfallereignis ist als Befund P8 sichtbar', () => {
    const p8 = befunde.filter((b) => b.rule === 'P8');
    const ohne: string[] = [];
    for (const w of wochen) {
      const week = plan.weeks.find((x) => x.shortName === w.kurz);
      for (const f of w.layout.fallbacks) {
        const da = p8.some(
          (b) =>
            b.weekId === week?.id &&
            (f.entryId === null ? b.region === f.region : b.entryId === f.entryId),
        );
        if (!da) ohne.push(kurzSchluessel(schluessel(w.kurz, f)));
      }
    }
    expect(ohne, 'Rückfälle ohne Befund P8').toEqual([]);
    expect(p8.length).toBeGreaterThan(0);
  });

  it('[R-14.3-03] eine Seite je Woche: keine Fortsetzungsseite im Layout und im PDF', () => {
    for (const w of wochen) {
      expect(w.layout.pages.length, `${w.kurz}: Seiten im Layout`).toBe(1);
      expect(w.pdfSeiten, `${w.kurz}: Seiten im PDF`).toBe(1);
      expect(
        w.layout.fallbacks.filter((f) => f.kind === 'continuationPage').length,
        `${w.kurz}: Fortsetzungsseiten`,
      ).toBe(0);
    }
  });

  it('[R-14.3-03] kein «…» ausserhalb der Liste: Ellipsen im Layout ≤ Kürzungen der Liste plus Quelltext, im PDF gleich viele wie im Layout', () => {
    for (const w of wochen) {
      const imLayout = ellipsenImLayout(w.layout.pages);
      const gekuerzt = w.layout.fallbacks.filter((f) => f.kind === 'ellipsis').length;
      expect(imLayout, `${w.kurz}: «…» im Layout`).toBeLessThanOrEqual(
        gekuerzt + ellipsenImQuelltext(w.kurz),
      );
      expect(w.pdfEllipsen, `${w.kurz}: «…» im PDF wie im Layout`).toBe(imLayout);
    }
  });
});
