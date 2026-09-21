# Abgleich: Detachementsplaner und PISA

Stand der ursprünglichen Codeprüfung: Commit `1623ac4`, Datei `index.html`. Die Lückentabelle unten beschreibt diesen Ausgangsstand und ist ein **Umsetzungsvorschlag**, keine zusätzliche PISA-Vorschrift.

## Umgesetzt: Arbeitsablauf und Personenarchiv

Die Neugestaltung (v4) richtet die App auf «Dienstleistung vorbereiten, danach archivieren» aus. Einrückungsgruppen bündeln MB-Details und Personal. Ein Hauptdetachement kann bis zu fünf Zusatz-EC referenzieren. Explizite Teilnahmeentscheidungen, nummernbasierter Quellenabgleich, einheitliche Personendossiers, manuelle PISA-Abgleichsmarker und separate unveränderte Archivstände sind umgesetzt. Die Archivsuche findet Personen über mehrere Dienstleistungen. v2/v3-Projekte bleiben ladbar, ohne alte Mehrfachzuteilungen automatisch fachlich umzudeuten. Details und Tests stehen in der [Projekt-README](../../README.md) und den [Entwurfsnotizen](../app-redesign.md).

Offen bleiben eine fachlich bestätigte DVM-/Gast-WK-Auswahl mit eigenem Nachweismodell, Beilagenverwaltung, Fristen- und Versandkontrolle sowie der eigene AO-Ablauf. Die lokale Teilnahmeentscheidung ersetzt diese fachlichen Nachweise nicht. Die folgenden Tabellen dokumentieren den ursprünglichen Befund und den weiterführenden Ausbauplan.

## Zielbild

Der Nutzer bereitet Bestand, Einrückungsdetails, Haupt-/Zusatz-MB, Bemerkungen und Beilagen einmal im Planer vor. Eine Erfassungsansicht gibt genau die Arbeitsreihenfolge und Felder in PISA vor. Anschliessend wird überprüft, ob der vorbereitete Stand tatsächlich übernommen und in PISA verarbeitet wurde.

Erfolg bedeutet: weniger Nachschlagen und Doppelerfassen, keine übersehenen AdA, nachvollziehbare Sonderfälle und ein prüfbarer Übertragungsstand. Ein Excel-Export allein ist kein PISA-Import und ein grüner lokaler Prüfstatus keine PISA-Genehmigung (`PISA-UNKNOWN-001`, `PISA-RELEASE-001`).

## Ausgangsstand vor der Neugestaltung

- Lokale Browseranwendung ohne Server; PISA-/MILO-Import, Quelldaten und Projektdateien.
- Personenfilter, Mehrfachauswahl und Detachementszuweisung.
- Prüfung von Zeitüberschneidungen, knappen Ortswechseln und fehlenden Basisdaten.
- Personenübersicht, Detachementsübersicht und Excel-Arbeitsunterlagen.

Diese Funktionen können die Vorbereitung tragen. Das fehlende Stück ist ein explizites Aufgebotsmodell für PISA.

## Lücken und Priorität

| Priorität | Beobachtung im Code | Auswirkung | Vorgeschlagene Änderung / Beleg |
| --- | --- | --- | --- |
| P0 | `ec` ist optionaler Freitext; `detExcel()` erkennt Einsatzcode, nicht Einrückcode. UI spricht von Einsatzcodes. | Falsche Terminologie, unbrauchbare Codes werden nicht erkannt. | Einrückcode als Fachbegriff; bestehende Importüberschrift als Legacy-Alias erhalten. Zwei Zeichen und Duplikate prüfen; Quellenkonflikt zur Zeichenliste sichtbar halten. EC-001/002, CONFLICT-002. |
| P0 | `neuesDet()` enthält allgemeine Zeitfenster, Ort/Treffpunkt, aber weder Anzug noch Entlassungsort. | Arbeitsunterlage reicht nicht für die PISA-Tabelle. | Explizite Aufgebotsdetails in PISA-Reihenfolge; Datum/Enddatum semantisch prüfen. FIELDS-001. |
| P0 | `S.assign` erlaubt unabhängige Mehrfachzuteilungen; es gibt keine Haupt-/Zusatz-MB-Verknüpfung. | Mehrfachzuweisung beschreibt keine gültige MB-Struktur. | Hauptdetachement mit referenzierten Zusatz-EC; max. fünf, gerichtete Beziehung. MB-001, FRACTION-002. |
| P0 | `personen()` blendet bei `nurMilo` und vorhandenem MILO-Import alle anderen aus; `konflikte()` und Personenexport nutzen diese Auswahl. | Vollständigkeitsprüfung kann fehlende PISA-AdA übersehen. | Prüfrelevanten Bestand unabhängig von UI-Filtern modellieren; Gast-WK/DVS/DVM-Status explizit abgleichen. DATA-001/002/004, ASSIGN-002. |
| P0 | `uebernehmen()` führt Personen anhand `norm(name)` zusammen, obwohl `pnr` gespeichert wird. | Namensgleiche Personen können zusammenfallen; Quellabgleich ist nicht zuverlässig genug für Aufgebote. | Identitätsabgleich mit bestätigtem eindeutigen Quellschlüssel, soweit verfügbar; unklare/mehrdeutige Treffer in Review. Dies ist ein technischer Befund, keine PAT-Identifikatorvorgabe. |
| P0 | Fehlende Zuteilung ist nur Warnung; Zeit-/Ortsprüfung ersetzt PISA-Prüfung. | Lokales „vollständig“ kann mehr versprechen als geprüft wurde. | „Vorbereitet“, „in PISA erfasst“ und „in PISA verarbeitet“ trennen. Ungeklärten Bestand als unbekannt anzeigen. ASSIGN-002, RELEASE-001. |
| P1 | `bem` ist ein beliebiger Text je Detachement. | Kein 240-Zeichen-Limit und keine wiederverwendbaren Bemerkungen. | Bemerkungskatalog mit Überschrift/Text, Zeichenzähler und EC-Zuordnung. REM-001. |
| P1 | Keine Dienste, kein H-Bezug, keine Fristen. | KVK-Beginn könnte fälschlich Fristenbasis werden. | Formation, Jahr, ADF-Start, Dienstperioden und konkrete Termine speichern. TIME-001/002. |
| P1 | Keine Beilagenverwaltung. | PDF-Format, Dateiname und Zuordnungen werden erst in PISA geprüft. | Lokale Beilagenliste mit PDF/A4/Hochformat/64-Zeichen/5-pro-EC-Prüfung und manueller Inhaltsprüfung. ATT-001 bis ATT-004. |
| P1 | Keine Übertragungs-/Bearbeitungsstände. | Nach Änderungen ist unklar, was in PISA noch stimmt. | Revisionen, Checkliste je EC/Zuteilung, PISA-Prozessnachweis und Abweichungsliste. RELEASE-001/002. |
| P1 | Kein DIMILAR-/AW416-Abgleich. | Papier- und Digitalversand werden nicht getrennt kontrolliert. | Kanalwahl, tatsächlicher Versandnachweis und Prüfergebnis getrennt speichern. DATA-003, DELIVERY-001. |
| P1 | `exportXlsx()` exportiert `bisDatum` weder in Detachemente noch Zuteilungen; Listen können durch MILO-Filter verkürzt sein. | Mehrtägige Aufgebote sind im Export nicht rekonstruierbar. | Entlassungsdatum und vollständigen relevanten Bestand in Erfassungshilfe aufnehmen. Technischer Befund; FIELDS-001, ASSIGN-002. |
| P2 | Keine Unterscheidung ordentliche/AO-Planung, Dienstgrund oder besondere Zuständigkeit. | AO/Gast-WK/DBem-50-Fälle könnten im falschen Ablauf landen. | Separater AO-Ablauf und fallbezogene KF-Klärungen. AO-001 bis AO-004, SPECIAL-001/002. |

Regel-IDs in dieser Tabelle haben im Katalog das Präfix `PISA-`. Prioritäten sind Produktvorschläge.

## Vorgeschlagenes Datenmodell

Dieses Modell ist eine lokale Arbeitshilfe, **kein dokumentiertes PISA-Importformat**.

| Entität | Wesentliche Angaben | Zweck |
| --- | --- | --- |
| Dienst | lokale ID, Formation, Jahr, ordentliche/AO-Planung, ADF-Beginn, Dienstperioden, Termine | Eindeutiger Planungskontext. |
| Person / Quellidentität | lokale ID, bestätigte externe Kennung soweit vorhanden, Rohwerte pro Quelle, Abgleichstatus | Keine stillen Zusammenführungen nur über Namen. |
| Teilnahme | Person, Dienst, DVM-Nachweis/Stand, Gast-WK, DVS-Entscheid, einzuplanen/ausgeschlossen/ungeklärt mit Begründung | Prüfumfang unabhängig vom sichtbaren Pool. „Ausgeschlossen“ benötigt einen fachlichen Nachweis. |
| Einrückungsdetails | EC als Text, Einrückdatum/-zeit/-ort, Treffpunkt, Anzug, Entlassungsdatum/-ort, Bemerkungsreferenz | Vollständige PISA-Erfassungszeile. |
| Aufgebotsgruppe | Haupt-EC, bis fünf Zusatz-EC, zugeordnete Personen | Verknüpfung als Gruppe ausdrücken; nicht nur mehrere lose Personenzuteilungen. |
| Bemerkung | ID, Überschrift, Text | Wiederverwendung und Zeichenprüfung. |
| Beilage / Zuordnung | lokale Datei oder Referenz, Dateiname, Jahr, Prüfergebnis, zugeordnete EC | Datei, EC-Zuordnung und PISA-Archiveintrag getrennt halten. |
| Übertragungsnachweis | lokale Revision, EC/Gruppe, erfasst am/durch, PISA-Prüfergebnis, Verarbeitungsnachweis | Planung und tatsächliche Übernahme abgleichen. |
| Klärung | betroffener Fall, Regel-ID, Frage, Antwort/Herkunft/Datum, Geltungsbereich | KF-Entscheidungen nachvollziehbar machen. |

Ein Einsatzdetachement des bestehenden Planers kann einer oder mehreren Aufgebotsgruppen zuarbeiten. Vor Migration muss geklärt sein, ob die vorhandenen Detachemente Einrückungsgruppen, spätere Einsatzgruppen oder beides darstellen. Bestehende Zuteilungen nicht automatisch in Haupt-/Zusatz-MB-Beziehungen umdeuten.

## Empfohlene Umsetzungsfolge

### 1. Verlässliche Erfassungsunterlage

Ergänzen: Dienstkontext, PISA-Details, bestätigter Personenabgleich, eindeutiger Prüfumfang, Haupt-/Zusatz-MB, Bemerkungen und Arbeitsansicht für die Übertragung.

Die Arbeitsansicht folgt dem PISA-Ablauf:

1. **Detailangaben MB:** eine Zeile je EC in der tatsächlichen Feldreihenfolge, kopierbare Einzelwerte und Bemerkungen.
2. **Detachemente:** Haupt-EC, Zusatz-EC und Personenauswahl mit passenden Filterhinweisen; Namensliste und bestätigte Kennung soweit verfügbar.
3. **Überprüfung/Genehmigung:** lokale offene Punkte, Quellenkonflikte und Checkliste der tatsächlichen PISA-Prüfung.
4. **Verarbeitung/Kontrolle:** bestätigter Verarbeitungsstatus sowie Abgleich mit PI Det und MB/AW416.

Abnahmekriterien:

- Alte v2-Projekte lassen sich weiterhin laden; neue semantische Felder werden als ungeklärt markiert statt aus beliebigen Altdaten erraten.
- `01` bleibt Text. `Z1`/`z1` werden im relevanten Planungskontext nicht als unterschiedliche EC behandelt.
- Sechs Zusatz-MB oder mehr als 240 Zeichen Bemerkung werden vor Übertragung erkannt.
- Jede Person des bestätigten Prüfumfangs ist abgedeckt oder sichtbar ungeklärt; UI-Filter beeinflussen dieses Ergebnis nicht.
- Personen mit gleichem Namen bleiben bei unterschiedlichen bestätigten Identitäten getrennt; unklare Altdubletten brauchen manuelle Auflösung.
- Die Erfassungshilfe enthält Einrück- und Entlassungsdaten, Anzug, beide Orte, Treffpunkt, Bemerkung, Verknüpfungen und vollständige Zuordnungen.
- KVK/WK-Konflikte und Kp-Fraktionen führen zu einer Klärung, nicht zu erfundenen Sold-/Diensttageentscheidungen.

### 2. Übertragungsstand und Änderungen

Ergänzen: Status pro Schritt, Revision der übertragenen Werte, Abweichungsliste seit letzter bestätigter Übertragung, Fristen und Beilagenvorbereitung.

Abnahmekriterien:

- Änderung an EC, Personenzuteilung, Bemerkung oder Beilage setzt betroffene Übertragungsbestätigungen auf „erneut prüfen“.
- Warteschlange, erfolgreiche Verarbeitung, MB-Auslösung und Kontrolle sind unterschiedliche Zustände.
- Allgemeine Änderungssperre ab MB-Auslösung und frühere Sonderfallgrenzen sind getrennt abbildbar.
- Ein lokal abgelegtes PDF wird weder als in PISA hochgeladen noch als an DIM übermittelt angezeigt.
- JSON-Export/-Import bewahrt alle neuen Felder; kein Personenexport hängt unbemerkt von einem Sichtfilter ab.

### 3. Sonderfälle und Nachkontrolle

Ergänzen: AO, Gast-WK nach Freigabe, DBem 50, Jahreswechsel, DIMILAR-/AW416-Abgleich. Mobilmachungsplanung bleibt ein eigener Kontext.

Abnahmekriterien:

- AO-Gast-WK und späte reguläre Gast-WK erzeugen den richtigen KF-Klärungsbedarf.
- DIMILAR-Kanalwahl wird nie als tatsächliche Zustellung oder Kenntnisnahme angezeigt.
- Beilagen-Zuordnungen lassen sich lokal ändern, ohne daraus eine PISA-Archivlöschung zu behaupten.

## Entscheidungen für die nächste Abstimmung

1. **Bedeutung der heutigen Detachemente:** Sind dies bereits die Gruppen für Einrückung/MB oder auch Einsatzgruppen während des Dienstes? Vorschlag: getrennte Aufgebotsgruppen, vorhandene Einsatzplanung erhalten.
2. **Prüfbestand und Identität:** Welche PISA-Auswertung wird tatsächlich importiert, welche stabile Kennung enthält sie und wie werden DVM-/DVS-Status geliefert? Vorschlag: anhand einer anonymisierten Spaltenstruktur bestimmen; keine Kennung erfinden.
3. **Erfassungsunterlage:** Vorschlag: eine im Browser sichtbare, kopierbare PISA-Arbeitsansicht plus Excel zum Gegenprüfen. Automatischer Import erst nach belegter Schnittstelle.
4. **Fachliche Klärungen:** KVK/WK-MB-Modell, Sonderzeichenliste und EC-Gültigkeitsbereich mit KF/PISA bestätigen, bevor darauf automatische Vorschläge aufbauen.

Die zwölf Szenarien in [rules.json](rules.json) sind fachliche Abnahmebeispiele für diese Schritte. Sie sind Quellenwissen und noch keine ausgeführten Tests der Planner-Anwendung.
