# Soll-Listen Anhang A–C – Format und Normalisierungsregeln

Stand 02.10.2026 · Etappe 0 (Prompt §5.1 Schritt 6) · erstellt durch `spec-analyst`; nachgeführt nach dem Gate-0-Entscheid vom 02.10.2026 (Q-006 b, Q-007, Q-008 B-F-06 und B-F-10, Q-011 N-05 bis N-23; Abschnitte 12 und 13); Runde 6c: Abschnitt 6 Grenzbereich 3,6–4,4 Min und Kennzeichen an Markern als Arbeitsannahme Q-014 markiert (SA0-26)

Grundlage: Beschrieb 14 (Einleitung, 14.1, 14.2, 14.5, 14.8, 14.16), 4.6, 4.8, 8.2; Prompt §5.1 Schritt 6, §7, §8; Q-001 (Bat **V3** massgebend).

Dieses Dokument legt nur Format und Regeln fest. Die Anhänge selbst entstehen in einem eigenen Auftrag.

## 1 Ablage und Datenschutz

- **Anhänge mit echten Inhalten** liegen nur in `C:\Users\phili\source\repos\detachementsplaner-fdt\reference\anhaenge\` (nicht versioniert, Prompt §8). Dateinamen:

| Datei | Inhalt | Zeitpunkt |
| --- | --- | --- |
| `anhang-a-kp.csv` | Anhang A, bereinigt und vom Kp Kdt bestätigt | Gate 0 |
| `anhang-a-kp.instanz-1.csv`, `anhang-a-kp.instanz-2.csv` | Zwei unabhängige Erfassungen (Prompt §5.1 Schritt 6) | vor Gate 0 |
| `anhang-a-kp.abweichungen.csv` | Abgleich der zwei Instanzen mit Klärung | vor Gate 0 |
| `anhang-b-kp.csv` | PDF-Checkliste Kp mit Sollwerten | Gate 0 |
| `anhang-c-bat.csv` (+ Instanzen, Abweichungen) | Anhang C, Bat V3 | vor Gate A Etappe 3 |
| `anhang-b-bat.csv` | PDF-Checkliste Bat | vor Gate A Etappe 3 |
| `rohinventar-kp.json`, `rohinventar-bat.json` | Rohinventar der Formen (Abschnitt 9) | vor den Anhängen |

- **In `docs/wap-planer/anhaenge/`** stehen nur dieses Dokument und die Zählungen `zaehlung-a.md` bzw. `zaehlung-c.md` (Abschnitt 8): Anzahlen, keine Titel, keine Namen, keine Zeiten einzelner Einträge.
- Die Anhänge in `reference/` bleiben unpseudonymisiert, weil sie gegen den Import der Originaldatei verglichen werden (`test:reference`). Kein Inhalt daraus in Testnamen, Logs, Konsolenausgaben oder versionierte Dateien.
- Die bestätigten Anhänge werden per SHA-256 in `test-lock.json` gesperrt (Prompt §5.2 Schritt 6); Änderungen nur mit Einzelbestätigung des Kp Kdt (R-14-03).

## 2 CSV-Format (Anhang A und C)

- Kodierung UTF-8 ohne BOM, Zeilenende LF, Trennzeichen `;`.
- Anführungszeichen nach RFC 4180: Felder mit `;`, `"` oder Zeilenumbruch stehen in `"…"`, `"` wird verdoppelt. Nach der Normalisierung (Abschnitt 4) enthält kein Feld einen Zeilenumbruch.
- Kopfzeile Pflicht, genau:

```
Woche;Tag;Typ;Titel;Zeitform;von;bis;Spalten;Kategorie;Ltg;Ort;Nr;Status;Bemerkung
```

- Die ersten **13 Felder sind Pflicht und fest** (Prompt §5.1 Schritt 6). Das **14. Feld «Bemerkung»** ist ein Vorschlag (Frage N-01): es trägt Unsicherheit, Zusätze und erwartete Berichtseinträge und wird beim Vergleich nicht als Feld verglichen. Wird es abgelehnt, entfällt die Spalte, und die Bemerkungen gehen in eine Begleitdatei `…bemerkungen.csv` mit den Schlüsselfeldern Woche, Tag, Typ, von, Spalten, Nr.
- Leerer Wert = leeres Feld (kein «-», kein «null»).
- Zeilenfolge (nur für die Lesbarkeit, der Vergleich ist reihenfolgeunabhängig): Woche → Tag (Mo…So, leer zuletzt) → Typ (Querbalken, Marker, Block, Rapport, Beso, TagBemerkung, MehrtagBemerkung, Wochenziel) → von → Spalten → Nr.

## 3 Felder

| Feld | Erlaubte Werte | Regel |
| --- | --- | --- |
| **Woche** | Kurzname: `KVK`, `Wo1`, `Wo2`, `Wo3` (Beschrieb 4.2, Beispiel Beschrieb 6) | Aus dem Blatt. Die Zuordnung Blatt → Kurzname steht in `zaehlung-a.md`. |
| **Tag** | `Mo` `Di` `Mi` `Do` `Fr` `Sa` `So`; leer bei MehrtagBemerkung und Wochenziel | Querbalken: erster Tag, an dem er in dieser Woche erscheint. Beso: Tag des Termintexts. |
| **Typ** | `Block` `Querbalken` `Marker` `Rapport` `Beso` `TagBemerkung` `MehrtagBemerkung` `Wochenziel` | Abschnitt 5. `Wochenziel` nur in Anhang C (14.8). |
| **Titel** | Text nach Abschnitt 4 | Je Typ Abschnitt 5. |
| **Zeitform** | `Zeitpunkt` `von-bis` `ab` `bis` `Frist` `ganztags` `Datum` oder leer | Beschrieb 4.6 plus `ganztags` (TagBemerkung) und `Datum` (Querbalken, MehrtagBemerkung mit Zeitraum). |
| **von** | `hhmm` (4-stellig, `0000`–`2359`; `2400` nur bei Zeitform `Zeitpunkt` als Tagesende, N-12) oder `dd.mm.yyyy` (Zeitform `Datum`) oder leer | Abschnitt 6. |
| **bis** | `hhmm` (`0005`–`2400`), `dd.mm.yyyy`, `dd.mm.yyyy hhmm` (Frist mit Uhrzeit) oder leer | Abschnitt 6. |
| **Spalten** | Spaltennamen mit `\|` getrennt, von links nach rechts; `alle`; `Rap`; `Beso` | Abschnitt 7. |
| **Kategorie** | Legendentext des Blatts; `neutral`; zwei Kategorien `A+B`; `unklar`; leer | Abschnitt 5 und 4. |
| **Ltg** | Text nach Abschnitt 4 | Beschrieb 8.2 Regel 12 bzw. Terminzeile 4.8. Ohne Präfix «Ltg:». |
| **Ort** | Text nach Abschnitt 4 | Klammerausdruck ohne Klammern (8.2 Regel 12) bzw. «Ort: …» der Terminzeile. |
| **Nr** | zweistellige Zahl `10`–`79` (Beso), Zahl (MehrtagBemerkung) oder leer | Auch gestrichene Nummern werden eingetragen. |
| **Status** | `bestätigt` `gestrichen` `geändert` | Abschnitt 5.9. `offen` kommt aus dem Excel nie vor (rot heisst «geändert», 8.2 Regel 2). |
| **Bemerkung** | Liste von Kennzeichen, getrennt durch ` / ` | Abschnitt 5.10. |

## 4 Textnormalisierung (Titel, Ltg, Ort, Spaltennamen, Kategorie)

In dieser Reihenfolge anwenden; das Vergleichsskript wendet dieselben Regeln auf beide Seiten an.

1. Unicode NFC.
2. Weiche Trennzeichen (U+00AD) und Zeichen ohne Breite (U+200B–U+200D, U+FEFF) entfernen.
3. Geschützte und schmale Leerzeichen (U+00A0, U+2007, U+202F) und Tabulatoren → Leerzeichen.
4. Zeilen- und Absatzumbrüche (auch senkrecht gesetzter Text, Umbrüche innerhalb eines Absatzes) → ein Leerzeichen; ein am Zeilenende getrenntes Wort mit Bindestrich bleibt mit Bindestrich stehen.
5. Striche U+2010–U+2015 und U+2212 → `-`; U+2026 `…` → `...`; typografische Apostrophe U+2018/U+2019 → `'`. Guillemets «» und Anführungszeichen bleiben.
6. Leerraum vor `,` `.` `:` `)` und nach `(` entfernen; mehrere Leerzeichen → eines; vorn und hinten kürzen.
7. Gross- und Kleinschreibung bleibt; Abkürzungen bleiben wie geschrieben (Unterschiede sind Befunde P12 im Tool, nicht Aufgabe der Soll-Liste).
8. **Formatierung:** gespeichert wird reiner Text. Fett-Teile des Titels stehen, falls vorhanden, als Kennzeichen `fett: <Teil>` in «Bemerkung» (nicht verglichen).
9. **Rot durchgestrichene Teile** gehören nie zum Text (8.2 Regel 2); sie stehen als `Teil gestrichen: <Teil>` in «Bemerkung».

## 5 Regeln je Typ

### 5.1 Block

- Jede Form im Raster (unter 0500), die weder Beso-Kästchen noch Rapport noch Marker ist, auch in einer Nebenspalte.
- **Titel:** fette Zeile(n) des Formtexts (8.2 Regel 12), einschliesslich eines unmittelbar anschliessenden nicht fetten Teils derselben Zeile (z.B. «**AVOR** Fahne» → `AVOR Fahne`). Ohne fette Zeile: die erste Zeile. Eine führende Zeitangabe (z.B. «0830-0900») gehört nicht zum Titel und steht als `Zeit im Text: 0830-0900` in «Bemerkung».
- Zusatz- und Tenue-Zeilen gehören nicht zum Titel; sie werden nicht erfasst (kein Feld).
- **Ltg / Ort:** nach 8.2 Regel 12 (Kp: Text vor der Ortsklammer = Ltg; Klammer mit Personen- oder Funktionsname = Ltg).
- **Kategorie:** Legendentext, dessen Farbe der Füllung entspricht (am PDF abgelesen, mit dem Füllwert des Inventars abgeglichen). Farbverlauf zwischen zwei Legendenfarben → `A+B` in der Reihenfolge der Legende. Nicht zuordenbar → `unklar` und `unsicher: Kategorie: Füllung <roh>`.
- Verknüpfte Formen für nicht benachbarte Spalten mit gleichem Text und gleicher Zeit → **eine** Zeile mit allen Spalten.
- Offenes Ende (gewellter Rand): Zeitform `ab`, `bis` leer; Kennzeichen `offenes Ende`.

### 5.2 Querbalken

- Form im Band oberhalb 0500, d.h. in der Stunde 0400–0500 des Anzeigebereichs (F-02 in der Fassung von B-F-06).
- **Titel:** ganzer Text. **Zeitform** `Datum`; **von/bis** = Datumsbereich des Eintrags über alle Wochen (aus dem Titel, sonst aus der Lage am ersten und letzten Tag).
- **Eine Zeile je Woche**, in der der Querbalken erscheint, mit demselben von/bis (R-4.6-10). Der Export der Listenansicht zerlegt einen Querbalken ebenso je Woche.
- **Spalten:** `alle` oder die überdeckten Spalten.

### 5.3 Marker

- Kräftige Linie mit Beschriftung (AV, ABV, HV oder freie Art).
- **Titel:** Art ohne Zeit (`ABV`, nicht `ABV 2330`). **Zeitform** `Zeitpunkt`; **von** = Zeit der Linie; **bis** leer. **Kategorie** leer.
- Enthält die Beschriftung eine Zeit, hat sie Vorrang, sofern sie höchstens 15 Min von der Lage abweicht; sonst `unsicher: von`.
- **Ort in der Beschriftung** (Gate B 28.10.2026, Entscheid 14 b): Marker haben kein Ort-Feld (Beschrieb 4.6). Trägt die Beschriftung eine Ortsklammer, ist der **Titel** die ganze Beschriftung wie geschrieben (einschliesslich Zeit und Klammer, Art frei), **Ort** leer.
- **Linie ohne Beschriftung** (Gate B 28.10.2026, Entscheid 13 a): Die Art ist nicht bestimmbar; die Zeile ist Typ `Bericht` mit `Bericht: Linie ohne Beschriftung` (erwarteter Berichtseintrag, keine Soll-Einheit).

### 5.4 Rapport

- Kästchen in der Rap-Spalte ohne Beso-Nummer, oder Form, deren fetter Text mit einem Rapportkürzel der Vorlage beginnt (KR, DR, AR1, AR2, ARK, BR …; Bat zusätzlich SR).
- **Titel:** Kürzel. **Ort:** Klammer. **Zeitform:** aus der Beschriftung; ohne Zeit in der Beschriftung `von-bis` gemäss Kästchenkanten; beträgt die Höhe genau 30 Min, zusätzlich `unsicher: Zeitform: Zeitpunkt oder von-bis` (Mindesthöhe, R-4.6-19).
- **Spalten:** `Rap`; erscheint derselbe Rapport zusätzlich als Block in Planungsspalten (gleiches Kürzel, gleiche Zeit), dann **eine** Zeile `Rap|<Spalten>`; nur in Planungsspalten (Bat BR 0–3 in Stab) → nur diese Spalten.
- Bat: SR als Marker gezeichnet → Typ `Rapport` (R-4.6-24), Kennzeichen `als Marker`.

### 5.5 Beso

- Termintext mit Nummer und Kästchen gehören zusammen.
- **Titel, Ltg, Ort** aus dem Termintext nach dem Muster Beschrieb 4.8: Titel = Text nach «\<Nr\> \<Zeit\>: » bis vor «, Ltg:», «, Tn:», «, Tpt:», «, Ort:» oder bis zum Schluss; Schlusspunkt entfernt. Passt der Text nicht zum Muster: Titel = ganzer Text ohne Nummer und Zeit, Kennzeichen `Freitext`.
- **Zeit:** aus dem Termintext (Vorrang, 8.2 Regel 3), in der geschriebenen Form (Zeitform). Weicht ein Kästchen mehr als 15 Min ab: Kennzeichen `Bericht: Abweichung Kästchen <hhmm-hhmm>` (R-14.5-07).
- **Mehrere Zeitfenster:** **eine Zeile je Zeitfenster** mit gleicher Nr, gleichem Titel, Ltg, Ort, Kategorie und Status; von, bis, Zeitform und Spalten je Zeitfenster; der Zusatz des Zeitfensters als `Zusatz: <Text>` in «Bemerkung». Zeilenfolge wie im Termintext. Das Muster «\<Nr\> \<Titel\>: \<Zeit 1\> \<Zusatz 1\>, …» (4.8) zeigt die Zeitfenster.
- **Spalten** je Zeitfenster: `Beso` für ein Kästchen in der Beso-Spalte; Name der Planungs- bzw. Nebenspalte, wenn das Kästchen dort liegt. Nummerierte Kästchen in der Rap-Spalte → `Beso` und `Bericht: Kästchen in Rap-Spalte` (8.2 Regel 6; R-14.5-04, R-14.5-05).
- **Kategorie:** Füllfarbe des Kästchens (4.6 «Leitungskategorie bestimmt die Füllfarbe»).
- **Sonderfälle** (je mit Kennzeichen, erwarteter Berichtseintrag):
  - Kästchen ohne Termintext: Titel leer, Zeit aus dem Kästchen, `Bericht: Kästchen ohne Termintext`.
  - Termintext ohne Kästchen: Spalten `Beso`, `Bericht: Termintext ohne Kästchen`.
  - Nummerierter Termin ohne Zeit: Typ `TagBemerkung`, Nr leer, `Bericht: Termin ohne Zeit Nr <nn>` (5.3; R-14.5-08, R-14.5-09).
  - Nummer passt nicht zur Sortierzeit: `Bericht: Reihenfolge` (R-14.5-06).
  - Sich überlagernde Kästchen: `Bericht: Überlappung mit <Nr>` (R-14.5-01, R-14.5-02).

### 5.6 TagBemerkung (ganztägige Bemerkung)

- Terminbereich-Text ohne Nummer, oder nummerierter Termin ohne Zeit (5.5).
- **Zeitform** `ganztags`, von/bis leer, Spalten leer, Kategorie leer. **Titel** = ganzer Text.

### 5.7 MehrtagBemerkung

- Einträge der Seitenleiste unter «Bemerkungen» (Kp «gelten durchgehend», Bat «Mehrtägige Bemerkungen»).
- **Tag** leer; **Nr** wie gedruckt; **Zeitform** `Datum` mit von/bis, wenn ein Zeitraum genannt ist, sonst leer; **Titel** = Text.
- Die Box «Bemerkungen», die in allen Wochen die Legende überlagert: je Woche eine Zeile mit Kennzeichen `Bericht: Überlappung Seitenleiste` (R-14.5-03).
- Bat: graue Verweis-Kästchen → Kennzeichen `Verweis-Kästchen: <Tage>, <Spalte>`.

### 5.8 Wochenziel (nur Anhang C)

- **Titel** = Aufzählungspunkt; **Spalten** = Gruppe (z.B. `Ganzes Bat`, `Inf Kp`, `Stab`); übrige Felder leer. Zeilenfolge wie gedruckt.

### 5.9 Status

| Excel | Status | Bemerkung |
| --- | --- | --- |
| schwarz bzw. normal | `bestätigt` | – |
| Nummer (bzw. ganzer Text) rot durchgestrichen | `gestrichen` | – |
| Text rot, nicht durchgestrichen | `geändert` | `rot: <Teil>`, wenn nur ein Teil rot ist |
| nur ein Teil rot durchgestrichen | `bestätigt` bzw. `geändert` (übriger Text rot) | `Teil gestrichen: <Teil>` (Auslegung F-30) |

Ein Feldwert «offen» (z.B. Ort «offen») bleibt Text im Feld; er ist kein Status.

**Gate B 28.10.2026, Entscheid 15 a:** «geändert» ist eine Markierung, kein Status. Der Export der Listenansicht und der Vergleich führen in der Spalte «Status» den Status (`bestätigt`); die Markierung bleibt im Plan (R-4.6-67, Q-026). Rot nicht durchgestrichener Text ergibt in Anhang A `bestätigt` (in Anhang A Kp kommt `geändert` nicht vor).

### 5.10 Kennzeichen im Feld «Bemerkung»

Mehrere Kennzeichen durch ` / ` getrennt. Feste Anfänge (für Skripte auswertbar):

| Kennzeichen | Bedeutung |
| --- | --- |
| `unsicher: <Feld>: <Grund>` | Wert nicht sicher bestimmbar; zählt trotzdem als Soll. Beispiel `unsicher: Spalten: Form ragt 1 mm in Rap-Spalte`. |
| `Bericht: <Art> …` | Erwarteter Eintrag im Importbericht (8.2 Regeln 3, 4, 6, 7, 11; 14.5). Arten: `Überlappung`, `Überlappung Seitenleiste`, `Kästchen in Rap-Spalte`, `Reihenfolge`, `Abweichung Kästchen`, `Termin ohne Zeit`, `Kästchen ohne Termintext`, `Termintext ohne Kästchen`, `Kante <hhmm>` (ungerundete Kante > 2 Min neben der 15-Min-Linie; Meldung im Importbericht nach Gate-Entscheid 7 b nur für Blöcke, gruppiert oder einzeln, siehe Abschnitt 6), `ragt in Rap-Spalte`, `in Beso-Spalte` (N-07), `Zwischenspalte`, `Farbe`. |
| `Excel≠PDF: <Beschreibung>` | Abweichung zwischen Excel und PDF; das neuere Excel ist massgebend (Beschrieb 14). |
| `Zusatz: <Text>` | Zusatz eines Beso-Zeitfensters. |
| `Zeit im Text: <Zeit>` | Zeitangabe im Formtext (für P19). |
| `fett: <Teil>` · `rot: <Teil>` · `Teil gestrichen: <Teil>` | Formatierung. |
| `offenes Ende` · `als Marker` · `Freitext` · `Verweis-Kästchen: …` | Darstellung. |

## 6 Zeiten und Rundung

- Format `hhmm`, 4-stellig, ohne Doppelpunkt (Beschrieb 11). Mitternacht als Ende `2400`, als Beginn `0000`.
- **Quelle:** Zeiten werden am gerenderten PDF abgelesen (Rasterlinien, mindestens 400 dpi) und mit den Rohkoordinaten des Inventars nur auf Widersprüche abgeglichen (z.B. Form im Inventar, im PDF verdeckt → `unsicher`). Beso-Zeiten stammen aus dem Termintext (5.5).
- **Rundung** (Beschrieb 8.2 Regel 4): abgelesene Kanten von Blöcken, Rapporten, Kästchen ohne Termintext und Markern auf die nächste 5-Minuten-Marke; genau in der Mitte (2,5 Min) wird aufgerundet (wie Vorschlag F-44). Liegt die ungerundete Kante mehr als 2 Min neben einer 15-Minuten-Linie: `Bericht: Kante <hhmm>`. `<hhmm>` ist die ungerundete Kantenzeit auf ganze Minuten. Das Kennzeichen steht je Kante (bestätigter Anhang A, unverändert) und trägt den genauen Abstand nicht.
- **Kennzeichen `Kante <hhmm>` und Importbericht** (Gate-0-Entscheid 7 b, Q-006 b, freigegebene Abweichung vom Wortlaut von Beschrieb 8.2 Regel 4; ADR-008 «Regel 4 – Meldung im Bericht»; R-8.2-11). Abstand `a` = Betrag zwischen ungerundeter Kante und nächster 15-Min-Linie, in Minuten, auf 0,01 Min gerundet verglichen:
  - Es zählen nur Kennzeichen an Zeilen vom Typ `Block`. Kennzeichen an Markern, Rapporten, Querbalken und Beso bleiben als Ablesehinweis stehen, ergeben aber keinen Berichtseintrag. **Arbeitsannahme Q-014 (offen), Vorlage Gate S** (`QUESTIONS.md` Q-014): Dass Kennzeichen an Markern keinen Berichtseintrag ergeben, ist nicht entschieden und gilt bis zum Entscheid nur als Arbeitsannahme; lehnt der Auftraggeber ab, werden Vergleich und Tests per `lock-update` nachgeführt.
  - `a` ≤ 2: keine Meldung (kein Kennzeichen).
  - 2 < `a` ≤ 4: keine Einzelmeldung. Je Blatt (= Woche) und Tag mit mindestens einer solchen Kante genau **ein Sammeleintrag**; Anzahl = Zahl dieser Kennzeichen an diesem Tag (ein Block mit zwei betroffenen Kanten zählt zweimal, steht aber nur einmal unter den Betroffenen).
  - `a` > 4: je Kennzeichen ein **Einzeleintrag**.
  - Bestimmung von `a` für den Vergleich: aus der lokalen Nachmessung an der Vektorgeometrie, wo vorhanden, sonst aus `<hhmm>`. Ergibt `<hhmm>` einen Abstand ≤ 2 (Rundung auf ganze Minuten), liegt `a` zwischen 2 und 2,5 → Sammeleintrag.
  - Vergleich je Woche und Tag: Zahl der Einzeleinträge plus Anzahl im Sammeleintrag = Zahl der `Block`-Kennzeichen. Die Aufteilung auf Sammel- und Einzeleintrag wird nur für Kanten mit `a` ausserhalb 3,6–4,4 Min verglichen; innerhalb dieses Grenzbereichs (Ablesegenauigkeit wie bei der Grenze 2 Min, Abschnitt 13 «6 Zeiten») ist beides zulässig. **Arbeitsannahme Q-014 (offen), Vorlage Gate S** (`QUESTIONS.md` Q-014): Der Grenzbereich 3,6–4,4 Min ist nicht entschieden; bis zum Entscheid gilt er nur als Arbeitsannahme, lehnt der Auftraggeber ab, wird die Aufteilung für alle Kanten verglichen und die Tests werden per `lock-update` nachgeführt.
- Zeiten aus Texten werden nicht gerundet. Liegt eine Textzeit nicht auf 5 Minuten: `unsicher: von` bzw. `bis`.
- **Zeitformen:**

| Zeitform | von | bis | Beispiel |
| --- | --- | --- | --- |
| `Zeitpunkt` | Zeit | leer | `1130` |
| `von-bis` | Beginn | Ende | `0900` / `1200` |
| `ab` | X | leer | `1900` |
| `bis` | leer | X | – / `1200` (KVK Mo Nr 13) |
| `Frist` | leer | `dd.mm.yyyy` oder `dd.mm.yyyy hhmm`; Jahr aus dem Plan ergänzt | `21.10.2026` |
| `ganztags` | leer | leer | TagBemerkung |
| `Datum` | `dd.mm.yyyy` | `dd.mm.yyyy` | Querbalken `08.10.2026` / `18.10.2026` |

- **Über Mitternacht:** eine Zeile am Starttag, `bis` < `von` bedeutet Folgetag; Kennzeichen `über Mitternacht`.

## 7 Spalten

- Namen wie im Spaltenkopf **des jeweiligen Tages**, normalisiert nach Abschnitt 4 (senkrechte Köpfe zu einer Zeile verbunden).
- Mehrere Spalten: `|`-getrennt, von links nach rechts, ohne Leerzeichen um `|` (z.B. `COBRA 10|COBRA 20`).
- `alle` = alle Planungsspalten des Tages (ohne Nebenspalte, Rap, Beso). Deckt ein Eintrag zusätzlich die Nebenspalte: `alle|Det`.
- Kanonische Namen: Rap-Spalte `Rap`; Beso-Spalte `Beso` (auch wenn der Kopf «Bes» lautet); Nebenspalte mit ihrem Kopf (Kp `Det`, Bat `Stab 2`).
- Formen ohne Nummer ganz in Rap- oder Beso-Spalte → Soll gemäss 8.2 Regel 6: Spalte `Det` (Kp) bzw. `Stab 2` (Bat) und `Bericht: ragt in Rap-Spalte` bzw. `Kästchen in Rap-Spalte`. Nur teilweise hineinragend → nur die Planungsspalten und `Bericht: ragt in Rap-Spalte`.
- Unbeschriftete Zwischenspalte → der linken Nachbarspalte zugeschlagen (Vorschlag F-32), `Bericht: Zwischenspalte`.
- Ist eine Spaltengrenze nicht eindeutig (Kante weniger als 1 mm neben der Grenze bei 400 dpi): `unsicher: Spalten`.

## 8 Zählung, zwei Instanzen, Unsicherheit

- Zwei `spec-analyst`-Instanzen erstellen die Liste unabhängig (je eine Datei `instanz-1`, `instanz-2`). Ein Skript gleicht sie nach dem Abgleich-Verfahren (Abschnitt 10) ab; jede Abweichung steht in `…abweichungen.csv` (Schlüssel, Wert Instanz 1, Wert Instanz 2, Klärung, geklärt durch). Nicht klärbare Abweichungen legt der Orchestrator dem Kp Kdt vor.
- `unsicher` markierte Einträge bleiben im Soll; die Markierung dient der Sichtprüfung durch den Kp Kdt.
- **`docs/wap-planer/anhaenge/zaehlung-a.md`** (versioniert, ohne Inhalte) enthält: Zuordnung Blatt → Woche; Anzahl Einheiten je Woche × Typ; je Woche × Tag; Anzahl `unsicher` je Woche; Anzahl `Bericht:`-Kennzeichen je Art; Anzahl Abweichungen der zwei Instanzen (gesamt, geklärt, vorgelegt); SHA-256 der bestätigten Datei. Gleich für Anhang C (`zaehlung-c.md`).

## 9 Rohinventar der Formen

Erlaubt ist nur ein Rohinventar ohne Deutung (Prompt §5.1 Schritt 6). Das Skript liegt in `reference/anhaenge/` (nicht versioniert); Import und Tests verwenden es nie. Es liest keinen Code aus `src/io/wap/`.

- **Pro Blatt:** Blattname, Pfad der Zeichnung.
- **Pro Form:** laufende ID, Formtyp aus dem XML (`sp`, `grpSp`, `cxnSp`, `pic`), Name, Gruppenpfad (IDs der umgebenden Gruppen), **Rohkoordinaten** genau wie im XML (Anker `from`/`to` in Zelle+Offset, `xfrm` `off`/`ext`/`rot`/`flipH`/`flipV`, Gruppen-`chOff`/`chExt`), Textkörper-Einstellungen roh (`vert`, `rot`), Absätze mit Läufen (Text, fett, Farbe roh, durchgestrichen), Füllung roh (Art, RGB- oder Designwert, Transparenz, Verlaufsstopps), Linie roh.
- **Verboten** im Inventar: Umrechnung in Zeit, Tag, Spalte, Typ oder Kategorie; Anwendung von Gruppen-Transformationen; Zuordnung zu Legendeneinträgen; Zellinhalte ausser dem Blattnamen.
- Zweck: Vollständigkeitskontrolle (jede Form ist in der Soll-Liste einer Zeile zugeordnet oder als «nicht Eintrag» begründet, z.B. Zeitbeschriftung, Rahmen, Legende), Abgleich von Text, Fett, Rot und Füllwert mit dem am PDF Abgelesenen.

## 10 «Korrekt erkannt» und Vergleich

Der Vergleich läuft per Skript zwischen der Soll-Liste und dem Export der Listenansicht im selben Format (R-6-16, Vorschlag F-25); beide Seiten werden nach Abschnitt 4 normalisiert.

- **Einheit:** jede Zeile ist eine Einheit, ausser beim Beso: alle Zeilen mit gleicher Woche und Nr (ohne Nr: gleiche Woche, Tag, Titel) bilden **eine** Einheit.
- **Zuordnung:** eins zu eins, zuerst über (Woche, Typ, Tag, Nr), dann über (von, bis, Spalten), dann Titel; jede Ist-Einheit wird höchstens einmal verwendet.
- **Korrekt erkannt** (Prompt §5.1 Schritt 6; R-14.1-01, R-14.8-04) ist eine Soll-Einheit, wenn es eine Ist-Einheit gibt mit gleichem **Typ, Woche, Tag, von, bis, Spalten** (als Menge, `alle` aufgelöst), **Kategorie, Titel** und beim Beso gleicher **Nr** und gleichen Zeitfenstern (von, bis, Spalten je Zeitfenster). Zeitform, Ltg, Ort und Status gehören nicht zu «korrekt erkannt».
- **Quote** = korrekt erkannte Soll-Einheiten / alle Soll-Einheiten der betrachteten Wochen. Überzählige Ist-Einheiten werden gemeldet, senken die Quote aber nicht.
- **100 % Übereinstimmung** (R-14.1-02, R-14.1-03, R-14.8-01 bis -03): alle 13 Pflichtfelder jeder Soll-Einheit gleich **und** keine überzählige Ist-Einheit.
- **Berichtsprüfung** (R-14.5-01 bis -09, R-8.2-20): jedes `Bericht:`-Kennzeichen muss einen passenden Eintrag im Importbericht haben.
- Ausgabe des Skripts nur als Zahlen und Schlüssel (Woche, Tag, Typ, Nr); keine Titel in Konsole oder Logs (Prompt §8).

## 11 Anhang B-Kp und B-Bat (PDF-Checkliste)

Format wie Abschnitt 2 (UTF-8, `;`, LF). Kopfzeile:

```
ID;Bereich;Element;Soll;Sollwert;Einheit;Toleranz;Messmethode;Quelle;Anforderung;Bemerkung
```

| Feld | Inhalt |
| --- | --- |
| **ID** | `B-Kp-nn` bzw. `B-Bat-nn` |
| **Bereich** | `Seite` `Kopf` `Raster` `Blöcke` `Rapporte` `Beso` `Marker` `Querbalken` `Seitenleiste` `Termine` `Schrift` `Farben` |
| **Element** | z.B. «Kopf links: SCHWEIZER ARMEE», «Stundenlinie», «Legende Farbfeld Ltg Zfhr» |
| **Soll** | Aussage in Worten, z.B. «vorhanden, links oben, fett», «gestrichelt», «Reihenfolge: Wochenziele vor Erhöhte Bereitschaft» |
| **Sollwert** | Zahl, Farbe oder Text; leer, wenn die Aussage reicht |
| **Einheit** | `mm` (PDF-Koordinaten, Ursprung links oben, 1 pt = 0,3528 mm), `pt` (Schrift, Linien), `Verhältnis`, `sRGB` (`#RRGGBB`), `Text`, `Reihenfolge` |
| **Toleranz** | z.B. `±0,5 mm`, `±2 %`, `ΔE2000 ≤ 3`, `exakt` |
| **Messmethode** | `PDF-Vektor` (Pfade und Linien aus dem PDF), `PDF-Text` (Position, Schrift, Grösse aus dem PDF), `Rendering 400 dpi` (Pixelmessung), `Sicht` (Seiten-an-Seiten-Vergleich) – jeweils gleich für Referenz und erzeugtes PDF |
| **Quelle** | Referenzseite (Woche) und Stelle der Messung; mehrere Wochen → Mittelwert und Streuung in «Bemerkung» |
| **Anforderung** | R-IDs, z.B. `R-4.5-04`, `R-10-15` |
| **Bemerkung** | u.a. `bewusste Abweichung: …`, `Hilfsreferenz` (Bat ohne offizielles PDF, Q-002) |

**Mindestinhalt B-Kp:**

1. Seite: Format A4 quer, Ränder (4 Werte), Lage der Bereiche Kopf, Raster, Seitenleiste, Termine (R-10-01, R-10-06).
2. Kopf: jedes Element aus Beschrieb 10 mit Lage, Rahmen, Schriftschnitt (R-10-07 bis R-10-12, R-4.9-01, R-4.9-07).
3. Raster: Rasterbreite; Breitenverhältnis voll/kompakt; Spaltenbreiten je Gewicht; Abbildung Zeit → Position als y(0500) und y(2300) mit Linearität (max. Abweichung an allen Stundenlinien); Lage und Höhe des Querbalken-Bands (F-02 in der Fassung von B-F-06: Band = 0400–0500, Querbalken je 0,5 h); Linienart und -dicke für Stunde, Halbstunde, Tagesgrenze, Spaltengrenze; Strichmuster der Stundenlinie (R-4.4-10 bis R-4.4-14, R-4.5-03 bis R-4.5-07, R-10-15).
4. Blöcke, Rapporte, Beso, Marker, Querbalken: Rahmendicken, Innenabstände, Kästchengrösse und Bahnen, Markerdicke und Beschriftungsfeld (R-10-16 bis R-10-20, R-4.6-12).
5. Seitenleiste: Breite, Reihenfolge der Abschnitte, Hintergrund «Erhöhte Bereitschaft», Legende mit Farbfeldern, Unterschriftblock, Wappen, Motto, Sonnenzeiten mit Symbol (Lage, nicht Werte: R-15-08) (R-10-21 bis R-10-26).
6. Termine: Lage, senkrechte Beschriftung, Kopf «Was», hängender Einzug (R-4.8-01 bis R-4.8-07).
7. Farben: fünf Legendenfarben Kp, neutral, Grau der Erhöhten Bereitschaft, Rot für Status (R-4.7-05, R-10-27).
8. Schrift: Sollwerte aus Beschrieb 10 (5 / 5,5 / 4,5 pt), **nicht** aus der Referenz (dort rund 3 pt) – bewusste Abweichung (R-10-37, R-10-38).

**Bewusste Abweichungen von der Referenz** (in «Bemerkung» als `bewusste Abweichung` markiert, Sollwert gemäss Beschrieb): Datumsformat dd.mm.yyyy (Beschrieb 10 «Daten»), Schriftgrössen, Werte der Sonnenzeiten (Beschrieb 15), keine Überlagerung von «Bemerkungen» und Legende (14.3).

**B-Bat** hat dasselbe Format; Grundlage ist das offizielle Bat-PDF (Q-002), bis dahin ein gekennzeichnetes Rendering des Excel V3 (`Hilfsreferenz` in jeder Zeile).

## 12 Fragen zu diesem Dokument

| Nr | Frage | Vorschlag | Status |
| --- | --- | --- | --- |
| N-01 | 14. Feld «Bemerkung» zusätzlich zu den 13 Pflichtfeldern zulassen? (= F-50 in `requirements.md`) | Ja; es wird nicht verglichen und hält die Pflichtfelder unverändert. | entschieden Gate 0 (02.10.2026): Vorschlag angenommen (als F-50, Q-007) |
| N-02 | Gehören ganztägige Bemerkungen in Anhang A? (= F-49) | Ja, Typ `TagBemerkung`; sonst sind 14.5 (KVK Fr 51, Wo 2 Fr 53) und die 100-%-Nacharbeit nicht prüfbar. | entschieden Gate 0 (02.10.2026): Vorschlag angenommen (als F-49, Q-007) |
| N-03 | Darf Anhang B-Kp versioniert werden, damit die Konformitätstests (Prompt §7 Ebene 1) ohne `reference/` laufen? Er enthält nur Masse, Farben und Elementnamen. | Ja, als `docs/wap-planer/anhaenge/anhang-b-kp.csv` mit Texten der Referenz durch Platzhalter ersetzt (z.B. «\<Einheit\>»); das Original mit Texten bleibt in `reference/`. Bis zum Entscheid nur in `reference/`. | entschieden Gate 0 (02.10.2026): Vorschlag angenommen (als F-51, Q-007); versioniert wird die pseudonymisierte Fassung von Anhang B-Kp (nur Masse, Farben, Elementnamen, Platzhalter; B-F-10, Q-008); Dateiname und Übernahme gemäss Plan Etappe 1, Paket E1-02e |
| N-04 | Querbalken über mehrere Wochen: eine Zeile je Woche (so hier festgelegt) statt einer Zeile für den ganzen Plan? | Je Woche, weil Anhang A «pro Woche» geführt wird (Beschrieb 14) und jede Seite geprüft wird. | entschieden Gate 0 (02.10.2026): Vorschlag angenommen (Q-007) |

## 13 Ergänzungen nach Gate 0 (Q-011, N-05 bis N-23)

Der Auftraggeber hat am 02.10.2026 die Vorschläge zu N-05 bis N-23 angenommen und den Kandidaten von Anhang A bestätigt (Q-011). Die Fragen mit Begründung und Fundstellen stehen nur lokal in `reference/anhaenge/abgleich/pruefhilfe.md` §5. Hier stehen allein die daraus folgenden Regeln. Sie gehen den Abschnitten 3 bis 7 vor, wo sie diese ergänzen.

- **Massgebender Stand (N-05, N-09):** Es gilt das Excel (Beschrieb 14 «neueres Excel massgebend»). Fälle aus Beschrieb 14.5, die nur im älteren PDF vorkommen, erhalten kein Kennzeichen. 14.5 «alle Wochen» heisst «alle Wochen mit dem Fall im Excel» (R-14.5-01 bis R-14.5-03).
- **3 Felder, von (N-12):** `2400` ist nur bei Zeitform `Zeitpunkt` als Tagesende zulässig (z.B. Marker «ABV 2400»).
- **5.1 Block (N-17, N-18):** Eine Klammer oder «Ltg: …» in einer fetten Zeile wird nach 8.2 Regel 12 zu Ort bzw. Ltg, nicht zum Titel. Ein nicht fetter Funktionsname auf derselben Zeile bleibt im Titel. Eine nicht fette Zeile ohne Ortsklammer, die nur eine Funktion nennt, wird Ltg mit `unsicher: Ltg`. Eine eigene nicht fette Zeile nach einem Zeilenumbruch ist Zusatz, auch direkt nach dem Titel. «Verknüpfte Formen» umfasst auch nicht gruppierte Einzelformen mit gleichem Text und gleicher Zeit (Aussparung, Beschrieb 4.6).
- **5.2 Querbalken (N-15):** Nennt der Titel kein Datum, gelten die Tage der Lage. Tagesangaben im Titel ändern von/bis nicht. Zeilen gibt es nur in Wochen, in denen der Balken gezeichnet ist.
- **5.3 Marker (N-10):** Ein flacher Kasten «<Art> hhmm» ohne Linie ist Typ `Marker`, von = Zeit der Beschriftung, mit `unsicher: Typ`. Die 15-Min-Regel gilt dafür nicht. Ein Block mit fetter Zeile «ABV …» bleibt ein Block, ohne zusätzlichen Marker.
- **5.4 Rapport (N-14):** Ein Kästchen ohne Nummer in der Rap-Spalte ist ein Rapport, Abschnitt 5.4 geht Abschnitt 7 vor. Ohne Kürzel der Vorlage ist der Titel die erste Zeile, mit `unsicher: Titel`.
- **5.5 Beso (N-08, N-19, N-20, N-23):**
  - Gibt es zu einem nummerierten Termin ohne Zeit ein nummeriertes Kästchen, entstehen eine TagBemerkung **und** eine Beso-Zeile (Nr, Titel leer, Zeit aus dem Kästchen, `Bericht: Kästchen ohne Termintext`).
  - `Bericht: Reihenfolge nach Nr <n>` steht an der Nummer, die vor einer kleineren Nummer einsortiert wird.
  - Ein zweites Zeitfenster ohne Kästchen ergibt keine Zeile, sondern `unsicher: Zeitform`.
  - Bei «Termintext ohne Kästchen» bleibt die Kategorie leer.
- **5.7 MehrtagBemerkung (N-05, N-06):** Je Aufzählungspunkt entsteht eine Zeile. Der führende Strich wird entfernt, die Überschrift nicht erfasst. `Bericht: Überlappung Seitenleiste` steht an der ersten Zeile der Woche, nur in Wochen mit Box im Excel.
- **5.10 Kennzeichen (N-07, N-16):**
  - Neue Berichtsart `in Beso-Spalte`: Form ohne Nummer ganz in der Beso-Spalte, Spalte = Nebenspalte.
  - `Bericht: Zwischenspalte` steht einmal je Tag, an der ersten Zeile, die die Zwischenspalte überdeckt.
  - Die Abgleich-Kennzeichen `offen: <Frage-ID>` und `Vorschlag: …` sind im bestätigten `anhang-a-kp.csv` nicht mehr zulässig.
- **6 Zeiten (N-11, N-13, N-21):**
  - Ablesequelle ist das Rendering einer Kopie des massgebenden Excel. Das Original bleibt unverändert; das ältere PDF dient nur zum Vergleich.
  - Die Kalibrierung an Formkanten ist verbindlich. Formen, deren Anker auf einer Zeilengrenze liegt, bestimmen den Versatz d zwischen Rasterlinienmitte und Zeilengrenze; d wird je Ablesequelle gemessen (Beleg nur lokal). Die Zeit ist die lineare Interpolation zwischen den um d verschobenen Halbstundenlinien.
  - Liegt eine Kante weniger als 0,4 Min neben einer Rundungsgrenze (x2,5 / x7,5), gilt der Wert nach Regel (aufrunden), mit `unsicher: <Feld>: Rundungsgrenze`. Bei einem Abstand zur 15-Min-Linie zwischen 1,6 und 2,4 Min steht `unsicher: Bericht Kante`.
  - Ganz oder teilweise verdeckte Formen: Werte aus der Formkante der Vektorgeometrie, mit `unsicher` und `Bericht: Überlappung`.
  - Eine Doppel-Form mit gleichem Text am selben Ort ist eine eigene Zeile mit `Bericht: Überlappung`. Eine verdeckte Linie ohne Beschriftung ist eine eigene Zeile mit `unsicher: Typ`.
- **7 Spalten (N-22):** Hat ein Tag nur eine Planungsspalte, steht `alle`. Die unbeschriftete Zwischenspalte gehört zu `alle`.
- **8 und 10 Abgleich zweier Instanzen:** Die Paarung folgt dem lokalen Abgleichskript in vier Stufen:
  1. Beso nach Woche und Nr.
  2. Woche, Tag und Typ mit Nähe von Titel, Zeit und Spalten.
  3. Anderer Typ bei Titelähnlichkeit ≥ 0,8.
  4. Rest.

  Strittige Zeitkanten werden an der Vektorgeometrie nachgemessen.

## Änderungsnotiz 04.10.2026 (Orchestrator)

Q-014 entschieden («014: annehmen», wörtlich in `PROGRESS.md`): Die Toleranz 3,6–4,4 Min für Regel 4 (Abschnitt «Regel 4», Vergleich Importbericht ↔ Anhang A) ist keine Arbeitsannahme mehr, sondern gilt. Anhang A bleibt unverändert.

## Änderungsnotiz 19.10.2026 (F-IMPORT2, Entscheide des Auftraggebers zu Q-042, Q-043, Q-044)

Entscheid wörtlich «3: ja / 4: ja / 5: ja» (`PROGRESS.md`, Freigabeprotokoll 19.10.2026). Die Regeln gehen den
Abschnitten 3, 5, 6, 10 und 13 vor, wo sie diese ändern. Massgebende Soll-Liste ist ab jetzt
`reference/anhaenge/anhang-a-kp.csv` (Kandidat vom 02.10.2026 mit den einzeln bestätigten Korrekturen); der Kandidat
bleibt unverändert und gesperrt. Zählungen in `zaehlung-a.md`, Änderungsliste nur lokal.

- **Verdeckung** (Gate S A2, R-8.2-39 bis R-8.2-42): massgebend ist der Flächenanteil, den später gezeichnete,
  gefüllte Formen ohne Transparenz zusammen bedecken; Linien gelten nie als verdeckt.
  - **ab 99 %** (ganz verdeckt, Q-043): kein Eintrag. Die Zeile erhält den Typ `Bericht` (neuer Wert im Feld Typ,
    Abschnitt 3) mit den Kennzeichen `Bericht: verdeckt` und `Form: <Typ der Form>`; Woche, Tag, Zeit und Spalten
    bleiben wie gelesen. Eine Zeile vom Typ `Bericht` ist keine Soll-Einheit (Abschnitt 10) und kein Eintrag der
    Listenansicht; sie erwartet einen Berichtseintrag «verdeckt». Ersetzt Abschnitt 13 «6 Zeiten» (ganz verdeckte
    Formen als eigene Zeile) und den Normalisierungsentscheid 15 der Zählung 1.
  - **5 % bis unter 99 %** (teilweise verdeckt, Q-042, Q-044 (d)): Eintrag mit der **sichtbaren Zeit** und Kennzeichen
    `Bericht: teilweise verdeckt`. Liegt die Bedeckung nur am Anfang und/oder Ende über die ganze Breite, wird die
    Zeit auf die kleinste Spanne gekürzt, die alles Sichtbare umfasst (Kante = Kante der verdeckenden Form); liegt
    sie dazwischen oder nur seitlich, bleiben Zeit und Spalten. Bei gekürzter Zeit steht zusätzlich
    `sichtbare Zeit (Form <hhmm-hhmm>)` mit der ursprünglichen Formkante. Ein gekürzter Rapport in einer
    Planungsspalte ist mit dem Rapport der Rap-Spalte nur bei gleicher Zeit eine Zeile (5.4 «gleiche Zeit»).
  - **unter 5 %**: keine Meldung, kein Kennzeichen.
- **Teilaufgaben** (Q-044 (a)–(c), R-8.2-37, R-8.2-38): hat ein Formtext mindestens zwei durch einen Leerabsatz
  getrennte Gruppen (fette Zeile(n), direkt gefolgt von normalen Zeilen) und tragen mindestens zwei Gruppen eine
  normale Zeile, ist die **erste fette Gruppe der Block** (Titel; die normale Zeile darunter ist Ltg, auch ohne
  Klammer) und jede weitere Gruppe eine Teilaufgabe. Die Zeile führt Titel und Ltg der ersten Gruppe und das
  Kennzeichen `Teilaufgaben: <n>`. Formen mit zwei fetten Teilen ohne eigene normale Zeile bleiben ohne Teilaufgaben.
  Damit gilt Abschnitt 5.1 «Titel = fette Zeile(n)» bzw. der Normalisierungsentscheid 5 der Zählung 1 (mehrere
  fette Zeilen zum Titel verbunden) nur noch ohne Teilaufgaben, ebenso der Normalisierungsentscheid 6 (Zeile ohne
  Ortsklammer = Zusatz).
- **Durchgehende Bemerkungen** (Beschrieb 4.2 Kp «gelten durchgehend», R-4.2-07; ergänzt Abschnitt 13 «5.7»): Hat
  das Blatt einer Woche keine eigenen Bemerkungen, gelten die der Vorwoche; je Aufzählungspunkt eine Zeile
  `MehrtagBemerkung` mit Kennzeichen `durchgehend: …`. `Bericht: Überlappung Seitenleiste` steht weiterhin nur in
  Wochen mit eigener Box.
