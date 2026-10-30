// Gemeinsame Typen der Schleusen-Skripte (Paket E1-01, ADR-010).
// Vertrag: docs/wap-planer/plan/vertraege/E1-01.md §2 (Typen als JSDoc, Notation dort in TypeScript).
// Nur Typdefinitionen; keine Laufzeitwerte.

/**
 * Ergebnis eines Schleusen-Schritts.
 * @typedef {object} Schritt
 * @property {string} id
 * @property {boolean} ok
 * @property {number} ms
 * @property {string} [ursache]
 * @property {string} [naechsterSchritt]
 * @property {unknown} [details]
 */

/**
 * Ergebnis eines Schleusen-Laufs.
 * @typedef {object} GateErgebnis
 * @property {'fast' | 'full'} modus
 * @property {string} zweig
 * @property {string | null} paket
 * @property {Schritt[]} schritte
 * @property {boolean} ok
 */

/**
 * Eine Zeile der Rückverfolgbarkeits-Matrix.
 * @typedef {object} TraceEintrag
 * @property {string} id
 * @property {string} paket
 * @property {string} testart
 * @property {string[]} tests
 * @property {'belegt' | 'offen' | 'verweis' | 'auftraggeber'} status
 */

/**
 * Rückverfolgbarkeits-Matrix (ADR-010 §5).
 * @typedef {object} TraceMatrix
 * @property {TraceEintrag[]} ids
 * @property {Record<string, number>} zahlen
 */

/**
 * Schwellen der Zweigabdeckung (ADR-010 §6.2).
 * @typedef {object} CoverageSchwellen
 * @property {{ name: string; muster: string[]; zweige: number }[]} mengen
 * @property {true} jeModul
 * @property {string[]} ausnahmen
 */

/**
 * Gewählter Python-Interpreter (python-check.mjs, Vertrag §2).
 * @typedef {object} PythonWahl
 * @property {'WAP_PYTHON' | 'py -3' | 'python3' | 'python'} quelle
 * @property {string} ausfuehrbar
 * @property {string} verzeichnis
 * @property {string} version
 */

/**
 * Ein geprüfter Python-Kandidat (python-check.mjs, Vertrag §2).
 * @typedef {object} PythonKandidat
 * @property {string} quelle
 * @property {string | null} version
 * @property {'fehlt' | 'exit' | 'version<3' | 'ok'} grund
 */

export {};
