# H-UI – Paketzweig `wap/h-ui` (Härtungsrunde, Befunde Code-Review Oberfläche und ux-critic; AE-006)

- Etappe: 1 (Härtungsrunde vor Gate B).
- Anforderungen:
- Bezug: Befunde CR-H-U-01, -04 bis -10 aus dem unabhängigen Code-Review Layout/PDF/UI, Runde 1 (14.10.2026, Stand 59ffa1d), und mit Vorrang UX-H-01, UX-H-02 sowie UX-H-05, UX-H-15 aus dem ux-critic-Bericht Runde 1 (Berichte nur lokal unter `.qa/haertung/`). CR-H-U-02 und -03 warten auf den Entscheid des Auftraggebers. Die Tests tragen nur IDs bereits eingefrorener Pakete; keine Neuzuordnung im Etappenplan.
- Grundlage: AE-006 §3 (Härtungsrunde); UI-Richtlinie §2.1, §5, §6, §18 S-1 bis S-3; ADR-001 «Tastatur»; ADR-004 Punkt 4. Zweig ab `wap-codex` 59ffa1d, Worktree `C:\Users\phili\source\repos\wap-wt\h-ui`.

| Befund | Stand | Umsetzung |
| --- | --- | --- |
| CR-H-U-01 | behoben | Tageslayout löst Verweise «(Nr)» in Titeln gegen den ganzen Plan auf; aufgelöste Nummern in Schnellweg und Schlüssel des Zwischenspeichers. |
| CR-H-U-04 | behoben | `layoutAgendaScreen` (Layout-Schicht, Regeln der Wochenseite: Einheiten, hängender Einzug, gemeinsame Grösse bis Mindestgrösse) und `screenAgenda`; Terminzeilen als vorberechnete Zeilen (WAP Arimo, `white-space: pre`), Zoom skaliert; Höhe = Textfläche der Termine der Wochenseite, Einpassen löst Raster und Termine gemeinsam. |
| CR-H-U-05 | behoben | Zeichen ohne Glyphe: Direktbearbeitung bleibt bei Klick ausserhalb, Tab und «Neuer Block» offen, Feld rot, Fokus im Feld. |
| CR-H-U-06 | behoben | Beso-Titel (Direktbearbeitung, Terminbereich) mit Fett-Maske. |
| CR-H-U-07, -08 | behoben | S-1 Alt+9, Werkzeug, Palette, Kürzelübersicht; S-2 keine Suite-Topbar auf /wap (Darstellung in der Kopfleiste der Route), Seitenleiste als Vorgabe eingeklappt; S-3 `setRouteKeyDelegate` (Shell) und Delegat der Route über App.tsx/WapPage; Ctrl+B in WAP-Textfeldern nie. E2E in der ganzen Suite (Harness `h-ui`). |
| CR-H-U-09 | behoben | Meldung «Neuer Plan» mit Ursache und nächstem Schritt. |
| CR-H-U-10 | behoben | Ctrl beim Loslassen legt eine Kopie ab, Zeitschild «Kopie», ein Undo-Schritt. |
| UX-H-01 | behoben | Seitenfeld übernimmt bei Tab (auch zum Knopf «Fett»), Fokusverlust und Auswahlwechsel; Felder je Eintrag; ungültige Eingabe beim Wechsel sichtbar gemeldet. |
| UX-H-02 | behoben | Touch: Wischen rollt, Tippen wählt, Ändern erst nach Langdruck; Maus und Stift unverändert. |
| UX-H-05 | behoben | P1-Eintrag lässt sich in eine andere Spalte ziehen (gezeichnete relative Lage als Ausgang). |
| UX-H-15 | behoben | Meldung «… gelöscht · Rückgängig» verschwindet nach der nächsten Änderung. |
| UX-H-13 | behoben | Entscheid Orchestrator 14.10.2026: im frisch mit E geöffneten Titel sind Buchstaben Text; Feldsprung im Seitenfeld mit Tab bzw. Alt+Z/T/S/K/L/O; Kürzelübersicht nennt es. |

**Tests.** Vitest `tests/wap/unit/h-ui/` (Verweise, Terminbereich, Shell, Delegat, Meldung «Neuer Plan»); Playwright `tests/wap-e2e/h-ui/` im Entwicklungsserver und in der Einzeldatei (Suite-Einbindung, Editor, Seitenfeld, Touch, Terminbereich, Meldung, P1) mit Harness `tests/wap-e2e/harness/h-ui.*` (ganze Suite). Je Befund zuerst rot, dann die Korrektur. Nur fiktive Daten.

**Leistung.** R-5.1-14 (Nachbau der Messroutine A3, Einzeldatei i2b dieses Zweigs, Edge, CPU ×2, 10 Läufe): Realistisch Median 6,3 ms (max 6,7), Belastungstest Median 11,5 ms (max 12,3), 10/10 ≤ 16,7 ms; eingefrorener Test in der vollen E2E grün.

**Offen.** CR-H-U-02/-03 (Entscheid Auftraggeber). Folgerunde: UX-H-03 (Kopf-/Werkzeugleiste: Menü «Mehr …» bzw. Planmenü; berührt eingefrorene Tests, die die Knöpfe direkt bedienen). Der Terminbereich zeigt Sa und So getrennt, die Wochenseite fasst sie zusammen (Rahmenfrage CR-H-U-02).

- [x] 6 Neue Tests eingefroren per lock-update mit Grund «H-UI» (28 Dateien, dazu 3 Dateien UX-H-13); Testpfade additiv registriert (5e91c9a).
- [x] 7 Umsetzung je Befund: zuerst ein roter Test, dann die Korrektur (Commits fc8a929 bis 14bb106).
