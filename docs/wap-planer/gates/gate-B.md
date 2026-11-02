# Gate B Etappe 1 – Entscheid

**Entscheid Auftraggeber 28.10.2026: «All as recommended for gate-b» – alle 43 Entscheide gemäss Empfehlung.**

Antwort wörtlich im Freigabeprotokoll (`PROGRESS.md`, 28.10.2026). Entscheid 39 mit der Antwort des Auftraggebers vom 28.10.2026 (wörtlich): «ARK: Ausbildungrapport Kompanie / BR: Battallionsrapport (0: kvk, 1: wo 1 etc...)»; KR noch offen (Rückfrage läuft; Nachtrag 29.10.2026: Antwort «1. Kompanierapport» → KR = Kompanierapport, GB-DOKU2). Umsetzung der Entscheide: Katalog, UI-Richtlinie, QUESTIONS und FINDINGS nachgeführt (Paket GB-DOKU, `pakete/GB-DOKU.md`); Import 12–15 (GB-IMPORT), Layout 17, 18 (GB-LAYOUT), Abdeckungspfad 34 c und Golden-Status 7 b (F-TOOLS). Etappe-2-Liste zu 41 und 43: `plan/etappe-2-kandidaten.md`. Abnahmebericht: `abnahme/etappe-1.md`.

Hinweis zu Entscheid 1: Nach dem Entscheid vom 26.10.2026 («Volles Gate entfällt für Etappe 1», Freigabeprotokoll) verlangt der Merge nach `wap-planer` für Etappe 1 die Merge-Schleuse; Selbsttest V1a und Mutation V8 laufen ab Etappe 2.

Die Vorlage folgt unverändert (Stand `wap-codex` a8e2f1d, 21.10.2026); ergänzt sind nur die Spalte «Entscheid 28.10.2026» und der Entscheid in Anhang 1, lokale Pfade sind relativ zum Haupt-Checkout geschrieben. Bilder, Listen und Vergleiche liegen nur lokal (`.qa/`, `reference/`).

---

## Vorlage (Entwurf spec-auditor, Fassung 2, 21.10.2026)

Stand `wap-codex` **a8e2f1d**. Gate B schliesst diese Iteration ab; Selbsttest und volles Gate laufen ganz am Schluss, vor dem Merge nach `wap-planer` (Entscheid 1). Zielort: `docs/wap-planer/gates/gate-B.md` (Prompt §10). Keine Namen, keine Inhalte aus `reference/`; Bilder und Listen nur lokal unter ``. Abnahmebericht-Entwurf: `.qa\gate-b\abnahmebericht-e1-entwurf.md`.

## Empfehlung

**Gate B: ja mit Auflagen, als Abschluss dieser Iteration.** Vor der Freigabe bestätigst du Seiten-an-Seiten (2) und Datenverlust-Schutz (8). Auflagen vor dem Merge nach `wap-planer`: (1) Selbsttest und volles Gate vollständig grün (heute rot: Selbsttest-Zeitlimit, Abdeckung in 6 Modulen, R-14.1-02; nicht gelaufen: Golden, Leistung, Mutation); (2) Nacharbeit 14.1 zu 100 % nach den Entscheiden 12–15; (3) kleine Nachträge aus 14, 15, 17, 18; (4) Katalog-Nachführungen und frische Prüfer für die letzten Runden.

## Was du jetzt prüfen sollst (5 Punkte)

1. **App ausprobieren** (≈ 15 min): `.qa\schlussrunde\pruefstand-final.html#/wap` in Edge, offline; eigene Mappe importieren, Liste und Raster nutzen. Stand a8e2f1d (Endstand, SHA-256 beginnt mit 58a95779490c2b27).
2. **Vorführung 5.6** (≈ 15 min) mit dieser Datei nach `.qa\haertung\ux\vorfuehrung-5-6-v2.md` → Entscheid 8.
3. **Rückfall-Liste** (≈ 15 min): `.qa\gate-b\rueckfaelle-liste.md`, 18 Stellen links Referenz, rechts WAP-Planer, dazu «Punkt 14» flacher Marker → 3, 4, 5, 17.
4. **Seite an Seite** (≈ 15 min): `.qa\haertung\vqa-3\seite-an-seite\` (KVK, Wo1, Wo2, Wo3; Übersicht 72 dpi, Detail 432 dpi) → 2, 6, 19.
5. **Entscheidliste unten** (≈ 20 min); für 11 die Änderungsliste `reference\anhaenge\aenderungen-2026-10-19.md` (nur lokal). Die Excel-Ausgangsmessung (9) später nach `.qa\gate-b\messanleitung-14-6-entwurf.md`.

## Erreicht in Etappe 1

1. **Planen wie im PDF:** Editor-Raster = PDF-Seite (Blockzeilen 642/642 am selben Ort), Text direkt im Block, bündige Blöcke, Spalten hinzufügen/entfernen, Doppelklick auf die Kante füllt bis zum Nachbarblock.
2. **Treffen und Ziehen neu:** Fehlklicks auf der echten Mappe bei 100 % 0/1190 (vorher 0,4 %), Kante ziehen 0 Fehlgriffe (vorher 1,9 %); Ziehen p95 12,99 ms (Budget 16,7 ms).
3. **PDF im heutigen Layout:** je Woche 1 Seite, Schrift ≥ 4,5 pt (Referenz rund 3 pt), keine Überlappung, kein verdeckter Text; Rückfälle 27 → 18, alle als P8 sichtbar.
4. **Excel-Import des eigenen Kp-WAP:** 98,3 % automatisch korrekt (Schwelle 95 %); nach zwei Nacharbeitsrunden KVK und Wo 1 229/231 (99,1 %), Rest an Entscheide gebunden; Import 6,0 s gedrosselt (Budget 15 s).
5. **Liste ↔ Raster:** Auswahl wandert mit, «Im Raster zeigen», Zelle leeren, Löschen mit Ctrl+Entf, Beso ohne Kategorie.
6. **Beso, Termine, Stand:** Nummern lückenlos, nach dem Stand fixiert; Stand mit PDF, nicht per Rückgängig verlierbar.
7. **Schutz vor Datenverlust 5.6:** sofort gespeichert, Wiederherstellungspunkte, 200 Rückgängig-Schritte auch nach Neuladen, Öffnen überschreibt nie still; Vorführskript bereit.
8. **Offline und datenfrei:** 0 Netzanfragen, 0 Konsolenfehler in allen Prüfläufen; Schleuse F1–F10, Vitest, E2E auf a8e2f1d grün.

## Entscheide – Empfehlung je Zeile (Antwort z.B. «1 a / 2 a / 14 b …»)

1 a · 2 a · 3 a · 4 a · 5 a · 6 a · 7 b · 8 a · 9 a · 10 a · 11 a · 12 a · 13 a · 14 b · 15 a · 16 a · 17 a · 18 a · 19 a · 20 a · 21 a · 22 a · 23 a · 24 a · 25 a · 26 a · 27 a · 28 a · 29 a · 30 a · 31 a · 32 a · 33 a · 34 c · 35 a · 36 a · 37 a · 38 a · 39 a · 40 a · 41 a · 42 a · 43 a

| Nr | Frage (ein Satz) | Optionen | Empfehlung (Grund) | Folge (ohne Entscheid) | Entscheid 28.10.2026 |
| --- | --- | --- | --- | --- | --- |
| **A Iteration und Abnahme** | | | | | |
| 1 | Gate B jetzt als Abschluss dieser Iteration, Selbsttest und volles Gate (inkl. Golden, Leistung, Mutation) erst vor dem Merge nach `wap-planer`? | a ja · b erst nach vollem Gate | **a** – dein Wunsch; die Schritte F1–F10, Vitest und E2E sind auf a8e2f1d schon grün | a: Abweichung von Prompt §5.3 Punkt 2 und §6 (Selbsttest, Mutation an jeder Abnahme) protokolliert; Merge nur mit grünem Schluss-Gate. (b) | **1 a** |
| 2 | Bestätigst du Seite an Seite KVK, Wo1, Wo2, Wo3 (R-14.2-05, R-1-02)? | a bestätigt · b Punkte | **a** – B-Kp im Soll ausser entschiedenen Abweichungen (Anhang 1) | 14.2 erfüllt. (offen) | **2 a** |
| 3 | Nimmst du die 18 Rückfälle der echten Wochen (KVK 8, Wo1 3, Wo2 5, Wo3 2) als bestätigte Liste an (R-14.3-03)? | a annehmen · b einzelne beheben | **a** – alle sichtbar, keine Fortsetzungsseite, vorher 27 | Test friert die Liste ein; Zählung am Schluss nachprüfen. (14.3 offen) | **3 a** |
| 4 | Bestätigst du die Rückfallliste der KVK-Fixture, 6 → 4 nach «12: ja» (F-LAYOUT2-16)? | a ja · b alte Fassung | **a** – zwei Det-Blöcke fassen die Ltg jetzt | – (unbestätigt) | **4 a** |
| 5 | Die KVK hat nach «12: ja» 3 Rückfälle mehr (Rap-Spalte Mo/Di 6,4 pt, F-LAYOUT2-A2) – so lassen? | a so lassen · b Rap-Spalte an Tagen mit Nebenspalte breiter | **a** – alles sichtbar; b wäre eine weitere Breitenabweichung | b: Nachtrag Layout. (a) | **5 a** |
| 6 | Abweichung B-Kp-37 (Nebenspalte Gewicht 2 statt 1) im Vergleich zur Kenntnis (F-LAYOUT2-A1)? | a ja · b zurück auf 1 | **a** – folgt aus «12: ja» | (a) | **6 a** |
| 7 | Golden-Bilder freigeben (4 PDF-Seiten, 2 Bildschirm-Kernzustände)? | a alle 6 · b 4 PDF jetzt, 2 Bildschirm nach V6 am Schluss | **b** – PDF bitgleich und geprüft (visual-qa-3); Bildschirmbilder von vor F-UX2 Runde 2–8, ungeprüft | Status «freigegeben» in `test-lock.json`. (vorläufig) | **7 b** |
| 8 | Bestätigst du nach der Vorführung den Datenverlust-Schutz 5.6 (R-14.15-01, R-1-06)? | a bestätigt · b Punkte | **a** – alle Punkte nachgespielt «OK» | 14.15 erfüllt. (offen) | **8 a** |
| 9 | Misst du die Excel-Ausgangszeit Kp Wo 1 bis Gate A Etappe 2 nach Messanleitung (R-15-07)? | a ja · b andere Messweise | **a** – Massstab für 14.6 | Wert ins Freigabeprotokoll. (Beschrieb 15: vor Etappe 2) | **9 a** |
| 10 | Lieferst du den Nachlauf der Umgebungsprobe (S-6)? | a liefern (≈ 10 min) · b nicht | **a** – schliesst «nicht gemessen» | (bleibt «laut Auftraggeber») | **10 a** |
| **B Nacharbeit 14.1 und Anhang A** | | | | | |
| 11 | Bestätigst du die Änderungsliste von Anhang A Zeile für Zeile: 50 Zeilen (16 verdeckt, 11 teilweise verdeckt, 1 Teilaufgaben, 22 durchgehende Bemerkungen; TR-2-01)? | a bestätigt · b Zeilen nennen | **a** nach Durchsicht (≈ 15 min) | R-14.1-01 ohne Vorbehalt. (Quote «unter Vorbehalt», beide Werte genannt) | **11 a** |
| 12 | KVK Mo Rapport (Test: «fehlt»): Anhang A Zeile 17 auf Spalte «Rap» ändern, Zeile 16 trägt die Planungsspalte (Q-IM2-02)? | a ja, zwei Rapporte wie Import und Quellen · b Zeilen 16/17 zu einem Rapport «Rap, Kp Kdt» zusammenlegen | **a** – die Quellen zeigen zwei Formen; Anhang und Import stimmen dann überein | a: Anhang lokal, Lock nachführen; die Nacharbeit dieses Schlüssels (in Runde 2 zu einem Objekt zusammengelegt) zurücknehmen. b: Import ändern | **12 a** |
| 13 | Wo1 Mo Marker (Test: «fehlt», Linie ohne Beschriftung unter einem Block, weder in Excel noch im PDF sichtbar): Anhang A korrigieren? | a Zeile wird erwarteter Berichtseintrag, keine Soll-Einheit · b Import legt einen Marker ohne Beschriftung an | **a** – die Art ist nicht bestimmbar, nichts erfinden; Import meldet die Linie schon (UX-AB-16) | a: Anhang lokal, Lock. (zählt als nicht erkannt) | **13 a** |
| 14 | KVK Mi und Do Marker mit Ortsangabe in der Beschriftung: Marker haben kein Ort-Feld (Beschrieb 4.6; UX-AB-14, UX-AB-F-05) – wie lösen? | a Feld «Ort» für Marker ins Modell · b Ort bleibt Teil der Beschriftung (Import übernimmt die ganze Beschriftung, Anhang A Ort → Beschriftung) · c Anhang A Ort leer, Angabe nur im Bericht | **b** – kein Modellumbau, nichts geht verloren, PDF wie Referenz | a: Stufe-A-Nachtrag (Modell, Seitenfeld, PDF, Liste). b: kleiner Import-Nachtrag, Anhang lokal. (Feldabweichung bleibt) | **14 b** |
| 15 | Nacharbeit an einem Beso setzt «geändert», der Export schreibt es ins Feld Status und verhindert 100 % (UX-AB-F-09) – wie behandeln? | a «geändert» ist Markierung, kein Status: Export und Vergleich führen den Status (bestätigt), die Markierung bleibt im Plan · b Nacharbeit endet mit «Neuen Stand setzen» | **a** – entspricht UX-AB-05 (Markierung nicht wählbar); Stand setzen gehört nicht zur Nacharbeit | a: kleiner Export-Nachtrag mit Test; Regel R-4.6-67 (Beso nach dem Stand markiert, Blöcke nicht, Q-026) bleibt. (Test rot) | **15 a** |
| 16 | Gilt die Nacharbeit, obwohl der Koordinator in Runde 2 neben den Schlüsseln kurze Prüfhinweise ohne Soll-Inhalte gab? | a gilt, offen vermerkt · b dritte Runde durch frischen ux-critic ohne Hinweise | **a** – Anhang A blieb ungeöffnet; Hinweise ohne Soll-Inhalte | b: zusätzliche Runde. (a mit Vermerk) | **16 a** |
| **C PDF und Layout** | | | | | |
| 17 | Flacher Marker soll auf der genannten Zeit **enden** (wie Referenz) statt dort beginnen (VQA-2-04, VQA-3-02)? | a enden · b beginnen (heute) | **a** – wie Referenz, keine leere Halbstunde | a: Nachtrag Layout, Katalog R-4.6-15, Golden/Liste neu. (b) | **17 a** |
| 18 | Markerfeld soll Blöcken ausweichen (Wo3 Fr ragt rund 3 pt in den Folgeblock, VQA-3-03)? | a vor dem Merge · b Etappe 2 | **a** – Überlappung widerspricht 14.3; klein | a: Nachtrag mit Test. (b) | **18 a** |
| 19 | Drei gleichzeitige Beso in drei Bahnen statt zwei (Wo2 Mo, B-Kp-64, R1-08) – so lassen? | a drei Bahnen · b zwei Bahnen mit Überlappung wie Referenz | **a** – keine Überlappung | Abweichung vermerkt. (a) | **19 a** |
| **D Bedienung** | | | | | |
| 20 | Doppelklick in leere Rap-/Beso-Spalte erzeugt 30 Min statt Zeitpunkt – «2: ja» so bestätigt (SA-2-02)? | a 30 Min · b Zeitpunkt | **a** – so umgesetzt; Rapporte und Beso haben meist eine Dauer | a: Katalog R-5.1-06/-07, Test mit Zeitform. b: Umsetzung | **20 a** |
| 21 | Ausnahme «Kantenzone» bestätigen: Kante eines höheren Blocks vor verdecktem Marker; äusserer Griff nur über leerer Fläche (UX-2-04, TE-FUX2-02)? | a bestätigen · b ohne Ausnahme | **a** – 0 Fehlgriffe an Kanten | (a vorläufig) | **21 a** |
| 22 | Legende «Leitung Kp» (wie Referenz), Felder «Ltg Kp» beibehalten (TE-FUX2-01)? | a beibehalten · b überall «Ltg Kp» | **a** – Legende wie Referenz | b: Tests per lock-update. (a) | **22 a** |
| 23 | Tippen auf einen gewählten Block startet die Bearbeitung und ersetzt den Text (wie Excel), statt dass N/B/R/Q/M/G einen neuen Eintrag anlegen (TE-FUX2-03, UX-AB-17)? | a Tippen ersetzt (heute, gesperrter Test) · b Einzeltasten als Befehle (UI-Richtlinie 13.3) | **a** – passt zur Direktbearbeitung im Block und zu Excel; Einzeltasten bleiben am leeren Zellzeiger | a: UI-Richtlinie 13.3 nachführen. b: Test-Einwand, Umsetzung | **23 a** |
| 24 | Pfeile und Shift+Pfeile verschieben bzw. vergrössern schon in Etappe 1, Ctrl+←/→ am Zellzeiger wechselt den Tag – Katalog R-6-27 so anpassen (HT-03, HT-04)? | a anpassen · b zurücknehmen | **a** – Rückmeldung Handhabung I2 | a: Katalog-Notiz. b: Rücknahme | **24 a** |
| 25 | Ctrl+Plus/Minus/0 zoomen im Raster das Raster, sonst Browser – so lassen (SA-2-12)? | a so lassen · b immer Browser, Raster mit −/+/0 | **a** – Raster bleibt PDF-treu | (a) | **25 a** |
| **E Stand und Daten** | | | | | |
| 26 | «Gesetzter Stand nicht rückgängig» als Abweichung von Beschrieb 5.6 Punkt 6 und Leitplanke 5 bestätigen (SA-2-05)? | a bestätigt · b wieder rückgängig | **a** – Rückweg über Punkt «vor Stand» | (a vorläufig) | **26 a** |
| 27 | An Import oder «Ersetzen» gekoppelte Stände bleiben mit dem Schritt rückgängig machbar (Q-FUX1-01)? | a ja (heute) · b auch dort Grenze | **a** | (a) | **27 a** |
| 28 | Durch «Ersetzen» ausgeblendeter Stand nur über den Punkt «vor Ersetzen» zurückholbar, solange dieser behalten wird (mindestens 30 Punkte; CR-D-2-01)? | a annehmen · b dauerhafte Aufbewahrung (Etappe 2) | **a** – Datenverlust behoben, Rest selten | (a) | **28 a** |
| 29 | Aufbewahrte Spaltensätze werden nach dem Neuladen nicht mehr automatisch aufgeräumt (Folge CR-5-03) – so lassen? | a so lassen (Entfernen in den Plan-Einstellungen mit Rückfrage) · b dauerhafte Kennzeichnung im Plan (Formatänderung, Etappe 2) | **a** – kein Datenverlust, nur ungenutzte Sätze | b: Nachtrag Etappe 2. (a) | **29 a** |
| **F Plan, Prüfart, Qualität** | | | | | |
| 30 | Planänderungen nach Gate A zur Kenntnis (nur Umhängen auf Härtungspakete, keine ID entfällt; Liste unten)? | a ja · b Einwand | **a** | – | **30 a** |
| 31 | R-5.6-18 und R-L-10 bis zu einer Prüfnaht als Integration statt E2E (FD-01)? | a annehmen · b Prüfnaht jetzt | **a** – App mit Format 1 kann kein älteres Format erzeugen | Prüfnaht Etappe 2. (a vorläufig) | **31 a** |
| 32 | Messarten: R-11-11 als Hauptthread-Zeit je Bild (HT-08), R-11-17 im Entwicklungsserver mit echter Mappe (SA-2-11)? | a annehmen · b andere Messung | **a** – Bildabstand misst nur die Bildwiederholrate; Einzeldatei darf die echte Mappe nicht enthalten | (a vorläufig) | **32 a** |
| 33 | E2E-Belegläufe nur exklusiv; Vitest-Zeitgrenze global 5 s, Hängerschutz 120 s nur einzeln mit Beleg (FL-07, FL-06)? | a so · b global anheben | **a** – keine stille Lockerung | (a) | **33 a** |
| 34 | Abdeckung: `src/pages` (0 %, WapPage nur in der Einzeldatei geladen) und `tools/wap` (14,7 %, Bau-Skripte) – wie behandeln? | a beide aus der Pfadmenge «übriger Code» · b beide messen bzw. testen · c `tools/wap` heraus (Bauwerkzeug, belegt durch Build und check:release), `pages` messen (Quellzuordnung der Einzeldatei) | **c** – Bau-Skripte sind kein ausgelieferter Code; WapPage ist Produkt | a/c: Änderung der Pfadmenge mit deiner Zustimmung (Prompt §7). (V2 rot) | **34 c** |
| 35 | Abdeckungsrückstand list 65,3 %, panel 61,6 %, settings 59 %, wap-persons 71,1 % (Schwelle 75 %): Tests in der nächsten Iteration, vor dem Merge? | a ja, Schwelle bleibt · b jetzt vor Gate B | **a** – Iterationsvorgehen; Schwelle wird nicht gesenkt | V2 bleibt bis dahin rot; Merge erst grün. (blockierend) | **35 a** |
| 36 | Statische Mutanten ungewertet (`ignoreStatic`, FT-M-02)? | a ja, Liste im Bericht · b mitzählen | **a** – sonst vielfache Laufzeit | (a vorläufig) | **36 a** |
| 37 | Datenschutz-Scan: Tokenizer-Sonderformen (CR-E101-P08) Restrisiko bis Etappe 2, dann standardtreue Zerlegung (parse5, MIT)? | a Restrisiko · b jetzt beheben | **a** – nur an Bau-Ausgabeorten, fail-closed | neue Abhängigkeit in Etappe 2 vorlegen. (offen) | **37 a** |
| **G Fragen** | | | | | |
| 38 | «Einrücken soll die Abstufungen zulassen» (Q-041): Teilaufgaben wie Referenz ohne Einzug genügen? | a genügt · b Einzugsstufen · c gestaffelte Einrücken-Blöcke | **a** – Referenz zeigt keinen Einzug | b/c: Etappe 2. (a) | **38 a** |
| 39 | Gibst du die Bedeutungen der Rapportkürzel KR, ARK und BR 0–3 an (Q-045 d)? | a ja (Text) · b leer lassen | **a** – Kürzelliste vollständig | (leer) | **39 a** |
| 40 | Sammelentscheid Arbeitsannahmen Q-038, Q-039, Q-040, Q-045 (a–c, e–h), Q-046 bis Q-050, Q-052, Q-054, Q-HL-02, Q-IM2-01, FD-06 («16 : 0900 X, 1000 Y» = ein Zeitfenster, «unsicher»); Q-029 nach Etappe 4? | a annehmen · b einzeln ändern | **a** – so umgesetzt und getestet | Annahmen werden Regeln. (bleiben Annahmen) | **40 a** |
| **H Weiteres Vorgehen** | | | | | |
| 41 | Kandidaten für Etappe 2 aus der Nacharbeit: Listenspalten Zusatz, Tn, Tpt, Tenue, Notiz (UX-AB-06, -F-03); «Bemerkung und Beso zusammenführen» (UX-AB-08); Import-Dialog (UX-AB-09, -F-08); Gruppierung «Kästchen > 15 Min» und Kantengruppen mit Zeit (UX-AB-12, -F-10); Rapport in Rap- und Planungsspalte melden (UX-AB-F-06); Spalten-Zelle wählbar (UX-AB-F-07)? | a Etappe 2 · b jetzt | **a** – Nacharbeit gelang ohne sie | Plan Etappe 2. (offen) | **41 a** |
| 42 | In der nächsten Iteration beheben: Fokus springt in der Liste bei Einträgen anderer Wochen, Eingabe geht ohne Rückmeldung verloren (UX-AB-F-01); widersprüchliche nächste Schritte im Importbericht (UX-AB-F-02); «Spalten …» schliesst nicht mit Esc (UX-AB-F-04)? | a nächste Iteration · b Etappe 2 | **a** – F-01 verliert Eingaben, F-02 führt zu Doppelungen | a: Nachtrag mit Tests. (offen) | **42 a** |
| 43 | Übrige nicht blockierende Befunde nach Etappe 2: F-LAYOUT2-A3, -A4, R1-13, R1-16, UX-H-N2 Rest, TR-H-14, FT-G-03, FL-05, CR-3-05 (Liste unten)? | a wie vorgeschlagen · b einzelne jetzt | **a** – keine Regel verletzt, kein Datenverlust | Plan Etappe 2. (offen) | **43 a** |

**Liste zu 30 (Planänderungen nach Gate A, Prompt §5.4):** R-4.6-61 (E1-13a) und R-8.2-44 (E1-07b) → F-FIX; R-4.6-67 (E1-03b), R-5.6-18, R-6-39, R-L-09, R-L-10 (E1-11), R-11-11 (E1-13a) → F-DOKU; R-11-17 (E1-08) → F-IMPORT2; R-H-16, -17, -23 (E1-01e), R-H-20 (E1-01d) → F-TOOLS; R-H-32, -36, -37 → Etappe 2 (H-TESTS, ohne Entscheid) und zurück → F-TOOLS (SA-2-03); R-10-47 bis -49 (E1-02i) → H-LAYOUT; R-5-02, R-5.1-04, -06, -07, -09, R-6-27, R-8.2-21, R-L-06 → H-TESTS; neu R-5.1-26 bis -29, R-5.2-11, -12 (F-UX2). Belege: Änderungsnotizen am Ende von `plan/etappe-1.md`.

**Liste zu 43:** Dauer des flachen Markers im Seitenfeld (F-LAYOUT2-A3); `statusRendering` aus dem Typ (F-LAYOUT2-A4); senkrechte Textrichtung aus dem Excel (R1-13); Unterschriftblock und Wappen nach Import aus Stammdaten (R1-16, mit FW-02); P1-Marke nach Tageswechsel, Querbalken-Name nach Verlängern (UX-H-N2); CSS-Lokatoren in E2E (TR-H-14); Render-Kette «bildschirm» automatisch prüfen (FT-G-03); Leistungsmessung im E2E lastfest (FL-05); Wochenseite je Änderung neu gelegt, 7 ms (CR-3-05).

## Zahlen Soll / Ist

| Grösse | Soll | Ist (a8e2f1d) |
| --- | --- | --- |
| Schleuse | grün | F1–F10, V1-vitest, V1a-gate, V1a-harness, V2-e2e grün; rot V1a-selbsttest (Zeitlimit 2 h), V2-abdeckung (6 Module), V3-referenz (nur R-14.1-02); V5–V8 nicht gelaufen |
| Importquote 14.1 automatisch | ≥ 95 % | 98,3 % (411/418) |
| 14.1 nach Nacharbeit KVK + Wo 1 | 100 % | 229/231 (99,1 %) + 2 Feldabweichungen, an Entscheide 12–15 gebunden |
| Nacharbeit Aktionen | 3 je Abweichung | Runde 1: 9 (Soll 6); Runde 2: 30 (22 ohne Klärung, Soll 18) |
| Rückfälle echte Wochen | Liste bestätigt | 18 (vorher 27) |
| Leistung | Budgets Beschrieb 11 | alle erfüllt (R-11-11 p95 12,99 ms, Import 6,0 s, Woche-PDF 0,07 s); V7 am Schluss |
| Abdeckung Fachlogik / übriger Code | 90 % / 75 % je Modul | 92,6 % / rot in list, panel, settings, wap-persons, pages, tools/wap |
| Mutationsscore | 80 % | Teilmessungen 88,1 % bzw. 55,5 %; voll am Schluss |
| Kriterien Auftraggeber Teil (b) | 6 bestätigt | 0 – an diesem Gate (Entscheide 2, 8, 11; R-14-04 zur Kenntnis) |
| Offene Befunde nach Stufe | 0 blockierend | ‹Zählskript über FINDINGS.md›; bekannt offen blockierend: R1-01/R1-02 (→ 3), CR-E101-P08 (→ 37) |

## Top-5-Risiken

1. **Schluss-Gate noch offen:** Selbsttest hängt über 2 h, Golden, Leistung und Mutation nicht gelaufen – Gegenmassnahme: Entscheid 1, Merge nur grün; Ursache des Selbsttest-Hängers zuerst klären.
2. **Abdeckung übriger Code in 6 Modulen unter 75 %** – Gegenmassnahme 34, 35.
3. **Unabhängigkeit 14.1:** Anhang A vom Umsetzer angepasst (TR-2-01), Prüfhinweise in Runde 2 – Gegenmassnahme 11, 16.
4. **Ungeprüfte letzte Runden** (F-UX2 Runde 4–8, F-FIX Runde 6, F-FLAKY) und Prüfstand ohne Runde 8/6 – Gegenmassnahme frische Prüfer vor dem Merge.
5. **Bildschirm-Golden und Rückfall-Zählung** beruhen auf älteren Ständen (d703e08, 79bf4d5) – Gegenmassnahme 7 b, Zählung am Schluss.

---

## Anhang 1 – Abweichungen vom Beschrieb mit Entscheid-Beleg (Stand nach Gate B, 28.10.2026)

| Abweichung | Stelle | Entscheid (Beleg) | Stand |
| --- | --- | --- | --- |
| Bat-Referenz V3 statt V2 | Beschrieb 14.8, 15; Prompt §8 | Q-001, 30.09.2026 | Etappe 3 |
| Import-Regel 4 gruppiert, einzeln ab > 4 Min | Beschrieb 8.2 Regel 4 | Gate 0 Entscheid 7b, Q-006 | umgesetzt |
| 14.5 «sofern im massgebenden Excel», «alle Wochen mit Box» | Beschrieb 14.5 | Gate 0, Q-011 N-05/N-09 | umgesetzt |
| Tablet liest das PDF | Beschrieb 11 | Gate 0 Entscheid 1 (G-7 a) | umgesetzt |
| Rückfälle als bestätigte Liste | Beschrieb 14.3 | Q-032, Gate S S-2 A; Gate B 28.10.2026, Nr 3 a (18 echte), 4 a (Fixture 4) | bestätigt |
| Rapportrahmen dünn | Beschrieb 10; B-F-04 | Gate S A3 | umgesetzt |
| Statusrot #c00000 | Referenz B-Kp-100 | Gate S S-3 a | umgesetzt |
| Köpfe zuerst waagrecht bis 4,5 pt | R-10-54 (Wortlaut «zuerst senkrecht») | AE-006 «2 a» | umgesetzt; Katalog R-10-54 nachgeführt (GB-DOKU) |
| Kopfzeile wächst je Woche | R-10-54, B-Kp-10 | «11: ja» | umgesetzt |
| Nebenspalte Gewicht 2 | Beschrieb 4.4, B-Kp-37 | «12: ja»; Gate B 28.10.2026, Nr 5 a, 6 a | umgesetzt |
| Rapport-Ort neben dem Kästchen | Beschrieb 10 | «13: ja» | umgesetzt |
| Flacher Marker = Block mit Dauer | R-4.6-15 | «14: ja»; Gate B 28.10.2026, Nr 17 a (endet auf der Zeit) | Lage GB-LAYOUT |
| Feldwert «offen» rot | B-Kp-99 | «1: ja» | umgesetzt |
| Standard-Kategorie je Spalte | Beschrieb 4.7 | «15: ja» | umgesetzt |
| Woche löschen ohne Dialog | R-5.2-05 | «10: a» | umgesetzt |
| Stand nicht rückgängig | Beschrieb 5.6 Pkt 6; Leitplanke 5 | «Stand: ja»; Gate B 28.10.2026, Nr 26 a | bestätigt |
| Doppelklick 30 Min | R-5.1-06, -07 | «2: ja»; Gate B 28.10.2026, Nr 20 a | Katalog R-5.1-06/-07 nachgeführt, Test mit Zeitform |
| Wochenziele nur sichtbarer Teil | Beschrieb 4.2, 8.2 Regel 8 | «9: ja»; Gate B 28.10.2026, Nr 40 a (Q-IM2-01 als Regel) | umgesetzt |
| Anhang A angepasst | Beschrieb 14 (Einzelbestätigung) | «3/4/5: ja»; Gate B 28.10.2026, Nr 11 a (Änderungsliste bestätigt), 12 a, 13 a, 14 b | Zeilen 12–14 lokal (GB-IMPORT) |
| Editor-Raster = PDF-Seite | Leitplanke 2 | «Bildschirm: ja» | umgesetzt |
| Marker ohne Ort-Feld, Ort in der Beschriftung | Beschrieb 4.6 (Lücke) | Gate B 28.10.2026, Nr 14 b | Ort bleibt Teil der Beschriftung (Umsetzung GB-IMPORT) |
| Beso ohne Kategorie («keine») | Beschrieb 4.6 Feldtabelle (optional) | Koordinator (UX-AB-15) | umgesetzt, keine Abweichung |
| Tippen ersetzt statt Einzeltasten | UI-Richtlinie 13.3 | Gate B 28.10.2026, Nr 23 a (TE-FUX2-03) | UI-Richtlinie 13.3 nachgeführt |
| Pfeiltasten verschieben in Etappe 1 | R-6-27 (Gate-0-Auslegung) | Gate B 28.10.2026, Nr 24 a (HT-03, HT-04) | Katalog R-6-27 nachgeführt |
| Teilaufgaben ohne Einzug | Gate S A1 | Gate B 28.10.2026, Nr 38 a (Q-041) | genügt; Einzugsstufen nicht verlangt |
| Kantenzone vor verdecktem Marker | R-5.1-26 | Koordinator; Gate B 28.10.2026, Nr 21 a | bestätigt |
| Drei Bahnen | B-Kp-64 | Gate B 28.10.2026, Nr 19 a (R1-08) | so belassen |
| Prüfart R-5.6-18, R-L-10 | Katalog | Gate B 28.10.2026, Nr 31 a (FD-01) | Integration bis zur Prüfnaht (Etappe 2) |
| Messart R-11-11, R-11-17 | Prompt §7 | Gate B 28.10.2026, Nr 32 a (HT-08, SA-2-11) | bestätigt |
| Zoom im Raster | UI-Richtlinie 4.1 | Gate B 28.10.2026, Nr 25 a (SA-2-12) | bestätigt |
| Selbsttest und Mutation erst am Schluss statt am Gate B | Prompt §5.3 Punkt 2, §6 | Gate B 28.10.2026, Nr 1 a; Entscheid 26.10.2026 «Volles Gate entfällt für Etappe 1» | ab Etappe 2 |
| R-H-32/-36/-37 zeitweise nach Etappe 2 | Prompt §5.4 | zurückgenommen (SA-2-03) | erledigt; → 30 |
| Marker immer über alle Planungsspalten | Beschrieb 4.6 Marker | Auftraggeber 21.10.2026 (Freigabeprotokoll) | umgesetzt F-UX3 (FUX3-04) |
| Gesetzter Stand an Import/«Ersetzen» gekoppelt rückgängig | ADR-006 2a, 2e | Gate B 28.10.2026, Nr 27 a (Q-FUX1-01) | bestätigt |
| Ausgeblendeter Stand nach «Ersetzen» nur über Punkt «vor Ersetzen» | Beschrieb 5.6 | Gate B 28.10.2026, Nr 28 a (CR-D-2-01) | bestätigt |
| Aufbewahrte Spaltensätze nach Neuladen nicht automatisch aufgeräumt | Beschrieb 5.2 | Gate B 28.10.2026, Nr 29 a (CR-5-03) | bestätigt |
| E2E-Belegläufe exklusiv; Vitest 5 s global, 120 s nur einzeln | Prompt §7 | Gate B 28.10.2026, Nr 33 a (FL-06, FL-07) | bestätigt |
| Statische Mutanten ungewertet | Prompt §7 Mutation | Gate B 28.10.2026, Nr 36 a (FT-M-02) | bestätigt |
| Datenschutz-Scan Tokenizer-Sonderformen | Prompt §7 Datenschutz-Scan | Gate B 28.10.2026, Nr 37 a (CR-E101-P08) | Restrisiko bis Etappe 2 |
| FA-07 abgesetzte Markerlinie nach der Beschriftung datiert | Normalisierung 5.3 | – | erledigt durch R-8.2-44 (FD-03), Quote 98,3 %; keine Abweichung mehr |

Beschrieb 15 «Vorgabe bis zum Entscheid» gilt weiter (Klassifizierung leer, Einrasten 15 / Eingabe 5 Min, Unterschrift als Bild aus, neutrale Kategorie nicht in der Legende, 5 / 5,5 / 4,5 pt, Umbruch an Wortgrenzen).

## Anhang 2 – Geänderte gesperrte Tests (Schlussrunde, Lock-Protokoll 20./21.10.2026)

Nur Änderungen an bereits gesperrten Tests, Fixtures und Golden-Bildern; Aufnahmen neuer Testdateien und die additiven Registrierungen in `scripts/wap-gate/testpfade.json` («ja dauerhaft», 13.10.2026) sind nicht einzeln aufgeführt.

| Commit | Gesperrte Dateien | Grund | Entscheid / Prüfung |
| --- | --- | --- | --- |
| cd21877 | `tests/wap-e2e/i2/support/ablauf.ts`, `i2c/support/ablauf.ts`, `i3/support/ablauf.ts`, `i5/support/ablauf.ts`, `i5/ablauf.dist.spec.ts`, `list/liste.spec.ts` | «PDF dieser Woche» und Ctrl+P zeigen zuerst die Befunde (TE-I5-01); i5 zusätzlich Stand nicht rückgängig | «6: ja», «Stand: ja»; test-reviewer-2: gedeckt |
| cd21877, 0e73354 | `tests/wap-e2e/support/fixtures.ts` | Konsolentext aufzeichnen; E2E-Abdeckung | «B3: b», Koordinator; test-reviewer-2: keine Lockerung |
| cd21877 | `tests/wap/reference/import/kp.ref.ts`, `tests/wap/support/anhang-compare/compare.ts`, `tests/wap/reference/required-files.json`, `reference-lock.json` | angepasster Anhang A (Q-042 bis Q-044) | «3/4/5: ja»; Orakel → 11 |
| 5788784 | `tests/wap/unit/model/plan-factory.test.ts`, `commands/entries-create.test.ts` | Standard-Kategorie je Spalte | «15: ja» |
| 20565ac | `tests/wap/pdf/page/b-kp/pruefer.ts`, `tests/wap/support/page/analyse.ts` | «offen» rot; rote Durchstreichung | «1: ja» |
| 21c6621 | `tests/wap/unit/grid/rapport.test.ts`, `e1-02l/beschriftung.test.ts` | Ort neben dem Kästchen | «13: ja» |
| 18b429f | `tests/wap/unit/h-tests/spaltenkopf-ereignisse.test.ts` | längeres Wort, Erwartung gleich | «11: ja» |
| 9b5aa2b, 7e6a5b6 | `grid/geometry`, `grid/raster`, `grid/beso`, `pdf/page/b-kp/pruefer.ts`, `pdf/page/raster`, `pdf/page/eintraege`, `pdf/page/seite`, `pdf/h-layout/teilaufgaben`, `unit/page/nachtrag-s318`, `wap-e2e/h-layout/teilaufgaben.spec.ts` | Nebenspalte Gewicht 2; KVK-Rückfallliste 6 → 4 | «12: ja»; Liste → 4 |
| a201b77 | `tests/wap/unit/f-abdeckung/einstellungen.test.ts` | ID korrigiert vor dem ersten Commit | – |
| 1c53f4f | `tests/wap-gate/reference-runner.gate.ts` | Positivfall nur mit der Probedatei (TE-FT-01) | Koordinator; test-reviewer-2 bestätigt |
| f4d9f09 | `tests/wap-gate/config-f-tools.gate.ts`, `mutation.selbsttest.ts`, `tests/wap-e2e/support/vite-e2e.config.ts` | Stryker-Läufer korrigiert; HMR in E2E aus | «7: ja», Koordinator |
| a5fbe5e | `tests/wap-e2e/f-ux2/support/paritaet.ts` | TE-I5-01 nach Merge | «6: ja» |
| 9b6ef29 bis 736d041 | `tests/wap/unit/f-abdeckung/` `import-blatt`, `einstellungen`, `import-mappe`, `import-termine-marker`, `formtext-termine`, `import-sonderfaelle` | `[FA-nn]` vom Ist auf das Soll (FA-01 bis FA-08) | Koordinator; test-reviewer-2: gedeckt |
| 5da6891, 8f129fd | `tests/wap-e2e/f-ux2/support/plaene.ts` | Fixtures angehängt | – |
| a415919, 8af58ff | `tests/wap/golden/manifest.json`, `baselines/synth-woche-1-s1.png` | Golden-Erstaufnahme «vorläufig»; synth-woche-1-s1 neu | visual-qa-3: übernehmen → 7 |
| ced5f0e | `tests/wap/integration/stand/setNewStand.test.ts` | zweiter Stand nach Wiederherstellen V2 (TR-2-09, F-47) | test-reviewer-2: Test war falsch |
| ced5f0e | `tests/wap/unit/f-abdeckung/import-termine-marker.test.ts`, `tests/wap/unit/f-doku/import-grenzen.test.ts` | FA-07-Einschränkung entfällt nach FD-03 | Koordinator; strenger |
| 79bf4d5 | `tests/wap/unit/f-ux2/runde3.test.ts` | äusserer Griff nur über leerer Fläche (TE-FUX2-02) | Koordinator; code-reviewer-4: nicht aufgeweicht → 21 |
| 2c326ed, ead7954 | `plan-datei-lesen`, `pdf/page/farbkennung`, `property/page/farbkennung`, `pdf/plan/gesamt-pdf`, `pdf/plan/s6-produkt`, `h-daten/personen-zip`, `i2b/sichern`, `text/gen-font-metrics` | Zeitlimit 120 s als Hängerschutz; 50-MB-Fixture über node:zlib (FL-01, FL-02) | Koordinator; code-reviewer-5: keine Prüfung gelockert → 33 |
| 79bf4d5 | `wap-e2e/h-ui2/support/anzeige.ts`, `suite.ts`, `i5/support/ablauf.ts`, `i5/ablauf.dist.spec.ts`, `i2c/support/ablauf.ts`, `playwright.wap.config.ts` | `test.setTimeout(120_000)` (FL-03); globale Vorbereitung (FL-04) | Koordinator; code-reviewer-5: keine Lockerung |
| 9f19fed, e9e8484 | `tests/wap/reference/abnahme/nacharbeit.ref.ts` | E1-AB: Test-Review TR-AB-01/02; alle Schlüssel melden | Koordinator |
| 2c94173 | `docs/wap-planer/plan/vertraege/E1-01i.md`, `tests/wap-gate/v1a-wiederverwendung-i.gate.ts` | FT-F2-01: bytegleich zum Stand vor der Rücknahme wieder gesperrt | Koordinator; code-reviewer-5: Hash belegt |
| fd271e8, acb0195 | `tests/wap/unit/f-abdeckung/formtext-termine.test.ts` | F-FIX Runde 5 UX-AB-01 (Funktion kein Zweifelsfall); Runde 6 CR-5-01 (Text vor der Namensklammer bleibt) | Koordinator; Verifikation ausstehend |
| 8e57f1c | `tests/wap/unit/f-abdeckung/import-blatt.test.ts` | Meldetext Linie ohne Beschriftung (UX-AB-16) | Koordinator |
| acb0195 | `tests/wap/unit/f-fix/bericht.test.ts` | Ort nur in `notTakenText` (CR-5-04) | Koordinator; Verifikation ausstehend |
| 78a32d3 | `tests/wap-e2e/f-ux2/support/runde7.ts` | Entf in Typ/Tag löscht nicht mehr, nur Ctrl+Entf (CR-5-05) | Koordinator; Verifikation ausstehend |

Gesperrte Werkzeugdateien, entsperrt und wieder gesperrt («7: ja» bzw. Koordinator): `scripts/wap-gate/gate.mjs`, `selftest.mjs`, `coverage-check.mjs`, `license-check.mjs`, `golden-report.mjs`, `trace.mjs`, `mutation.mjs`, `privacy-deep.mjs`, `suite-allowlist.json`, `lib/vite-server.mjs`, `stryker.wap.conf.mjs`, `vitest.wap.config.ts`. Schwellen (`coverage-schwellen.json`, Budgets, Baseline, Toleranzen) unverändert.

## Anhang 3 – Ausblick Funktionswünsche

| ID | Wunsch (20.10.2026) | Vorschlag | Offene Fragen |
| --- | --- | --- | --- |
| FW-01 | Tages-PDF («Büchlein»): je Tag ein PDF mit dem ganzen Tag inkl. Zeitachse | Etappe 2, mit Quick Win «Zug-Auszug» (gleiche Layout-Schicht und PDF-Schreiber); grob 1–2 Tage | Format (A4 hoch, A5 hoch, A4 quer)? Termine auf derselben Seite? Teile der Seitenleiste? Sammel-PDF? Massstab? |
| FW-02 | Export Tages-WAP und Tagesbefehl verbunden | Etappe 4 (Beschrieb 9.2), nach FW-01 und Zusammenführung der Stammdaten | Reihenfolge? Ein PDF oder zwei Dateien? Auslösung aus welchem Werkzeug? |

Aufnahme in eine Etappe entscheidest du an Gate A der jeweiligen Etappe (`funktionswuensche.md`).
