// V7 Leistungsvergleich (R-H-22, ADR-010 §8).
// Vertrag: docs/wap-planer/plan/vertraege/E1-01c.md §2.3: Schema, feste Budgets, Drosselung und
// Regression gegenüber der Baseline. Sperre und Läufer liegen bei e2e.mjs; kein eigener CLI-Befehl.

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import {
  ANFORDERUNG,
  NAME,
  pruefeBudget,
  pruefeBudgets,
} from '../../tests/wap-perf/support/budgets.mjs';
import { rot } from './lib/out.mjs';

/** @type {'Netz' | 'Akku' | 'unbekannt' | undefined} */
let strom;
function stromStatus() {
  if (strom !== undefined) return strom;
  try {
    const s = spawnSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        'Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SystemInformation]::PowerStatus.PowerLineStatus.ToString()',
      ],
      { encoding: 'utf8', windowsHide: true, timeout: 10_000 },
    );
    strom =
      s.stdout?.trim() === 'Online'
        ? 'Netz'
        : s.stdout?.trim() === 'Offline'
          ? 'Akku'
          : 'unbekannt';
  } catch {
    strom = 'unbekannt';
  }
  return strom;
}
/** @param {string} datei */
function json(datei) {
  try {
    return JSON.parse(readFileSync(datei, 'utf8'));
  } catch {
    throw new Error(`Datei fehlt oder ungültig: ${datei}`);
  }
}
/** @param {unknown} v */
function objekt(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Vergleicht Messungen mit Budgets und perf-baseline.json; drosselung.json mit faktor null oder
 * status «offen» → rot «Drosselungsfaktor nicht festgelegt (Umgebungsprobe ausstehend)».
 * @param {{ messungen: string | null; baseline: string; drosselung: string; budgets: string; regel: 'prozent10' | 'prozent10oder2ms' }} opts
 * @returns {import('./lib/types.mjs').Schritt}
 */
export function comparePerf(opts) {
  const beginn = Date.now();
  const id = 'V7-vergleich';
  try {
    let d;
    try {
      d = json(opts.drosselung);
    } catch {
      d = {};
    }
    if (
      d.status !== 'festgelegt' ||
      typeof d.faktor !== 'number' ||
      !Number.isFinite(d.faktor) ||
      d.faktor < 1
    )
      throw new Error('Drosselungsfaktor nicht festgelegt (Umgebungsprobe ausstehend)');
    const budgets = pruefeBudgets(json(opts.budgets));
    const b = json(opts.baseline);
    if (b.version !== 1 || !objekt(b.messwerte))
      throw new Error(`Baseline ungültig: ${opts.baseline}`);
    if (Number(b.protokoll?.drosselung) !== d.faktor)
      throw new Error('Baseline mit anderem Drosselungsfaktor gemessen');
    const m = opts.messungen === null ? { messwerte: {} } : json(opts.messungen);
    if (!objekt(m.messwerte)) throw new Error(`Messungen ungültig: ${opts.messungen}`);
    /** @type {string[]} */
    const ohneBaseline = [],
      verbesserungen = [],
      fehler = [];
    for (const [name, v] of Object.entries(m.messwerte)) {
      if (
        !NAME.test(name) ||
        !objekt(v) ||
        !ANFORDERUNG.test(v.anforderung ?? '') ||
        typeof v.medianMs !== 'number' ||
        !Number.isFinite(v.medianMs) ||
        v.medianMs < 0 ||
        typeof v.budgetMs !== 'number' ||
        !Number.isFinite(v.budgetMs) ||
        v.budgetMs <= 0
      )
        throw new Error(`Leistungseintrag ungültig: ${name}`);
      pruefeBudget(budgets, name, v.anforderung, v.budgetMs);
      if (v.medianMs > v.budgetMs) fehler.push(`Budget überschritten: ${name}`);
      const basis = b.messwerte[name];
      if (basis === undefined) {
        ohneBaseline.push(name);
        continue;
      }
      if (!objekt(basis) || basis.anforderung !== v.anforderung || basis.budgetMs !== v.budgetMs)
        throw new Error(`Budget weicht von der Baseline ab: ${name}`);
      if (
        typeof basis.medianMs !== 'number' ||
        !Number.isFinite(basis.medianMs) ||
        basis.medianMs < 0
      )
        throw new Error(`Baseline ungültig: ${opts.baseline}`);
      if (
        v.medianMs * 10 > basis.medianMs * 11 &&
        !(
          opts.regel === 'prozent10oder2ms' &&
          basis.medianMs < 20 &&
          v.medianMs <= basis.medianMs + 2
        )
      )
        fehler.push(`Leistungsregression: ${name}`);
      if (v.medianMs < basis.medianMs) verbesserungen.push(name);
    }
    for (const name of Object.keys(b.messwerte))
      if (!(name in m.messwerte)) fehler.push(`Messgrösse fehlt: ${name}`);
    const details = {
      faktor: d.faktor,
      messgroessen: Object.keys(m.messwerte).length,
      ohneBaseline,
      verbesserungen,
      strom: stromStatus(),
    };
    if (fehler.length > 0)
      return {
        id,
        ok: false,
        ms: Date.now() - beginn,
        ursache: fehler.slice(0, 20).join('; '),
        naechsterSchritt: 'Messungen und Baseline prüfen',
        details,
      };
    return { id, ok: true, ms: Date.now() - beginn, details };
  } catch (e) {
    return {
      id,
      ok: false,
      ms: Date.now() - beginn,
      ursache: e instanceof Error ? e.message : 'Leistungsvergleich gescheitert',
      naechsterSchritt: 'Eingabedateien und Messprotokoll prüfen',
    };
  }
}

// CLI: Aufruf als Skript (Vertrag §2 «als Modul und als CLI nutzbar»).
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  rot('V7-vergleich', 'kein eigener Befehl: npm run wap:test:perf', 'npm run wap:test:perf');
  process.exitCode = 1;
}
