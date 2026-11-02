# WAP-Planer – Zwischenstand I1 (06.10.2026)

Nicht blockierender Zwischenstand nach AE-001 §3. Er zeigt den Durchstich «PDF-Seite» mit dem **fiktiven synthetischen Plan** (keine echten Daten). Deine Rückmeldung fliesst ins nächste Inkrement; die Arbeit läuft bis Gate S weiter.

## Öffnen

- Einzeldatei (lokal, nicht versioniert): `C:\Users\phili\source\repos\detachementsplaner-fdt\.qa\e1-02f\gate-s\zwischenstand\wap-planer-zwischenstand-i1.html` (SHA-256 beginnt mit `422d8809d7675eed`). Doppelklick öffnet sie in Edge; sie läuft ohne Netz, speichert nichts im Browser und sendet nichts.
- Neu bauen (gleiche Datei): `npm run wap:einzeldatei -- --entry tests/wap-e2e/harness/zwischenstand-i1.tsx --out <Ziel>.html --titel "WAP-Planer – Zwischenstand I1"`.
- Warum nicht versioniert: Der eingebettete Lizenzblock enthält wörtlich zwei E-Mail-Adressen aus Lizenztexten Dritter; der Datenschutz-Scan lässt sie unter `docs/` (zu Recht) nicht zu. Entscheid an Gate S (Q-037).

## Was neu ist

- Wochenseite im Bildschirm und als PDF aus **einer** Layoutquelle (Parität gemessen: höchstens 0,008 pt Abweichung, Texte und Grössen gleich).
- Seitenkomposition Kp: Kopf, Raster mit Tagen und Spalten, Einträge (Blöcke, Beso, Marker, Querbalken), Seitenleiste (Ziele, Bemerkungen, Legende, Unterschrift), Terminbereich, Fortsetzungsseiten.
- PDF dieser Woche und PDF aller Wochen (ein Dokument, Wochen in Planreihenfolge), lokaler Download.
- Schriftgrössen 5 / 5,5 / 4,5 pt; Rückfallregel mit gekürzten Texten («…») und weggelassenen Zeilen, wenn der Platz nicht reicht.

## Bekannte Lücken

- Noch keine Bearbeitung: Die Seite zeigt nur an (Erfassen, Speichern, Import kommen ab I2).
- Der synthetische Plan ist ein **Belastungsplan** (rund 1000 Einträge) und erzeugt absichtlich viele Rückfälle (723 über vier Wochen). Viele «…» und gekürzte Blöcke sind dort kein Fehler.
- Statusrot im Raster, Leitung geteilt, A3 und Unterschriftsbild folgen mit E1-10.
- Zoom nur 100 / 150 / 200 / 300 %; der Zoom der App kommt mit E1-11.

## Probierliste (≤ 15 Minuten)

1. Datei öffnen: Überschrift «WAP-Planer – Zwischenstand I1», Hinweis «Fiktiver Plan …», Woche «KVK KW 40», Zoom 200 %.
2. Zoom auf 100 % und 300 % stellen: Seite bleibt scharf, Text bleibt markierbar.
3. Woche auf «Wo1 KW 41» bis «Wo3 KW 43» wechseln: jede Woche erscheint, Fortsetzungsseiten folgen darunter.
4. «PDF dieser Woche»: Download «WAP-Planer_Zwischenstand_I1_KVK.pdf», Rückmeldung «PDF erstellt: …».
5. PDF in Edge öffnen, auf 400 % zoomen: Linien und Schrift scharf, Text markierbar und suchbar.
6. «PDF aller Wochen»: ein Dokument mit allen vier Wochen in Planreihenfolge.
7. Bildschirm und PDF derselben Woche nebeneinander: gleiche Lage der Texte und Linien.
8. Netz trennen (Flugmodus) und Seite neu laden: alles funktioniert weiter.
9. Rückmeldung: Was stört beim Lesen der Seite am meisten?

## Bildschirmfotos (fiktiver Plan)

- `i1-start-zoom200-fenster.png`, `i1-start-zoom200-ganz.png` – Start bei 200 %
- `i1-woche1-zoom100-ganz.png` … `i1-woche4-zoom100-ganz.png` – Wochen 1–4 bei 100 %
- `i1-woche1-zoom300-fenster.png` – Woche 1 bei 300 %
