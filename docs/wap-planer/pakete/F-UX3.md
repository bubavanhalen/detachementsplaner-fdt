# F-UX3 – Paketzweig `wap/f-ux3` (Bewegung und Rückmeldung im Raster)

- Etappe: 1 (vor Gate B).
- Anforderungen:
- Hinweis: Die Tests tragen nur IDs bereits eingefrorener Pakete (R-5.1-28 Auffüllen mit Änderungsnotiz F-UX3; R-5.1-14
  und R-11-11 Leistung beim Ziehen; R-6-13, R-6-15, R-11-07 für UX-AB-F-01/-F-04); keine Neuzuordnung im Etappenplan.
- Bezug: Rückmeldung des Auftraggebers beim Prüfen von a8e2f1d (21.10.2026): ABV beim Auffüllen, «teils
  unnatürlich», mehr Animation beim Verschieben, Shift/Alt deutlich. Änderung des Auftrags (Koordinator 21.10.2026):
  Resize und Drag & Drop sind ein grosses Thema («extrem performant und extrem schön»); jetzt Punkt 1 und die
  technischen Grundlagen, die Optik (Animationen, Hervorhebungen) erst nach Wahl einer Prototyp-Variante des
  ui-designers.
- Gestaltung: `docs/wap-planer/ui/bewegung-v1.md` (Schritt 0; Optikteil vorläufig bis zur Wahl).
- Zweig ab `wap-codex` a8e2f1d, Worktree `C:\Users\phili\source\repos\wap-wt\f-ux3`.

## Stufe 1 (umgesetzt)

| Punkt | Stand | Umsetzung |
| --- | --- | --- |
| 1 Auffüllen hält an Markern | umgesetzt | Doppelklick auf die Kante und Ctrl+Shift+↑/↓ (`fillTarget`) halten auch an AV, ABV, HV und freien Markern; seit Stufe 2 an jedem Marker des Tags (Marker gelten über alle Planungsspalten). Änderungsnotiz zu R-5.1-28. |
| Grundlage Ebene | umgesetzt | Angehobener Block: Grösse einmal je Geste, danach nur `transform` (translate3d, bei der Kante scale) auf eigener Ebene (`will-change`, `contain: strict`); Vorschaurahmen nur über `transform`; Zeitschild am Zeiger über `transform` statt left/top; keine Übergänge mehr auf Layout-Eigenschaften (`is-adjusting`). |
| Grundlage Takt | umgesetzt | Zeigerereignisse (pointermove, pointerrawupdate) nur merken; Treffer, Einrasten und Vorschau je Bild einmal (requestAnimationFrame); Loslassen verwirft ein ausstehendes Bild und rechnet mit der letzten Lage. |
| Grundlage Zusatztasten | umgesetzt | Shift/Alt/Ctrl als Zustand der Geste mit Ereignis beim Drücken und Loslassen (`modifierStore`); sofortige Neubewertung ohne Mausbewegung; Zeitschild trägt `data-mode` (adjust/shift/none), Ansage in der Statusregion «Ziehmodus»; Hervorhebungsklassen `is-shift-follow` / `is-parallel` als Haken für die gewählte Optik (noch ohne endgültige Gestaltung). |
| 4 UX-AB-F-01 | behoben | Importbericht stiehlt den Fokus nicht mehr, wenn er nach einem Wochenwechsel aus der Liste neu gezeichnet wird; Tippen ersetzt die Zelle. |
| 4 UX-AB-F-04 | behoben | Esc schliesst das Aufklappfeld «Spalten …» (auf dem Knopf und im Feld). |
| 2, 3 Optik | offen | Animationen (Einrasten, Einschwingen, Nachbarn gleiten, Esc, Undo/Redo) und Hervorhebung von Shift/Alt nach der gewählten Prototyp-Variante. |

## Messung (Entwurf `tests/wap-perf/f-ux3/bewegung.perf.ts`)

Szene F-DOKU (1000 Einträge), je 2 s. Werte des Laufs auf diesem Stand (Rechner mit fremdem Browser im Hintergrund,
daher nur Richtwerte):

| Geste | p95 Hauptthread je Bild ungedrosselt | gedrosselt | längste Aufgabe | Eingabe-zu-Bild (p95) |
| --- | --- | --- | --- | --- |
| Verschieben | 5,84 ms (≤ 8) | 12,32 ms (≤ 16,7) | 17,37 ms (≤ 50) | 0,91 Bild |
| Kante unten | 4,80 ms | 14,44 ms | 16,28 ms | 0,88 Bild |

Der gesperrte F-DOKU-Leistungstest R-11-11 (gedrosselt) schwankte im selben Zeitraum auch auf der Basis a8e2f1d über
das Budget (18,8 ms); die endgültige Messung ist auf ruhigem Rechner zu wiederholen.

Tests (eingefroren, Grund «F-UX3»): `tests/wap/unit/f-ux3/auffuellen.test.ts` (2), `tests/wap-e2e/f-ux3/bewegung*`
(3), `tests/wap-e2e/f-ux3/bedienung.spec.ts` (2, nur Entwicklungsserver); Leistungsentwurf
`tests/wap-perf/f-ux3/bewegung.perf.ts`. Rot gegen a8e2f1d, danach grün.

## Stufe 2: Marker immer über alle Planungsspalten (Entscheid Auftraggeber 21.10.2026)

«Marker sollen per se immer über alle Det-Spalten gehen.» Änderungsnotiz F-UX3 in `requirements.md`; Befund FUX3-04.

| Punkt | Umsetzung |
| --- | --- |
| Anlegen | Menü «Marker …» (M), Rechtsklick und Dialog «Neuer Marker» speichern immer «alle» (`MARKER_COLUMNS`); der Dialog sagt «Der Marker gilt über alle Planungsspalten des Tags.» Bausteine (R-6-22) sind Etappe 2 und übernehmen dieselbe Regel. |
| Seitenfeld, Liste | Keine Spaltenwahl für Marker; Hinweis «Spalten: alle Planungsspalten»; Liste «alle», nicht änderbar, Hinweis im `title`. |
| Bestehende Pläne | Gespeicherte Einzelspalten bleiben in der Datei unverändert und wirken nirgends (Zeichnung, P1, Liste, Spaltenverschiebung, Zeigerlage). Gewählt, weil kleiner und verlustfrei: keine Migration beim Öffnen, kein neues Formatfeld, kein stilles Umschreiben; ein Rückweg hätte die Daten noch. |
| Import | Marker immer «alle»; die zugeordnete Linie bestimmt weiter die Zeit (R-8.2-44). |
| Bildschirm und PDF | Linie über alle Planungsspalten (Läufe zwischen Rap/Beso wie bisher je Lauf); Auffüllen hält an jedem Marker des Tags. |

Tests (eingefroren, Grund «F-UX3»): `tests/wap/unit/f-ux3/marker-alle-spalten.test.ts` (6; 5 rot gegen cc7988f,
der Schutztest «verlustfrei» schon grün), `tests/wap-e2e/f-ux3/marker.spec.ts` und `marker.dist.spec.ts` mit
`support/marker.ts` (4, rot gegen cc7988f). Nachgeführte gesperrte Tests: 38 in 13 Dateien (Liste in FINDINGS
«F-UX3»).

Prüfungen Stufe 2: Unit 2750 grün; E2E Entwicklungsserver 256 grün, 1 Lastschwankung
(`h-tests/verschieben.spec.ts` Rand-Rollen, einzeln 3 × grün); Einzeldatei F-UX3 7 grün. `npm run test:reference`:
Kp-Import 411/418 (98,3 %), gleich wie cc7988f (Marker 38/39, die fehlende Einheit hängt nicht an den Spalten);
R-14.1-02 (Nacharbeit) rot wie auf der Basis – der Test vergleicht nur die lokale Nacharbeitsdatei mit dem
angepassten Anhang A (2 Einheiten: KVK|Mo|Rapport, Wo1|Mo|Marker), unabhängig vom Code. Anhang A: 39 Marker-Zeilen,
alle schon «alle» (keine Nachführung nötig); Abgleich-Kandidat: 2 Marker-Zeilen mit Einzelspalten (Nachtrag zur
Änderungsliste vorgeschlagen, nicht geändert).

## Stufe 3: Manipulation ohne vorheriges Wählen (Grundlage; Rückmeldung Auftraggeber 21.10.2026)

«Ich mag nicht, dass ich einen Block zuerst anwählen muss, bevor ich diesen manipulieren kann.» Änderungsnotiz zu
R-5.1-27; Befund FUX3-05. Die gestalteten Griffe (Icon bzw. Layout an der Kante) kommen mit der Prototyp-Variante.

| Punkt | Umsetzung |
| --- | --- |
| Ohne Wählen | Drücken trifft, wählt und zieht in einem: Verschieben, Kante oben/unten und neu seitlich an jedem Block. |
| Zonen | Seitlich 6 px innen ab 24 px Breite; schmale Blöcke 4 px aussen über leerer Fläche (nähere Kante, bei Gleichstand der gewählte); oben/unten 8/4 px, unter 12 px ein Drittel der Höhe. Die Auswahl ändert keine Zone. Vorrang R-5.1-26 samt Ausnahme Kantenzone unverändert. |
| Mauszeiger | je Zone (grab, ns-resize, ew-resize) wie bisher, nun auch an nicht gewählten Blöcken. |
| Zustand «über» | `hoverStore` je Eintrag und Zone, Ereignis nur bei Wechsel: `data-hover` am Eintrag, `i2-hover` am Raster (`detail`: Schlüssel, ID, Fenster, Zone) – Haken für die Griff-Elemente. |
| Leistung | Überfahren höchstens einmal je Bild (erste Bewegung sofort, weitere am nächsten Bildbeginn mit der letzten Lage); Lage von Raster und Tagen zwischengespeichert (verworfen bei Rollen, Grösse, Ansichten, Verlassen des Tags); Hervorhebungsrahmen nur bei geänderter Lage geschrieben. Gemessen (E2E): 12 Mausbewegungen in derselben Zone → 0 Lageabfragen, 0 Stilschreibungen (vorher 36 bzw. 12). |
| Klick | Klick ohne Bewegung wählt und fokussiert wie bisher (Tastatur, Mehrfachauswahl, Direktbearbeitung unverändert). |

Tests (eingefroren, Grund «F-UX3»): `tests/wap/unit/f-ux3/zonen-ohne-auswahl.test.ts` (6, rot gegen 01bd218),
`tests/wap-e2e/f-ux3/ueberfahren.spec.ts` und `ueberfahren.dist.spec.ts` mit `support/ueberfahren.ts` (3, rot gegen
01bd218). Nachgeführt: 5 gesperrte Tests in 3 Dateien (FINDINGS «F-UX3»). Leistungsentwurf ergänzt um «Überfahren
ohne Drücken» (`tests/wap-perf/f-ux3/bewegung.perf.ts`, nicht eingefroren).

Messung Stufe 3 (Entwurf, Szene F-DOKU, gleicher Lauf nacheinander; Rechner mit fremden Browsern, Bildabstand rund
33 ms, daher Richtwerte):

| Geste | Stand | p95 ungedrosselt | p95 gedrosselt | längste Aufgabe | Eingabe-zu-Bild |
| --- | --- | --- | --- | --- | --- |
| Überfahren | 01bd218 | 7,14 ms | 17,71 ms (über 16,7) | 23,15 ms | – |
| Überfahren | Stufe 3 | 5,62 ms | 14,37 ms | 14,04 ms | – |
| Verschieben | Stufe 3 | 5,27 ms | 12,68 ms | 15,95 ms | 0,91 Bild |
| Kante unten | Stufe 3 | 4,53 ms | 14,51 ms | 16,86 ms | 0,91 Bild |

## Runde 3: Gestaltung endgültig (Entscheid Auftraggeber 21.10.2026 «1: a / 2: a / 3: a / 4: a / 5: a»)

Grundlage: Prototyp und Varianten des ui-designers (`.qa/f-ux3/varianten.md`, `prototyp-ziehen.html`, nur lokal).
Gestaltung `ui/bewegung-v1.md` (jetzt endgültig, mit den bewussten Abweichungen von `raster-bedienung-v2.md` §2);
Änderungsnotiz «Runde 3» in `requirements.md`; Befunde FUX3-06 bis -08.

| Entscheid | Umsetzung |
| --- | --- |
| 1a Variante B + Aufleuchten aus C | Angehobener Block rastet ein und gleitet 110 ms (Abbild des Blocks beim Verschieben; beim Ändern der Grösse Fläche per `scale` mit vier eigenen Kanten), Anheben 1,015, Schatten, Leuchtrahmen in der Modusfarbe; Original als Umriss 45 %; Nachbarn gleiten 180 ms (FLIP), Esc 200 ms, Einschwingen 180 ms. Shift/Alt: Rahmen mit Glanz um das Raster, Plakette am Zeitschild mit Anzahl, Nachbarn mit Rahmen und Plakette («+30 Min», «dockt an»). `prefers-reduced-motion`: ohne Bewegung. |
| 2a Andocken | `arrangeBlocks` gibt `dock` zurück; freie Kante hält am nächsten Block derselben Spalten an, mit Alt darüber. |
| 3a Shift beim Drücken | Auswahlrahmen auch auf einem Eintrag; Shift während des Ziehens = Folgende mitschieben. |
| 4a Shift bis Tagesende | unverändert (Variante c), Anzahl in der Plakette. |
| 5a Pille | Griffe an den Kanten des überfahrenen Blocks (oben/unten ab 80 px rechts, Seiten ab 60 × 30 px), Marker-Zeitgriff auf der Linie, Hover-Zustand mit Schatten, Marker-Band; Trefferfläche Griff + 3 px. |
| Befunde Designer | Loslassen mit Lage und Tasten des Loslassens; nur der angehobene Block mit eigener Ebene; Rolllage in der Geste selbst geführt (keine Layout-Lesung); Modusfarbe nur an den Marken; Detail beim Überfahren in eigenem Speicher (FUX3-08). |

Bilder für den Auftraggeber (fiktiver Plan, nur lokal): `.qa/f-ux3/bilder-umsetzung/` – `1-hover-block.png`,
`2-hover-kante.png`, `3-ziehen-standard.png`, `4-ziehen-shift.png`, `5-ziehen-alt.png`, `6-kante-dockt-an.png`,
`6b-kante-nachbar-angepasst.png`, `7-kante-shift.png`, `8-marker-hover.png`, `9-marker-ziehen.png`.

Tests (eingefroren, Grund «F-UX3 Runde 3»): `tests/wap/unit/f-ux3/runde3.test.ts` (10; 8 rot gegen 9df7d07, die
Schutztests «Alt darüber» und «Shift bis Tagesende» schon grün), `tests/wap-e2e/f-ux3/runde3.spec.ts` und
`runde3.dist.spec.ts` mit `support/runde3.ts` (6, alle rot gegen 9df7d07). Leistungsentwurf
`tests/wap-perf/f-ux3/bewegung-frei.perf.ts` (nicht eingefroren). Nachgeführte gesperrte Tests: FINDINGS «F-UX3».

Messung Runde 3 ohne Bildratenbegrenzung (Herstellungszeit je Bild wie der Designer: Edge mit
`--disable-gpu-vsync --disable-frame-rate-limit`, Fenster ausserhalb des Bildschirms; Szene F-DOKU mit 1000 Einträgen;
Rechner mit fremden Browsern, zwei Läufe; Rohwerte `.qa/f-ux3/messwerte-umsetzung-frei.json`):

| Geste | p95 ungedrosselt (≤ 8) | p95 gedrosselt (≤ 16,7) | Aufgaben > 50 ms | längste Aufgabe |
| --- | --- | --- | --- | --- |
| Verschieben | 1,7–3,2 ms | 6,1–13,4 ms | 0 | – |
| Kante | 2,3–3,0 ms | 6,0–8,5 ms | 0 | – |
| Überfahren (Median) | 0,4–0,7 ms | 4,7–16,8 ms | 0 | – |

Beim Überfahren ändert sich das Bild nur bei einem Wechsel von Eintrag oder Zone; dazwischen liefert der Browser den
60-Hz-Ersatztakt (~17 ms, wie im Prototyp bei «Spalten» und «Marker»), daher der Median. Vergleich 9df7d07 im selben
Zeitraum: Verschieben 1,4–1,5 / 5,0–5,7 ms (ohne Gleiten, weniger Bilder), Kante und Überfahren nur Ersatztakt (18 ms).
Gemessen mit Bildtakt (Ablaufverfolgung, `bewegung.perf.ts`): Verschieben p95 6,9 / 13,5 ms, Kante 7,1 / 23,2 ms,
Überfahren 8,9 / 21,7 ms – auf diesem Rechner schwankend; Eingabe-zu-Bild 0,87–0,88 Bild. Der gesperrte Test I2b A3
(gedrosselt) schwankt auf 9df7d07 gleich (16,7–23,5 ms).

## Runde 4: Shift/Alt sofort, Shift alle darunter, ohne Taste nie überlappen (Rückmeldung Auftraggeber zu e1598a3)

«perf is good, but when selecting shift or alt it takes to loong … with shift, it only moves items that are equal
width, but it should move all items below. And with normal drag, it should not overlap …» Änderungsnotiz «Runde 4» in
`requirements.md`; `ui/bewegung-v1.md` «Nachbarn» und «Shift und Alt»; Befunde FUX3-09 bis -11.

| Punkt | Umsetzung |
| --- | --- |
| 1 Shift/Alt sofort | Ursache gemessen: keydown→Bild im DOM schon vorher 17–31 ms (≤ 1 Bild bei 32,7 ms Bildabstand); sichtbar zu spät waren Einblenden der Plakette (180 ms) und der Nachbar-Markierung (160 ms) und das Gleiten von Nachbarn und angehobenem Block beim Moduswechsel (180/110 ms). Jetzt springt die Vorschau beim Moduswechsel, kein Einblenden, Farbübergang 50 ms; gemessen 4–27 ms bis zum Bild, 1–2 Bildaufrufe (`test-results/wap/f-ux3-taste-*.json`). Fokuswechsel löst die Taste. 3a präzisiert: Shift beim Drücken auf einem Eintrag + Ziehen = sofort mitschieben (Klick = Bereich), auf leerer Fläche = Rahmen. |
| 2 Shift alle darunter | `arrangeBlocks` (Kante): alle Einträge unter dem Block mit überschneidenden Spalten um die Differenz, transitiv über Überdeckung, bis Tagesende; (Verschieben) Folgendes so weit nötig je Spalte. Mit: Blöcke, Rapporte in Planungsspalten, Beso-Kästchen in Planungs-/Nebenspalten (`shifts`); Marker nie. |
| 3 Nie überlappen | Gemeinsame Kante wandert zusammen (Nachbar ≥ 15 Min, sonst Halt mit «Nachbar mind. 15 Min · Shift = mitschieben»); freie Kante dockt an und wird zur gemeinsamen Kante; Verschieben: ganz Überdecktes bzw. Rest < 15 Min rückt direkt unter das Ziel («rückt +1 h»), Folgendes gleicher Spalten mit; anders breite Blöcke bleiben Ausnahmen (Beschrieb 4.6). Nur Alt überlappt. |
| 4 Vorschau | Plaketten «−30 Min» (schrumpft), «+1 h» (Shift), «rückt +1 h», «dockt an», «geteilt»; Zeitschild ««…» schrumpft · −30 Min»; nach dem Loslassen stehen alle Nachbarn sofort an der Endlage (laufendes Gleiten wird abgebrochen); ein Undo-Schritt. |

Bilder (fiktiver Plan, nur lokal) `.qa/f-ux3/bilder-runde4/`: `1-gemeinsame-kante-schrumpft.png`,
`2-grenze-shift-hinweis.png`, `3-shift-alle-darunter.png`, `4-verschieben-verdraengt.png`, `5-alt-parallel.png`.

Messung ohne Bildratenbegrenzung (zwei Läufe, `.qa/f-ux3/messwerte-runde4-frei-1.json`, `-2.json`): Verschieben p95
1,8 / 6,0–6,2 ms, Kante 2,8–3,4 / 7,2–7,6 ms, Überfahren Median 0,5–0,9 / 9,6–16,8 ms (Ersatztakt), keine Aufgabe
> 50 ms.

Tests (eingefroren, Grund «F-UX3 Runde 4»): `tests/wap/unit/f-ux3/runde4.test.ts` (7; 6 rot gegen e1598a3, «nur Alt
überlappt» schon grün), `tests/wap-e2e/f-ux3/runde4.spec.ts` und `runde4.dist.spec.ts` mit `support/runde4.ts` (4, alle
rot gegen e1598a3). Nachgeführt: FINDINGS «F-UX3» (FUX3-09 bis -11).

## Runde 5: Code-Review (`.qa/haertung/code-reviewer-fux3.md`, Auftrag Koordinator 23.10.2026)

Zuerst `wap-codex` 6fca39d (Freigabeprotokoll) eingeführt. Befunde CR-F3-01 bis -05 behoben (FINDINGS «F-UX3»):
Grenze am Tagesende für Verdrängen und Mitschieben (Vorschau hält an, Hinweis, Ablegen ohne Fehler, Pfeiltasten mit
Meldung); Block über Mitternacht mit Shift; Mehrfachauswahl mit Shift nimmt Beso-Kästchen und Rapporte mit;
Rapporte in Planungsspalten ohne Taste wie Blöcke, Beso-Kästchen bleiben (Entscheid Koordinator); Lagen für das
Überfahren bei Rasterverschiebung neu (ResizeObserver).

Tests (eingefroren, Grund «F-UX3 Runde 5»): `tests/wap/unit/f-ux3/runde5.test.ts` (7, alle rot gegen 4375de1),
`tests/wap-e2e/f-ux3/runde5.spec.ts` und `runde5.dist.spec.ts` mit `support/runde5.ts` (2, rot gegen 4375de1).
Nachgeführt (gesperrt, Grund «Code-Review F-UX3 CR-F3-04, Entscheid Koordinator 23.10.2026»):
`tests/wap/unit/f-ux3/runde4.test.ts` (1: obere Kante dockt am Rapport an, statt ihn zu überdecken).

## Zusatz zu Runde 5: Bedienungsprüfung ux-critic (`.qa/haertung/ux-critic-fux3.md`, Urteil «fühlt sich gut an: ja» mit Auflage)

| Befund | Umsetzung |
| --- | --- |
| UX-FUX3-01 (mittel, Auflage vor der Vorführung): Titel springt beim Kantenzug auf 10 px oben links | Der angehobene Block trägt beim Kantenzug ein Abbild der gezeichneten Zeilen (Layout-Schicht, gleiche Schrift und Lage) in eigener Textebene; nur Fläche und Kanten folgen per `scale`. Die Textebene steht an der Lage beim Greifen (innerer Teil gleitet gegenläufig zum Block, gleiche Dauer und Kurve) und ist auf die neue Fläche beschnitten; rückt die Oberkante nach innen, wandert sie mit. Einmal je Geste geklont, je Rasterschritt nur `transform` und Grösse der Hülle, keine Layout-Lesung. Das Layout der neuen Höhe folgt nach dem Loslassen (wie bei den Nachbarn, `preview.ts`). |
| UX-FUX3-02 (mittel): Unterkante ohne Taste über 2400 in den Folgetag | Die Kante hält in jeder Betriebsart (ohne Taste, Shift, Alt) bei 2400 bzw. 0000, Plakette «Tagesende 2400 · über Mitternacht: Zeit eingeben (Z)». Begründung: Beschrieb 5.1 und UI-Richtlinie 5.6 «Tagesgrenze» (R-5.1-16 bis -19) regeln das **Verschieben** auf einen anderen Tag, nicht die Kante. Einträge über Mitternacht sind gültig (R-4.5-10, Hinweis P14), entstünden beim Kantenzug aber unsichtbar ausserhalb des Rasters. Darum über Mitternacht nur per Eingabe (Seitenfeld, Z). Ein Block, der schon über Mitternacht reicht, behält seine Grenze von 24 h. |
| UX-FUX3-03 (niedrig): Shift-Mitschieben am Tagesende ohne Hinweis | Seit Runde 5 (CR-F3-01) zeigt die Plakette «⇧ Shift · Folgende reichen über Tagesende · Alt = parallel». Der Test ist rot gegen fcf7767 (geprüfter Stand) und grün ab f8f76a2. |
| UX-FUX3-04 (niedrig): Klick in die unteren 12 px beendet die Direktbearbeitung | Während der Bearbeitung deckt die Schreibfläche den ganzen Block. Die Kantenzonen wirken dann nicht, ein Klick setzt die Schreibmarke. Ziehen über den Block hinaus verschiebt wie bisher; die Grösse ändert man nach der Bearbeitung. |
| UX-FUX3-05 (niedrig): vergrösserte Pille verdeckt den 15-Min-Nachbarn samt Plakette; Plaketten 10 px | Die gegriffene Pille liegt beim Ziehen innen an der Kante im gezogenen Block (bei kleinem Block höchstens mittig). Plaketten haben 11 px und stehen an kurzen Blöcken (< 30 px) mittig. |
| UX-FUX3-06 (niedrig): bei 50 % landet die Kante einen Schritt daneben | Kanten folgen dem Zeiger relativ zur Greiflage (Kante plus Zeigerweg, dann aufs Raster); der Abstand beim Greifen wird nicht gerundet. |

Tests (eingefroren, Grund «F-UX3 Zusatz Runde 5»): `tests/wap-e2e/f-ux3/zusatz5.spec.ts` und `zusatz5.dist.spec.ts`
mit `support/zusatz5.ts` (6; 5 rot gegen f8f76a2, alle 6 rot gegen fcf7767). Bilder (fiktiv, nur lokal) unter
`.qa/f-ux3/bilder-zusatz5/`: `01-ruhe.png`, `02-unten-plus45.png`, `03-unten-minus45.png`, `04-oben-minus45.png`,
`05-grenze.png`.
