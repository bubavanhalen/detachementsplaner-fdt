# F-LAYOUT2 – Schlussrunde Layout vor Gate B (Schnellspur AE-005/AE-006)

- Etappe: 1 (Härtungsrunde, Schlussrunde)
- Anforderungen: (keine eigenen; die Tests tragen IDs eingefrorener Pakete: R-4.4-03, R-4.4-13, R-4.7-11, R-4.7-12, R-4.9-19, R-7-11, R-7-13, R-10-27, R-10-29, R-10-31, R-10-41, R-10-54, R-10-55)
- Zweig `wap/f-layout2` ab `wap-codex` cd21877, Worktree `C:\Users\phili\source\repos\wap-wt\f-layout2`.
- Grundlage: Entscheide des Auftraggebers vom 19.10.2026 (Freigabeprotokoll in `PROGRESS.md`, wörtlich «11: ja / 12: ja / 13: ja / 14: ja / 1: ja / 8: ja / 15: ja»); Q-HL-01, Q-HL-03, TE-I3-01, UX-H-14/TE-HUI2-01, HT-02; Beschrieb 4.4, 4.6, 4.7, 10; ADR-004.

| Punkt | Stand | Umsetzung |
| --- | --- | --- |
| 12 Nebenspalte Gewicht 2 | ja | `columnWeight` Nebenspalte 2 (bewusste Abweichung von Beschrieb 4.4, B-Kp-37; Änderungsnotizen Katalog R-4.4-13 und ADR-004). Folgen: Planungsspalten an Tagen mit Nebenspalte schmaler (KVK Mo/Di: «Zfhr» senkrecht, «Rap» senkrecht in 5 pt); KVK-Rückfallliste 6 → 4 (e39, e50 fassen die Ltg) – neue Fassung zur Bestätigung an Gate B. Gesperrte Tests nachgeführt (nur breitenabhängige Erwartungen): grid/geometry, grid/raster, grid/beso, b-kp/pruefer (B-Kp-28/-31/-37/-43/-66 über das Gewicht und Träger-Ausnahme), pdf/page/raster, pdf/page/eintraege, pdf/page/seite, pdf/h-layout/teilaufgaben, unit/page/nachtrag-s318 (F-LAYOUT2-08 bis -16), wap-e2e/h-layout/teilaufgaben.spec.ts (F-LAYOUT2-17). Anhang B-Kp und reference-lock unverändert. |
| 11 Kopfzeile wächst | ja | Ragt an einem Tag ein Spaltenkopf in Standardhöhe aus dem Kopfbereich (bisher ins Band, E1-02l R1), wächst die Spaltenkopfzeile der ganzen Woche einheitlich in 0,25-pt-Schritten, bis dort jeder Kopf ganz in seiner Spalte steht (ohne zeichenweisen Notumbruch); höchstens um den Unterschied der Kopfhöhen B-Kp-10 (senkrecht − waagrecht ≈ 19,5 pt). Rasterrahmen, Seite und Termine bleiben, das Raster beginnt tiefer (`pageFrame(…, template)`, `headHeight.ts`). Nicht erreichbar → Tag bleibt bei R1 mit Befund. Gesperrter Test nachgeführt: h-tests/spaltenkopf-ereignisse.test.ts (längeres Wort, Erwartung unverändert, F-LAYOUT2-07). Bildschirm: übernimmt die Höhe, sobald er `pageFrame` mit Vorlage verwendet (F-UX2). |
| 13 Ort neben dem Kästchen | ja | Passt «(‹Ort›)» nicht ins Rapport-Kästchen, steht er vollständig daneben im freien Bereich des Tages (Träger wie E1-02l R2, nie über einer Blockfläche); P8 `lineDropped` «ort» nur, wenn dort kein Platz ist. Steht das Kürzel nach R2 daneben, kommt der Ort in denselben Träger («Kürzel (Ort)»), wenn Platz ist. Gesperrte Tests nachgeführt: grid/rapport.test.ts [R-4.6-21] (F-LAYOUT2-05), e1-02l/beschriftung.test.ts [R-10-55] (F-LAYOUT2-06). |
| 1 TE-I3-01 Status | ja | Status-Darstellung nur nach `showStatus` (Beschrieb 10, R-10-27 bis R-10-29, R-10-31); der Schalter `statusRendering` wirkt nicht mehr (Feld nur noch als veraltet angenommen, weil Oberfläche und eingefrorene Testhilfen ihn setzen). Gesperrte Prüfungen nachgeführt: B-Kp-99 (Feldwert «offen» rot, pruefer.ts, F-LAYOUT2-03), H8 (c) rote Durchstreichung eines roten Laufs (analyse.ts, F-LAYOUT2-04). |
| 15 Standard-Kategorie | ja | Kp-Vorlage: Standard-Kategorie je Planungsspalte aus der Funktionsliste («Kp Kdt» → Ltg Kp, «Zfhr» → Ltg Zfhr, übrige leer); neuer Block ohne Standard und ohne zuletzt verwendete → «Ltg Kp» (V-03-1 für Blöcke revidiert). Keine neue Datenablage. Gesperrte Tests nachgeführt: plan-factory (F-LAYOUT2-01), entries-create (F-LAYOUT2-02); Änderungsnotizen E1-02a P-6, E1-03 §2a. |
| 14 flacher Marker | ja (geprüft) | Bereits mit H-LAYOUT umgesetzt: Block ab dem Zeitpunkt mit Dauer `flatBlockMinutes` (Vorgabe 30 Min), Beschriftung im Block, Hindernis für Felder anderer Marker (tests/wap/unit/h-layout/marker-flach.test.ts, tests/wap/pdf/i5/ergaenzungen.test.ts). Echte Wochen: 10 flache Marker ohne Rückfall; Gate-B-Bild lokal `.qa/gate-b/rueckfaelle-liste.md` (Abschnitt «Punkt 14», Ausschnitte `.qa/gate-b/flacher-marker/`). Offen: Dauer im Seitenfeld nicht einstellbar (F-LAYOUT2-A3). |
| 8 Rückfälle echte Wochen | ja | Neu gezählt (Import der echten Mappe, renderWeekPdf, nur lokal): vorher (cd21877) KVK 5, Wo1 6, Wo2 13, Wo3 3 = 27; nachher KVK 8, Wo1 4, Wo2 6, Wo3 2 = 20. Liste mit Ausschnitten (links Referenz, rechts WAP-Planer) lokal `.qa/gate-b/rueckfaelle-liste.md`. KVK +3 durch «12: ja» (schmalere Rap-Spalte Mo/Di, F-LAYOUT2-A2). |
| HT-02 P17 | ja | «Nummernkreis voll» nur bei vollem Kreis; sonst Ursache «keine Nummer, obwohl … frei» und nächster Schritt «Tag neu nummerieren». |

- [x] 1 Worktree angelegt, `npm ci`
- [x] 6 Neue Tests eingefroren per lock-update mit Grund «F-LAYOUT2» (6 Dateien unter tests/wap/unit/f-layout2/); Testpfade additiv registriert (5788784)
- [x] 7 Umsetzung nach Schnellspur AE-005/AE-006, je Punkt Test vorher rot (Belege lokal `.qa/f-layout2/rot-*.txt`); Commits 5788784, 20565ac, 21c6621, 18b429f, 9b5aa2b, 8803873

## Runde 2 (20.10.2026, nach visual-qa-2, Auftrag Koordinator)

Basis `wap-codex` 5da6891 (vorgespult). Bericht lokal `.qa/haertung/visual-qa-2.md`.

| Befund | Stand | Umsetzung |
| --- | --- | --- |
| VQA-2-03 Beso-Nummer über fremdem Kästchen | behoben | Beschriftungen neben dem Kästchen suchen zuerst eine freie Lage unmittelbar am eigenen Kästchen (Abstand ≤ 1 Zeile, gemeinsame Projektion, an den Tagesrand geschoben). Wo2 Mo 0800: 11 darüber, 10 und 12 darunter am eigenen Kästchen. |
| VQA-2-06 Rasterlinien durch Kopf «Rap» | behoben | Jeder überlaufende Spaltenkopf (auch im Kopfbereich) erhält einen weissen Träger. |
| VQA-2-07 Rapport-Beschriftung 11 pt unter dem Kästchen | behoben | Wie VQA-2-03; finden Kürzel und Ort zusammen keinen Platz am Kästchen, das Kürzel aber allein, steht der Ort in einem eigenen Träger (freier Bereich, sonst P8). KVK Mo 2000: «Kürzel (Ort)» direkt unter dem Kästchen. |
| VQA-2-05 Rückfall-Liste | neu erzeugt | 18 Rückfälle (KVK 8, Wo1 3, Wo2 5, Wo3 2), Referenz-Ausschnitte über die Tagesspalten der Referenz (Messdaten B-Kp), alle angesehen; lokal `.qa/gate-b/rueckfaelle-liste.md`. VQA-2-04 (flacher Marker endet in der Referenz auf der Zeit) als Frage an Gate B in der Liste. |

Test `tests/wap/unit/f-layout2/beschriftung-naehe.test.ts` vorher rot (3 von 3), eingefroren (Grund «F-LAYOUT2 Runde 2»). Golden-Bild `synth-woche-1-s1` neu aufgenommen (vorläufig, F-LAYOUT2-18; übrige drei bitgleich). Commits 8af58ff, a3ff3c3.
