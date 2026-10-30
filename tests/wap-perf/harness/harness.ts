// Leistungs-Harness (Paket E1-01c, R-H-22, PL0-13). Eintragsdateien entries/<paket>.ts besitzt das
// jeweilige Paket. Vertrag: docs/wap-planer/plan/vertraege/E1-01c.md §2 «Leistung» (Grundlage E1-01 §4).
// Register mit Budgetprüfung; reproduzierbare Vorbereitung und Browser-Messung je Eintrag.

import budgets from '../../../docs/wap-planer/perf/budgets.json';
import { ANFORDERUNG, NAME, pruefeBudget, pruefeBudgets } from '../support/budgets.mjs';

const eintraege = new Map<string, PerfEntry>();

export interface PerfEntry {
  readonly name: string;
  readonly anforderung: string;
  readonly budgetMs: number;
  prepare(seed: number): Promise<unknown>;
  run(prepared: unknown): Promise<void>;
}

/** Registriert die Messeinträge eines Pakets; wirft bei doppeltem oder ungültigem Eintrag. */
export function registerPerfEntries(entries: readonly PerfEntry[]): void {
  const tabelle = pruefeBudgets(budgets);
  for (const e of entries) {
    if (
      !e ||
      typeof e.name !== 'string' ||
      !NAME.test(e.name) ||
      typeof e.anforderung !== 'string' ||
      !ANFORDERUNG.test(e.anforderung) ||
      !Number.isFinite(e.budgetMs) ||
      e.budgetMs <= 0 ||
      typeof e.prepare !== 'function' ||
      typeof e.run !== 'function'
    )
      throw new Error(`Leistungseintrag ungültig: ${e?.name}`);
    pruefeBudget(tabelle, e.name, e.anforderung, e.budgetMs);
    if (eintraege.has(e.name)) throw new Error(`Leistungseintrag doppelt: ${e.name}`);
    eintraege.set(e.name, e);
  }
}

/** Alle registrierten Einträge (ohne Funktionen), sortiert nach name. */
export function registrierteEintraege(): {
  name: string;
  anforderung: string;
  budgetMs: number;
}[] {
  return [...eintraege.values()]
    .map(({ name, anforderung, budgetMs }) => ({ name, anforderung, budgetMs }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** prepare(seed), dann Dauer von run(prepared) in ms (performance.now); unbekannter Name → Fehler. */
export async function messeEintrag(name: string, seed: number): Promise<number> {
  const e = eintraege.get(name);
  if (!e) throw new Error(`Leistungseintrag unbekannt: ${name}`);
  const vorbereitet = await e.prepare(seed);
  const beginn = performance.now();
  await e.run(vorbereitet);
  return performance.now() - beginn;
}
