# Satz-Zuordnung Beschrieb ↔ Anforderungskatalog (Etappe 0, Prompt §5.1 Schritt 7)

Prüfer: `spec-auditor` · Stand 30.09.2026 · Grundlagen: `PROJEKTBESCHRIEB_WAP_Planer.md` V2, `requirements.md` (524 IDs), `QUESTIONS.md` (Q-001: Bat V3 statt V2)

> Vom Orchestrator unverändert aus der Schlussmeldung des `spec-auditor` übernommen (Runde 1). Befunde SA0-01 bis SA0-21 sind in `FINDINGS.md` übertragen.

## Ergebnis

**Freigabe: nein.** Es gibt keinen blockierenden Befund, aber 3 Befunde der Stufe hoch (SA0-01 bis SA0-03). Nach deren Behebung ist eine Freigabe möglich.

- **Vorgehen.** Teil 1 lief blind, ohne `requirements.md`. Das Zwischenergebnis liegt in `C:\Users\phili\source\repos\detachementsplaner-fdt\.qa\etappe0\trace-blind.md` und entstand, bevor ich den Katalog geöffnet habe. Teil 2 ist der Abgleich.
- **Einheiten:** 336 insgesamt, davon 297 prüfbar und 39 Kontext.
- **Aussagen:** 667. Gezählt habe ich per Skript die Teilaussagen a), b) … und dazu von Hand die zusammengefassten Zeilen (Prüfregeln, 13, 14) aufgelöst.
- **Abdeckung:**
  - Einheiten: 297 von 297 prüfbaren Einheiten haben mindestens eine ID (100 %).
  - Aussagen: 663 von 667 sind zugeordnet (99,4 %).
  - Ohne ID bleiben: Unabhängigkeit von Anhang C (SA0-03), Vorjahres-Import (SA0-07), Spalten der Kp-Vorlage und Vorbelegung der Rapportkürzelliste (SA0-06).
- **Q-001 ist überall angewendet:** R-8-01, R-8.2-03, R-11-17, R-14-02, R-14.8-01 bis -05, R-14.9-01 und R-14.16-01 nennen V3. «KVK Mo alter Nr 13» ist bedingt formuliert (R-14.8-05). Dazu kein Befund.
- **Zählung im Katalog stimmt:** 524 Zeilen `| R-…`. Nach Etappen: 0: 10 · 1: 383 · 2: 56 · 3: 53 · 4: 22. Keine doppelte ID.
- **Q-006 ist noch offen** und betrifft R-8.2-11 (Etappe 1). Die Anforderung folgt derzeit dem Wortlaut; nach dem Entscheid ist sie nachzuführen.
- `git status` im Worktree ist sauber. Geschrieben habe ich nur in `.qa/etappe0/`.

## Satz-Zuordnung

| Einheit | Stelle | Kurzinhalt | Anforderungs-IDs / Kontext |
| --- | --- | --- | --- |
| S-0-01 | Kopf | Stand, Version, Autor | Kontext: Metadaten |
| S-0-02 | Kopf | Hinweis Pseudonymisierung Repo-Kopie | Kontext: Hinweis zur Kopie |
| S-1-01 | 1 Satz 1 | Tool statt Excel: schnell, geprüft, PDF im Layout | R-7-01, R-1-02, R-1-01 |
| S-1-02 | 1 «Heute» | Excel mit frei platzierten Formen | Kontext: Ist-Zustand |
| S-1-03 | 1 Tab. Textüberlauf | Bemerkungen überlagern Legende | R-14.3-01, R-14.3-02, R-10-42, R-14.5-03 |
| S-1-04 | 1 Tab. Kästchen | Beso 52/53 übereinander | R-4.6-51 bis -53, R-14.5-01 |
| S-1-05 | 1 Tab. Raster | Zeit im Text ≠ Lage der Form | R-7-06, R-8.2-08 |
| S-1-06 | 1 Tab. Kopfdaten | Spalten, Sa/So, KW, Sonnenzeiten von Hand | R-4.3-01, R-6-05, R-4.8-10, R-4.8-11, R-15-08 |
| S-1-07 | 1 Tab. Beso/Text | Nummer ohne Text fällt spät auf | R-5.3-01 |
| S-1-08 | 1 Tab. Schrift | rund 3 pt | R-10-38, R-1-02 |
| S-1-09 | 1 Tab. Datum | US-Format | R-10-44 |
| S-1-10 | 1 Tab. Weiterverwendung | Tagesbefehle aus Formen herauslesen | R-9.2-01 |
| S-1-11 | 1 | Überschrift Erfolgskriterien | Kontext: Überschrift |
| S-1-12 | 1 EK1 | halbe Excel-Zeit | R-1-01 (→ R-14.6-01) |
| S-1-13 | 1 EK2 | PDF wie Referenz, besser lesbar | R-1-02 |
| S-1-14 | 1 EK3 | kein unbemerkter Regelverstoss im PDF | R-1-03, R-7-04, R-7-05 (SA0-01) |
| S-1-15 | 1 EK4 | Bat-Termine und Tagesbefehle ohne Abtippen | R-1-04, R-1-05 |
| S-1-16 | 1 EK5 | kein Datenverlust; Wechsel per Plan-Datei | R-1-06, R-5.5-07 |
| S-2-01 | 2 Einleitung | Begriffe gelten auch in Oberfläche | R-2-01 |
| S-2-02 | 2 Plan | alle Wochen eines Dienstes | R-4.1-16 |
| S-2-03 | 2 WAP | Woche = eine PDF-Seite | R-10-02 |
| S-2-04 | 2 Stufe/Vorlage | Vorlage legt Spalten, Legende, Kopf, Darstellung fest | R-3-01, R-4.9-01 bis -17, R-8.1-01 (Kp-Spalten: SA0-06) |
| S-2-05 | 2 Spalte | Definition senkrechte Bahn | Kontext: Begriffsdefinition (R-2-01) |
| S-2-06 | 2 Nebenspalte | optional, schmal, vor Rap; Det/Stab 2 | R-4.4-05, R-2-02, R-4.4-13, R-4.9-13, R-4.9-14 |
| S-2-07 | 2 Rap-Spalte | nur Rapporte | R-4.4-06 |
| S-2-08 | 2 Beso-Spalte | zwei Bahnen, nur Beso | R-4.4-07 |
| S-2-09 | 2 Block | Zeit, Spalten, Farbe nach Kategorie | R-4.6-01, R-4.7-02 |
| S-2-10 | 2 Querbalken | ganze Tage ohne Uhrzeit, Band oberhalb 0500 | R-4.6-04, R-4.5-07, R-4.6-06 |
| S-2-11 | 2 Marker | AV, ABV, HV | R-4.6-11 |
| S-2-12 | 2 Rapport | Kürzelliste, Zeitpunkt/Dauer, kein Termintext | R-4.6-16, R-4.6-19, R-5.3-14 (Liste: SA0-06) |
| S-2-13 | 2 Beso | Text, Nummer, Kästchen | R-5.3-01, R-4.6-25, R-4.6-27 |
| S-2-14 | 2 Termine | unter Raster; Bat «Termindetails» | R-10-06, R-4.9-11, R-4.9-12, R-4.6-30 |
| S-2-15 | 2 Leitungskategorie | Farbe gemäss Legende | R-4.7-01, R-4.7-04 |
| S-2-16 | 2 Ltg | Text: Funktion oder Person | R-4.1-10, R-4.6-02 |
| S-2-17 | 2 Tn/Tpt | Abkürzungen | Kontext: Begriffsdefinition |
| S-2-18 | 2 Stand | planweit, im Kopf | R-4.1-15, R-10-12 |
| S-2-19 | 2 Beilage | Kopfzeile unter Titel | R-10-09 |
| S-3-01 | 3 Satz 1 | eine Person pro Plan | Kontext: Nutzungsannahme (Abgrenzung 12) |
| S-3-02 | 3 Bearbeiter | keine gleichzeitige Bearbeitung, keine Rechte | Kontext: Negativumfang |
| S-3-03 | 3 Empfänger | PDF; Bat-WAP als Excel oder Plan-Datei | R-8-01, R-5.5-01 |
| S-3-04 | 3 Stufen | gleiche Bedienung, Unterschiede nur in Vorlage | R-3-01 |
| S-3-05 | 3 Nicht 61/4 | Einheit, Spalten, Legende usw. frei einstellbar | R-3-02 |
| S-3-06 | 3 Zusammenspiel | Kp-WAP baut auf Bat-WAP auf | Kontext: Verweis auf 8 |
| S-3-07 | 3 Arbeitsumgebung | Maus/Tastatur; Tablet lesen | R-11-07, R-11-10 |
| S-4-01 | 4 Einleitung | Daten statt Bild; PDF daraus gezeichnet | R-4-01 |
| S-4.1-01 | 4.1 | Stufe, Einheit, übergeordnete Einheit | R-4.1-01, R-4.1-02 |
| S-4.1-02 | 4.1 | Dienst, Übungsname, Beilage | R-4.1-03 |
| S-4.1-03 | 4.1 | Klassifizierung optional | R-4.1-04, R-15-01 |
| S-4.1-04 | 4.1 | Standort für Sonnenzeiten | R-4.1-05 |
| S-4.1-05 | 4.1 | Kommandant, Reihenfolge, Unterschrift als Bild | R-4.1-06, R-4.1-07, R-4.1-08 |
| S-4.1-06 | 4.1 | Personenliste: Felder, Auswahl, Datei, Detachementsplaner | R-4.1-09, R-4.1-10, R-4.1-11, R-4.1-12, R-8.2-30 |
| S-4.1-07 | 4.1 | Wappen, Motto | R-4.1-13 |
| S-4.1-08 | 4.1 | Bemerkungen für ganzen Plan | R-4.1-14 |
| S-4.1-09 | 4.1 | Stand-Datum, Version planweit | R-4.1-15 |
| S-4.1-10 | 4.1 | Liste der Wochen | R-4.1-16 |
| S-4.2-01 | 4.2 | Bezeichnung, Kurzname | R-4.2-01 |
| S-4.2-02 | 4.2 | Startdatum Montag; Daten, KW automatisch | R-4.2-02, R-4.2-03 |
| S-4.2-03 | 4.2 | Wochenziele; Bat nach Gruppen | R-4.2-04, R-4.2-05 |
| S-4.2-04 | 4.2 | Erhöhte Bereitschaft optional | R-4.2-06 (SA0-11) |
| S-4.2-05 | 4.2 | «Bemerkungen:» | Kontext: Einleitung der Aufzählung |
| S-4.2-06 | 4.2 | Kp «gelten durchgehend», ausblendbar, ergänzbar | R-4.2-07, R-4.2-08, R-4.2-09 |
| S-4.2-07 | 4.2 | Bat mehrtägig, Nummer, Zeitraum, Verweis-Kästchen | R-4.2-10, R-4.2-11, R-4.6-31 (SA0-04) |
| S-4.2-08 | 4.2 | Abkürzungen und Legende | Kontext: Verweis 4.7 |
| S-4.2-09 | 4.2 | Sonnenauf- und -untergang | Kontext: Verweis 4.8 |
| S-4.3-01 | 4.3 | eigener Spaltensatz je Tag | R-4.3-01 |
| S-4.3-02 | 4.3 | voll / kompakt / ausgeblendet | R-4.3-02, R-4.3-03, R-4.3-04 |
| S-4.3-03 | 4.3 | Tagesbefehl-Angaben beim Tag, nicht gedruckt | R-4.3-05, R-9.2-07 |
| S-4.4-01 | 4.4 Tab. | Planungsspalte: Name, Gewicht, Richtung, Kategorie, Herkunft | R-4.4-01, R-4.4-02, R-4.4-03, R-4.4-04 |
| S-4.4-02 | 4.4 Tab. | Nebenspalte optional, schmale Blöcke | R-4.4-05 |
| S-4.4-03 | 4.4 Tab. | Rap-Spalte nur Rapporte | R-4.4-06 |
| S-4.4-04 | 4.4 Tab. | Beso-Spalte zwei Bahnen, schmal «Bes» | R-4.4-07, R-4.4-08 (SA0-08) |
| S-4.4-05 | 4.4 | Spaltensätze als Vorlagen je Tag | R-4.4-09 |
| S-4.4-06 | 4.4 | Breiten voll gleich, kompakt ⅓, ausgeblendet gibt ab | R-4.4-10, R-4.4-11, R-4.4-12 |
| S-4.4-07 | 4.4 | Gewichte; Terminspalten unter Tag | R-4.4-13, R-4.4-14 |
| S-4.5-01 | 4.5 | Anzeigebereich 0400–2400, Beschriftung 0500–2300 | R-4.5-01, R-4.5-02, R-4.5-03 |
| S-4.5-02 | 4.5 | Linien Stunde, Halbstunde, keine Viertel | R-4.5-04, R-4.5-05, R-4.5-06 |
| S-4.5-03 | 4.5 | Band oberhalb 0500 für Querbalken | R-4.5-07 |
| S-4.5-04 | 4.5 | Einrasten 15 Min, Eingabe 5 Min | R-4.5-08, R-4.5-09, R-15-02 |
| S-4.5-05 | 4.5 | über Mitternacht fortgesetzt, gekennzeichnet | R-4.5-10, R-7-29 |
| S-4.6-01 | 4.6 Tab. Block | Pflicht-/Zusatzangaben, Rechteck | R-4.6-01, R-4.6-02, R-4.6-03 |
| S-4.6-02 | 4.6 Tab. Querbalken | von–bis, Band, Stapel, zentriert, Schriftfarbe, Wochengrenze | R-4.6-04 bis -10 |
| S-4.6-03 | 4.6 Tab. Marker | Art, Linie, Beschriftung, Zeit bei ABV, flacher Block | R-4.6-11 bis -15 (SA0-13) |
| S-4.6-04 | 4.6 Tab. Rapport | Kürzel, Zeit, Höhe, fett, senkrecht, Anzeige, Marker | R-4.6-16 bis -24 |
| S-4.6-05 | 4.6 Tab. Beso | Titel, Zeitfenster, Nummer, Terminzeile/Freitext | R-4.6-25 bis -28 |
| S-4.6-06 | 4.6 Tab. Ganztägig | Tag, Text; nur Terminbereich | R-4.6-29, R-4.6-30 |
| S-4.6-07 | 4.6 Tab. Mehrtägig | Text, Zeitraum, Nummer; Seitenleiste | R-4.6-31 |
| S-4.6-08 | 4.6 Status | bestätigt/offen/gestrichen, «geändert» | R-4.6-32, R-4.6-33, R-4.6-34 |
| S-4.6-09 | 4.6 Zeitformen | fünf Formen, Frist, erfasste Form, Sortierzeit | R-4.6-35 bis -40 |
| S-4.6-10 | 4.6 Beso im Detail | Zeitfenster mit Spalte/Zusatz, gleiche Nummer | R-4.6-41 bis -44 |
| S-4.6-11 | 4.6 Beso im Detail | «bis X» endet, «ab X» beginnt | R-4.6-45, R-4.6-46 |
| S-4.6-12 | 4.6 Beispiel | «13 Vorrevisionen» drei Kästchen | R-4.6-47, R-4.8-08 |
| S-4.6-13 | 4.6 Beso im Detail | Kategorie bestimmt Füllfarbe | R-4.6-48 |
| S-4.6-14 | 4.6 Beso im Detail | Höhe Dauer (Bat) / 30 Min (Kp) | R-4.6-49, R-4.6-50 |
| S-4.6-15 | 4.6 Beso im Detail | wahre Zeit, zweite Bahn, Teilung | R-4.6-51, R-4.6-52, R-4.6-53 (SA0-09) |
| S-4.6-16 | 4.6 Beso im Detail | Kästchen über Blöcken, teilen Breite | R-4.6-54, R-4.6-55 (SA0-18) |
| S-4.6-17 | 4.6 Überdeckung | Ausnahme, Aussparung, Text im grössten Teilstück | R-4.6-56, R-4.6-57 |
| S-4.6-18 | 4.6 Überdeckung | nebeneinander nur bei gleichen Spalten | R-4.6-58 |
| S-4.6-19 | 4.6 Überdeckung | Marker über Blöcken, Titel rückt | R-4.6-59 (SA0-18) |
| S-4.6-20 | 4.6 Überdeckung | zusammenhängend; verknüpfte Teilblöcke | R-4.6-60, R-4.6-61 |
| S-4.7-01 | 4.7 | Legende, zweite Kategorie diagonal, keine anderen Farben | R-4.7-01 bis -04 |
| S-4.7-02 | 4.7 | Vorgabe Kp-Legende | R-4.7-05 |
| S-4.7-03 | 4.7 | Vorgabe Bat-Legende | R-4.7-06 |
| S-4.7-04 | 4.7 | neutrale Kategorie weiss | R-4.7-07, R-15-04 |
| S-4.7-05 | 4.7 | Funktionsliste mit Einzelfunktion | R-4.7-08, R-4.7-09 |
| S-4.7-06 | 4.7 | Kategorie-Vorschlag, Spaltenstandard, zuletzt verwendet | R-4.7-10, R-4.7-11, R-4.7-12 (SA0-12) |
| S-4.7-07 | 4.7 | offenes Ende gewellt | R-4.7-13 |
| S-4.7-08 | 4.7 | Abkürzungsliste nur Verwendetes, Schreibweise gleich | R-4.7-14 bis -17 |
| S-4.8-01 | 4.8 | Spalte «Was», Wochenende, senkrechte Beschriftung | R-4.8-01, R-4.8-02, R-4.8-03 |
| S-4.8-02 | 4.8 | Zeilenmuster, leere Felder, Freitext, Einzug | R-4.8-04 bis -07 |
| S-4.8-03 | 4.8 | Muster mehrere Zeitfenster | R-4.8-08 |
| S-4.8-04 | 4.8 | Sortierung nach Nummer | R-4.8-09 |
| S-4.8-05 | 4.8 | Status siehe 10 | Kontext: Verweis 10 |
| S-4.8-06 | 4.8 | Sonnenzeiten Mittwoch, Ortszeit, 5 Min, übersteuerbar | R-4.8-10, R-4.8-11 |
| S-4.9-01 | 4.9 | Vorlage bündelt Unterschiede; weitere möglich | R-3-01, R-4.9-16 |
| S-4.9-02 | 4.9 Tab. | Titel Kp/Bat | R-4.9-01, R-4.9-02 |
| S-4.9-03 | 4.9 Tab. | Ltg im Block | R-4.9-03, R-4.9-04 |
| S-4.9-04 | 4.9 Tab. | Beso-Kästchen Höhe und Nummer | R-4.9-05, R-4.9-06, R-4.6-49, R-4.6-50 |
| S-4.9-05 | 4.9 Tab. | Farbe Stand-Datum | R-4.9-07, R-4.9-08 |
| S-4.9-06 | 4.9 Tab. | Überschrift Kürzelliste | R-4.9-09, R-4.9-10 |
| S-4.9-07 | 4.9 Tab. | Terminbereich-Beschriftung | R-4.9-11, R-4.9-12 |
| S-4.9-08 | 4.9 Tab. | Name Nebenspalte | R-4.9-13, R-4.9-14 |
| S-4.9-09 | 4.9 Tab. | Rapport als Marker (Bat SR) | R-4.9-15, R-4.6-24 |
| S-4.9-10 | 4.9 Tab. | Legende je Stufe | R-4.9-17 |
| S-5-01 | 5 Einleitung | Hauptansicht wie PDF, zoombar | R-5-01, R-5-02 |
| S-5-02 | 5 Einleitung | Bedien-/Prüfmarken nur am Bildschirm | R-5-03 |
| S-5.1-01 | 5.1 | Klick wählt nur aus | R-5.1-01 |
| S-5.1-02 | 5.1 | Ziehen erzeugt Block, Titel sofort | R-5.1-02, R-5.1-03 |
| S-5.1-03 | 5.1 | Alt-Ziehen über Blöcken; Schnelleingabe | R-5.1-04, R-5.1-05 |
| S-5.1-04 | 5.1 | Doppelklick Rap/Beso erzeugt Eintrag | R-5.1-06, R-5.1-07 (SA0-14) |
| S-5.1-05 | 5.1 | Direktbearbeitung Tab/Enter/Esc | R-5.1-08 bis -11 |
| S-5.1-06 | 5.1 | Seitenfeld zeigt alle Angaben | R-5.1-12 |
| S-5.1-07 | 5.1 | Titel teilweise fett | R-5.1-13 (SA0-10) |
| S-5.1-08 | 5.1 | Verschieben/Grösse, Einrasten, Zeitanzeige | R-5.1-14, R-5.1-15 |
| S-5.1-09 | 5.1 | Ziehen über Tagesgrenze, Spaltenzuordnung | R-5.1-16 bis -19 |
| S-5.1-10 | 5.1 | Mehrfachauswahl und gemeinsame Aktionen | R-5.1-20, R-5.1-21 |
| S-5.1-11 | 5.1 | Kopieren/Einfügen/Duplizieren, auch zwischen Wochen | R-5.1-22 |
| S-5.2-01 | 5.2 | Neuer Plan erzeugt Wochen mit Daten/KW | R-5.2-01 |
| S-5.2-02 | 5.2 | Woche einfügen … löschen, wiederherstellbar | R-5.2-02 bis -06 |
| S-5.2-03 | 5.2 | Spaltensatz je Tag oder mehrere Tage | R-5.2-07 |
| S-5.2-04 | 5.2 | Spaltensatz ändern: markiert statt gelöscht | R-5.2-08, R-5.2-09 |
| S-5.2-05 | 5.2 | Wochenende voll/kompakt/ausgeblendet | R-5.2-10 |
| S-5.3-01 | 5.3 | Kästchen und Text ein Objekt | R-5.3-01 |
| S-5.3-02 | 5.3 | Nummernkreise 10er bis 70er | R-5.3-02 |
| S-5.3-03 | 5.3 | vor erstem Stand laufend, fixierbar | R-5.3-03, R-5.3-04, R-5.3-05, R-14.4-01 |
| S-5.3-04 | 5.3 | ab erstem Stand fixiert, Befehl mit Vorschau | R-5.3-06, R-5.3-07, R-5.3-08, R-14.4-02 |
| S-5.3-05 | 5.3 | gestrichener Beso behält Nummer | R-5.3-09 (SA0-05) |
| S-5.3-06 | 5.3 | mehr als zehn: P17, nie Folgetag | R-5.3-10, R-7-13 |
| S-5.3-07 | 5.3 | Nummernverweise geführt und nachgeführt | R-5.3-11, R-5.3-12 |
| S-5.3-08 | 5.3 | ohne Zeit → ganztägige Bemerkung | R-5.3-13 |
| S-5.3-09 | 5.3 | Rapporte ohne Termintext | R-5.3-14 |
| S-5.4-01 | 5.4 | mehrere Tagesabläufe, alle Planungsspalten | R-5.4-01, R-5.4-02, R-5.4-03 |
| S-5.4-02 | 5.4 | Verbindung, lokale Änderung, zurücksetzen | R-5.4-04, R-5.4-05, R-5.4-06 |
| S-5.4-03 | 5.4 | Plan als Vorlage, Datumsverschiebung | R-5.4-07 |
| S-5.4-04 | 5.4 | Stufe gemäss 4.9 | R-5.4-08 |
| S-5.5-01 | 5.5 | PDF Woche/Plan, Vorschau | R-5.5-01, R-5.5-02 |
| S-5.5-02 | 5.5 | Neuen Stand setzen, einfrieren, gleiches Datum | R-5.5-03, R-5.5-04, R-5.5-05 |
| S-5.5-03 | 5.5 | früherer Stand als identisches PDF | R-5.5-06 |
| S-5.5-04 | 5.5 | Plan als Datei sichern/laden | R-5.5-07 |
| S-5.6-01 | 5.6 Pkt 1 | sofort speichern, Anzeigen | R-5.6-01, R-5.6-02, R-5.6-03 |
| S-5.6-02 | 5.6 Pkt 2 | Wiederherstellungspunkte, ≥ 30 | R-5.6-04 bis -09 |
| S-5.6-03 | 5.6 Pkt 3 | Erinnerung beim Schliessen | R-5.6-10 |
| S-5.6-04 | 5.6 Pkt 4 | Warnung Speicher nicht dauerhaft/voll | R-5.6-11, R-5.6-12 |
| S-5.6-05 | 5.6 Pkt 5 | Öffnen überschreibt nie still | R-5.6-13 |
| S-5.6-06 | 5.6 Pkt 6 | Undo/Redo alle Änderungen, 200, nach Neuladen | R-5.6-14, R-5.6-15, R-5.6-16 |
| S-5.6-07 | 5.6 Pkt 7 | neuere Dateiversion abgelehnt | R-5.6-17 |
| S-5.7-01 | 5.7 | Erststart drei Einstiege | R-5.7-01 |
| S-5.7-02 | 5.7 | leere Woche zeigt nächsten Schritt | R-5.7-02 |
| S-5.7-03 | 5.7 | Fehlermeldungen Deutsch, nie stiller Abbruch | R-5.7-03, R-5.7-04 |
| S-6-01 | 6 Einleitung | Quick Wins machen schneller | Kontext: Einleitung |
| S-6-02 | 6 Tab. E1 | «Auch an anderen Tagen» | R-6-01 |
| S-6-03 | 6 Tab. E1 | Automatische Textausrichtung | R-6-02, R-6-03 |
| S-6-04 | 6 Tab. E1 | Kollisionsfreie Kästchen | R-6-04 |
| S-6-05 | 6 Tab. E1 | Automatische Kopfdaten | R-6-05 (SA0-15) |
| S-6-06 | 6 Tab. E1 | Detail beim Überfahren | R-6-06 |
| S-6-07 | 6 Tab. E1 | Interne Notizen nie PDF, nie Weitergabe | R-6-07, R-6-08, R-6-09 (SA0-02) |
| S-6-08 | 6 Tab. E1 | Dateiname nach Konvention | R-6-10, R-6-11, R-6-12 |
| S-6-09 | 6 Tab. E1 | Listenansicht | R-6-13 bis -16 |
| S-6-10 | 6 Tab. E2 | Schnelleingabe | R-6-17 bis -20, R-5.1-05 |
| S-6-11 | 6 Tab. E2 | Autovervollständigung | R-6-21 |
| S-6-12 | 6 Tab. E2 | Bausteine | R-6-22 |
| S-6-13 | 6 Tab. E2 | Tastatur | R-6-23 bis -27 |
| S-6-14 | 6 Tab. E2 | Automatische Sonnenzeiten | R-6-28, R-4.8-10, R-4.8-11 |
| S-6-15 | 6 Tab. E2 | Filtern und Hervorheben | R-6-29, R-11-13 (SA0-19) |
| S-6-16 | 6 Tab. E2 | Änderungsvergleich | R-6-30, R-6-31, R-6-32 |
| S-6-17 | 6 Tab. E2 | Pendenzenliste | R-6-33, R-6-34 |
| S-6-18 | 6 Tab. E2 | Planübersicht | R-6-35 |
| S-6-19 | 6 Tab. E2 | Zug-Auszug | R-6-36 |
| S-6-20 | 6 Tab. E4 | Heute-Ansicht | R-6-37 |
| S-6-21 | 6 Tab. E4 | Schwarz-Weiss-Druck (Kann) | R-6-38 |
| S-7-01 | 7 Einleitung | Prüfung bei jeder Änderung, Zähler, Sprung | R-7-01, R-7-02, R-7-03 |
| S-7-02 | 7 Einleitung | Export mit Befundanzeige, Fehler bestätigen | R-7-04, R-7-05 |
| S-7-03 | 7 Aufbau | fünf durch Aufbau ausgeschlossene Fehler | R-5.3-01, R-7-06, R-4.7-04, R-7-07, R-6-05 |
| S-7-04 | 7 P1 | Spalte fehlt (Fehler) | R-7-10, R-7-08 |
| S-7-05 | 7 P8 | Text passt nicht (Fehler) | R-7-11, R-10-43 (SA0-21) |
| S-7-06 | 7 P16 | Eintrag an ausgeblendetem Tag (Fehler) | R-7-12 |
| S-7-07 | 7 P17 | Nummernkreis voll (Fehler) | R-7-13 |
| S-7-08 | 7 P2 | fixierte Nummer falscher Kreis | R-7-14 |
| S-7-09 | 7 P3 | doppelter Eintrag | R-7-15 |
| S-7-10 | 7 P4 | Platzhalter oder leer | R-7-16 |
| S-7-11 | 7 P5 | Einzelfunktion doppelt, inkl. Bat | R-7-17, R-7-18 |
| S-7-12 | 7 P6 | Abweichung neueste Bat-Version | R-7-19 |
| S-7-13 | 7 P7 | Detachement existiert nicht mehr | R-7-20, R-9.1-06 |
| S-7-14 | 7 P18 | Datum im Text falsch | R-7-21 (SA0-20) |
| S-7-15 | 7 P9 | Termintext wiederholt Block | R-7-22 |
| S-7-16 | 7 P10 | Blöcke überlappen gleiche Spalten | R-7-23 |
| S-7-17 | 7 P11 | Tagesablauf unvollständig | R-7-24 |
| S-7-18 | 7 P12 | Schreibweise Wörterbuch, Ausnahmen | R-7-25, R-7-26 |
| S-7-19 | 7 P13 | Verweis auf Bat-Dokument, Liste | R-7-27, R-7-28 |
| S-7-20 | 7 P14 | über Mitternacht / ausserhalb Bereich | R-7-29 |
| S-7-21 | 7 P15 | Kopfangaben fehlen | R-7-30 |
| S-7-22 | 7 P19 | Zeitangabe im Freitext ≠ Zeitfeld | R-7-31 |
| S-7-23 | 7 Nachsatz | Wörterbuch pflegbar, auf alle Fundstellen | R-7-32, R-7-33 |
| S-7-24 | 7 Nachsatz | Befunde quittierbar | R-7-34 |
| S-8-01 | 8 Einleitung | Excel und Plan-Datei über denselben Assistenten | R-8-01 |
| S-8.1-01 | 8.1 | Bat-Spalten 0–4, Stab, KVK Funktionsstufen | R-8.1-01, R-8.1-02 |
| S-8.1-02 | 8.1 | Bat-Seitenleiste | R-8.1-03 |
| S-8.1-03 | 8.1 | Weitergabe entfernt Internes; andere Stufe schreibgeschützt | R-8.1-04, R-8.1-05, R-8.1-06 |
| S-8.2-01 | 8.2 | heutiges Format, Blatt pro Woche, Formen | R-8.2-01, R-8.2-02, R-8.2-03 |
| S-8.2-02 | 8.2 | Zweck: Bat-Grundlage, eigene Kp-WAP inkl. Vorjahre | R-8.2-01, R-8.2-03 (Vorjahre: SA0-07) |
| S-8.2-03 | 8.2 R1 | Termintexte aus Textfeldern und Zellen | R-8.2-04 |
| S-8.2-04 | 8.2 R2 | rot durchgestrichen / rot | R-8.2-05, R-8.2-06, R-8.2-07 |
| S-8.2-05 | 8.2 R3 | Termintext hat Vorrang, > 15 Min Bericht | R-8.2-08, R-8.2-09 |
| S-8.2-06 | 8.2 R4 | Kanten 5 Min, > 2 Min Bericht | R-8.2-10, R-8.2-11 (Q-006 offen) |
| S-8.2-07 | 8.2 R5 | Farbzuordnung, Verlauf, Unklares | R-8.2-12, R-8.2-13, R-8.2-14 |
| S-8.2-08 | 8.2 R6 | Formen in Rap-/Beso-Spalte | R-8.2-15 bis -18 |
| S-8.2-09 | 8.2 R7 | Zwischenspalten zur Nachbarspalte | R-8.2-19 |
| S-8.2-10 | 8.2 R8 | keine Form still verloren, Sprung | R-8.2-20, R-8.2-21 |
| S-8.2-11 | 8.2 R9 | Original unverändert, Wiederherstellungspunkt | R-8.2-22, R-5.6-05 |
| S-8.2-12 | 8.2 R10 | Nummern fixiert, erster Stand, Bericht | R-8.2-23, R-8.2-24, R-8.2-25 |
| S-8.2-13 | 8.2 R11 | weitere Berichtsinhalte | R-8.2-26, R-8.2-25, R-8.2-09, R-8.2-27, R-8.2-28 |
| S-8.2-14 | 8.2 R12 | Zerlegung Formtext und Termintext | R-8.2-29 bis -35 |
| S-8.3-01 | 8.3 | Vorauswahl relevanter Bat-Einträge | R-8.3-01 bis -05 |
| S-8.3-02 | 8.3 | Kategorien-Zuordnung, einmal bestätigt | R-8.3-06, R-8.3-07 |
| S-8.3-03 | 8.3 | Entscheid pro Eintrag, Quelle, Spaltenvorschlag | R-8.3-08, R-8.3-09, R-8.3-10 |
| S-8.3-04 | 8.3 | Bat-Ebene als blasse Bänder | R-8.3-11 |
| S-8.3-05 | 8.3 | neue Bat-Version, P6, Nachführen | R-8.3-12, R-8.3-13, R-7-19 |
| S-8.3-06 | 8.3 | nie selbständige Änderung | R-8.3-14 |
| S-9-01 | 9 Einleitung | ohne Anbindung voll nutzbar | R-9-01 |
| S-9-02 | 9 Einleitung | eigenständig bei Nachteil | Kontext: Architekturgrundsatz |
| S-9-03 bis S-9-06 | 9 Datenflüsse | vier Datenflüsse | Kontext: Übersicht, Details in 8, 9.1, 9.2, 10 |
| S-9.1-01 | 9.1 | Züge als feste Spalten | R-9.1-01, R-14.11-01 |
| S-9.1-02 | 9.1 | mehrtägige Detachemente als Spalten | R-9.1-02 |
| S-9.1-03 | 9.1 | kurze Detachemente als Blockvorschlag | R-9.1-03 |
| S-9.1-04 | 9.1 | Spaltensatz-Vorschlag je Tag | R-9.1-04, R-14.11-02 |
| S-9.1-05 | 9.1 | Personenliste aus Detachementsplaner, vier Felder | R-9.1-05, R-4.1-12 |
| S-9.1-06 | 9.1 | Änderungen als P7, nie still | R-9.1-06, R-7-20 |
| S-9.1-07 | 9.1 | Stammdaten im WAP-Planer gepflegt | R-4.1-02, R-4.1-06, R-4.1-13 |
| S-9.2-01 | 9.2 | strukturierte Felder pro Tag | R-9.2-01 |
| S-9.2-02 | 9.2 | Lieferung auslösen, Suite ohne Dateiauswahl | R-1-05, R-9.2-02, R-9.2-03 |
| S-9.2-03 | 9.2 | Feldabgleich mit Spezifikation Tagesbefehle | R-9.2-04 |
| S-9.2-04 | 9.2 | Tagesbefehl-Angaben beim Tag | R-9.2-07, R-4.3-05 |
| S-9.2-05 | 9.2 | letzte Lieferung, «Tagesbefehl veraltet» | R-9.2-05, R-9.2-06 |
| S-10-01 | 10 Einleitung | A4 quer, Seite/Woche, Anordnung | R-10-01, R-10-02, R-10-06 |
| S-10-02 | 10 Einleitung | Massstab Kp-PDF und Bat PICASSO (V3) | R-14.2-01 bis -05, R-14.16-01 bis -03 |
| S-10-03 | 10 Layout-Schema | Kopf, Raster, Seitenleiste, Termine | R-10-07 bis -12, R-4.5-03, R-4.6-06, R-2-02, R-10-21, R-4.8-01 |
| S-10-04 | 10 Tab. Seite | A4, Fortsetzung, Gesamt, A3, durchsuchbar | R-10-01 bis -05 |
| S-10-05 | 10 Tab. Kopf | links/Mitte/rechts, Stand-Farbe | R-10-07 bis -12 |
| S-10-06 | 10 Tab. Raster | Achse, Tageskopf, kompakt, Grenzen, Linien | R-4.5-03 bis -06, R-10-13, R-10-14, R-10-15, R-4.4-02, R-4.4-10 bis -13 |
| S-10-07 | 10 Tab. Blöcke | Füllung, Rahmen, Felder, Häkchen, diagonal, gewellt | R-10-16, R-10-17, R-10-18, R-4.7-03, R-4.7-13 |
| S-10-08 | 10 Tab. Rapporte | kräftiger Rahmen, Kürzel fett | R-10-19, R-4.6-20 |
| S-10-09 | 10 Tab. Beso | klein, Nummer gemäss Vorlage, Farbe | R-10-20, R-4.9-05, R-4.9-06 |
| S-10-10 | 10 Tab. Marker | Linie, verdeckt keinen Text | R-4.6-12, R-4.6-59 |
| S-10-11 | 10 Tab. Querbalken | Band, zentriert | R-4.6-06, R-4.6-08 |
| S-10-12 | 10 Tab. Seitenleiste | Elemente, grau, Nr/Was, Unterschrift, Symbol | R-10-21 bis -26 |
| S-10-13 | 10 Tab. Termine | senkrecht, «Was», Einzug | R-4.8-01, R-4.8-03, R-4.8-07 |
| S-10-14 | 10 Tab. Status | offen rot, gestrichen, abschaltbar | R-10-27 bis -31 (SA0-11) |
| S-10-15 | 10 Tab. Änderungen | geänderte Felder/Nummern rot | R-10-32 bis -35, R-4.6-34 |
| S-10-16 | 10 Tab. Schrift | serifenlos, Grössen, Minimum, einheitlich | R-10-36 bis -39, R-15-05 |
| S-10-17 | 10 Tab. Rückfallregel | Zeilen entfallen, «…», Fortsetzung, P8 | R-10-40 bis -43 |
| S-10-18 | 10 Tab. Daten | dd.mm.yyyy, dd.mm.yy, yyyy-mm-dd | R-10-44, R-10-45, R-10-46 |
| S-10-19 | 10 Tab. Datei | Name gemäss 6 | Kontext: Verweis auf 6 (R-6-10 bis -12) |
| S-10-20 | 10 Tab. Optionen | Zug-Auszug, S/W | Kontext: Verweis auf 6 (R-6-36, R-6-38) |
| S-11-01 | 11 | Suite nur mit Vorteil | Kontext: Architekturgrundsatz |
| S-11-02 | 11 | Browser ohne Installation, offline | R-11-01, R-11-02, R-14.13-01 |
| S-11-03 | 11 | Daten beim Nutzer, Plan-Datei | R-11-03, R-11-04 |
| S-11-04 | 11 | Personendaten nur vier Felder | R-11-05, R-8.1-05 |
| S-11-05 | 11 | Sprache, Zeiten, Datum, Abkürzungen | R-11-06, R-10-44 |
| S-11-06 | 11 | Tastatur, Fokus, Kontrast, Tablet | R-11-07 bis -10 |
| S-11-07 | 11 | Leistungsziele | R-11-11 bis -17, R-14.14-01 |
| S-12-01 bis S-12-09 | 12 | Einleitung und acht Ausschlüsse | Kontext: Negativumfang |
| S-13-01 | 13 | Etappe nutzbar, Abnahme | Kontext: Vorgehen |
| S-13-02 | 13 E1 | Umfang Etappe 1 | Spalte «Et.» aller E1-IDs (SA0-02, SA0-04) |
| S-13-03 | 13 E1 Abnahme | 14.1 KVK/Wo 1, 14.2–14.5, 14.7 | R-14.1-01, R-14.1-02, R-14.2-01 bis R-14.5-09, R-14.7-01 |
| S-13-04 | 13 E2 | übrige Prüfungen, Tagesabläufe, Vergleich, QW E2 | R-7-14 bis -33 (E2), R-5.4-01 bis -07, R-6-17 bis -36, R-10-32 bis -35 |
| S-13-05 | 13 E2 Abnahme | 14.1 alle, 14.6, 14.7 | R-14.1-03, R-14.6-01, R-14.7-01 |
| S-13-06 | 13 E3 | Bat-Vorlage, Import, Assistent, P6, P5-Bat, Weitergabe | R-4.9-02 ff. (Bat), R-8.2-03, R-8.3-01 bis -14, R-7-18, R-7-19, R-8.1-04 bis -06 |
| S-13-07 | 13 E3 Abnahme | 14.8–14.10, 14.16, 14.7 P6 | R-14.8-01 bis R-14.10-01, R-14.16-01 bis -03 |
| S-13-08 | 13 E4 | Detachementsplaner, Tagesbefehle, Heute, S/W | R-9.1-01 bis -06, R-9.2-01 bis -07, R-6-37, R-6-38 |
| S-13-09 | 13 E4 Abnahme | 14.11, 14.12, 14.7 P7 | R-14.11-01, R-14.11-02, R-14.12-01, R-7-20 |
| S-13-10 | 13 Nachsatz | 14.13–14.15 ab E1, jede Abnahme | R-14.13-01, R-14.14-01, R-14.15-01 |
| S-14-01 | 14 Einleitung | Soll-Listen, unabhängig, bestätigt, Excel massgebend | R-14-01 bis R-14-04 (C unabhängig: SA0-03) |
| S-14-02 | 14.1 | 95 % automatisch, 100 % nach Nacharbeit | R-14.1-01, R-14.1-02, R-14.1-03 |
| S-14-03 | 14.2 | Checkliste B-Kp, Farben, Kanten, Schrift, Bestätigung | R-14.2-01 bis -05 |
| S-14-04 | 14.3 | keine Überlappung, kein Rückfall in Referenz | R-14.3-01, R-14.3-02, R-14.3-03 |
| S-14-05 | 14.4 | Nummern lückenlos / unverändert | R-14.4-01, R-14.4-02 |
| S-14-06 | 14.5 | Importbericht Kp nennt Referenzfälle | R-14.5-01 bis -09 |
| S-14-07 | 14.6 | Tempo halbe Excel-Zeit | R-14.6-01 |
| S-14-08 | 14.7 | jede Regel positiv und negativ | R-14.7-01 |
| S-14-09 | 14.8 | Bat-Import gegen Anhang C (V3) | R-14.8-01 bis -05 |
| S-14-10 | 14.9 | 5 Änderungen = 5 Meldungen (V3) | R-14.9-01 |
| S-14-11 | 14.10 | Weitergabe ohne AHV, Telefon, Adressen, Notizen | R-14.10-01 |
| S-14-12 | 14.11 | Detachementsplaner-Spalten, Vorschlag | R-14.11-01, R-14.11-02 |
| S-14-13 | 14.12 | Datenlieferung KVK Montag | R-14.12-01 |
| S-14-14 | 14.13 | Offline | R-14.13-01 |
| S-14-15 | 14.14 | Leistung | R-14.14-01 |
| S-14-16 | 14.15 | Datenverlust-Schutz vorgeführt | R-14.15-01 |
| S-14-17 | 14.16 | Bat-PDF gegen B-Bat | R-14.16-01, R-14.16-02, R-14.16-03 |
| S-15-01 bis S-15-05, S-15-07 | 15 Tab. | Referenzdateien und Zweck | Kontext: Referenzliste (Prompt §8; Hilfsreferenz Bat über Q-002) |
| S-15-06 | 15 Tab. | Spezifikation Tagesbefehle: Felder abgleichen | R-9.2-04 |
| S-15-08 | 15 | Testdaten anonymisiert | R-15-09 |
| S-15-09 | 15 | Sonnenzeiten der Referenz kein Massstab | R-15-08 |
| S-15-10 | 15 Entschieden | Sa 60er, So 70er | R-5.3-02 |
| S-15-11 | 15 Entschieden | Suite nur mit Vorteil | Kontext: Grundsatz |
| S-15-12 | 15 offen | Klassifizierung Kp leer | R-15-01 |
| S-15-13 | 15 offen | Einrasten 15 / Eingabe 5 | R-15-02 |
| S-15-14 | 15 offen | Unterschrift-Bild standardmässig aus | R-15-03 |
| S-15-15 | 15 offen | neutrale Kategorie nicht in Legende | R-15-04 |
| S-15-16 | 15 offen | Schriftgrössen 5 / 5,5 / 4,5 pt | R-15-05 |
| S-15-17 | 15 offen | Umbruch an Wortgrenzen, Silbentrennung nötigenfalls | R-15-06 |
| S-15-18 | 15 offen | Excel-Zeitmessung vor Etappe 2 | R-15-07 |

**Anforderungen ohne Beschrieb-Grundlage:** keine, abgesehen von R-H-01 bis R-H-09 (Quelle Prompt). Einige Anforderungen stützen sich zusätzlich auf den Prompt, belegt mit Stelle: R-4.1-11 (§8), R-6-16 (§7), R-10-36 (§3), R-14-01 und R-14-03 (Lock). Zusätze, die nur im Abnahmekriterium stehen, fasst SA0-17 zusammen.

## Befunde

| ID | Stufe | Art | Stelle | Beschreibung | Empfehlung |
| --- | --- | --- | --- | --- | --- |
| SA0-01 | hoch | Auslegung / Prüfbarkeit | R-1-03; Beschrieb 1 EK3, 7 «Durch den Aufbau ausgeschlossen» | **Beschrieb:** «Kein PDF verlässt das Tool mit unbemerktem Regelverstoss (Beso/Termine, Überlappung, Überlauf, ausgeblendete Einträge).» **R-1-03 verlangt:** «für jede der vier Arten ein Plan mit Verstoss: vor dem Export erscheint der Befund». In Etappe 1 lassen sich «Beso/Termine» und «Überlappung» gar nicht als Verstoss herstellen: Sie sind durch den Aufbau ausgeschlossen (R-5.3-01, R-4.6-51 bis -53), und die passenden Befunde P9, P10 und P4 kommen erst in Etappe 2. Der Test ist so in Etappe 1 nicht schreibbar. | Kriterium aufteilen: Überlauf → P8 (R-7-11) und ausgeblendet → P16 (R-7-12) als E2E; Beso/Termine und Überlappung als Verweis auf die Property-Tests R-5.3-01, R-4.6-51 bis -53 und R-14.3-01. Nur der 11. Beso (F-14 → P17) bleibt als Befund. P9 und P10 in Etappe 2 ergänzen. |
| SA0-02 | hoch | Etappenzuordnung | R-6-09; Beschrieb 6 Tab. «Interne Notizen … nie in weitergegebenen Dateien \| 1» | Tabelle 6 nennt Etappe 1, R-6-09 steht auf Etappe 3. In Etappe 1 ist die Plan-Datei aber das einzige Mittel der Weitergabe (Beschrieb 11 «Sicherung und Weitergabe erfolgen als Plan-Datei»; 3). Nach F-46 enthält sie die Notizen. | R-6-09 teilen. **Etappe 1:** Notizen nie im PDF (R-6-08) und nie im CSV-Export der Listenansicht (R-6-16); der Sicherungsdialog kennzeichnet die Datei als «enthält interne Notizen» (F-46), mit Test. **Etappe 3:** Export zur Weitergabe. F-46 an Gate 0 entscheiden lassen. |
| SA0-03 | hoch | Lücke (Etappe 3) | Beschrieb 14 Einleitung; R-14-01, R-14-02 | **Beschrieb:** «Anhang A und C entstehen unabhängig vom Import (Auszählung der Formen und Termintexte mit Sichtkontrolle am PDF)». R-14-01 regelt das nur für A. R-14-02 verlangt für C nur, dass er vorliegt und bestätigt ist. | R-14-02 ergänzen oder neue ID: Anhang C entsteht unabhängig vom Bat-Import und wird vor Beginn der Bat-Import-Entwicklung bestätigt. |
| SA0-04 | mittel | Etappenzuordnung inkonsistent | R-4.2-10 (E3) ↔ R-4.6-31 (E1), F-38 | Beschrieb 13 E1 verlangt «alle Eintragstypen». F-38 schlägt vor: «Typ mit Nummer und Zeitraum in Etappe 1». R-4.2-10 (Nummer, Zeitraum, erscheint in den Wochen des Zeitraums) steht trotzdem auf Etappe 3. | R-4.2-10 auf Etappe 1 setzen. Nur das Verweis-Kästchen (R-4.2-11) und die Bat-Darstellung bleiben in Etappe 3. |
| SA0-05 | mittel | abweichende Auslegung (nicht markiert) | R-5.3-09; Beschrieb 5.3 | **Beschrieb:** «behält seine Nummer bis zum nächsten Stand; sie wird nicht neu vergeben». **R-5.3-09:** «nach neuem Stand ist 12 frei», also Wiedervergabe erlaubt. Die Auslegung ist nicht als solche markiert und passt nicht sicher zu F-13. | Als «Auslegung» markieren und eine F-Frage stellen: Wiedervergabe nach dem nächsten Stand ja oder nein. |
| SA0-06 | mittel | unvollständig | Beschrieb 2 «Stufe/Vorlage», «Rapport»; 4.6 Rapport «aus der Liste»; R-4.6-16, F-09 | Die Vorlage soll «Spalten, Legende, Kopf- und Darstellungsregeln» festlegen. Für Kp fehlt eine Anforderung zu vorbelegten Spaltensätzen. Ebenso fehlt eine Anforderung zum Inhalt der Rapportkürzelliste (KR, DR, AR1, AR2, ARK, BR 0–3). | Neue ID, z.B. R-4.9-18: Die Kp-Vorlage liefert die Rapportkürzelliste mit Standardkategorie (F-09). F-Frage, ob die Kp-Vorlage Spaltensätze mitbringt. |
| SA0-07 | mittel | Aussage ohne Referenz | Beschrieb 8.2 Zweck «(FDT 2026, Vorjahre)» | Für den Import von Vorjahres-Dateien gibt es keine Anforderung und in Beschrieb 15 keine Referenzdatei. | Frage an den Auftraggeber: Vorjahres-Datei liefern, oder Vorjahre ohne Abnahme als «bestmöglich mit Bericht» festhalten. |
| SA0-08 | mittel | Kriterium widerspricht eigener Auslegung | R-4.4-08, F-42 | **Kriterium:** «Kompakter Tag → Kopf «Bes»; voller Tag → «Beso»». **F-42 dagegen:** «Bes», wenn «Beso» nicht in die Spaltenbreite passt. Das kann auch an einem vollen Tag mit vielen Spalten eintreten. | Kriterium auf «passt nicht → Bes» umstellen, mit einem Fall für einen vollen, breiten Tag. |
| SA0-09 | mittel | Kriterium schwächer als Wortlaut | R-4.6-53 | Wortlaut: «Bahnbreite wird geteilt». Das Kriterium prüft nur «keine Überlappung, innerhalb der Spalte». Die Teilung selbst ist ungeprüft. | Unit-Fall ergänzen: drei gleichzeitige Kästchen → festgelegte Breitenaufteilung (Werte nennen). |
| SA0-10 | mittel | Prüfart unpassend | R-5.1-13; Beschrieb 5.1 «Im Titel darf ein Teil fett … sein» | Geprüft wird nur am PDF. Wie die Eingabe im Raster oder Seitenfeld geht (Erfassen), bleibt ungetestet. | Ein E2E-Kriterium für das Setzen von Teil-Fett ergänzen, per Tastatur erreichbar. |
| SA0-11 | niedrig | Prüfart unpassend | R-4.2-06 («entfällt im PDF»), R-10-30 («nicht mehr im PDF») | PDF-Aussagen werden nur als Unit geprüft. | Prüfart PDF oder PDF als Zweitprüfung. |
| SA0-12 | niedrig | Auslegung nicht markiert | R-4.7-10 | Beschrieb: «schlägt … vor». Kriterium: «Kategorie wechselt» (automatisch, übersteuerbar). | Als Auslegung markieren oder Kriterium auf «Vorschlag, per Aktion übernehmen» ändern. |
| SA0-13 | niedrig | Kriterium unvollständig | R-4.6-14 | «Die Zeit erscheint je nach Art (Vorgabe: nur bei ABV)» heisst: pro Art einstellbar. Geprüft wird nur die Vorgabe. | Fall mit geänderter Einstellung ergänzen, oder F-Frage. |
| SA0-14 | niedrig | Kriterium mehrdeutig | R-5.1-06, R-5.1-07 | «Rapport ab 0700» und «Zeitfenster ab 1400» fallen mit der Zeitform «ab X» (4.6) zusammen. Die Terminzeile würde dann «ab 1400» lauten. | «Zeitpunkt 0700» bzw. «Beginn 1400» mit der vorgesehenen Zeitform schreiben. |
| SA0-15 | niedrig | Kriterium zu weit | R-6-05 | «kein Kopffeld von Hand editierbar» widerspricht den editierbaren Feldern Einheit, Beilage und Klassifizierung im Kopf (R-4.1-02 bis -04). | Auf die berechneten Angaben beschränken: Datum, KW, Wochentage, Sa/So, Stand. |
| SA0-16 | niedrig | Doppelung ohne Verweis | R-4.1-15 ↔ R-5.5-03; R-4.5-07 ↔ R-4.6-06; R-4.4-07 (zweite Bahn) ↔ R-4.6-52 | Jeweils dieselbe Aussage mit eigenem Kriterium, ohne Querverweis. | Querverweis setzen oder zusammenlegen. |
| SA0-17 | niedrig | Zusatz ohne Auslegungs-Markierung | R-4.6-25 (Bestätigung beim Löschen des letzten Zeitfensters), R-4.6-28 (Nummer vor Freitext), R-4.7-01 (Löschen nur mit Umzuordnung), R-5.4-07 (Fixierung und Stände nicht übernommen), R-4.9-16 («ohne Codeänderung»), R-10-40 (Klammerliste als Reihenfolge) | Diese Kriterien sagen mehr als der Beschrieb. | Als «Auslegung» markieren oder F-Fragen stellen. |
| SA0-18 | niedrig | Kriterium schwächer als Wortlaut | R-4.6-54, R-4.6-59 | Geprüft wird nur, dass sich nichts überschneidet. «Liegen über Blöcken» (Zeichenreihenfolge) und «Titel rückt unter den Marker» sind nicht geprüft. | Beide Fälle ergänzen. |
| SA0-19 | niedrig | Kriterium unvollständig | R-6-29 (Etappe 2) | Geprüft wird nur der Filter nach Spalte. Ltg und Ort (Beschrieb 6) fehlen. | Je einen Fall für Ltg und Ort ergänzen. |
| SA0-20 | niedrig | Kriterium unvollständig | R-7-21 P18 (Etappe 2) | Der Fall «Datum ausserhalb des Plans» fehlt. | Positiven und negativen Fall ergänzen. |
| SA0-21 | niedrig | Kriterium unvollständig | R-7-11 P8 | Beschrieb P8 nennt «Block, Termin, Seitenleiste». Das Kriterium prüft nur den Block. Termin und Seitenleiste sind nur indirekt über R-10-43 (Fortsetzung) abgedeckt. | Je einen Fall für Termin und Seitenleiste ergänzen. |

**Etappenzuordnung, sonst geprüft:** Alle übrigen IDs stimmen mit Beschrieb 13 und Tabelle 6 überein. Etappe 4 für R-4.3-05 und Etappe 1 für R-14.1-01 (95 %) und R-7-34 sind vertretbar; sie hängen an den offenen Fragen F-45, F-01 und F-37.

## Offene Punkte

- Der Orchestrator entscheidet, ob SA0-06 und SA0-07 als neue F-Fragen nach `QUESTIONS.md` (Q-007) übertragen werden.
- Für SA0-02 ist F-46 an Gate 0 massgebend.

**Freigabe: nein**
