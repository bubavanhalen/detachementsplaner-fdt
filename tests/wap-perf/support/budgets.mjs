/** Gemeinsame Budgetprüfung für Browser-Harness, Messdatei und Vergleich. */
export const NAME = /^[A-Za-z][A-Za-z0-9]*$/;
export const ANFORDERUNG = /^R-[0-9A-Z.]+-\d{2}$/;

/** @param {unknown} roh */
export function pruefeBudgets(roh) {
  const fail = (/** @type {string} */ regel) => {
    throw new Error(`budgets.json ungültig: ${regel}`);
  };
  if (typeof roh !== 'object' || roh === null) return fail('Objekt fehlt');
  const b = /** @type {{ version?: unknown; budgets?: unknown }} */ (roh);
  if (b.version !== 1) return fail('version muss 1 sein');
  if (!Array.isArray(b.budgets) || b.budgets.length === 0)
    return fail('budgets muss ein nicht leeres Array sein');
  /** @type {{ anforderung: string; budgetMs: number; endung?: string }[]} */
  const liste = [];
  for (const e of b.budgets) {
    if (
      typeof e !== 'object' ||
      e === null ||
      typeof e.anforderung !== 'string' ||
      !ANFORDERUNG.test(e.anforderung)
    )
      return fail('anforderung');
    if (typeof e.budgetMs !== 'number' || !Number.isFinite(e.budgetMs) || e.budgetMs <= 0)
      return fail('budgetMs');
    if ('endung' in e && (typeof e.endung !== 'string' || e.endung.length === 0))
      return fail('endung');
    if (
      liste.some(
        (v) =>
          v.anforderung === e.anforderung &&
          (v.endung === undefined || e.endung === undefined || v.endung === e.endung),
      )
    )
      return fail('Anforderung oder Endung doppelt');
    liste.push(e);
  }
  return liste;
}

/**
 * @param {ReturnType<typeof pruefeBudgets>} budgets
 * @param {string} name
 * @param {string} anforderung
 * @param {number} budgetMs
 */
export function pruefeBudget(budgets, name, anforderung, budgetMs) {
  const passt = budgets.filter(
    (b) => b.anforderung === anforderung && (b.endung === undefined || name.endsWith(b.endung)),
  );
  if (passt.length !== 1 || passt[0]?.budgetMs !== budgetMs)
    throw new Error(`Budget nicht nach ADR-010 §8: ${name}`);
}
