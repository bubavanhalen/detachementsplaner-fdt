// Verbindliche Meldungstexte von Paket E1-05, wörtlich aus dem Vertrag (docs/wap-planer/plan/vertraege/E1-05.md,
// Notiz «Ausarbeitung Schritt 2» Abschnitt F). Die Tests vergleichen `userMessage` mit diesen Texten, nicht mit den
// Konstanten des Produktcodes, damit eine Änderung der Texte im Code auffällt.

export const MELDUNG = {
  renderFailed: {
    cause:
      'Das PDF für den Stand konnte nicht erzeugt werden. Kein Stand gesetzt; der Plan ist unverändert.',
    nextStep:
      'Die Befunde prüfen und den Stand erneut setzen. Bleibt der Fehler, den WAP-Planer neu laden.',
  },
  aborted: {
    cause: 'Das Setzen des Stands wurde abgebrochen. Kein Stand gesetzt; der Plan ist unverändert.',
    nextStep: 'Den Stand bei Bedarf erneut setzen.',
  },
  variantNotStored: {
    cause: 'Für diesen Stand ist kein PDF dieser Woche gespeichert.',
    nextStep:
      'Eine Woche wählen, die es beim Setzen des Stands gab, oder die Arbeitsfassung exportieren.',
  },
  planNotFound: {
    cause: 'Der Plan ist im Speicher nicht vorhanden.',
    nextStep: 'Den Plan aus einer Plan-Datei öffnen oder einen neuen Plan erstellen.',
  },
  standNotFound: {
    cause: 'Der gewählte Stand ist nicht mehr vorhanden.',
    nextStep: 'Einen anderen Stand wählen oder die Arbeitsfassung exportieren.',
  },
} as const;

export type StandFehlerCode = keyof typeof MELDUNG;
