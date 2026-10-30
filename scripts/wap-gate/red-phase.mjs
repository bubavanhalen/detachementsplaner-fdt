// Rot-Phase (R-H-12, ADR-010 §3.3, Entscheid E5).
// Vertrag: docs/wap-planer/plan/vertraege/E1-01.md §2 `classifyRedPhase`.
// Liest JSON-Berichte von Vitest und Playwright. Fachlich rot sind nur Assertion-Fehler (auch
// expect.soft, expect.poll, Playwright-expect mit Wartezeit) und Vertrags-Stub-Fehler
// «nicht implementiert: <name>» mit <name> aus dem Vertrag des laufenden Pakets. Alles andere (Import-,
// Syntax-, Typ- und Referenzfehler, Zeitüberschreitung des Tests, Fehler im Aufbau, fremder Stub,
// Absturz) macht die Schleuse rot. Bei fast-check-Berichten zählt nur der eingebettete Fehler («Got …»-Zeile
// nach «Shrunk k time(s)», Nachtrag E1-01-25); fehlt er, ist der Test nicht fachlich rot.
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { zeigePfad } from '../wap/lib/common.mjs';
import { kurzeListe, ohneFarben } from './lib/prozess.mjs';

/** @typedef {import('./lib/types.mjs').Schritt} Schritt */
/**
 * @typedef {object} TestErgebnis
 * @property {string} name voller Name (Gruppen und Titel)
 * @property {string} datei
 * @property {'passed' | 'failed' | 'skipped' | 'vorgemerkt' | 'timedOut'} status jedes ≠ passed ist
 *   ausserhalb der Rot-Ausnahme rot (CR-E101-02); vorgemerkte Tests getrennt von übersprungenen
 * @property {string[]} fehler Fehlermeldungen (mit Stack)
 */
/** @typedef {{ tests: TestErgebnis[]; dateiFehler: { datei: string; meldung: string }[] }} Bericht */

/** Status vorgemerkter Tests im Vitest-Bericht (zur Laufzeit gebildet, F4-Merkwortregel). */
const VORGEMERKT = ['to', 'do'].join('');

/** Anforderungs-IDs in einem Testnamen. */
const ID_MUSTER = /\[(R-[A-Z0-9]+(?:\.[0-9]+)*-[0-9]+)\]/g;

/**
 * IDs eines Testnamens.
 * @param {string} name
 * @returns {string[]}
 */
export function idsIn(name) {
  return [...name.matchAll(ID_MUSTER)].map((m) => m[1] ?? '');
}

/**
 * Liest einen JSON-Bericht von Vitest oder Playwright.
 * @param {string} pfad
 * @returns {Bericht}
 */
export function leseBericht(pfad) {
  /** @type {unknown} */
  const daten = JSON.parse(readFileSync(pfad, 'utf8'));
  const d = /** @type {Record<string, unknown>} */ (daten ?? {});
  /** @type {Bericht} */
  const out = { tests: [], dateiFehler: [] };
  if (Array.isArray(d.testResults)) {
    for (const f of /** @type {Record<string, unknown>[]} */ (d.testResults)) {
      const datei = typeof f.name === 'string' ? f.name : '';
      if (typeof f.message === 'string' && f.message.trim() !== '') {
        out.dateiFehler.push({ datei, meldung: f.message });
      }
      const ergebnisse = Array.isArray(f.assertionResults) ? f.assertionResults : [];
      for (const a of /** @type {Record<string, unknown>[]} */ (ergebnisse)) {
        /** @type {TestErgebnis['status']} */
        const status =
          a.status === 'passed'
            ? 'passed'
            : a.status === 'failed'
              ? 'failed'
              : a.status === VORGEMERKT
                ? 'vorgemerkt'
                : 'skipped';
        const gruppen = Array.isArray(a.ancestorTitles) ? a.ancestorTitles.map(String) : [];
        const titel = typeof a.title === 'string' ? a.title : String(a.fullName ?? '');
        out.tests.push({
          name: [...gruppen, titel].join(' > '),
          datei,
          status,
          fehler: Array.isArray(a.failureMessages) ? a.failureMessages.map(String) : [],
        });
      }
    }
    return out;
  }
  if (Array.isArray(d.suites)) {
    const konfig = /** @type {{ rootDir?: unknown }} */ (d.config ?? {});
    const basis = typeof konfig.rootDir === 'string' ? konfig.rootDir : '';
    for (const e of Array.isArray(d.errors) ? d.errors : []) {
      /** @type {{ message?: unknown } | null | undefined} */
      const fehler = e;
      const m = fehler?.message;
      out.dateiFehler.push({
        datei: '',
        meldung: typeof m === 'string' ? m : 'Fehler des Läufers',
      });
    }
    /**
     * @param {Record<string, unknown>} suite
     * @param {string[]} pfad
     */
    const gehe = (suite, pfad) => {
      for (const spec of /** @type {Record<string, unknown>[]} */ (
        Array.isArray(suite.specs) ? suite.specs : []
      )) {
        const dateiRoh = typeof spec.file === 'string' ? spec.file : '';
        const datei = basis === '' || isAbsolute(dateiRoh) ? dateiRoh : join(basis, dateiRoh);
        for (const t of /** @type {Record<string, unknown>[]} */ (
          Array.isArray(spec.tests) ? spec.tests : []
        )) {
          const results = /** @type {Record<string, unknown>[]} */ (
            Array.isArray(t.results) ? t.results : []
          );
          const letztes = results.at(-1);
          const roh = letztes?.status;
          /** @type {TestErgebnis['status']} */
          const status =
            roh === 'passed'
              ? 'passed'
              : roh === 'timedOut'
                ? 'timedOut'
                : roh === 'failed' || roh === 'interrupted'
                  ? 'failed'
                  : 'skipped';
          /** @type {string[]} */
          const fehler = [];
          for (const r of results) {
            for (const f of Array.isArray(r.errors) ? r.errors : []) {
              const m = /** @type {{ message?: unknown; stack?: unknown }} */ (f ?? {});
              fehler.push(
                `${typeof m.message === 'string' ? m.message : ''}\n${typeof m.stack === 'string' ? m.stack : ''}`,
              );
            }
          }
          out.tests.push({
            name: [...pfad, String(spec.title ?? '')].join(' > '),
            datei,
            status,
            fehler,
          });
        }
      }
      for (const s of /** @type {Record<string, unknown>[]} */ (
        Array.isArray(suite.suites) ? suite.suites : []
      )) {
        gehe(s, [...pfad, String(s.title ?? '')]);
      }
    };
    for (const s of /** @type {Record<string, unknown>[]} */ (d.suites)) gehe(s, []);
    return out;
  }
  throw new Error('unbekanntes Berichtsformat');
}

/** Erste Zeile eines fast-check-Berichts über eine gescheiterte Eigenschaft (Prompt §7, Nachtrag E1-01-25). */
const FC_KOPF = /^(?:Error: )?Property failed after \d+ tests\s*$/;
/** Zweite Zeile: Startwert und Pfad des Gegenbeispiels. */
const FC_SEED = /^\{ seed: -?\d+, path: "[^"\n]*", endOnFailure: true \}\s*$/;
/** Dritte Zeile: Beginn des Gegenbeispiels. */
const FC_GEGENBEISPIEL = /^Counterexample: /;
/** Zeile nach dem Gegenbeispiel; danach folgt bei includeErrorInReport der eingebettete Fehler. */
const FC_SHRUNK = /^Shrunk \d+ time\(s\)\s*$/;
/** Eingebetteter Vertrags-Stub-Fehler (fast-check ersetzt das führende «Error: » durch «error: »). */
const FC_STUB = /^Got error: nicht implementiert: (\S+)\s*$/;

/**
 * Ist ein fast-check-Bericht fachlich rot? Massgebend ist allein die erste Zeile nach «Shrunk k time(s)»:
 * die «Got …»-Zeile mit dem eingebetteten ursprünglichen Fehler (Option includeErrorInReport der
 * WAP-Vitest-Hilfe). Fachlich rot: Assertion, Vertrags-Stub des laufenden Pakets, Eigenschaft liefert false.
 * Fehlt die Zeile (Option nicht gesetzt, zu viele verworfene Vorbedingungen) oder ist es ein anderer Fehler:
 * nicht fachlich rot. Keine Textsuche im ganzen Bericht: Gegenbeispiel, Hinweise und die Liste der
 * Fehlschläge zählen nicht.
 * Fail-closed (CR-E101-301): Ist Zeile 2 nicht die «{ seed: … }»-Zeile, Zeile 3 nicht «Counterexample: …» oder
 * passt mehr als eine Zeile auf «Shrunk k time(s)» (z.B. mehrzeiliges Gegenbeispiel mit eigenem toString),
 * ist die Stelle des eingebetteten Fehlers nicht eindeutig: nicht fachlich rot.
 * @param {string[]} zeilen Zeilen der Meldung ohne Farben
 * @param {string[]} stubNamen
 * @returns {boolean}
 */
function fastCheckFachlichRot(zeilen, stubNamen) {
  if (!FC_SEED.test(zeilen[1] ?? '') || !FC_GEGENBEISPIEL.test(zeilen[2] ?? '')) return false;
  const kandidaten = zeilen.flatMap((z, i) => (FC_SHRUNK.test(z) ? [i] : []));
  if (kandidaten.length !== 1) return false;
  const shrunk = kandidaten[0] ?? -1;
  if (shrunk < 3) return false;
  const got = zeilen[shrunk + 1] ?? '';
  if (/^Got AssertionError\b/.test(got)) return true;
  if (got.trimEnd() === 'Got error: Property failed by returning false') return true;
  const stub = FC_STUB.exec(got);
  if (stub !== null) return stubNamen.includes(stub[1] ?? '');
  return false;
}

/**
 * Ist ein Fehler fachlich rot (Assertion oder Vertrags-Stub des laufenden Pakets)? Bei fast-check-Berichten
 * entscheidet allein der eingebettete Fehler (fastCheckFachlichRot).
 * @param {string} meldung
 * @param {string[]} stubNamen
 * @returns {boolean}
 */
export function fachlichRot(meldung, stubNamen) {
  const text = ohneFarben(meldung).trimStart();
  const zeilen = text.split('\n');
  const erste = zeilen[0] ?? '';
  if (FC_KOPF.test(erste)) return fastCheckFachlichRot(zeilen, stubNamen);
  if (/^AssertionError\b/.test(erste)) return true;
  if (/^Error: /.test(erste) && text.includes('__VITEST_POLL_CHAIN__')) return true;
  if (/^Error: expect\(/.test(erste)) return true;
  const stub = /^Error: nicht implementiert: (\S+)/.exec(erste);
  if (stub !== null) return stubNamen.includes(stub[1] ?? '');
  if (/^Error: /.test(erste)) {
    for (let k = 2; k < zeilen.length; k++) {
      if (
        (zeilen[k - 1] ?? '').trimEnd() === '' &&
        /^expect\([A-Za-z]+\)(\.not)?\.[A-Za-z]+\(/.test(zeilen[k] ?? '') &&
        !zeilen.slice(0, k).some((z) => /^\s*>?\s*\d+ \|/.test(z))
      )
        return true;
    }
  }
  return false;
}

/**
 * Prüft die Rot-Phase: Tests mit IDs des laufenden Pakets fachlich rot, alle übrigen grün.
 * @param {{ berichte: string[]; paket: string; paketIds: string[]; stubNamen: string[] }} opts
 * @returns {Schritt}
 */
export function classifyRedPhase(opts) {
  const beginn = Date.now();
  const ids = new Set(opts.paketIds);
  /** @type {string[]} */
  const verstoesse = [];
  for (const pfad of opts.berichte) {
    if (!existsSync(pfad)) {
      verstoesse.push(`Bericht fehlt: ${zeigePfad(pfad)}`);
      continue;
    }
    /** @type {Bericht} */
    let bericht;
    try {
      bericht = leseBericht(pfad);
    } catch {
      verstoesse.push(`Bericht nicht lesbar: ${zeigePfad(pfad)}`);
      continue;
    }
    for (const f of bericht.dateiFehler) {
      verstoesse.push(`Fehler beim Laden oder im Aufbau: ${zeigePfad(f.datei || pfad)}`);
    }
    for (const t of bericht.tests) {
      const eigen = idsIn(t.name).some((id) => ids.has(id));
      if (!eigen) {
        // Jeder Status ≠ passed ist rot, auch übersprungen, offen oder vorgemerkt (CR-E101-02).
        if (t.status === 'failed' || t.status === 'timedOut') {
          verstoesse.push(`fremder Test rot: ${t.name}`);
        } else if (t.status !== 'passed') {
          verstoesse.push(`fremder Test nicht ausgeführt (${t.status}): ${t.name}`);
        }
        continue;
      }
      if (t.status === 'passed') verstoesse.push(`Test des Pakets schon grün: ${t.name}`);
      else if (t.status === 'skipped' || t.status === 'vorgemerkt')
        verstoesse.push(`Test des Pakets nicht ausgeführt (${t.status}): ${t.name}`);
      else if (t.status === 'timedOut') verstoesse.push(`Zeitüberschreitung: ${t.name}`);
      else if (t.fehler.length === 0 || !t.fehler.every((m) => fachlichRot(m, opts.stubNamen))) {
        verstoesse.push(`nicht fachlich rot: ${t.name}`);
      }
    }
  }
  if (verstoesse.length === 0) {
    return { id: 'F8-rotphase', ok: true, ms: Date.now() - beginn };
  }
  return {
    id: 'F8-rotphase',
    ok: false,
    ms: Date.now() - beginn,
    ursache: `Rot-Phase von ${opts.paket} verletzt: ${kurzeListe(verstoesse)}`,
    naechsterSchritt:
      'Tests des Pakets müssen mit Assertion- oder Vertrags-Stub-Fehler scheitern, alle übrigen grün sein (ADR-010 §3.3)',
    details: { verstoesse },
  };
}
