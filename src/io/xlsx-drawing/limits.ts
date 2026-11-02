// Ressourcen- und Excel-Grenzen von readWorkbook (Vertrag E1-07, Änderungsnotiz Code-Review
// Runde 1, G1–G5). Ein Verstoss gegen G1–G3 ergibt XlsxError 'tooLarge', gegen G4/G5 'corrupt'.

export const XLSX_LIMITS = {
  /** G1: Einträge im ZIP-Zentralverzeichnis. */
  maxEntries: 10_000,
  /** G2: Formatvorlagen-Teil als Text für parseStyles (32 MiB). */
  maxStylesBytes: 33_554_432,
  /** G3: Summe aller als XML geparsten Teile (16 MiB). */
  maxXmlBytes: 16_777_216,
  /** G4/G5: grösster nullbasierter Spaltenindex in Excel (XFD). */
  maxCol: 16_383,
  /** G4/G5: grösster nullbasierter Zeilenindex in Excel (1 048 576). */
  maxRow: 1_048_575,
} as const;
