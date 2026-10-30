# Satz-Zuordnung – Nachführung nach Gate 0

`trace-beschrieb.md` ist der unverändert übernommene Bericht der Katalogprüfung Runde 1 (`spec-auditor`) und bleibt in diesem Stand (Prompt §4.1; Befund SA0-27). Diese Datei führt die Satz-Zuordnung auf den Katalog nach Gate 0 (02.10.2026, Runde 6c, 572 IDs) nach. Massgebend ist die Kombination beider Dateien.

Grundlage: Nachführung `spec-analyst` Runde 6 und 6b (`.qa/etappe0/spec-analyst-gate0-nachfuehrung.md`, `.qa/etappe0/spec-analyst-runde-6b.md`); unabhängige Prüfung `spec-auditor` nach Gate 0 (`.qa/etappe0/spec-auditor-gate0-nachpruefung.md`, Abschnitt 4).

## Ergebnis

- **667 von 667** Sätzen, Tabellenzeilen und Beispielen des Beschriebs sind einer Anforderungs-ID zugeordnet oder begründet als «Kontext, nicht prüfbar» markiert (Prüfskript `spec-auditor` nach Gate 0: 320 Einheiten, alle genannten R-IDs im Katalog vorhanden, keine Einheit ohne ID oder Kontext-Markierung).
- Die vier in Runde 1 offenen Aussagen sind im Katalog belegt (Zeilen unten).
- Katalog: **572 IDs** (Etappe 1: 431 = 396 Beschrieb + 25 R-H + 10 R-L).

## Nachgeführte Zuordnungen

| Einheit | Stelle | Inhalt (Kurzform) | Anforderungs-IDs nach Gate 0 | Grund |
| --- | --- | --- | --- | --- |
| S-1-03 | 1 Tab. Textüberlauf | Bemerkungen überlagern Legende | R-14.3-01, R-14.3-02, R-10-42, R-14.5-03 (Wochen mit Box im Excel) | Q-011 N-05 |
| S-1-04 | 1 Tab. Kästchen | Beso 52/53 übereinander | R-4.6-51 bis -53, R-14.5-01 (Excel-Stand massgebend) | Q-011 N-09 |
| S-2-04 | 2 Stufe/Vorlage | Vorlage legt Spalten, Legende, Kopf, Darstellung fest | R-3-01, R-4.9-01 bis -17, R-4.9-19, R-8.1-01 | SA0-06 erledigt (Kp-Spalten) |
| S-2-10 | 2 Querbalken | ganze Tage ohne Uhrzeit, Band | R-4.6-04, R-4.5-07, R-4.6-06, R-4.6-62 (Band = 0400–0500) | B-F-06 |
| S-2-12 | 2 Rapport | Kürzelliste, Zeitpunkt/Dauer, kein Termintext | R-4.6-16, R-4.6-19, R-5.3-14, R-4.9-18 | SA0-06 erledigt (Liste) |
| S-4.5-03 | 4.5 | Band für Querbalken | R-4.5-07, R-4.6-62 (Folgefragen F-63 / Q-013) | B-F-06 |
| S-4.6-02 | 4.6 Tab. Querbalken | von–bis, Band, Stapel, zentriert, Schriftfarbe, Wochengrenze | R-4.6-04 bis -10, R-4.6-62 (Stapel höchstens zwei) | B-F-06 |
| S-5.1-10 | 5.1 | Mehrfachauswahl und gemeinsame Aktionen | R-5.1-20 (Rahmen mit Shift+Ziehen), R-5.1-21 | Q-009 K-1 |
| S-6-07 | 6 Tab. E1 | Interne Notizen nie PDF, nie Weitergabe | R-6-07, R-6-08, R-6-09 (Weitergabe, Etappe 3), R-6-39, R-6-40 (Export der Listenansicht, Etappe 1) | SA0-02, SA0-22 |
| S-6-13 | 6 Tab. E2 | Tastatur | R-6-23 bis -27 (R-6-27 mit Ctrl+Pfeile Etappe 1) | Q-009 UI-F-3 |
| S-8.2-02 | 8.2 | Zweck: Bat-Grundlage, eigene Kp-WAP inkl. Vorjahre | R-8.2-01, R-8.2-03, R-8.2-36 | SA0-07 erledigt (Vorjahre) |
| S-8.2-06 | 8.2 R4 | Kanten 5 Min, > 2 Min Bericht | R-8.2-10, R-8.2-11 (gruppiert, einzeln ab > 4 Min; freigegebene Abweichung) | Q-006 b |
| S-14-01 | 14 Einleitung | Soll-Listen, unabhängig, bestätigt, Excel massgebend | R-14-01 bis R-14-05 | SA0-03 erledigt (C unabhängig) |
| S-14-06 | 14.5 | Importbericht Kp nennt Referenzfälle | R-14.5-01 bis -09 (R-14.5-01 bis -03 angepasst) | Q-011 N-05/N-09 |

## Offene Frage aus Runde 1

- Q-006 ist an Gate 0 mit b entschieden; R-8.2-11 ist als freigegebene Abweichung nachgeführt.

## Anforderungen ohne Beschrieb-Grundlage

- R-H-01 bis R-H-34 (Quelle Prompt; R-H-34 zusätzlich Gate-0-Entscheid 11 b).
- R-L-01 bis R-L-10 (Quelle Prompt §3 Leitplanken; R-L-09 zusätzlich Gate-0-Entscheid 2 a = G-9 a; R-L-10 ADR-006 Punkt 2c).
- R-5.1-24 (Erweiterung von Beschrieb 5.1 durch Q-009 UI-F-8, an Gate 0 angenommen).
- R-5.6-18 (Erweiterung von Beschrieb 5.6 durch Q-009 UI-F-10 und ADR-006 Punkt 2c, an Gate 0 angenommen); R-11-07 erweitert um UI-F-7.
- Unverändert aus Runde 1: Anforderungen, die sich zusätzlich auf den Prompt stützen (R-4.1-11 §8, R-6-16 §7, R-10-36 §3, R-14-01 und R-14-03).
