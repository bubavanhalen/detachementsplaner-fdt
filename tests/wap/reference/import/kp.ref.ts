// @vitest-environment jsdom
// I4 (E1-08): Import der Kp-Referenzmappe gegen den bestätigten Anhang A (lokal, test:reference; Prompt §5.6:
// fehlt eine Datei, scheitert der Test). Ausgaben und Meldungen nur als Zahlen und Schlüssel (Woche, Tag, Nr),
// nie Inhalte (agent-regeln 3, Befund E1-02a-06).
// F-IMPORT2 (Entscheide des Auftraggebers vom 19.10.2026 zu Q-042, Q-043, Q-044, 9): Massgebend ist der danach
// angepasste Anhang A `anhaenge/anhang-a-kp.csv` (Änderungsliste nur lokal); ganz verdeckte Formen sind dort
// erwartete Berichtseinträge (Typ «Bericht»), die Quote misst ohne Abzug im Nenner (TR-H-03).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { type ImportOutcome, importKpWorkbook } from '../../../../src/io/wap-import/index';
import { readWorkbook } from '../../../../src/io/xlsx-drawing/index';
import { addDays } from '../../../../src/model/wap/calendar';
import { dayColumns } from '../../../../src/model/wap/derive/columns';
import { createPlanFromTemplate } from '../../../../src/model/wap/factories';
import { listCsv, listRows } from '../../../../src/model/wap/list/index';
import { builtInTemplates, kpTemplate } from '../../../../src/model/wap/template';
import type { Weekday } from '../../../../src/model/wap/types';
import {
  type CsvRow,
  compareWithAnhang,
  normalizeText,
  parseCsv,
  REPORT_ROW_TYPE,
} from '../../support/anhang-compare/compare';

const DIR = process.env.WAP_REFERENCE_DIR ?? '';
const XLSX = join(DIR, '01_02_WAP_FDT_2026.xlsx');
const ANHANG = join(DIR, 'anhaenge', 'anhang-a-kp.csv');
const WEEKDAYS: readonly Weekday[] = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const START: Readonly<Record<string, string>> = {
  KVK: '2026-09-28',
  Wo1: '2026-10-05',
  Wo2: '2026-10-12',
  Wo3: '2026-10-19',
};

let outcome: ImportOutcome;
let soll: CsvRow[];
let csv: string;
let sollText: string;

beforeAll(() => {
  expect(existsSync(XLSX), 'Referenzmappe vorhanden (WAP_REFERENCE_DIR)').toBe(true);
  expect(existsSync(ANHANG), 'Anhang A vorhanden (WAP_REFERENCE_DIR)').toBe(true);
  const template = kpTemplate();
  const target = createPlanFromTemplate(template, {
    planId: 'referenz',
    startDate: '2026-09-28',
    weekCount: 1,
  });
  outcome = importKpWorkbook(
    target,
    readWorkbook(new Uint8Array(readFileSync(XLSX))),
    'referenz.xlsx',
    {
      template,
      persons: [],
      functionList: target.functionList,
    },
    { templates: builtInTemplates() },
  );
  csv = listCsv(outcome.result.plan, 'plan');
  sollText = readFileSync(ANHANG, 'utf8');
  soll = parseCsv(sollText);
});

const dateOf = (r: CsvRow): string =>
  addDays(START[r.Woche] ?? '', Math.max(0, WEEKDAYS.indexOf(r.Tag as Weekday)));
const minutes = (t: string): number =>
  /^\d{4}$/.test(t) ? Number(t.slice(0, 2)) * 60 + Number(t.slice(2)) : Number.NaN;
const items = (kind: string) => outcome.report.items.filter((i) => i.kind === kind);
const weekOf = (weekId: string | null) =>
  outcome.result.plan.weeks.find((w) => w.id === weekId)?.shortName ?? '';
const kennzeichen = (art: string) => soll.filter((r) => r.Bemerkung.includes(`Bericht: ${art}`));
const marks = (r: CsvRow): string[] => (r.Bemerkung === '' ? [] : r.Bemerkung.split(' / '));
const sorted = (xs: readonly string[]): string[] => [...xs].sort();

describe('Import Kp-Referenz', () => {
  it('[R-8.2-01] vier Wochen mit richtigen Daten; die Spalten von Anhang A liegen in den Spaltensätzen der Tage', () => {
    const plan = outcome.result.plan;
    expect(plan.weeks.map((w) => [w.shortName, w.startDate])).toEqual(Object.entries(START));
    let missing = 0;
    for (const r of soll) {
      if (r.Tag === '' || r.Spalten === '') continue;
      const week = plan.weeks.find((w) => w.shortName === r.Woche);
      const names = new Set(
        (week === undefined ? [] : dayColumns(plan, week.id, r.Tag as Weekday)).map((c) =>
          c.kind === 'rap' ? 'Rap' : c.kind === 'beso' ? 'Beso' : c.name,
        ),
      );
      for (const t of r.Spalten.split('|')) if (t !== 'alle' && !names.has(t)) missing++;
    }
    expect(missing, 'Spaltennamen aus Anhang A ohne Spalte am Tag').toBe(0);
  });

  it('[R-8.2-04] alle Beso-Texte aus Anhang A erkannt (Nummer mit Titel in derselben Woche)', () => {
    const ist = new Set(
      listRows(outcome.result.plan, 'plan')
        .filter((r) => r.typ === 'Beso' && r.titel !== '')
        .map((r) => `${r.woche}|${r.nr}`),
    );
    const erwartet = soll
      .filter((r) => r.Typ === 'Beso' && r.Titel !== '')
      .map((r) => `${r.Woche}|${r.Nr}`);
    expect(erwartet.filter((k) => !ist.has(k))).toEqual([]);
  });

  it('[R-8.2-20] je Blatt gelesen = zugeordnet + nicht zugeordnet; jede nicht zugeordnete Form einzeln im Bericht', () => {
    for (const s of outcome.report.sheets) {
      expect(s.shapesRead).toBe(s.assigned + s.unassigned);
      const einzeln = new Set(
        outcome.report.items
          .filter(
            (i) => i.sheet === s.sheet && (i.kind === 'unassignedShape' || i.kind === 'hidden'),
          )
          .map((i) => i.target.shapeIndex),
      );
      expect(einzeln.size).toBe(s.unassigned);
    }
    expect(outcome.report.sheets).toHaveLength(4);
  });

  it('[R-8.2-43] Berichtseinträge «verdeckt» = Zeilen «Bericht: verdeckt» von Anhang A (Q-043: 16), eins zu eins nach Woche, Tag und Zeit; keine davon ein Eintrag', () => {
    const erwartet = soll.filter(
      (r) => r.Typ === REPORT_ROW_TYPE && marks(r).includes('Bericht: verdeckt'),
    );
    expect(erwartet).toHaveLength(16);
    const hidden = items('hidden');
    expect(hidden).toHaveLength(erwartet.length);
    expect(hidden.every((h) => h.target.entryId === null && h.span !== null)).toBe(true);
    // Toleranz: Blöcke 8 Min je Kante (Ablesung am PDF gegenüber Formkante); Marker 35 Min, weil Anhang A die
    // Zeit der Beschriftung führt und der Bericht die Spanne des verdeckten Kästchens (30 Min).
    const used = new Set<string>();
    const ohne: string[] = [];
    for (const r of erwartet) {
      const marker = marks(r).includes('Form: Marker');
      const h = hidden.find(
        (x) =>
          !used.has(x.id) &&
          weekOf(x.weekId) === r.Woche &&
          x.date === dateOf(r) &&
          x.span !== null &&
          Math.abs(x.span.from - minutes(r.von)) <= (marker ? 35 : 8) &&
          (marker || Math.abs(x.span.to - minutes(r.bis)) <= 8),
      );
      if (h === undefined) ohne.push(`${r.Woche}|${r.Tag}|${r.von}`);
      else used.add(h.id);
    }
    expect(ohne, 'Zeilen «Bericht: verdeckt» ohne Berichtseintrag').toEqual([]);
  });

  it('[R-8.2-43] teilweise verdeckte Formen: je Zeile «Bericht: teilweise verdeckt» ein Berichtseintrag, dessen Eintrag Typ, Tag und sichtbare Zeit der Zeile hat (Q-042)', () => {
    const key = (w: string, tag: string, typ: string, von: string, bis: string) =>
      `${w}|${tag}|${typ}|${von}|${bis}`;
    const erwartet = soll
      .filter((r) => r.Typ !== REPORT_ROW_TYPE && marks(r).includes('Bericht: teilweise verdeckt'))
      .map((r) => key(r.Woche, r.Tag, r.Typ, r.von, r.bis));
    expect(erwartet.length).toBeGreaterThan(0);
    const rows = listRows(outcome.result.plan, 'plan');
    const ist = items('partlyHidden').map((i) => {
      const row = rows.find((x) => x.entryId === i.target.entryId);
      return row === undefined
        ? `ohne Eintrag ${weekOf(i.weekId)}`
        : key(row.woche, row.tag, row.typ, row.von, row.bis);
    });
    expect(sorted(ist)).toEqual(sorted(erwartet));
  });

  it('[R-8.2-37] [R-8.2-38] Blöcke mit Teilaufgaben wie Anhang A (Q-044): gleiche Blöcke, gleiche Anzahl Teilaufgaben', () => {
    const erwartet = soll.flatMap((r) => {
      const t = marks(r).find((k) => k.startsWith('Teilaufgaben: '));
      return t === undefined ? [] : [`${r.Woche}|${r.Tag}|${r.von}|${r.bis}|${t.slice(14)}`];
    });
    expect(erwartet.length).toBeGreaterThan(0);
    const plan = outcome.result.plan;
    const rows = listRows(plan, 'plan');
    const ist = Object.values(plan.entries).flatMap((e) => {
      if (e.type !== 'block' || (e.subtasks?.length ?? 0) === 0) return [];
      const row = rows.find((r) => r.entryId === e.id);
      return row === undefined
        ? ['ohne Zeile']
        : [`${row.woche}|${row.tag}|${row.von}|${row.bis}|${String(e.subtasks?.length ?? 0)}`];
    });
    expect(sorted(ist)).toEqual(sorted(erwartet));
  });

  it('[R-4.2-07] durchgehende Bemerkungen erscheinen in jeder Woche wie in Anhang A (auch Wo2/Wo3 ohne eigene Box)', () => {
    const titles = (rs: readonly { woche: string; titel: string }[], w: string) =>
      sorted(rs.filter((r) => r.woche === w).map((r) => normalizeText(r.titel)));
    const ist = listRows(outcome.result.plan, 'plan').filter((r) => r.typ === 'MehrtagBemerkung');
    const erwartet = soll
      .filter((r) => r.Typ === 'MehrtagBemerkung')
      .map((r) => ({ woche: r.Woche, titel: r.Titel }));
    // Nur Anzahlen in der Meldung (keine Texte, agent-regeln 3): je Woche fehlende und überzählige Bemerkungen.
    const abweichung = (a: readonly string[], b: readonly string[]): number => {
      const rest = [...b];
      let n = 0;
      for (const x of a) {
        const i = rest.indexOf(x);
        if (i < 0) n++;
        else rest.splice(i, 1);
      }
      return n + rest.length;
    };
    const je = Object.keys(START).map((w) => [
      w,
      titles(erwartet, w).length,
      abweichung(titles(erwartet, w), titles(ist, w)),
    ]);
    expect(
      je.filter(([, n]) => n === 0).map(([w]) => w),
      'Wochen ohne Bemerkungen in Anhang A',
    ).toEqual([]);
    expect(je.map(([w, , d]) => [w, d])).toEqual(Object.keys(START).map((w) => [w, 0]));
  });

  it('[R-14.1-01] mindestens 95 % von Anhang A (alle Wochen) automatisch korrekt erkannt, gegen den angepassten Anhang ohne Abzug im Nenner', () => {
    const r = compareWithAnhang(csv, sollText);
    // Nenner = alle Soll-Einheiten des angepassten Anhangs; Zeilen «Bericht» sind keine Einheit (Q-043).
    expect(Object.keys(r.byWeekType).filter((k) => k.endsWith(`|${REPORT_ROW_TYPE}`))).toEqual([]);
    expect(Object.keys(r.byWeek).sort()).toEqual(Object.keys(START).sort());
    expect(r.quote).toBeGreaterThanOrEqual(0.95);
  });

  it('[R-4.2-04] Wochenziele nur mit dem im Excel sichtbaren Text (Entscheid 9): KVK 4, Wo1 4, Wo2 2, Wo3 4; der Rest im Bericht «nicht sichtbar, nicht übernommen»', () => {
    const plan = outcome.result.plan;
    expect(plan.weeks.map((w) => [w.shortName, w.weekGoals.length])).toEqual([
      ['KVK', 4],
      ['Wo1', 4],
      ['Wo2', 2],
      ['Wo3', 4],
    ]);
    const notVisible = items('notVisible');
    expect(sorted(notVisible.map((i) => weekOf(i.weekId)))).toEqual(['Wo1', 'Wo2']);
    for (const i of notVisible) {
      const m = /(\d+) Zeilen? mit (\d+) Zeichen/.exec(i.message.cause);
      expect(Number(m?.[2] ?? 0)).toBeGreaterThan(0);
      expect(i.message.cause).toContain('nicht sichtbar, nicht übernommen');
    }
  });
});

describe('Importbericht Kp nach Beschrieb 14.5', () => {
  const beso = (kind: string, woche: string, nr: number) =>
    items(kind).some((i) => weekOf(i.weekId) === woche && i.besoNumber === nr);

  it('[R-14.5-01] Beso 52/53 Fr Wo 3: «Überlappung» genau dann, wenn Anhang A sie kennzeichnet', () => {
    const marked = kennzeichen('Überlappung mit').some(
      (r) => r.Woche === 'Wo3' && ['52', '53'].includes(r.Nr),
    );
    expect(beso('overlappingShapes', 'Wo3', 52)).toBe(marked);
  });

  it('[R-14.5-02] Beso 10/11 Mo Wo 2: «Überlappung» genau dann, wenn Anhang A sie kennzeichnet', () => {
    const marked = kennzeichen('Überlappung mit').some(
      (r) => r.Woche === 'Wo2' && ['10', '11'].includes(r.Nr),
    );
    expect(beso('overlappingShapes', 'Wo2', 10)).toBe(marked);
  });

  it('[R-14.5-03] «Bemerkungen» über der Legende: je Woche mit Box genau ein Eintrag', () => {
    const erwartet = [
      ...new Set(kennzeichen('Überlappung Seitenleiste').map((r) => r.Woche)),
    ].sort();
    const ist = items('overlappingShapes')
      .filter((i) => i.besoNumber === null)
      .map((i) => weekOf(i.weekId))
      .sort();
    expect(ist).toEqual(erwartet);
  });

  it('[R-14.5-04] Beso 32 Mi Wo 1 in der Rap-Spalte', () => {
    expect(beso('besoInRapColumn', 'Wo1', 32)).toBe(true);
  });

  it('[R-14.5-05] Beso 52 Fr Wo 1 in der Rap-Spalte', () => {
    expect(beso('besoInRapColumn', 'Wo1', 52)).toBe(true);
  });

  it('[R-14.5-06] KVK Mo Nr 13 «bis 1200» vor Nr 14 «1130» nummeriert', () => {
    const item = items('numberOrder').find(
      (i) => weekOf(i.weekId) === 'KVK' && i.date === START.KVK,
    );
    expect(item?.besoNumber).toBe(14);
    expect(item?.message.cause).toMatch(/\b14\b.*\b13\b/);
  });

  it('[R-14.5-07] alle Kästchen mit mehr als 15 Min Abweichung zum Termintext (Menge wie Anhang A)', () => {
    const erwartet = kennzeichen('Abweichung Kästchen')
      .map((r) => `${r.Woche}|${r.Nr}`)
      .sort();
    const ist = items('boxTimeDeviation')
      .map((i) => `${weekOf(i.weekId)}|${String(i.besoNumber)}`)
      .sort();
    expect(ist).toEqual(erwartet);
  });

  it('[R-14.5-08] nummerierter Termin ohne Zeit KVK Fr 51 → Bericht, als Bemerkung übernommen', () => {
    expect(beso('numberedWithoutTime', 'KVK', 51)).toBe(true);
    const date = addDays(START.KVK ?? '', 4);
    expect(
      Object.values(outcome.result.plan.entries).some(
        (e) => e.type === 'dayRemark' && e.date === date,
      ),
    ).toBe(true);
  });

  it('[R-14.5-09] nummerierter Termin ohne Zeit Wo 2 Fr 53 → Bericht, als Bemerkung übernommen', () => {
    expect(beso('numberedWithoutTime', 'Wo2', 53)).toBe(true);
    const date = addDays(START.Wo2 ?? '', 4);
    expect(
      Object.values(outcome.result.plan.entries).some(
        (e) => e.type === 'dayRemark' && e.date === date,
      ),
    ).toBe(true);
  });
});
