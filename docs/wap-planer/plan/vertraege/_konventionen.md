# Vertragskonventionen (gelten für alle Verträge der Etappe 1)

Stand: Entwurf Runde 2, 01.10.2026 (`architect`, Prompt §5.2 Schritt 2). Grundlage: `glossar.md` (Bezeichner und Oberflächentexte), ADR-001 (Modulgrenzen), ADR-002 (Datenmodell), ADR-010 (Rot-Klassifikation).

## 1 Stubs

- Jede Funktion eines Vertrags erhält in Prompt §5.2 Schritt 2 einen Stub, dessen Rumpf `throw new Error('nicht implementiert: <Stub-Name>')` ist. Der **Stub-Name** steht im Abschnitt «Stub-Namen» des Paketvertrags (Form `<bereich>.<modul>.<funktion>`, z.B. `model.calendar.weekDates`). Nur diese Namen gelten in der Rot-Phase als fachlich rot (ADR-010 3.3, Entscheid E5).
- Konstanten und Typen sind im Stub vollständig (keine Stubs für Typen). Konstanten mit Fachwerten (z.B. Vorlagen-Daten) sind Teil der Umsetzung, nicht des Stubs; der Stub exportiert sie über eine Funktion (`kpTemplate()`), damit er werfen kann.
- Komponenten-Stubs rendern die vertraglichen Rollen, Namen und sichtbaren Texte ohne Verhalten; Ereignisse lösen nichts aus.
- Stubs schreiben nie in die Konsole und machen nie Netzanfragen.

## 2 Grundtypen (definiert in E1-02a, `src/model/wap/types.ts`)

- `Id` = `string` (stabil, nie Name). Erzeugt nur aus dem Zähler `Plan.nextId` im Dokument (ADR-002 Punkt 8b), nie mit Zufall im Modell; neue Plan-IDs (neuer Plan, «als Kopie öffnen») und Stand-IDs erzeugt `src/io/` mit `crypto.randomUUID()`. `nextId` ist monoton über «Wiederherstellen» und «Ersetzen» (Maximum aus aktuellem Wert und Schnappschuss, AR0-31); ein Undo stellt den vorherigen Wert exakt her (unschädlich, weil ein neuer Befehl den Redo-Zweig verwirft, AR0-41). `HistoryStep.seq` wird nie wiederverwendet.
- `IsoDate` = `'yyyy-mm-dd'`. Anzeige immer `dd.mm.yyyy` (kompakte Tagesköpfe `dd.mm.yy`, Dateinamen `yyyy-mm-dd`; Beschrieb 10 «Daten»).
- `MilTime` = Minuten seit 0000, ganzzahlig, Vielfaches von 5 (Beschrieb 4.5); Anzeige `hhmm`, Zeitraum `hhmm-hhmm` (Beschrieb 11).
- Masse im Layout in **pt**, Ursprung **oben links**, y nach unten. Der PDF-Schreiber rechnet in PDF-Koordinaten um.
- Farben `Rgb = { r, g, b }` mit Ganzzahlen 0–255 in `src/model/wap/types.ts`; `FontWeight = 'regular' | 'bold'` in `src/model/wap/layout/text/types.ts` (E1-02b). Beide liegen im Modell, nicht in `src/assets` (Modulgrenze, AR0-11).
- Vorlagen werden als Parameter übergeben (`templates: ReadonlyMap<string, LevelTemplate>`), nie global registriert (AR0-18).

## 3 Fehlerverhalten

```ts
// src/model/wap/errors.ts (E1-02a)
export interface UserMessage {
  /** Ursache in Deutsch (Schweiz), ein bis zwei Sätze. */
  readonly cause: string;
  /** Nächster Schritt für den Nutzer (Beschrieb 5.7). */
  readonly nextStep: string;
}

/** Basisklasse aller erwarteten Fehler des WAP-Planers. */
export class WapError extends Error {
  readonly code: string;          // stabil, camelCase, für Tests und Meldungskatalog
  readonly userMessage: UserMessage;
  constructor(code: string, userMessage: UserMessage, options?: { cause?: unknown });
}
```

- **Reine Funktionen** (Modell, Layout) werfen `WapError`-Unterklassen nur bei ungültiger Eingabe des Aufrufers (z.B. Startdatum kein Montag). Fachliche Zustände (Befunde, Überlauf, Rückfallregel) sind **Rückgabewerte**, nie Ausnahmen.
- Jeder `code` hat einen Eintrag im Meldungskatalog (E1-11) mit Ursache und nächstem Schritt; kein Fehler bricht still ab (R-5.7-03, R-5.7-04).
- Unerwartete Fehler (Programmfehler) werden nicht abgefangen und umgedeutet; die Oberfläche zeigt eine allgemeine Meldung mit dem Code `unexpected` (E1-11).
- Meldungen enthalten keine Personendaten ausser den vom Nutzer erfassten Texten des Plans und nie Inhalte aus `reference/`.

## 4 Determinismus und Umgebung

- Modell und Layout: keine Uhr, kein Zufall, kein DOM (Leitplanke 2, R-L-02). Zeit kommt als `Clock` (E1-04) nur in `src/io/**` und in der Oberfläche vor.
- Zeichenreihenfolge im Seitenmodell = Reihenfolge der `items` (spätere liegen oben, R-4.6-54, R-4.6-59).

## 5 Oberfläche

- Rollen und Namen folgen WAI-ARIA; Tests greifen über Rolle und Name zu (Prompt §5.2 Schritt 2). Sichtbare Texte gemäss Spalte «Oberfläche» in `glossar.md`, verbotene Synonyme nie (R-2-01).
- Die Oberflächenverträge (E1-11 bis E1-17) sind auf `ui-richtlinie.md` (Stand 01.10.2026, Commit 8723afe) ausgerichtet. Ändert sich die Richtlinie oder fallen die Gate-0-Punkte Q-009 (S-1 bis S-7, K-1 bis K-5, F-1 bis F-10) anders aus, gilt die Richtlinie in ihrer entschiedenen Fassung, und der `architect` passt den Vertrag in Schritt 2 des Pakets an (vor dem Test-Freeze). Stand 02.10.2026: Q-009 ist an Gate 0 vollständig nach Vorschlag entschieden (UI-F-1 zusätzlich Sichtprüfung an Gate S).
- `data-testid` nur, wo Rolle und Name nicht reichen (z.B. Zeichenfläche für Ziehen mit Koordinaten); jede Verwendung steht im Vertrag.
- Tastenkürzel wirken nur innerhalb der WAP-Route. Globale Suite-Kürzel (Ctrl+S, Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z, Ctrl+B während Textbearbeitung, «?») übernimmt die Route über die **Delegation der Shell** `setRouteKeyDelegate` (ADR-001 Abschnitt «Tastatur», Gate-0-Entscheid G-1); `stopPropagation` genügt nicht. Verbindlicher E2E (E1-11): Suite-Undo, Suite-Redo und Suite-JSON-Sicherung lösen auf `/wap` nie aus.
