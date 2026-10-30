# F-PERF – Paketzweig `wap/f-perf` (Ziehen im Belastungstest, Befund FL2-04)

- Etappe: 1 (vor Gate B).
- Anforderungen:
- Hinweis: Keine neuen Tests; Beleg ist der bestehende Test I2b A3 [R-5.1-14] (gedrosselt, Einzeldatei) und die
  volle E2E-Kette; Grenzwert 16,7 ms unverändert (R-11-11, R-5.1-14).
- Bezug: FINDINGS F-FLAKY2 «FL2-04», Auftrag Koordinator 26.10.2026.
- Zweig ab `wap-codex` a8281af, Worktree `C:\Users\phili\source\repos\wap-wt\f-perf` (npm ci).

## Profil (Edge, A3-Ablauf, Belastungstest, Drosselung 2; Mittel der 6 teuersten Bilder mit Zeigerbewegung)

Unminifizierte Einzeldatei mit CPU-Profil (Messaufwand inbegriffen); nur lokal.

| Kosten je Bild | vorher (a8281af) | nachher |
| --- | --- | --- |
| Summe Hauptthread | 21,5–29,9 ms | 13,6–14,0 ms |
| JavaScript | 10,1–12,8 ms (Raster-Render 3,0–3,4, Commit 1,3–2,2, Geste 1,4–1,9, «Mehr …» `getBoundingClientRect` mit Layout 0,7–1,1, Ansichten 1,0–1,1) | 3,3–3,8 ms (Geste 1,8–1,9, davon Anordnung 0,8–0,9; das Raster-Render ist nicht mehr unter den teuersten Bildern) |
| Ebenen aufteilen (Layerize) | 2,7–5,9 ms; dazu rund 3 ms in jedem Bild durch das Zeitschild | 3,8–3,9 ms in den teuersten Bildern, sonst um 0,8 ms |
| Layout | 2,5–3,3 ms | 1,0–1,1 ms |
| Zeichnen (Paint) | 2,1–2,5 ms | 1,1–1,4 ms |
| Stil | 1,6–2,1 ms | um 0,8 ms |

Weitere Beobachtung ohne Massnahme: Edge prüft periodisch die Fenstermitte auf Werbeeinblendungen
(`OverlayInterstitialAdDetector`, Treffertest 4–9 ms gedrosselt), unabhängig von der App.

## Änderungen (kleinste wirksame)

| Befund | Änderung |
| --- | --- |
| PERF-01 | Zeitschild folgt dem Zeiger mit CSS-Übergang 32 ms (Compositor-Animation statt Layerize je Bild); erstes Bild der Geste und das Ende ohne Gleiten (`is-jump`); bei reduzierter Bewegung ohne Übergang. |
| PERF-02 | `MoreMenu` liest die Lage nur bei offenem Menü. |
| PERF-03 | Bei Zeigerbewegung zeichnet das nächste Bild die Vorschau der Nachbarn (React), dieses Bild Schild und angehobenen Block; Shift/Alt sofort. |
| PERF-04 | Zwischenspeicher je Tag (unbetroffene Tage überspringt React ganz), stabile DOM-Reihenfolge beim Ziehen, Nachbarn/Verschiebungen/Teilstücke nach Kennung, `readingOrder` und `visibleKeys` aus den gelegten Ansichten. |

Verworfen nach Messung: Paint-Containment je Tag (Treffertests 3× schneller, aber mehr Layerize), eigene
Layout-Grenze für die Einträge, `overflow: visible` am Eintragsknopf, `pointer-events: none` beim Ziehen.

## Belege

- A3 [R-5.1-14] sechsmal hintereinander bei ruhigem Rechner (`--repeat-each 6`, edge-dist): grün.
- Gleiches Messverfahren wie A3, abwechselnd vorher/nachher (6 Paare): Belastungstest p95 vorher 17,3 · 21,7 · 19,8 ·
  13,4 · 17,2 · 24,7 ms, nachher 12,9 · 11,8 · 9,7 · 13,6 · 12,2 · 9,2 ms (6/6 ≤ 16,7; ≤ 12 in 3/6, Median 12,0; spätere
  Läufe 9,3–12,7). Realistisch vorher 5,0–7,2, nachher 4,7–9,6 ms (Summe der Arbeit je Lauf gleich: 198–266 bzw.
  183–236 ms; Unterschied im Rauschen).
- F-UX3-Leistungsentwürfe (perf-Projekt, 10 Paare abwechselnd mit der Basis, Szene F-DOKU): `bewegung.perf.ts`
  Median p95 Verschieben ungedrosselt 5,6 → 6,1, gedrosselt 10,9 → 12,0 ms; Kante ungedrosselt 6,6 → 7,0, gedrosselt
  13,1 → 14,8 ms (Streuung je Seite 4–9 bzw. 8–23 ms). Die Mediane liegen leicht höher, die Unterschiede sind kleiner
  als die Streuung; eine Variante ohne Schild-Übergang zeigte keinen Unterschied (Reihe unter Fremdlast, nur
  qualitativ). Zur Nachmessung durch ux-critic empfohlen. `bewegung-frei.perf.ts` (ohne Bildratenbegrenzung):
  Verschieben 1,4–2,3 / 5,3–11,4, Kante 3,5 / 6,2–8,6 ms, keine Aufgabe > 50 ms.
- Unit 2919 grün; `npm run wap:test:e2e` ganz grün (V4-e2e); `npm run wap:test:visual` grün (Bildschirm unverändert).
