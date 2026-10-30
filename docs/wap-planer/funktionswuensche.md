# WAP-Planer – Funktionswünsche des Auftraggebers (nach Etappe 1)

Gesammelte Wünsche, die nicht zum Umfang von Etappe 1 gehören. Jeder Eintrag nennt den Wortlaut, die vorgeschlagene Einordnung und offene Fragen. Die Aufnahme in eine Etappe entscheidet der Auftraggeber an Gate A der jeweiligen Etappe.

## FW-01 Tages-PDF («Büchlein») – 20.10.2026

**Wortlaut:** «WAP Tagesexport oftmals führt man ein manuelles büchlien wo man de WAP nimmt und zerstückelt pro Tag, da ist aber der Zeitstrahl nur auf einem Tag drauf. Es muss möglichsein vom WAP pro Tag ein Pdf zu genererien das dne ganzen Tag beinhaltet inkl. dem Zeitstrahl der sonst nur am Montag sichatbar ist»

**Inhalt:** Pro Tag ein PDF (bzw. eine Seite im Sammel-PDF) mit dem ganzen Tag: Tageskopf (Wochentag, Datum, KW), Spaltenköpfe, alle Einträge des Tages (Blöcke, Rapporte, Beso-Kästchen, Marker, Querbalken des Tages), **Zeitachse am Tag** (heute nur links am Montag und rechts am Sonntag, Beschrieb 4.5), die Terminzeilen des Tages und die Kopfangaben (Einheit, Stand).

**Einordnung (Vorschlag):** Etappe 2, zusammen mit dem Quick Win «Zug-Auszug» (Beschrieb 6: PDF nur mit einer Spalte) – beide sind Ausschnitte derselben Layout-Schicht und teilen PDF-Schreiber, Dateinamen nach Konvention und Stand-Logik. Aufwand grob 1–2 Tage inkl. Tests.

**Offene Fragen:** Format (A4 hoch, A5 hoch für das Büchlein, oder A4 quer)? Termine des Tages auf derselben Seite? Teile der Seitenleiste (Wochenziele, Legende, Sonnenzeiten) mitdrucken? Mehrere Tage als ein Sammel-PDF mit einer Seite je Tag? Massstab gleich wie im Wochen-PDF oder auf die Seite vergrössert (bessere Lesbarkeit)?

## FW-02 Export Tages-WAP + Tagesbefehl – 20.10.2026

**Wortlaut:** «Anschliessend nächstes Feature ist der Export welcher den Tages WAP und dne Tagesbefehl verbindet»

**Inhalt:** Ein gemeinsamer Export je Tag: Tages-PDF (FW-01) und Tagesbefehl desselben Tages als ein Dokument bzw. abgestimmtes Paket.

**Einordnung (Vorschlag):** Etappe 4 (Anbindung Tagesbefehle, Beschrieb 9.2 «WAP-Planer → Tagesbefehle»), nach FW-01 und nach der Zusammenführung der Stammdaten (`.qa/stammdaten/`), damit Kopf, Kdt, Unterschrift und Einheit aus einer Quelle kommen.

**Offene Fragen:** Reihenfolge im Dokument (Tagesbefehl zuerst oder WAP zuerst)? Ein PDF oder zwei Dateien mit gleichem Namensstamm? Auslösung aus dem WAP-Planer, aus dem Tagesbefehl-Werkzeug oder aus beiden?

## FW-03 Fremd-WAP: WAP anderer Kompanien importieren – 28.10.2026

**Wortlaut:** «i tested it with 2 different WAP's from other companies, which might is nice to take into account now. I said in the beginning its just me, but im quite sure more will like to use this tool. one, different time scale, the other different colors and styling. We might implement a broader recognition first, and also maybe a simple config to select the colors»

**Grundlage:** Analyse `.qa/fremd/analyse.md` (lokal; zwei Arbeitsmappen anderer Kompanien unter `reference/fremd/`, Ausnahme des Auftraggebers 28.10.2026). Heute: eine Mappe wird gar nicht gelesen (Zeitachse in Zellen 0100–2400, kein Querbalken-Band, keine Spaltenköpfe, Sa/So gestapelt), die andere mit 95 Blöcken «Farbe unklar» (andere Legende, vertauschte Farben, Transparenz, Verläufe).

**Entscheide des Auftraggebers (28.10.2026):**
1. Zeitbereich aus der Mappe übernehmen; Formen nur dann als Querbalken, wenn über der ersten Stundenbeschriftung ein Band liegt – **ja**.
2. Gestapelte Tage (z.B. So unter Sa): **beim Import nachfragen** (Auswahl je Mappe).
3. Legende der Mappe (Farben und Bezeichnungen) in den Plan übernehmen, für unbekannte Farben neue Kategorien vorschlagen – **ja**.
4. Farben zuordnen **im Import-Dialog und danach in den Plan-Einstellungen**.
5. Farbvorlagen je Einheit als **lokale Datei** (Export/Import).
6. Abnahme fremder Mappen: **Zählkriterien + Sichtprüfung des Auftraggebers + kleine Stichprobe** (ein Tag, rund 20 Einträge, vom Auftraggeber bestätigt).
7. Reihenfolge: **zuerst Etappe 1 abschliessen** (Gate B, Merge nach wap-planer), dann Fremd-WAP als eigene Iteration. **Geändert 28.10.2026:** «Noe fremd-wap, after the all in one» – Fremd-WAP erst **nach** FW-04 (WK Suite als eine Anwendung).

**Aufwand (Schätzung Analyse):** Kern 10–14 Agententage, gesamt 14–19. Kp-Quote (411/418) durch test:reference geschützt.

## FW-04 WK Suite als eine Anwendung – 28.10.2026

**Wortlaut:** «After Etappe 1 and Fremd WAP, i want to refine the App as a whole. The WK Suite, so that tagesbefehl can reference WAP und person lists etc. so that it is actually One app the WK Suite, but this will come later for the specs etc»

**Einordnung:** direkt nach Etappe 1, **vor** FW-03 (Entscheid 28.10.2026 «Noe fremd-wap, after the all in one»); gemeinsam mit der Stammdaten-Zusammenführung (`.qa/stammdaten/`), FW-02 (Tages-WAP + Tagesbefehl) und Beschrieb 9 (Einbindung in die Suite). Spezifikation folgt separat.

