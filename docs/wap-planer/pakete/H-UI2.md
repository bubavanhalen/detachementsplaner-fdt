# H-UI2 – Paketzweig `wap/h-ui2` (Härtungsrunde 2 Oberfläche, Befunde ux-critic und spec-auditor; AE-006)

- Etappe: 1 (Härtungsrunde vor Gate B).
- Anforderungen:
- Bezug: Befunde UX-H-03, -06, -08, -09, -10, -14 und Niedrig aus dem ux-critic-Bericht Runde 1 sowie SA-H-06, -07, -08, -09, -11, -19 bis -22 aus dem spec-auditor-Bericht Runde 1 (14.10.2026, Stand 59ffa1d; Berichte nur lokal unter `.qa/haertung/`). Nicht in diesem Paket (Entscheid Auftraggeber offen): TE-I5-01/UX-H-07/SA-H-05, SA-H-13, Stand und Undo, Woche löschen, CR-H-U-02/-03, Wochenziele-Import. Die Tests tragen nur IDs bereits eingefrorener Pakete; keine Neuzuordnung im Etappenplan.
- Grundlage: AE-006 §3; UI-Richtlinie 2.2, 5.1, 9, 10, 11.1–11.6, 13; Beschrieb 4.7, 5.6, 6; R-4.6-67, R-5.6-18, R-6-39, R-L-07, R-L-09. Zweig ab `wap-codex` edefd5c, Worktree `C:\Users\phili\source\repos\wap-wt\h-ui2`.

| Befund | Stand | Umsetzung |
| --- | --- | --- |
| UX-H-03 | behoben | Kopf- und Werkzeugleiste als einzeilige Leisten mit Überlauf (`OverflowBar`): Fehlt der Platz, weichen Knöpfe nach Priorität aus – in der Kopfleiste ins **Planmenü** (immer alle Plan-Befehle, UI-Richtlinie 2.2), in der Werkzeugleiste ins Menü **«Mehr …»**. Befehle der Auswahl (Bearbeiten, Löschen, Kategorie, Auch an anderen Tagen) in der Statuszeile (Werkzeugleiste springt nicht). Kompakte Knöpfe mit unverändertem Namen (sichtbarer Text ist Teil des Namens, WCAG 2.5.3), z.B. «Datei sichern» für «Plan-Datei sichern», ↶/↷, ⌨, ⋯. Gemessen per ResizeObserver, nie beim Ziehen. Leisten zusammen 90 px bei 1366 × 768 und 1600 × 900. |
| UX-H-06 | behoben | Anker der Tagesauswahl: Shift+←/→ und Shift-Klick bilden den Bereich vom Anker; ohne Auswahl ist der fokussierte Tag der Anker. |
| UX-H-08 | behoben | Befehlspalette des WAP-Planers (Ctrl+K, `WapPalette`) in eigenständigen Einstiegen und der Einzeldatei mit den Befehlen von Kopf-, Werkzeugleiste und Raster; in der Suite liefert die Route dieselben Befehle an die Suite-Palette (Gruppe «WAP-Planer», `setRouteCommands` in CommandPalette.tsx, App.tsx). Speicheranzeige als Knopf «Speicheranzeige: letzte Datei-Sicherung …» öffnet Wiederherstellungspunkte mit Dauerhaftigkeit und Belegung; Warnpunkt «Speicher nicht dauerhaft» im Namen. |
| UX-H-09 | behoben | Z/T/S öffnen bei Beso, Rapport, Marker und Querbalken das Seitenfeld beim Feld Zeit, Tag bzw. Spalten; nach «Zeitfenster hinzufügen» Fokus im neuen Zeitfeld. |
| UX-H-10 | behoben | Importbericht angedockt im Seitenbereich (UI-Richtlinie 2.2; nicht modal, verdeckt den Eintrag nie, Esc schliesst). «Zur Stelle» mit Maus oder Leertaste: Bericht bleibt offen, Fokus bleibt in der Liste (auch nach Wochenwechsel), Eintrag gewählt und ins Bild gerollt, Meldung «angesehen»; Enter springt mit Fokus (eingefrorener I4-Test); wieder geöffnet Fokus auf der nächsten Meldung. |
| UX-H-14 | Test-Einwand | TE-HUI2-01: Vorlage ohne Standard-Kategorie der Spalten (eingefrorener R-4.9-19-Test) und Rückfall V-03-1 (eingefroren); nicht geändert. |
| SA-H-06, SA-H-19 | behoben | `useDialogGuard`: Esc auf Dokumentebene abgefangen, `cancel` abgewiesen, ein vom Browser trotzdem geschlossener Sperrdialog öffnet sofort wieder (I2Dialog nicht schliessbar, BlockingProgress, Import); Esc vor dem Schreiben genau einmal «Abbrechen»; gewöhnliche Dialoge melden ein Schliessen durch den Browser. |
| SA-H-07 | behoben | Terminbereich als Tab-Stopp nach der tatsächlichen Höhe im DOM (scrollHeight), gemessen bei Änderung von Inhalt, Höhe, Zoom; axe ohne Verstoss bei 50–300 %. Mit H-UI bereits nach Layout-Höhe; Test rot auf 59ffa1d. |
| SA-H-08 | behoben | Meldung und Tooltip «Plan-Datei sichern»: «enthält interne Notizen – nur zur eigenen Sicherung, nicht weitergeben», wenn Einträge oder Tage Notizen haben. |
| SA-H-09 | behoben | `command()`: Nach dem ersten Stand setzt jede inhaltliche Änderung eines Beso `changed` (neu angelegte, Blöcke und der Stand-Befehl nicht); Marke 7 px oben links und Beschreibung «geändert seit letztem Stand», Liste «geändert»; Rückgängig nimmt sie mit, der nächste Stand setzt zurück. |
| SA-H-11 | behoben | Unter file://: Erststart-Knopf «Hinweis zum gemeinsamen Speicher …» (Tab-Stopp nach den drei Karten), Palettenbefehl «Hinweis zum gemeinsamen Speicher», Abschnitt mit «Details»; öffnet die Übersicht beim Abschnitt, Fokus auf der Überschrift. |
| SA-H-20 | behoben | Fokus ins Titelfeld der neuen Teilaufgabe. |
| SA-H-21 | behoben | `--text-3` der Suite-Seitenleiste nur auf /wap = `--text-2` (hell und dunkel ≥ 4,5:1); eine h1, ein Knopf «Tastenkürzel». |
| SA-H-22 | behoben | Ctrl+Plus/Minus/0 im Raster, Ctrl+Mausrad über dem Papier um den Zeiger (Abweichung UI-Richtlinie 4.1 auf Auftrag, nur im Raster). |
| Niedrig | teilweise | Kürzelübersicht ergänzt; «0800-1200» im Feld Beginn; leerer Titel mit Meldung; letzte Woche pro Plan und Gerät; «Nur lesen» mit nächstem Schritt; «gestrichen»/«geändert» als Beschreibung. Offen: P1-Meldung nach Tageswechsel, Querbalken-Name nach Verlängern, Guillemets im Plannamen, «Leitung Kp» (Legendentext der Vorlage). |

**Tests.** Vitest `tests/wap/unit/h-ui2/` (Überlauf, Dialogschutz, «geändert», «Nur lesen»); Playwright `tests/wap-e2e/h-ui2/` im Entwicklungsserver und in der Einzeldatei (Leisten, Palette, Suite, Sperrdialoge, Tastatur, Anzeige, Niedrig; Importbericht nur Entwicklungsserver) mit Harness `tests/wap-e2e/harness/h-ui2.*` (Suite mit Befehlen der Route) und `h-ui2-sperre.*`. Je Befund vor der Korrektur rot (gegen edefd5c; SA-H-07 gegen 59ffa1d). Nur fiktive Daten.

**Datenschutz.** privacy-scan `--commits edefd5c..HEAD`: 70 Dateien ohne Befund; `--baum HEAD`: 959 Dateien ohne Befund.

**Offen.** TE-HUI2-01 (UX-H-14; Auslegungsfrage beim Auftraggeber). TE-HUI2-02 entschieden: H-TESTS-Test R-8.2-21 nach `korrektur.patch` des frischen test-reviewers korrigiert und nachgeführt. UI-Richtlinie 4.1 (Ctrl+Plus/Minus) und 2.2 (Statuszeile mit Befehlen der Auswahl, Planmenü als Knopf «Planmenü» neben der Planwahl) nachführen.

- [x] 6 Neue Tests eingefroren per lock-update mit Grund «H-UI2» (30 Dateien); Testpfade additiv registriert (f1616ae).
- [x] 7 Umsetzung je Befund: zuerst ein roter Test, dann die Korrektur (Commits f1616ae, 7fed037, 6936fce; rot belegt gegen edefd5c bzw. 59ffa1d).
