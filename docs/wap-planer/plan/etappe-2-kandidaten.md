# Etappe 2 – Kandidaten aus Gate B Etappe 1

Stand 28.10.2026 · Quelle: Gate B Etappe 1, Entscheid des Auftraggebers vom 28.10.2026 «All as recommended for gate-b» (`gates/gate-B.md`, Freigabeprotokoll `PROGRESS.md`). Diese Liste ist kein Etappenplan: Aufnahme und Schnitt entscheidet der Auftraggeber an Gate A der Etappe 2 (Prompt §5.3 Punkt 1). Erstellt durch GB-DOKU (spec-analyst). Befund-IDs nach `FINDINGS.md`; Nacharbeitsbericht lokal `.qa/e1-ab/sa34-final.md`.

## Entscheid 41 a – Kandidaten aus der Nacharbeit 14.1

| Kandidat | Befunde | Bezug |
| --- | --- | --- |
| Listenansicht: Spalten Zusatz, Tn, Tpt, Tenue, Notiz | UX-AB-06, UX-AB-F-03 | Beschrieb 6 Listenansicht; R-6-13 bis R-6-16 |
| Befehl «Bemerkung und Beso zusammenführen» | UX-AB-08 | Beschrieb 5.3, 8.2 |
| Import-Dialog (Wahl der Blätter, Vorschau, Bericht) | UX-AB-09, UX-AB-F-08 | Beschrieb 8.2 |
| Gruppierung «Kästchen > 15 Min» und Kantengruppen mit Block und Zeit im Importbericht | UX-AB-12, UX-AB-F-10 | Beschrieb 8.2 Regeln 3, 4; R-8.2-09, R-8.2-11 |
| Rapport in Rap- und Planungsspalte melden | UX-AB-F-06 | Beschrieb 8.2 Regel 6 |
| Spalten-Zelle der Liste wählbar | UX-AB-F-07 | Beschrieb 6 |

## Entscheid 43 a – übrige nicht blockierende Befunde

| Kandidat | Befund | Bezug |
| --- | --- | --- |
| Dauer des flachen Markers im Seitenfeld einstellbar | F-LAYOUT2-A3 | R-4.6-15 |
| `PageOptions.statusRendering` aus dem Typ entfernen | F-LAYOUT2-A4 | R-10-31 |
| Senkrechte Textrichtung aus dem Excel übernehmen | R1-13 | B-Kp-54; Beschrieb 8.2 |
| Unterschriftblock und Wappen nach Import aus Stammdaten | R1-16 (mit FW-02) | B-Kp-81/82; Beschrieb 9 |
| P1-Marke ohne Meldung nach Tageswechsel; Querbalken-Name nach Verlängern | UX-H-N2 (Rest) | Beschrieb 7, 5.1 |
| CSS-Lokatoren in E2E durch Rolle und Name ersetzen | TR-H-14 | Prompt §5.2 Schritt 2 |
| Render-Kette «bildschirm» automatisch prüfen | FT-G-03 | Prompt §7 Regression |
| Leistungsmessung im E2E lastfest | FL-05 | R-5.1-14, R-11-11 |
| Wochenseite nicht je Planänderung neu legen (7 ms) | CR-3-05 | Beschrieb 11 |

## Fachentscheid 29.10.2026 – Kanten nahe der 15-Min-Linie

| Kandidat | Grundlage | Bezug |
| --- | --- | --- |
| Import: Kanten 2–4 Min neben der 15-Min-Linie optional auf die Linie ziehen (heute Regel 4: 5-Min-Rundung + Bericht); gilt für Blockanfang und Blockende | Freigabeprotokoll 29.10.2026 «Kanten nahe der 15-Min-Linie» und Ergänzung «Blockanfänge» (Antwort «yess») | Beschrieb 8.2 Regel 4; Nacharbeit 14.1 (Nacharbeits-Export und Anhang A Etappe 1 unverändert) |

## Folgen weiterer Entscheide für Etappe 2

| Entscheid | Folge |
| --- | --- |
| 1 a (mit Entscheid 26.10.2026 «Volles Gate entfällt für Etappe 1») | Volles Gate mit Selbsttest V1a und Mutation V8 ab Etappe 2 (Prompt §5.3 Punkt 2, §6). |
| 31 a | Prüfnaht für das Format (FD-01), danach R-5.6-18 und R-L-10 als E2E nach Katalog. |
| 37 a | Standardtreue Zerlegung im Datenschutz-Scan (parse5, MIT) als neue Abhängigkeit vorlegen (CR-E101-P08). |
| 39 a | erledigt: alle Bedeutungen in der Vorlage Kp (ARK, BR 0–3 GB-DOKU Runde 2; KR «Kompanierapport» GB-DOKU2, Antwort 29.10.2026). |
| 9 a, 10 a | Excel-Ausgangsmessung Kp Wo 1 (R-15-07, Massstab 14.6) bis Gate A Etappe 2; Nachlauf der Umgebungsprobe (S-6) – liefert der Auftraggeber. |

## Nicht Etappe 2 (zur Abgrenzung)

- **Vor dem Merge nach `wap-planer` (nächste Iteration):** Entscheid 42 a – UX-AB-F-01 (Fokus springt in der Liste bei Einträgen anderer Wochen, Eingabe geht ohne Rückmeldung verloren), UX-AB-F-02 (widersprüchliche nächste Schritte im Importbericht), UX-AB-F-04 («Spalten …» schliesst nicht mit Esc); Entscheid 35 a – Abdeckung list, panel, settings, wap-persons (Schwelle 75 % bleibt); Entscheide 12–15 (GB-IMPORT), 17, 18 (GB-LAYOUT), 7 b und 34 c (F-TOOLS).
- **Etappe 4:** Q-029 (Ressourcenschutz im Tagesbefehl, Entscheid 40 a).
- **Funktionswünsche:** FW-01 bis FW-04 nach `funktionswuensche.md` und Freigabeprotokoll 28.10.2026 (Reihenfolge: Etappe 1 abschliessen → WK Suite als eine Anwendung → Fremd-WAP).
