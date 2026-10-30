// @vitest-environment node
// E1-AB (Vertrag docs/wap-planer/plan/vertraege/E1-AB.md Abschnitt 1; Plan etappe-1.md 4.23): Nach Import und
// Nacharbeit stimmt Anhang A für KVK und Wo1 zu 100 % mit der Listenansicht überein (Beschrieb 14.1, R-14.1-02).
// Eingaben nur lokal über WAP_REFERENCE_DIR (test:reference, Prompt §5.6; fehlt eine Datei, scheitert der Test):
//   anhaenge/anhang-a-kp.csv               – bestätigter Anhang A (F-IMPORT2, Lock R-14-01/R-14-03)
//   nacharbeit/etappe-1/liste-kvk-wo1.csv  – Export «Export …» der Listenansicht (E1-15, Umfang «Ganzer Plan»)
//                                            nach der Nacharbeit des ux-critic (Format normalisierung.md)
// Die Nacharbeitsdatei steht bewusst nicht in required-files.json: Vor der Nacharbeit ist der Test fachlich rot
// (erste Erwartung), nicht ein Setup-Fehler.
// «100 % Übereinstimmung» nach normalisierung.md Abschnitt 10: alle 13 Pflichtfelder jeder Soll-Einheit gleich und
// keine überzählige Ist-Einheit. Zusätzlich muss die Datei die Signatur des Exports tragen (Test-Review TR-AB-01/02).
// Ausgaben und Meldungen nur als Zahlen und Schlüssel (Woche|Tag|Typ|Nr und Feldnamen), nie Inhalte
// (agent-regeln 3, Befund E1-02a-06).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CSV_FIELDS,
  type CsvField,
  type CsvRow,
  compareWithAnhang,
  matchUnits,
  normalizeText,
  parseCsv,
  REPORT_ROW_TYPE,
} from '../../support/anhang-compare/compare';

const DIR = process.env.WAP_REFERENCE_DIR ?? '';
const ANHANG = join(DIR, 'anhaenge', 'anhang-a-kp.csv');
const NACHARBEIT = join(DIR, 'nacharbeit', 'etappe-1', 'liste-kvk-wo1.csv');
/** Wochen der Abnahme Etappe 1 (Beschrieb 13, 14.1). */
const WOCHEN: readonly string[] = ['KVK', 'Wo1'];
/** Kopfzeile gemäss normalisierung.md Abschnitt 2. */
const KOPF = CSV_FIELDS.join(';');
/** Die 13 Pflichtfelder (ohne «Bemerkung», normalisierung.md Abschnitt 2). */
const PFLICHT: readonly CsvField[] = CSV_FIELDS.filter((f) => f !== 'Bemerkung');

/**
 * Bemerkungen, die der Export der Listenansicht erzeugt (src/model/wap/list: «offenes Ende», «über Mitternacht»,
 * «Zusatz: …», getrennt durch « / »); leer ist erlaubt (TR-AB-02).
 */
const EXPORT_BEMERKUNG =
  /^(?:(?:Zusatz: .+|offenes Ende)(?: \/ über Mitternacht)?|über Mitternacht)?$/;

const csvFeld = (v: string): string => `"${v.replace(/"/g, '""')}"`;

/** Nur die Zeilen der Wochen KVK und Wo1, wieder als CSV im Format der Soll-Listen. */
function nurWochen(text: string): string {
  const rows = parseCsv(text).filter((r) => WOCHEN.includes(r.Woche));
  return `${[KOPF, ...rows.map((r) => CSV_FIELDS.map((f) => csvFeld(r[f])).join(';'))].join('\n')}\n`;
}

const schluessel = (r: CsvRow): string => `${r.Woche}|${r.Tag}|${r.Typ}|${r.Nr.trim()}`;
const zeilenSchluessel = (r: CsvRow): string =>
  PFLICHT.map((f) => normalizeText(r[f])).join('\u0001');

/** Je korrekt erkannter Einheit die Pflichtfelder, die nicht gleich sind (nur Schlüssel und Feldnamen). */
function abweichendePflichtfelder(ist: string, soll: string): string[] {
  const out: string[] = [];
  for (const p of matchUnits(ist, soll)) {
    const first = p.soll[0];
    if (p.ist === null || p.feld !== null || first === undefined) continue;
    if (p.ist.length !== p.soll.length) {
      out.push(`${schluessel(first)}:Zeitfenster-Anzahl`);
      continue;
    }
    const s = [...p.soll].sort((a, b) => zeilenSchluessel(a).localeCompare(zeilenSchluessel(b)));
    const i = [...p.ist].sort((a, b) => zeilenSchluessel(a).localeCompare(zeilenSchluessel(b)));
    const felder = new Set<string>();
    for (const [k, r] of s.entries()) {
      const g = i[k];
      for (const f of PFLICHT)
        if (g === undefined || normalizeText(r[f]) !== normalizeText(g[f])) felder.add(f);
    }
    for (const f of felder) out.push(`${schluessel(first)}:${f}`);
  }
  return out.sort();
}

/** Schlüssel der Ist-Zeilen, die keiner Soll-Einheit zugeordnet sind (überzählig; nur Schlüssel). */
function ueberzaehligeSchluessel(ist: string, soll: string): string[] {
  const zeile = (r: CsvRow): string => CSV_FIELDS.map((f) => r[f]).join('\u0001');
  const verwendet = new Map<string, number>();
  for (const p of matchUnits(ist, soll))
    for (const r of p.ist ?? []) verwendet.set(zeile(r), (verwendet.get(zeile(r)) ?? 0) + 1);
  const out = new Set<string>();
  for (const r of parseCsv(ist)) {
    if (r.Typ === REPORT_ROW_TYPE) continue;
    const n = verwendet.get(zeile(r)) ?? 0;
    if (n > 0) verwendet.set(zeile(r), n - 1);
    else out.add(schluessel(r));
  }
  return [...out].sort();
}

/** Vollständige Liste für die Meldung (Vitest kürzt Arrays in der Meldung); nur Schlüssel und Feldnamen. */
const liste = (xs: readonly string[]): string =>
  `${String(xs.length)}: ${xs.length === 0 ? 'keine' : xs.join(', ')}`;

describe('Abnahme Etappe 1 – Nacharbeit 14.1', () => {
  it('[R-14.1-02] nach Import und Nacharbeit stimmt Anhang A für KVK und Wo1 zu 100 % mit dem Export der Listenansicht überein (alle 13 Felder, 0 Abweichungen)', () => {
    // 1. Erste Erwartung: Export der Listenansicht nach der Nacharbeit liegt vor (vor der Nacharbeit rot).
    expect(
      existsSync(NACHARBEIT),
      'Export der Listenansicht nach der Nacharbeit vorhanden (nacharbeit/etappe-1/liste-kvk-wo1.csv)',
    ).toBe(true);
    expect(existsSync(ANHANG), 'Anhang A vorhanden (anhaenge/anhang-a-kp.csv)').toBe(true);
    const istText = readFileSync(NACHARBEIT, 'utf8');
    const sollText = readFileSync(ANHANG, 'utf8');
    // Nur Wahrheitswerte melden, nie Zeilentext der Datei (TR-AB-01; agent-regeln 3, Befund E1-02a-06).
    const ersteZeile = istText.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0] ?? '';
    expect(ersteZeile === KOPF, 'Kopfzeile des Exports gemäss normalisierung.md Abschnitt 2').toBe(
      true,
    );

    // Signatur des Exports der Listenansicht (TR-AB-02): keine Zeile vom Typ «Bericht» und jede Bemerkung nur aus
    // den Teilen, die listRows selbst erzeugt. Eine abgelegte Kopie von Anhang A wird so rot. Nur Anzahlen.
    const istRows = parseCsv(istText);
    expect(
      istRows.filter((x) => x.Typ === REPORT_ROW_TYPE).length,
      'Zeilen vom Typ «Bericht» im Export (kommen im Export der Listenansicht nie vor)',
    ).toBe(0);
    expect(
      istRows.filter((x) => !EXPORT_BEMERKUNG.test(x.Bemerkung)).length,
      'Zeilen mit Bemerkung, die der Export der Listenansicht nicht erzeugt',
    ).toBe(0);

    // 2. Vergleich nur auf den Zeilen der Wochen KVK und Wo1 (Hilfe E1-08).
    const ist = nurWochen(istText);
    const soll = nurWochen(sollText);
    const r = compareWithAnhang(ist, soll);
    expect(
      WOCHEN.map((w) => (r.byWeek[w]?.total ?? 0) > 0),
      'Soll-Einheiten je Woche KVK, Wo1 vorhanden',
    ).toEqual([true, true]);

    // 3. 0 Abweichungen, Quote 1; dazu alle 13 Pflichtfelder gleich und keine überzählige Ist-Einheit.
    // Meldung bei Abweichung: alle Schlüssel Woche|Tag|Typ|Nr mit Feld vollständig in der Meldung, keine Inhalte.
    const nichtErkannt = r.diffs.map((d) => `${d.key}:${d.feld}`);
    expect(r.diffs, `Soll-Einheiten nicht korrekt erkannt ${liste(nichtErkannt)}`).toHaveLength(0);
    expect(r.quote).toBe(1);
    const pflicht = abweichendePflichtfelder(ist, soll);
    expect(pflicht.length, `Pflichtfelder ungleich ${liste(pflicht)}`).toBe(0);
    expect(r.exact, 'Soll-Einheiten mit allen 13 Pflichtfeldern gleich').toBe(r.total);
    expect(r.extra, `überzählige Ist-Einheiten ${liste(ueberzaehligeSchluessel(ist, soll))}`).toBe(
      0,
    );
  });
});
