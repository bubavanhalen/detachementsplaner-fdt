// Verbindliche Meldungstexte von Paket E1-04, wörtlich aus dem Vertrag und den Stubs (docs/wap-planer/plan/vertraege/
// E1-04.md, Notiz «Ausarbeitung Schritt 2» Abschnitt G; Änderungsnotizen E1-05 J1, R2 V12). Die Tests vergleichen
// `userMessage` mit diesen Texten, nicht mit den Konstanten des Produktcodes, damit eine Änderung der Texte im Code
// auffällt.

export const SPEICHER_MELDUNG = {
  unavailable: {
    cause:
      'Der lokale Speicher des Browsers ist nicht verfügbar; Änderungen können nicht gespeichert werden.',
    nextStep:
      'Seite neu laden (F5). Hilft das nicht: den WAP-Planer in Microsoft Edge öffnen und die Plan-Datei sichern.',
  },
  blocked: {
    cause:
      'Der WAP-Planer ist in einem anderen Tab mit einer älteren Version geöffnet; die Umstellung des Speichers wartet.',
    nextStep: 'Die anderen Tabs mit dem WAP-Planer schliessen und diese Seite neu laden (F5).',
  },
  newerSchema: {
    cause:
      'Die Pläne auf diesem Gerät wurden mit einer neueren Version des WAP-Planers gespeichert.',
    nextStep: 'Die neueste Version des WAP-Planers öffnen.',
  },
  migrationPending: {
    cause: 'Die Pläne müssen zuerst ins neue Format umgestellt werden.',
    nextStep:
      'Im Dialog «Sicherung vor dem Update» die Plan-Dateien sichern oder ohne Sicherung fortfahren.',
  },
  quotaExceeded: {
    cause: 'Der lokale Speicher ist voll; die Änderung ist nicht gespeichert.',
    nextStep: 'Jetzt die Plan-Datei sichern, danach alte Wiederherstellungspunkte löschen.',
  },
  planNotFound: {
    cause: 'Der Plan ist im Speicher nicht vorhanden.',
    nextStep: 'Den Plan aus einer Plan-Datei öffnen oder einen neuen Plan erstellen.',
  },
  planExists: {
    cause: 'Auf diesem Gerät gibt es bereits einen Plan mit dieser Kennung.',
    nextStep:
      'Die Plan-Datei über «Plan-Datei öffnen» laden und «Behalten», «Ersetzen» oder «Als Kopie öffnen» wählen.',
  },
  restorePointNotFound: {
    cause: 'Der Wiederherstellungspunkt ist nicht mehr vorhanden.',
    nextStep: 'Einen anderen Wiederherstellungspunkt wählen.',
  },
} as const;

/** «Update gescheitert» mit dem Anzeigenamen des Plans. */
export function migrationFailedMeldung(planName: string): {
  readonly cause: string;
  readonly nextStep: string;
} {
  return {
    cause: `Die Pläne wurden nicht ins neue Format umgestellt. Die Umstellung brach bei «${planName}» ab; alle Pläne sind unverändert im bisherigen Format.`,
    nextStep:
      'Seite neu laden (F5). Hilft das nicht: mit der vorherigen Version des WAP-Planers weiterarbeiten und die gesicherte Plan-Datei öffnen.',
  };
}

export const KONFLIKT = {
  import: {
    cause:
      'Der Plan wurde während des Imports geändert. Nichts importiert; die Änderung ist gespeichert.',
    nextStep: 'Import erneut starten.',
  },
  stand: {
    cause:
      'Der Plan wurde während des Stand-Setzens geändert. Kein Stand gesetzt; die Änderung ist gespeichert.',
    nextStep: 'Stand erneut setzen.',
  },
  change: {
    cause:
      'Der Plan wurde inzwischen an anderer Stelle geändert, z.B. in einem anderen Tab. Diese Änderung ist nicht gespeichert.',
    nextStep: 'Seite neu laden (F5) und die Änderung wiederholen.',
  },
} as const;

export const DATEI_MELDUNG = {
  invalidJson: {
    cause: 'Die Datei ist keine lesbare Plan-Datei (kein gültiges JSON). Nichts wurde geändert.',
    nextStep: 'Eine mit «Datei sichern» erstellte Plan-Datei wählen.',
  },
  notPlanFile: {
    cause: 'Die Datei ist keine Plan-Datei des WAP-Planers. Nichts wurde geändert.',
    nextStep: 'Eine mit «Datei sichern» erstellte Plan-Datei wählen.',
  },
  corrupt: {
    cause: 'Die Plan-Datei ist beschädigt oder unvollständig. Nichts wurde geändert.',
    nextStep: 'Eine frühere Sicherung der Plan-Datei öffnen.',
  },
  notSerializable: {
    cause:
      'Der Plan kann nicht als Plan-Datei gesichert werden, weil er eine ungültige Angabe enthält. Der Plan im Speicher ist unverändert.',
    nextStep:
      'Die letzte Änderung rückgängig machen (Ctrl+Z) und erneut sichern. Hilft das nicht: den Plan über «Wiederherstellungspunkte» auf einen früheren Stand zurücksetzen.',
  },
} as const;

/** «Neuere Plan-Datei» mit Version der Datei `v` und lesbarer Version `max` (G2). */
export function neuereVersionMeldung(
  v: number,
  max: number,
): { readonly cause: string; readonly nextStep: string } {
  return {
    cause: `Die Plan-Datei stammt aus einer neueren Version des WAP-Planers (Format ${String(v)}); diese Version liest höchstens Format ${String(max)}. Nichts wurde geändert.`,
    nextStep: 'Den WAP-Planer aktualisieren und die Plan-Datei danach erneut öffnen.',
  };
}
