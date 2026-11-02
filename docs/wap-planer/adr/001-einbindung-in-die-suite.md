# ADR-001: Einbindung in die Suite und Modulgrenzen

- **Status:** Entwurf Runde 3 (01.10.2026, nach AR0-27). **Entschieden an Gate 0 (02.10.2026):** G-1 ja (Delegation über `setRouteKeyDelegate`, verbindlicher E2E R-L-06 in E1-11), G-2 ja (Option A, Route `/wap`, Suite-Dateien gemäss `plan/etappe-1.md` §9); dazu Q-009 S-1 bis S-7 und UI-K-2 angenommen.
- **Leitplanken:** 1 (ein Datenmodell), 6 (Auslieferung, siehe ADR-007); Beschrieb 9, 11
- **Gate-0-Entscheide des Auftraggebers:** G-2 Einbindung als Route (ändert Suite-Dateien, vergrössert das gemeinsame Bundle); **G-1 Delegation der globalen Suite-Kürzel in `Shell.tsx`** (Suite-Änderung, Abschnitt «Tastatur»). Vollständige Liste der Suite-Dateien: `plan/etappe-1.md` Abschnitt 9.

## Kontext

- Die Suite ist eine React-19-App (TypeScript 7, Vite 8, TanStack Router mit Hash-History) und wird als **eine** HTML-Datei mit strikter CSP ausgeliefert (`repo-analyse.md`, `tools/build-offline.mjs`). Heute 2 549 431 Byte (`dist/index.html`, Stand 30.09.2026).
- Beschrieb 11: «In die WK Util Suite eingebunden nur dort, wo es Vorteile bringt … wo die Suite Nachteile hätte, bleibt das Tool eigenständig und voll funktionsfähig.»
- Beschrieb 9 und 9.2: Die Anbindung an Detachementsplaner und Tagesbefehle gehört zum Umfang (Etappe 4). «Innerhalb der Suite übernimmt das Tagesbefehl-Werkzeug sie ohne Dateiauswahl, sonst als Datei.»
- Die Suite speichert ihr Projekt in `localStorage` (`detplaner.v2`) und hat ein gemeinsames, flüchtiges Undo mit 30 Schritten aus ganzen Projekt-Schnappschüssen. Beschrieb 5.6 verlangt ≥ 200 Schritte, persistent.
- Gemessen (ADR-006, Spike 3): `localStorage` fasst in Edge 155 genau 5 242 879 Zeichen (≈ 10 MB UTF-16). 200 Schnappschüsse eines Plans mit 1000 Einträgen belegen 39,4 MB.

## Geprüfte Optionen

| | Option | Vorteile | Nachteile |
| --- | --- | --- | --- |
| A | **Eigene Route in der Suite mit eigenem Zustand** («Werkzeug-Insel»): Route `/wap`, eigener Store, eigene IndexedDB-Datenbank, eigenes Undo, Vollbild-Arbeitsfläche | Eine Datei für den Nutzer; Etappe 4 greift direkt auf Personen, Züge und Detachemente zu und liefert an die Tagesbefehle ohne Dateiauswahl (9.1, 9.2); gleiche Gestaltung, Werkzeuge und Schleusen | Bundle wird für alle Werkzeuge grösser (Schrift und fontkit, ADR-003/005); Änderungen an Shell, Router und Befehlspalette; Tastenkürzel müssen abgegrenzt werden |
| B | **Eigenständige zweite HTML-Datei** im selben Repo und Build (z.B. `dist/wap-planer.html`) mit geteiltem Quellcode | Eigene CSP möglich (z.B. `font-src data:`), Suite bleibt unverändert, eigene Startzeit | Zwei Dateien ausliefern und aktualisieren; 9.2 «ohne Dateiauswahl» nur über gemeinsamen Speicher-Ursprung (bei `file://` gegeben, siehe ADR-006) mit eigenem Übergabeprotokoll; zweiter Build-Pfad |
| C | **Voll in den Suite-Zustand** (`project.wap`, Suite-Undo, `localStorage`) | Kein neuer Speicher | Verletzt Beschrieb 5.6 (30 Schritte, flüchtig); `localStorage`-Grenze reicht nicht für Wiederherstellungspunkte (30 × ~0,2 MB) und Undo; koppelt WAP-Migrationen an `normalizeProject` der Suite |

## Entscheid (Empfehlung)

**Option A.** Der WAP-Planer wird eine eigene Route der Suite, bleibt aber in Zustand, Speicher, Undo und Tastatur eigenständig:

- Route `/wap` in `src/App.tsx`; Eintrag in `tools`/`titles` (`Shell.tsx`) und in der Befehlspalette; Tastenkürzel **Alt+9** (heute `^[1-8]$`).
- Die Route rendert eine eigene Vollbild-Arbeitsfläche (Suite-Navigation einklappbar), weil Raster und Seitenfeld die volle Breite brauchen (Beschrieb 5).
- Eigener Store, eigene IndexedDB-Datenbank `wap-planer` (ADR-006). **Kein** Schreiben in `detplaner.v2`; das Suite-Undo erfasst den WAP-Planer nicht, das WAP-Undo erfasst die Suite nicht.
- Tastaturbehandlung: siehe Abschnitt «Tastatur» (Delegation durch die Shell; `stopPropagation` genügt nicht).
- Etappe 4: Lesezugriff auf den Suite-Store über einen Adapter (Personen: nur Grad, Name, Vorname, Funktion; Züge; Detachemente mit Zeitraum); Lieferung an die Tagesbefehle über eine definierte Schnittstelle (eigenes ADR in Etappe 4).
- Der WAP-Code wird erst beim Betreten der Route ausgeführt (Modul-Initialisierung verzögert; Vite-Lib-Modus inlinet dynamische Importe in dasselbe IIFE, die Auswertung bleibt aber lazy). Gemessen: Auswertung von `@pdf-lib/fontkit` kostet 71 ms (CPU ×4: 338 ms); ein mit Vite 8 gebündeltes IIFE aus pdf-lib und `fontkit` 2 mit Adapter wird in 35 ms ausgewertet (CPU ×4: 148 ms) statt 71 ms (322 ms) mit Option A (Spike AR0-08, ADR-005).

### Tastatur (Entscheid G-1, Konflikt UI-K-2)

Die Shell wertet ihre globalen Kürzel auf `window` aus (`src/components/Shell.tsx` Zeilen 81–129): Ctrl+S (JSON-Sicherung) und Ctrl+B laufen noch **vor** der Prüfung auf Texteingabe und offene Dialoge, Ctrl+Z/Y lösen bei Fokus auf `body` das Suite-Undo aus. `stopPropagation` in der Route erreicht Tasten mit Fokus auf `body` nicht und käme bei `window`-Listenern ohnehin zu spät. Entscheid (Empfehlung):

- `Shell.tsx` erhält eine **Delegationsschnittstelle** `setRouteKeyDelegate(delegate | null)`. Solange eine Route einen Delegaten gesetzt hat, fragt `onKey` **zuerst** `delegate.handles(event)`; ist das wahr, ruft die Shell `delegate.handle(event)` auf und führt ihre eigene Aktion nicht aus.
- Auf `/wap` übernimmt der WAP-Planer Ctrl+S (Plan-Datei), Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z (WAP-Historie) und «?» (WAP-Kürzel); Ctrl+B wird während einer WAP-Textbearbeitung nicht ausgewertet. Ctrl+K und Alt+1–9 bleiben Suite-Kürzel. Beim Verlassen der Route wird der Delegat entfernt.
- Die Suite-Kürzel anderer Routen bleiben unverändert (Regressionstest der Suite).
- **Verbindlicher E2E-Test** (Paket E1-11, Anforderung **R-L-06**, Quelle Prompt §5.6 und dieses ADR; `plan/katalog-ergaenzung-e1.md`): Auf `/wap` lösen Suite-Undo, Suite-Redo und die Suite-JSON-Sicherung **nie** aus – mit Fokus auf `body`, im Raster, in einem Textfeld und bei offenem Dialog; kein Download der Suite-JSON, Suite-Projekt unverändert (Hash).

Option B bleibt Rückfallebene, falls der Auftraggeber die CSP-Frage (ADR-004) mit «nur `font-src data:`, aber nicht für die ganze Suite» entscheidet.

### Modulgrenzen (Vorschlag, verbindlich ab Etappenplan 1)

Nach den Konventionen des Repos (nach Schicht, Unterordner je Werkzeug, vgl. `src/model/tagesbefehl`, `src/io/tagesbefehl`, `src/components/tagesbefehl`):

| Ordner | Inhalt | Darf importieren |
| --- | --- | --- |
| `src/model/wap/` ohne `layout/`, `checks/` | Datenmodell (inkl. `Rgb` in `types.ts`), Befehle/Patches, Beso-Nummerierung, Zeitformen (ADR-002) | nur `src/model/wap/` ohne `layout/` und `checks/`; `immer`; nichts aus UI, IO oder DOM |
| `src/model/wap/layout/` | Layout-Schicht: Breiten, Positionen, Umbruch, Kollisionen, Aussparungen (ADR-004); `FontWeight` in `layout/text/types.ts` | `src/model/wap/` ohne `checks/`, `hyphen`, generierte Metrik-Tabelle; kein DOM |
| `src/assets/wap-fonts/` | Schriftdateien und Zugriff auf die Bytes | nur `import type` aus `src/model/wap/layout/text/types.ts` |
| `src/model/wap/checks/` | Prüfregeln (Beschrieb 7) | `src/model/wap/`; aus `layout/` nur Typen (`import type`) und `layoutWeekPage` als übergebene Funktion |
| `src/io/wap-plan/` | IndexedDB, Plan-Datei, Migration (ADR-006) | `src/model/wap/` |
| `src/io/wap-pdf/` | PDF-Zeichner (ADR-005) | `src/model/wap/**`, pdf-lib, fontkit, `src/assets/wap-fonts/` |
| `src/io/wap-import/` | Excel-Assemblierung und Bericht (ADR-008) | gemeinsame untere XLSX-Module, `src/model/wap/` |
| `src/components/wap/`, `src/pages/WapPage.tsx` | Oberfläche, zeichnet nur das Layout-Ergebnis | alle obigen |

Abhängigkeiten zeigen nur nach unten; `module-boundaries.mjs` in der Schleuse (ADR-010 §4.4, gleiche Tabelle) sichert die Richtung, auch für `import type`. Bezeichner folgen `glossar.md`, sobald vorhanden.

## Folgen

- Änderungen an Suite-Dateien → Gate-0-Freigabe (Prompt §5.6). Vollständige Liste in `plan/etappe-1.md` Abschnitt 9: `App.tsx`, `Shell.tsx` (Route, Alt+9, Kopfleiste, Seitenleiste, Delegation G-1, «?»/`ShortcutSheet`), `CommandPalette.tsx`, `Icon.tsx`, `tools/build-offline.mjs` (Lizenzeinträge, ADR-003; Release-Dateiname mit Version, ADR-007 G-8), `src/io/wap/*` (ADR-008).
- Bundle-Zuwachs für alle Werkzeuge: Schrift ≈ 0,85 MB (Base64 zweier TTF), fontkit 0,37–0,99 MB minifiziert, WAP-Code. Gegenmassnahmen: lazy Auswertung, `fontkit` 2 statt `@pdf-lib/fontkit` (ADR-005), optional Schrift-Teilmenge beim Build (ADR-003).
- Die Leistungsbudgets (Beschrieb 11) werden in der Suite gemessen, inklusive Startzeit der Suite (keine Regression anderer Werkzeuge).
- Der WAP-Planer bleibt ohne Detachementsplaner-Daten voll nutzbar (Beschrieb 9).

## Beleg

- Repo-Analyse: `docs/wap-planer/repo-analyse.md`; Routen `src/App.tsx` (Zeilen 45–60), Werkzeuge `src/components/Shell.tsx` (Zeile 32 ff., Alt-Kürzel Zeile 111).
- `localStorage`-Grenze und Undo-Volumen: Spike 3, siehe ADR-006.
- Verzögerte Auswertung im einzelnen IIFE (Vite 8/Rolldown), Probe des `code-reviewer` (`.qa/etappe0/review-architektur/lazy/`): `{"heavyEvaluatedBeforeImport":0,"heavyEvaluatedAfterImport":1}` – ein Chunk, das Modul wird erst beim `import()` ausgewertet.
- Tastatur: `src/components/Shell.tsx` Zeilen 81–129 (Listener auf `window`, Ctrl+S vor der Texteingabe-Prüfung).
- Auswertungskosten fontkit: `spikes/font-layout/dist/evalcost.mjs` → `{"rate":1,"evalMs":{"fk.min.js":71,"pl.min.js":21}}`, `{"rate":4,"evalMs":{"fk.min.js":338,"pl.min.js":69}}` (Edge 155.0.4283.24, headless).
