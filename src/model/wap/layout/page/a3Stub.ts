// Stub-Fehler der A3-Ausgabe bis E1-10 (Vertrag E1-02e, Notiz «Ausarbeitung Schritt 2» Abschnitt B
// «Fehlerverhalten» Nr 4, N). Intern: nicht über page/index.ts exportiert; gemeinsam für a3() und layoutWeekPage.

/** Fehler «nicht implementiert: layout.page.a3» (Stub-Name nach N). */
export function a3Unavailable(): Error {
  return new Error('nicht implementiert: layout.page.a3');
}
