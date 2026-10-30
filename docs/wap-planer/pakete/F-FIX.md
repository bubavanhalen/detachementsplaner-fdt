# Paket F-FIX – Behebung der Befunde FA-01 bis FA-09 (Schlussrunde vor Gate B)

- Etappe: 1 (Schlussrunde vor Gate B)
- Anforderungen: R-4.6-61, R-8.2-44 (Runde 2, umgehängt aus E1-13a bzw. E1-07b; die übrigen umgestellten Tests tragen IDs eingefrorener Pakete und die Befund-IDs FA-01 bis FA-09 bzw. FD-02, FD-03, FD-05)
- Worktree: `C:\Users\phili\source\repos\wap-wt\f-fix` · Zweig `wap/f-fix` ab `wap-codex` 9b6ef29
- Grundlage: Auftrag F-FIX des Koordinators (20.10.2026); Befunde FA-01 bis FA-09 aus F-ABDECKUNG (`FINDINGS.md`, Abschnitt «F-ABDECKUNG»); Prompt §4.2 (FA-01, FA-02, FA-06, FA-07 als blockierend eingestuft, Koordinator 20.10.2026).

Je Befund wird der `[FA-nn]`-Test, der bisher das Fehlverhalten festhielt, auf das Soll umgestellt (Rot-Nachweis vor der Behebung in `.qa/f-fix/rot-FA-nn.txt` im Haupt-Checkout), dann der Produktcode in der betroffenen Funktion behoben und der Test per lock-update mit Grund «F-FIX: FA-nn behoben (Koordinator 20.10.2026)» neu eingefroren. Nach jeder Importänderung `npm run test:reference` und Quote gegen Anhang A (nur Zahlen, lokal, Messhilfe in `spikes/f-fix/`, nicht versioniert).

- [x] 1 Paket-Worktree angelegt und installiert (`git worktree add … -b wap/f-fix wap-codex`, `npm ci`)
- [x] 6 Eingefroren: Runde 1 umgestellte F-ABDECKUNG-Tests per lock-update je Befund; Runde 2 eigene Tests `tests/wap/unit/f-fix/**` und `tests/wap-e2e/f-fix/**` (lock-update --add, Testpfad «F-FIX» additiv registriert)
- [x] 7 Umsetzung: FA-01 bis FA-09 behoben, alle Tests grün (Commits unten)
- [ ] 9 Volle Schleuse (Orchestrator)
- [ ] 10 Prüfung: frischer `code-reviewer`

## Belege

| Befund | Ursache | Änderung | Rot / Grün | Commit |
| --- | --- | --- | --- | --- |
| FA-03 | `/s+/g` statt `/\s+/g` in der Signatur planweiter Bemerkungen | `assemble.ts`: `/\s+/g` | rot «expected ['Kasse offen'] to deeply equal ['Kasse offen', 'Kase offen']» → grün | 76176a6 |
| FA-04 | gestrichener Text nach gestrichener Nummer galt nie als Inhalt, Zeit fehlte | `parseAgendaLine`: ganz gestrichene Zeile → gestrichener Text ist Inhalt des gestrichenen Eintrags | 2 Tests rot (toMatchObject status) → grün | 76176a6 |
| FA-02 | `deleteCategory` prüfte nur den Fall «zweite = gelöschte» | zweite Kategorie entfällt, wenn sie nach dem Ersatz der ersten gleich ist | rot «expected [Function] to not throw» → grün | 72adcac |
| FA-06 | `coveredColumns` mass nur die Kernbreite | ohne Kernüberlappung zählt die Spanne samt zugeschlagener Lücke | rot (6 statt 5 Spalten) → grün | ad30710 |
| FA-07 | Markerzeit stets aus dem oberen Rand der Beschriftung | Zeit der Linie, wenn sie die Beschriftung berührt oder schneidet (±2 Min); abgesetzte Linie wie bisher (Referenz-Anker 7–22 Min neben der Beschriftung, VQ-I2-01; ohne Einschränkung Quote 395/418) | 2 Tests rot (at 1260/1290) → grün; Grenzfall grün vor und nach | 029b850 |
| FA-01 | Vorausschau `(?=\s\|$)` in `TIME_LEAD` schloss «:» aus | Vorausschau `(?=\s\|:\|$)` | rot «'0830-0900: Antreten' to be 'Antreten'» → grün | 680279c |
| FA-05 | Verlauf galt als unklar, wenn die Kategorie dem Rückfall gleich war | unklar nur ohne passende Legendenfarbe | rot (1 Bericht statt 0) → grün | 736d041 |
| FA-08 | Frist ohne Uhrzeit hatte Abweichung 0 zu jedem Kästchen | Zeitfenster mit Uhrzeit innerhalb 15 Min geht vor; sonst bisherige Zuordnung | rot (Kästchen in der Frist) → grün; Grenzfall grün vor und nach | b16c28b |
| FA-09 | `?? ''`-Rückfälle auf stets gesetzte Werte, unerreichbare Zweige | `Record<FieldLabel, string>`, Werte aus dem ganzen Treffer, erstes Zeitfenster aus der geprüften führenden Zeit | 95/106 (Import-Teilmenge) → 78/78; Gesamtlauf 100 %; Differenztest alt/neu 200 000 Läufe gleich | 45e1c01 |

| Messung | Befehl | Ergebnis |
| --- | --- | --- |
| Importquote Anhang A | Messhilfe `spikes/f-fix/quote.mess.ts` (nur Zahlen), nach jeder Importänderung | vorher 406/418 (97,1 %), nach jedem Befund und am Schluss 406/418 (97,1 %); Berichtsarten unverändert |
| test:reference | `npm run test:reference -- --maxWorkers=2` mit `WAP_REFERENCE_DIR` | nach FA-03/04, -06, -07, -01, -05, -08, -09 je 19/19 grün |
| Abdeckung | `npx vitest run -c vitest.wap.config.ts --maxWorkers=2 --coverage.enabled=true`, dann `node scripts/wap-gate/coverage-check.mjs --istanbul …` | 2578 Tests grün; Pfadmenge fachlogik 92,6 % (5715/6167), alle Fachlogik-Module ≥ 90 %, agenda-text 100 % (78/78); V2 rot nur wegen Pfadmenge «uebrig» (Oberfläche, FT-A-02/F-UX2) |
| Merge wap-codex a567e36 | edd3c53 (Hook grün); Konflikt nur `FINDINGS.md` (Protokoll: Zeilen F-FIX zuerst; Abschnitt F-ABDECKUNG wieder geordnet) | Quote danach 406/418, test:reference 19/19 grün |
| Abschlusslauf | `npm run wap:test -- --maxWorkers=2` auf edd3c53 | 229 Dateien, 2602 Tests grün |

## Runde 2 (Folgeauftrag Koordinator 20.10.2026: FD-02, FD-03, FD-05/TR-2-09)

Basis: Merge wap-codex 0705565 (F-DOKU) in ced5f0e. Rot-Belege `.qa/f-fix/rot-FD-02.txt`, `rot-FD-03.txt`, `rot-FD-05.txt`.

| Befund | Ursache | Änderung | Rot / Grün | Commit |
| --- | --- | --- | --- | --- |
| FD-02 (R-4.6-61) | Verschieben bildete die Zielspalten mit `columnsBetween(erste, letzte)` und füllte die Zwischenspalte | GridEditor verschiebt jede gewählte Spalte einzeln | E2E (aus F-DOKU übernommen, Silbentrennung im Titelvergleich und 1,5-px-Toleranz ergänzt, Neuladen geprüft): 1 rot → 3 grün; Regressionslauf Verschieben/Raster 44 grün | 9448c39 |
| FD-03 (R-8.2-44 = VQ-I2-01) | `readDrawing` nahm für Formen ohne Fläche (Linien) die veraltbare xfrm der obersten Ebene statt des Zellankers | Vorstufe `src/io/xlsx-drawing/anchors.ts` (Kopie der Zeichnung, xfrm auf den Anker; zwei Zellen, eine Zelle, absolut, Vierteldrehungen), Aufruf in `workbook.ts`; Altmodul `drawing.ts` unverändert (R-L-11) | 14 rot → 16 grün (`tests/wap/unit/f-fix/linienanker.test.ts`) | 9448c39 |
| FA-07 nach FD-03 | – | Einschränkung «Linie berührt die Beschriftung» entfernt; Grenzfälle FA-07 und F-DOKU TR-2-02 auf «Zeit der Linie» umgestellt (lock-update) | Quote mit Einschränkung 409/418 (97,8 %), ohne 411/418 (98,3 %) | 9448c39 |
| FD-05 / TR-2-09 (R-5.5-03, F-47) | `applyStand` ohne Version: Plan-Stand + 1; nach Wiederherstellen vor S1 erneut V1 | `setNewStand`: ohne Version höchste sichtbare Version + 1; Eingabeprüfung weiter vor jedem Speicherzugriff (R-5.5-04) | rot «expected 1 to be 2» → grün | 9448c39 |

Planänderung: R-4.6-61 (bisher E1-13a) und R-8.2-44 (bisher E1-07b) im Etappenplan auf F-FIX umgehängt; Testpfad «F-FIX» additiv registriert. test:reference 19/19 grün.
| Abschlusslauf Runde 2 | `npm run wap:test -- --maxWorkers=2` auf 9448c39 | 240 Dateien, 2691 Tests grün |

## Runde 3 (Folgeauftrag Koordinator 20.10.2026 nach visual-qa-3 und code-reviewer-3)

Basis: Merge wap-codex 79bf4d5 in 6a5c9a7. Rot-Beleg `.qa/f-fix/rot-VQA-3-01-CR-3-04.txt` (3 rot), danach 5/5 grün (`tests/wap/unit/f-fix/linienanker-runde3.test.ts`).

| Befund | Ursache | Änderung |
| --- | --- | --- |
| VQA-3-01 (hoch, Rückschritt durch FD-03) | In der Mappe liegen neben Markerlinien drei Linien ohne Länge (Anker 1 EMU bzw. 0 breit); seit der Anker-Vorstufe liegen sie auf der Höhe der Beschriftung und wurden an Wo3 Do/Fr 0700 statt der echten Linie zugeordnet (eine Spalte statt aller) | Markerzuordnung (`sheet.ts`): Linien mit Länge höchstens 1 EMU tragen keinen Marker; bei gleicher Abweichung hat die längere Linie Vorrang. Referenz Wo3 Do/Fr 0700 wieder über alle Planungsspalten |
| CR-3-04 (niedrig) | `anchors.ts` legte jede Einzelform mit Anker der Höhe 0 auf den Anker, auch gefüllte Formen | Nur Linien (cxnSp bzw. Linien-/Verbinder-Geometrie) werden auf den Anker gelegt |
| VQA-3-02 (Info) | – | Wo3 22.10 2300 ist seit FD-03 ein Linienmarker 2300 (Linie aus dem Anker zugeordnet, Beschriftung 2230–2300 darüber); die Referenz zeigt die Linie 2300 mit dem Kästchen darüber. Zeit und Art entsprechen der Referenz; die Lage des Felds (unter statt über der Linie) ist Layout (F-LAYOUT2, VQA-2-04) |

Quote 411/418 (98,3 %) unverändert; test:reference 19/19 grün.

## Runde 4 (Folgeauftrag Koordinator 20.10.2026 nach code-reviewer-4)

Basis: Merge wap-codex 966d848 in e44f0b1. CR-4-05 (niedrig): Die Schwelle «Linie ≤ 1 EMU trägt keinen Marker» war absolut; ein unsichtbarer Rest von wenigen hundert EMU konnte gewinnen, wenn er die Zeit knapp besser traf. Jetzt zählt als Linie erst, was mindestens 10 % der schmalsten Planungsspalte des Tags lang ist; unter den Linien bis 30 Min neben der Beschriftung gewinnt die längste innerhalb von 2 Min der kleinsten Abweichung. Test `tests/wap/unit/f-fix/linienanker-runde4.test.ts`: 2 rot → 4 grün (Rot-Beleg `.qa/f-fix/rot-CR-4-05.txt`). Referenz: Quote 411/418 und alle Berichtsarten gleich wie Runde 3; Wo3-Marker unverändert (0700 an allen Tagen über alle Planungsspalten); test:reference 19/19.

## Runde 5 (Folgeauftrag Koordinator 20.10.2026 nach SA-34-Nacharbeit, Befund UX-AB-01)

Basis: Merge wap-codex 682ccd5 in fd271e8. Prüfung gegen Beschrieb 8.2 Regel 12 und normalisierung.md 5.1/5.4 (Klammer = Ort, ausser Name oder Funktion → Ltg; «Ltg: …» = Ltg; unsichere Zerlegungen in den Bericht). Ursachen (lokal an der Referenz, nur maskiert ausgewertet):

| Ursache | Änderung (`src/io/wap-import/formtext/index.ts`) |
| --- | --- |
| Eine Klammer über mehrere Läufe der Titelzeile verlor den Text der ersten Läufe (Klammertext je Lauf zurückgesetzt) | Klammertext läuft über die Läufe der Zeile weiter |
| «(Ltg: …)» bzw. «(Ort: …)» in der Klammer wurde als Ort samt Bezeichnung übernommen | `classifyParen`: «Ltg: …» → Ltg, «Ort: …» → Ort |
| Eine über mehrere Zeilen offene Klammer landete im Zusatz | Zeilen einer offenen Klammer werden zu einem Ausdruck verbunden (auch in Teilaufgaben) |
| Grad allein («Hptfw», «Four») und Funktionsbezeichnung ohne Einheit («Kdt» aus «Kp Kdt») wurden Ort | Grad allein → Ltg (sicher); letztes Wort einer Funktion der Liste → Ltg, als unsicher gemeldet |
| Titelklammern in Teilaufgaben wurden ohne Prüfung Ort | gleiche Einordnung wie in der Hauptzeile |
| Eine Zeile genau mit einer Funktion der Funktionsliste (z.B. «Einh Fw») wurde als unsicher gemeldet, obwohl richtig | unsicher nur, wenn die Listen den Namen nicht bestätigen (Grad mit Name ohne Personenliste, Teil einer Funktion) |
| Titel endete mit Leerzeichen vor einer entfernten Klammer | letzter Lauf ohne Leerraum am Ende |

Ergebnis an der Referenz (Listen-Export vorher/nachher, nur Schlüssel): 6 Einträge ändern Ltg/Ort (KVK Di 1730, Mi 1800, Do 0730; Wo1 Mo 2030, Di 0710; zusätzlich Wo3 Do 0730, gleiche Ursache «Klammer über Läufe»). Von den 7 Fällen aus SA-34: 5 jetzt richtig zerlegt (KVK Di 1730, Mi 1800, Do 0730; Wo1 Mo 2030 – zugleich als unsicher gemeldet –, Wo1 Di 0710); 1 wie bisher gemeldet und nicht geändert (Wo1 Di 0700 Rapport: Kürzel in der Schreibweise der Arbeitsmappe, Beschrieb 14 «das neuere Excel massgebend», Anhang A; eine Angleichung an die Vorlage senkte die Quote auf 410/418 und wurde verworfen); 1 weder richtig noch gemeldet (KVK Mo 0925: Personenname ohne Grad in der Klammer; ohne Personenliste nicht von einem Ort unterscheidbar – 83 von 114 Klammer-Orten der Referenz sind Einzelwörter –, der Import über die Oberfläche übergibt keine Personenliste, `usePlan.ts` `persons: []`). Meldungen «unsicher zerlegt» 8 → 4 (die 5 richtig zerlegten Funktionszeilen entfallen, «(Kdt)» kommt hinzu). Quote 411/418 unverändert; test:reference: Import- und Dauer-Tests grün, `abnahme/nacharbeit.ref.ts` rot (liest den Export der Nacharbeit, unabhängig von dieser Änderung). Tests `tests/wap/unit/f-fix/zerlegung.test.ts` (9 rot vorher, 13 grün); F-ABDECKUNG-Test «Zeile nur mit Funktion» auf «sicher» umgestellt (lock-update). Rot-Beleg `.qa/f-fix/rot-UX-AB-01.txt`. Zweigabdeckung formtext (Teilmenge Import) 92,6 %.

### Runde 5, Zusatz (SA-34-Nacharbeit Runde 2: UX-AB-14, UX-AB-16, UX-AB-08)

| Befund | Änderung (`src/io/wap-import/sheet.ts`) |
| --- | --- |
| UX-AB-14 (Ort eines Markers ging still verloren) | Marker haben kein Ort-Feld (Beschrieb 4.6), das Modell bleibt unverändert (Entscheid Auftraggeber an Gate B). Die Ortsklammer der Beschriftung wird gemeldet: «unsicher zerlegt» mit Ursache «Der Marker … nennt den Ort «…»; Marker haben kein Ort-Feld, der Ort wurde nicht übernommen.» und nächstem Schritt «Den Ort bei Bedarf in der Notiz des Markers festhalten.» Referenz: KVK Mi und Do je eine Meldung |
| UX-AB-16 (Linie ohne Beschriftung: Rat «im Raster erfassen» nicht ausführbar) | Ursache «… wurde nicht übernommen; ohne Beschriftung ist die Art des Markers nicht bestimmbar.», nächster Schritt «Die Art aus der Planung ergänzen (AV, ABV, HV oder eine freie Art mit Bezeichnung) oder die Meldung ignorieren, wenn die Linie nichts bedeutet.» |
| UX-AB-08 (Rat «in einen Beso umwandeln» führte zu falscher Nacharbeit) | Mit Kästchen derselben Nummer: «Keine Aktion nötig, wenn der Termin ganztägig gilt; das Kästchen Nr … bleibt ein eigener Beso (siehe «Kästchen ohne Termintext»).»; ohne Kästchen bleibt die bisherige Empfehlung |

Tests `tests/wap/unit/f-fix/bericht.test.ts` (3 rot vorher, 5 grün; Rot-Beleg `.qa/f-fix/rot-UX-AB-14-16-08.txt`); F-ABDECKUNG-Test «Linie ohne Beschriftung» auf den neuen Meldetext umgestellt (lock-update). Quote 411/418 unverändert; Meldungen «unsicher zerlegt» 4 → 6 (2 Marker-Orte).

## Runde 6 (Folgeauftrag Koordinator 20.10.2026 nach code-reviewer-5)

Basis: Merge wap-codex 78a32d3 in acb0195. Rot-Beleg `.qa/f-fix/rot-CR-5.txt` (9 rot), danach `tests/wap/unit/f-fix/runde6.test.ts` 9 grün.

| Befund | Ursache | Änderung |
| --- | --- | --- |
| CR-5-01 (mittel, Textverlust) | `ltgOrtOfLine` (Runde 5) gab bei einer Ltg- bzw. Namensklammer den Text davor auf; eine leere «(Ltg:)»-Klammer löschte die ganze Zeile | Text vor der Klammer bleibt Zusatz (in Teilaufgaben bei Ltg, wie übrige Zeilen); leere Klammer bzw. «(Ltg:)» ohne Wert: die Zeile bleibt als Ganzes Zusatz; «Klammer mit Name und weiterer Text» nur noch ohne «Ltg:» als unsicher. F-ABDECKUNG-Test «Gruppe …» erwartet jetzt auch «Fahrt» (vorher still verloren) |
| CR-5-02 (niedrig) | Länge = grössere Ausdehnung; eine senkrechte Linie gewann gegen die waagrechte Markerlinie | Länge quer zur Zeitachse (Breite); senkrechte Linien tragen keinen Marker |
| CR-5-04 (niedrig, CR-D-2-04) | Meldung zum Marker-Ort enthielt den Ort | Meldung «nennt einen Ort …» ohne Inhalt, der Ort nur in `notTakenText`; `bericht.test.ts` nachgeführt |

Referenz: Listen-Export aller 417 Einträge unverändert (keiner der Fälle kommt vor), Quote 411/418 und Berichtsarten wie Runde 5, Wo3-Marker unverändert; test:reference Import 18/18.

