// Testname mit Anforderungs-ID (Paket E1-01, Prompt §5.2 Schritt 3, ADR-010 §5).
// Vertrag: docs/wap-planer/plan/vertraege/E1-01.md §4.

/** Form einer Anforderungs-ID des Katalogs, z.B. R-4.6-03, R-H-10, R-L-01, R-14-01. */
const ID = /^R-[A-Z0-9]+(?:\.[0-9]+)*-[0-9]+$/;

/**
 * Prüft, dass ein Testname mindestens eine Anforderungs-ID trägt; wirft sonst beim Laden.
 * Ergebnis: "[R-4.6-03] <name>" bzw. "[R-4.6-03][R-4.6-04] <name>".
 */
export function req(ids: string | string[], name: string): string {
  const liste = typeof ids === 'string' ? [ids] : ids;
  if (liste.length === 0) {
    throw new Error(`Testname ohne Anforderungs-ID: «${name}». IDs aus requirements.md angeben.`);
  }
  const ungueltig = liste.filter((id) => !ID.test(id));
  if (ungueltig.length > 0) {
    throw new Error(
      `Ungültige Anforderungs-ID ${ungueltig.map((id) => `«${id}»`).join(', ')} im Testnamen «${name}». ` +
        'Form R-<Abschnitt>-<Nummer> aus requirements.md verwenden.',
    );
  }
  return `${liste.map((id) => `[${id}]`).join('')} ${name}`;
}
