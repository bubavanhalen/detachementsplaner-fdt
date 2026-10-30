# WAP-Planer – Projektbeschrieb

Stand 30.09.2026 (Version 2, nach Review) · Hptm Philipp Tischhauser

> Repo-Kopie: Zwei Personennamen in den Beispielen (2 «Ltg», 8.2 Regel 12) sind pseudonymisiert. Sonst unverändert gegenüber der Fassung des Auftraggebers vom 30.09.2026.

## 1 Ausgangslage und Ziel

Der WAP entsteht künftig im **WAP-Planer** (Arbeitstitel) statt in Excel: mindestens so schnell erfasst wie in Excel, laufend automatisch geprüft und als PDF ausgegeben, das dem heutigen Layout entspricht.

**Heute:** Der WAP (Bat: Beilage 00-03, Kp: Beilage 01-02) ist eine Excel-Datei mit einem Blatt pro Woche (KVK, Wo 1–3). Die Zellen bilden nur das Raster. Der eigentliche Inhalt – Blöcke, Beso-Kästchen, Marker, Texte – liegt als frei platzierte Formen darüber. Zeit, Spalte und Termintext sind dadurch nicht miteinander verknüpft, sondern nur optisch nebeneinander.

| Schmerzpunkt | Beispiel im WAP FDT 2026 |
| --- | --- |
| Textüberlauf | Box «Bemerkungen» überlagert in allen Wochen die Legende |
| Überlappende Kästchen | Beso 52/53 am Fr Wo 3 liegen übereinander |
| Formen nicht am Raster | Zeit im Text und Lage der Form laufen auseinander (z.B. «10 0830-0900» liegt auf 0800–0830) |
| Handarbeit bei Kopfdaten | Spalten pro Tag, Sa/So-Beschriftung, KW und Sonnenzeiten werden von Hand gepflegt; die Sonnenzeiten im PDF stammen aus einer alten Vorlage und sind falsch |
| Beso und Termintext getrennt | Nummer ohne Termintext oder Text ohne Kästchen fällt erst beim Gegenlesen auf |
| Unlesbar kleine Schrift | Termine und Bemerkungen auf Wo 1–3 erscheinen im PDF mit rund 3 pt |
| Datumsformat | Bat-WAP zeigt US-Format (10/5/2026) |
| Keine Weiterverwendung | Tagesbefehle müssen aus den Formen herausgelesen werden |

**Erfolgskriterien**

1. Eine WAP-Woche ist in höchstens der halben Zeit erstellt wie in Excel (Ausgangsmessung siehe 14).
2. Das PDF entspricht in Aufbau, Farben und Lesbarkeit dem heutigen (Referenz: `WAP_FDT_2026_V1.pdf`), ist aber besser lesbar.
3. Kein PDF verlässt das Tool mit unbemerktem Regelverstoss (Beso/Termine, Überlappung, Überlauf, ausgeblendete Einträge).
4. Bat-Termine und Tagesbefehle entstehen ohne Abtippen.
5. Kein Datenverlust bei Absturz oder Fehlbedienung; beim Wechsel von Browser oder Gerät über die Plan-Datei.

## 2 Begriffe

Diese Begriffe gelten im ganzen Beschrieb und in der Bedienoberfläche.

| Begriff | Bedeutung im Tool |
| --- | --- |
| Plan | Alle Wochen eines Dienstes, z.B. FDT 2026 «PICASSO» mit KVK und Wo 1–3 |
| WAP | Arbeitsplan einer Woche; im PDF eine Seite |
| Stufe / Vorlage | Bat oder Kp; die Vorlage legt Spalten, Legende, Kopf- und Darstellungsregeln fest (4.9) |
| Spalte | Senkrechte Bahn innerhalb eines Tages: Personengruppe, Zug/Element, Detachement, Einheit oder Stab |
| Nebenspalte | Optionale schmale Planungsspalte vor der Rap-Spalte für Nebentätigkeiten (Kp «Det», Bat «Stab 2») |
| Rap-Spalte | Schmale Spalte pro Tag nur für Rapporte |
| Beso-Spalte | Schmale Spalte pro Tag mit zwei Bahnen für Beso-Kästchen |
| Block | Tätigkeit mit Zeit über eine oder mehrere Spalten, farbig nach Leitungskategorie |
| Querbalken | Eintrag über einen oder mehrere ganze Tage, ohne Uhrzeit, im Band oberhalb 0500 (z.B. «OLMA 08.10.–18.10.2026», «Wachtdienst Stao HERISAU durch 61/4») |
| Marker | Kräftige Zeitmarke der Tagesstruktur: AV, ABV, HV |
| Rapport | Kästchen in der Rap-Spalte (KR, DR, AR1, AR2, ARK, BR 0–3 …) mit Zeitpunkt oder Dauer; braucht keinen Termintext |
| Beso | Besonderer Termin: Termintext mit Nummer und ein oder mehrere Kästchen im Raster |
| Termine | Bereich unter dem Raster (Bat: «Termindetails») mit den Beso-Texten und ganztägigen Bemerkungen pro Tag |
| Leitungskategorie | Farbe gemäss Legende (z.B. Ltg Kp, Ltg Zfhr, Extern) |
| Ltg | Leitende Funktion oder Person als Text (z.B. «Einh Fw», «Lt Muster») |
| Tn / Tpt | Teilnehmer / Treffpunkt |
| Stand | Datum der gültigen Fassung des ganzen Plans, steht im Kopf |
| Beilage | Kopfzeile unter dem Titel, z.B. «Beilage 01-02 zum Allgemeinen Befehl für den FDT 2026» |

## 3 Nutzer und Einsatzbereich

Pro Plan arbeitet genau eine Person; alle anderen erhalten das PDF.

- **Bearbeiter:** Kp Kdt für den Kp-WAP, S3 für den Bat-WAP. Keine gleichzeitige Bearbeitung, keine Rechteverwaltung.
- **Empfänger:** Kader und Truppe erhalten das PDF bzw. die daraus abgeleiteten Tagesbefehle. Die Kp erhält den Bat-WAP zusätzlich als Excel oder als Plan-Datei (Abschnitt 8).
- **Stufen:** Bat und Kp mit derselben Bedienung. Unterschiede liegen nur in der Vorlage (4.9).
- **Nicht auf 61/4 zugeschnitten:** Einheit, Spalten, Legende, Wappen, Motto und Texte sind frei einstellbar. Inf Ustü Kp 61/4 ist die erste Anwendung.
- **Zusammenspiel:** Der Kp-WAP baut auf dem Bat-WAP auf (Abschnitt 8).
- **Arbeitsumgebung:** Laptop mit Maus und Tastatur; Lesen auf dem Tablet ist erwünscht.

## 4 Fachlicher Aufbau eines WAP

Das Tool speichert den WAP als Daten, nicht als Bild: jeder Eintrag kennt Tag, Zeit, Spalten, Leitung und Text, und das PDF wird daraus gezeichnet.

### 4.1 Plan

- Stufe (Bat/Kp) mit Vorlage, Einheit (z.B. «Inf Ustü Kp 61/4»), übergeordnete Einheit (z.B. «Inf Bat 61»)
- Dienst und Übungsname (z.B. «FDT 2026», «PICASSO»), Beilage-Text
- Klassifizierung (optional, z.B. «INTERN»)
- Standort für die Sonnenzeiten (z.B. Kaserne Herisau)
- Kommandant: Grad, Name, Vorname, Funktion; Reihenfolge im Unterschriftblock frei; optional Unterschrift als Bild
- Personenliste (Grad, Name, Vorname, Funktion) für die Auswahl von Ltg und Tn und für den Import (8.2); von Hand oder aus einer Datei erfasst, ab Etappe 4 aus dem Detachementsplaner gefüllt
- Wappen und Motto (z.B. «TRAGEN & SCHLAGEN»)
- Bemerkungen, die für den ganzen Plan gelten (4.2)
- Stand-Datum und Versionsnummer; der Stand gilt für den ganzen Plan
- Liste der Wochen

### 4.2 Woche

- Bezeichnung (z.B. «KVK», «FDT Woche 1») und Kurzname für Dateinamen (z.B. «KVK», «Wo1»)
- Startdatum (Montag); Enddatum, KW und alle Tagesdaten ergeben sich automatisch
- Wochenziele als Aufzählung, beim Bat nach Gruppen gegliedert (Ganzes Bat, Inf Kp, Stab …)
- Erhöhte Bereitschaft (Freitext, optional)
- Bemerkungen:
    - Kp «gelten durchgehend»: einmal pro Plan erfasst, erscheinen auf allen Wochen, pro Woche ausblendbar oder ergänzbar.
    - Bat «Mehrtägige Bemerkungen» mit Nummer und Zeitraum; optional ein graues Verweis-Kästchen mit der Nummer an jedem betroffenen Tag in einer gewählten Spalte.
- Abkürzungen und Legende (4.7)
- Sonnenauf- und -untergang (4.8)

### 4.3 Tag

- Jeder der sieben Tage hat seinen eigenen Spaltensatz.
- Darstellung pro Tag: **voll**, **kompakt** (z.B. Sa nur «Kp» und «Beso») oder **ausgeblendet** (z.B. Wochenende Wo 3).
- Zusatzangaben nur für den Tagesbefehl (z.B. Tagesoffizier, Tagesbefehl-Nr) werden beim Tag gepflegt und nicht im WAP gedruckt (Abschnitt 9).

### 4.4 Spalten und Breiten

| Spaltentyp | Beispiele aus FDT 2026 | Eigenschaften |
| --- | --- | --- |
| Planungsspalte | KVK Mo–Di: Kp Kdt, Stv, Zfhr, Uof, höh Uof, Trp · KVK Mi–Fr: Kdo, Mö, Sph · Wo 1–3: SERVIZIO, COBRA 10, COBRA 20, FALCON, HAWK bzw. Sph Det 1–3 · Bat: 0–4, Stab | Name, Gewicht (schmal/normal/breit), Beschriftung waagrecht oder senkrecht, Standard-Leitungskategorie, Herkunft (frei oder Detachementsplaner) |
| Nebenspalte | Kp «Det» (z.B. «Ausb Mun Det», «Mun Fsg Det»), Bat «Stab 2» | Optional pro Tag; nimmt schmale Blöcke auf |
| Rap-Spalte | Rap | Nimmt nur Rapporte auf |
| Beso-Spalte | Beso; bei schmaler Darstellung automatisch «Bes» | Zwei Bahnen; nimmt nur Beso-Kästchen auf |

- Spaltensätze sind wiederverwendbare Vorlagen (z.B. «KVK Stufen», «Woche mit FALCON/HAWK», «Woche mit Sph Det 1–3») und werden pro Tag zugewiesen.
- **Breiten:** Alle Tage mit Darstellung «voll» sind gleich breit, unabhängig von der Spaltenzahl. «Kompakt» belegt etwa ein Drittel. Ausgeblendete Tage geben ihre Breite an die übrigen ab.
- Innerhalb eines Tages teilen sich die Spalten die Breite nach Gewicht (schmal 1, normal 2, breit 3; Nebenspalte 1, Rap-Spalte 1, Beso-Spalte 2). Die Spalten des Terminbereichs liegen genau unter ihrem Tag.

### 4.5 Zeitraster

- Anzeigebereich standardmässig 0400–2400, einstellbar; beschriftet 0500–2300 links und rechts.
- Volle Stunden als gestrichelte Linie, Halbstunden als feine durchgezogene Linie, keine Viertelstundenlinien.
- Das Band oberhalb 0500 nimmt die Querbalken auf.
- Einträge rasten auf 15 Minuten ein; genaue Zeiten auf 5 Minuten sind per Eingabe möglich.
- Einträge über Mitternacht werden am Folgetag fortgesetzt und so gekennzeichnet.

### 4.6 Eintragstypen

| Typ | Pflichtangaben | Weitere Angaben | Darstellung |
| --- | --- | --- | --- |
| Block | Titel, Zeit, Spalte(n), Leitungskategorie | Zusatz (zweite Zeile), Ltg, Tn, Tpt, Ort, Tenue, zweite Leitungskategorie, Textrichtung, offenes Ende, Status, interne Notiz | Rechteck über die gewählten Spalten (4.7, 10) |
| Querbalken | Titel, Datum von–bis (auch über Wochengrenzen) | Spalten (Standard alle), Leitungskategorie | Balken im Band oberhalb 0500; mehrere übereinander in Erfassungsreihenfolge; Text zentriert, Schriftfarbe automatisch schwarz oder weiss je nach Füllung; reicht er über die Woche hinaus, erscheint er auf jeder betroffenen Seite mit vollem Titel |
| Marker | Art (AV, ABV, HV oder frei), Zeitpunkt, Spalten | – | Kräftige Linie mit kleinem Beschriftungsfeld; Beschriftung aus der Art gebildet, die Zeit erscheint je nach Art (Vorgabe: nur bei ABV, z.B. «ABV 2330»); nicht frei editierbar; wahlweise als flacher Block |
| Rapport | Kürzel (aus der Liste oder frei), Zeit (Zeitpunkt oder von–bis) | Ort, Tn, Leitungskategorie (Standard Ltg Kp; Rapporte der übergeordneten Stufe Ltg Bat), Anzeige | Kästchen in der Rap-Spalte, Höhe = Dauer, mindestens 30 Min; Kürzel fett, Ort in Klammern; bei Platzmangel senkrecht. Anzeige «auch in Spalten»: derselbe Rapport erscheint zusätzlich als Block in gewählten Planungsspalten (ein Objekt). Anzeige «nur in Spalten»: ausschliesslich als Block (Bat: BR 0–3 in Stab). Die Vorlage kann eine Rapportart als Marker zeigen (Bat: SR); sie bleibt ein Rapport |
| Beso | Titel, mindestens ein Zeitfenster | Ltg, Tn, Tpt, Ort, Leitungskategorie, Status | Nummer im Kästchen; Terminzeile im Terminbereich, aus den Feldern gebildet (4.8) oder als Freitext übersteuert |
| Ganztägige Bemerkung | Tag, Text | Status | Nur im Terminbereich, ohne Nummer und ohne Kästchen |
| Mehrtägige Bemerkung | Text | Zeitraum, Nummer, Verweis-Kästchen | In der Seitenleiste unter «Bemerkungen» (4.2) |

**Status** (für alle Einträge): bestätigt (Standard), offen, gestrichen. Zusätzlich die Markierung «geändert» (aus dem Import oder bis zum nächsten Stand), gedruckt gemäss «Änderungen markieren» (10).

**Zeitformen** (für Block, Rapport, Beso): Zeitpunkt, von–bis, ab X, bis X, Frist mit Datum («bis 21.10.»). Eine Frist ohne Uhrzeit gilt als ganztägig. Die Terminzeile gibt die Zeit in der erfassten Form wieder («13 bis 1200: …»). **Sortierzeit:** Beginn; bei «bis X» gilt X; bei Gleichstand zuerst das früher Erfasste.

**Beso im Detail**

- Ein Beso hat ein oder mehrere Zeitfenster. Jedes Zeitfenster hat eine Zeit, optional eine Spalte und optional einen Zusatz (z.B. «Inf Ustü Kp 61/4»): ohne Spalte liegt sein Kästchen in der Beso-Spalte, mit Spalte in dieser Planungs- oder Nebenspalte. Alle Kästchen eines Beso tragen dieselbe Nummer.
- Bei «bis X» endet das Kästchen bei X, bei «ab X» beginnt es bei X.
- Beispiel Bat Wo 2 Mo: «13 Vorrevisionen: 0900-1200 Inf Ustü Kp 61/4, 1300-1600 Inf Kp 61/3, 1600-1800 Inf Stabskp 61» mit drei Kästchen in den Einheitsspalten.
- Die Leitungskategorie bestimmt die Füllfarbe (Bat: grau für extern, grün für Ltg Kp).
- Die Vorlage legt fest, ob die Kästchenhöhe der Dauer entspricht (Bat) oder fest 30 Minuten beträgt (Kp).
- Kästchen liegen immer auf ihrer wahren Zeit; das Tool verschiebt sie nie in der Zeit. Überschneiden sich Kästchen in der Beso-Spalte, weicht das spätere in die zweite Bahn aus; bei drei und mehr gleichzeitigen wird die Bahnbreite geteilt.
- Beso-Kästchen in Planungs- oder Nebenspalten liegen über Blöcken; der Blocktext weicht aus wie bei Markern. Mehrere gleichzeitige Kästchen teilen sich die Spaltenbreite (z.B. Bat Wo 2 Mo: Kästchen 13 über «Ausb / Gef S»).

**Überdeckung und Ausnahmen**

- Belegt ein Block zur gleichen Zeit nur einen Teil der Spalten eines anderen, gilt er als Ausnahme: Der breite Block wird in diesen Spalten ausgespart und in Teilstücken gezeichnet; sein Text steht im grössten Teilstück (z.B. Kp Wo 2 Di: «MiE (Spl)» über alle Spalten, ausgespart für «RECON-SIXTYONE»).
- Nebeneinander mit geteilter Breite nur, wenn beide Blöcke genau dieselben Spalten belegen.
- Marker liegen über Blöcken, verdecken aber keinen Text; ein betroffener Titel rückt unter den Marker.
- Ein Block deckt zusammenhängende Spalten ab. Gilt er für nicht benachbarte Spalten, entstehen verknüpfte Teilblöcke, die gemeinsam bearbeitet werden.

### 4.7 Leitung, Farben, Abkürzungen

- Die Legende ist eine Liste von Leitungskategorien mit Farbe. Jeder Block hat eine Kategorie; optional eine zweite für «gemeinsame Leitung» (diagonal geteilte Füllung, z.B. Bat Wo 3 «WEME, Spl Abgabe – Ltg: Bat Stab, Kp Kdt»). Andere Farben gibt es nicht.
- Vorgabe Kp: Ltg Bat (hellblau), Ltg Kp (gelb), Ltg Zfhr (pfirsich), Extern (grau), Ltg S2 (orange).
- Vorgabe Bat: Ltg Kp (grün), Ltg Bat (gelb), Ltg Externe (grau).
- Zusätzlich eine neutrale Kategorie (weiss) für Hinweise wie «Ausgang».
- **Funktionsliste** pro Plan, vorbelegt aus der Vorlage: Kürzel, Leitungskategorie, Einzelfunktion ja/nein (für P5). Beispiele: Zfhr → Ltg Zfhr, S2 → Ltg S2, Bat Kdt/S3/S4 → Ltg Bat; Kp Kdt, Kdt Stv, Einh Fw, Four = Einzelfunktion.
- Beim Setzen der Ltg schlägt das Tool die Kategorie gemäss Funktionsliste vor. Ein neuer Block ohne Ltg erhält die Standard-Leitungskategorie der Spalte, sonst die zuletzt verwendete.
- «Offenes Ende» (gewellter unterer Rand) zeigt einen Block ohne festes Ende (Bat Wo 3 Fr «WEME, Abgabe Ukft»).
- **Abkürzungsliste:** enthält die Rapportkürzel und vom Bearbeiter gewählte weitere Kürzel; allgemeine Armeeabkürzungen (Ukft, Spl, AVOR …) erscheinen nicht. In der Seitenleiste stehen nur die in der Woche verwendeten. Unbekannte Kürzel werden nur bei Rapporten zur Aufnahme vorgeschlagen. Die Schreibweise ist überall gleich (z.B. «AR2» im Raster und in der Liste).

### 4.8 Terminbereich und Sonnenzeiten

- Pro Tag eine Spalte mit Kopf «Was»; Wochenendtage einzeln oder zusammengefasst; links die senkrechte Beschriftung (Kp «Termine», Bat «Termindetails»).
- Eine Zeile wird aus den Feldern zusammengesetzt: «`<Nr> <Zeit>: <Titel>, Ltg: <Ltg>, Tn: <Tn>, Tpt: <Tpt>, Ort: <Ort>.`» Leere Felder entfallen. Freitext bleibt möglich. Hängender Einzug nach der Nummer.
- Mehrere Zeitfenster: «`<Nr> <Titel>: <Zeit 1> <Zusatz 1>, <Zeit 2> <Zusatz 2> …`».
- Sortierung nach Nummer.
- Darstellung des Status siehe 10.
- **Sonnenzeiten:** Sonnenauf- und -untergang für den Mittwoch der Woche am Plan-Standort, in gesetzlicher Ortszeit (Sommer-/Winterzeit), auf 5 Minuten gerundet; pro Woche übersteuerbar.

### 4.9 Vorlage (Stufe)

Die Vorlage bündelt alle Unterschiede zwischen Bat und Kp. Weitere Vorlagen sind möglich.

| Einstellung | Kp | Bat |
| --- | --- | --- |
| Titel | «`<Einheit>` Arbeitsplan `<Bezeichnung>`» | «Arbeitsplan `<Bezeichnung>`» |
| Ltg im Block | ohne Präfix, auf der Zeile des Orts: «Einh Fw (Ukft)» | «Ltg: …» auf eigener Zeile |
| Beso-Kästchen | feste Höhe 30 Min, Nummer normal | Höhe = Dauer, Nummer fett |
| Farbe Stand-Datum | schwarz | rot |
| Überschrift Kürzelliste | «Legende» | «Abkürzungen» |
| Terminbereich | «Termine» | «Termindetails» |
| Nebenspalte | «Det» | «Stab 2» |
| Rapport als Marker | – | SR |
| Legende | 4.7 Kp | 4.7 Bat |

## 5 Kernfunktionen (Muss)

Die Hauptansicht zeigt das Wochenraster in derselben Anordnung wie das PDF (Lage, Farben, Umbrüche), frei zoombar. Bedien- und Prüfmarken erscheinen nur am Bildschirm.

### 5.1 Erfassen – so direkt wie in Excel

- Einfacher Klick wählt nur aus; er erzeugt nie einen Eintrag.
- Ziehen auf leerer Fläche (Zeit × Spalten) erzeugt einen Block; der Titel wird sofort eingetippt.
- Ziehen mit gedrückter Alt-Taste erzeugt einen neuen Block auch über bestehenden Blöcken (Ausnahme bzw. parallel gemäss 4.6); ebenso die Schnelleingabe.
- Doppelklick auf leere Fläche in der Rap- bzw. Beso-Spalte erzeugt einen Rapport bzw. einen Beso; beim Beso öffnet sich sofort das Feld für den Termintext.
- Doppelklick auf einen Eintrag bearbeitet den Titel direkt im Raster; Tab springt zum nächsten Feld, Enter schliesst ab, Esc bricht ab.
- Ein Seitenfeld zeigt alle Angaben des gewählten Eintrags.
- Im Titel darf ein Teil fett und ein Teil normal sein (z.B. «**AVOR** Fahne»).
- Verschieben und Grösse ändern mit der Maus, einrastend auf 15 Minuten und Spaltengrenzen; die Zeiten werden während des Ziehens angezeigt.
- Ziehen über die Tagesgrenze verschiebt den Eintrag auf einen anderen Tag. Hat der Zieltag einen anderen Spaltensatz, bleibt der Eintrag in Spalten gleichen Namens; fehlen sie, übernimmt er die gleiche relative Lage und wird markiert (P1). Blöcke über alle Spalten bleiben über alle Spalten.
- Mehrfachauswahl (Rahmen ziehen, Shift- und Ctrl-Klick) zum gemeinsamen Verschieben, Umfärben oder Löschen.
- Kopieren, Einfügen und Duplizieren, auch zwischen Wochen.

### 5.2 Wochen, Tage, Spalten

- Neuer Plan: Vorlage, Startdatum KVK-Montag und Anzahl Wochen eingeben → Wochen mit Daten und KW entstehen automatisch.
- Woche einfügen, duplizieren, umbenennen, löschen; gelöschte Wochen sind wiederherstellbar.
- Spaltensatz pro Tag wählen oder auf mehrere Tage gleichzeitig anwenden.
- Ändert sich ein Spaltensatz, bleiben Einträge in ihrer Spalte; fällt eine Spalte weg, werden die Einträge markiert statt gelöscht (P1).
- Wochenendtage voll, kompakt oder ausgeblendet.

### 5.3 Beso und Termine als Einheit

- Kästchen und Termintext sind ein einziges Objekt: keine Nummer ohne Text, kein Text ohne Nummer.
- Nummernkreise: Mo 10er, Di 20er, Mi 30er, Do 40er, Fr 50er, Sa 60er, So 70er.
- **Bis zum ersten Stand** nummeriert das Tool laufend nach Sortierzeit; wird ein Beso verschoben, nummeriert es den Tag neu. Einzelne Nummern lassen sich schon vorher fixieren.
- **Ab dem ersten Stand** sind alle Nummern der Woche fixiert. Neue Beso erhalten die nächste freie Nummer. Neu nummeriert wird nur auf Befehl «Tag neu nummerieren» mit Vorschau.
- Ein gestrichener Beso behält seine Nummer bis zum nächsten Stand; sie wird nicht neu vergeben.
- Mehr als zehn Beso an einem Tag ergeben einen Fehler (P17); es wird nie eine Nummer aus dem Kreis des Folgetags vergeben.
- Verweise auf Beso-Nummern in Titeln (z.B. «Waffenplatzbegehung (21)») werden als Verweis geführt und bei Umnummerierung nachgeführt.
- Ein Eintrag ohne Zeit wird automatisch zur ganztägigen Bemerkung ohne Nummer.
- Rapporte brauchen keinen Termintext.

### 5.4 Vorlagen

- **Tagesabläufe:** mehrere pro Plan (z.B. Werktag, Einrückungstag, Samstag, Sonntag mit Einrücken, Entlassung), jeweils mit Einträgen wie Tagwach/MoE, AV, MiE, NaE, ID, ABV. Ein Tagesablauf gilt standardmässig über alle Planungsspalten.
- Angewendete Einträge bleiben mit ihrem Tagesablauf verbunden: Änderungen am Tagesablauf wirken überall, ausser auf lokal veränderte Einträge; diese sind markiert und lassen sich «auf Vorlage zurücksetzen».
- **Plan:** ein ganzer Plan (z.B. FDT 2026) dient als Grundlage für den nächsten Dienst; alle Daten verschieben sich mit dem neuen Startdatum.
- **Stufe:** Bat- und Kp-Vorlage gemäss 4.9.

### 5.5 Stand und Ausgabe

- PDF pro Woche oder für den ganzen Plan (Abschnitt 10); Vorschau jederzeit.
- «Neuen Stand setzen» speichert Datum und Versionsnummer für den ganzen Plan und friert die Fassung ein. Alle Wochen-PDF eines Stands tragen dasselbe Datum.
- Jeder frühere Stand lässt sich jederzeit als identisches PDF ausgeben.
- Sichern und Laden des ganzen Plans als Datei.

### 5.6 Schutz vor Datenverlust

1. Jede Änderung wird sofort gespeichert; eine Anzeige zeigt «gespeichert hh:mm» und «letzte Datei-Sicherung vor X Tagen».
2. Automatische Wiederherstellungspunkte täglich und vor jedem Import, jeder Übernahme und jedem Stand; mindestens 30 werden behalten, jeder ist wiederherstellbar.
3. Erinnerung beim Schliessen, wenn seit mehr als einem Arbeitstag keine Datei-Sicherung erfolgt ist.
4. Deutliche Warnung, wenn der lokale Speicher nicht dauerhaft oder voll ist.
5. Das Öffnen einer Plan-Datei überschreibt nie still: Liegt lokal ein neuerer Stand desselben Plans, fragt das Tool: behalten, ersetzen oder als Kopie öffnen.
6. Rückgängig und Wiederholen umfassen alle Änderungen, auch Import, Übernahme, Spaltensatz und «auf alle Fundstellen anwenden»; mindestens 200 Schritte, auch nach Neuladen.
7. Plan-Dateien einer neueren Tool-Version werden mit Hinweis abgelehnt, nie beschädigt.

### 5.7 Erststart und Meldungen

- Der Erststart bietet «Neuer Plan aus Vorlage», «Plan-Datei öffnen» und «Excel-WAP importieren».
- Eine leere Woche zeigt den nächsten sinnvollen Schritt (z.B. Spaltensatz wählen, Tagesablauf anwenden).
- Fehlermeldungen auf Deutsch mit Ursache und nächstem Schritt; nie stiller Abbruch.

## 6 Quick Wins und Bedienungsfreundlichkeit

Diese Funktionen machen das Tool schneller als Excel; die Etappe verweist auf Abschnitt 13.

| Quick Win | Was es bringt | Etappe |
| --- | --- | --- |
| «Auch an anderen Tagen» | Eintrag markieren, Tage ankreuzen (z.B. Di–Fr), fertig | 1 |
| Automatische Textausrichtung | Schmale Blöcke senkrecht beschriftet; pro Block übersteuerbar (automatisch, waagrecht, senkrecht) | 1 |
| Kollisionsfreie Kästchen | Beso-Kästchen weichen in die zweite Bahn aus, ohne ihre Zeit zu ändern | 1 |
| Automatische Kopfdaten | Datum, KW, Wochentage, Sa/So-Beschriftung und Stand stimmen immer | 1 |
| Detail beim Überfahren | Ltg, Tn, Tpt, Ort, Termintext und Notiz ohne Klick sichtbar | 1 |
| Interne Notizen | Pro Eintrag und pro Tag, erscheinen nie im PDF und nie in weitergegebenen Dateien | 1 |
| Dateiname nach Konvention | `<Beilage mit _>_WAP_<Dienst>_<Kurzname>_Stand_<yyyy-mm-dd>.pdf`, z.B. `01_02_WAP_FDT_2026_Wo1_Stand_2026-09-17.pdf`; Gesamt-PDF mit Kurzname «Plan»; bei mehreren Ständen am selben Tag wird `_V<Versionsnummer>` angehängt | 1 |
| Listenansicht | Alle Einträge als Tabelle (Tag, Zeit, Titel, Spalten, Ltg, Ort, Nr), sortier- und filterbar, direkt editierbar wie in Excel; das Raster folgt sofort; dient auch zur Kontrolle des Imports | 1 |
| Schnelleingabe per Textzeile | `<Zeit> <Titel> [@<Spalten>] [#<Ltg>] [(<Ort>)]`, z.B. «0800-1200 Mö Sch @COBRA 10-COBRA 20 #Zfhr (Spl)»; Spalten als Name, Bereich oder «@alle», ohne @ die markierten Spalten; Vorschau vor Enter | 2 |
| Autovervollständigung | Beim Tippen eines bekannten Titels werden Zusatz, Ltg, Ort, Kategorie und Dauer vorgeschlagen | 2 |
| Bausteine | Häufige Einträge (Tagwach/MoE, MiE, WEB/PD, ABV) per Ziehen einsetzen | 2 |
| Tastatur | Pfeile verschieben (15 Min / eine Spalte), Shift+Pfeile ändern die Grösse, Ctrl+D dupliziert, Ctrl+F sucht; ausserhalb der Bearbeitung springt Tab zum nächsten Eintrag | 2 |
| Automatische Sonnenzeiten | Aus Standort und Datum (4.8); in Etappe 1 von Hand erfasst | 2 |
| Filtern und Hervorheben | «Was macht COBRA 10 diese Woche?», alles unter Ltg S2, alles auf der Säntisalp; der Rest wird blass | 2 |
| Änderungsvergleich | Zwei Stände vergleichen: Liste neu / geändert / gestrichen, Markierung im Raster, optional im PDF | 2 |
| Pendenzenliste | Alle offenen Punkte (Status offen, Feldwert «offen», Prüfbefunde) als Liste, als PDF exportierbar | 2 |
| Planübersicht | Alle Wochen als Miniaturen; Klick springt in die Woche | 2 |
| Zug-Auszug | PDF nur mit den Einträgen einer Spalte (z.B. für den Zfhr COBRA 10) | 2 |
| Heute-Ansicht | Während des Dienstes sind aktueller Tag und Uhrzeit hervorgehoben | 4 |
| Schwarz-Weiss-Druck (Kann) | Druckoption mit Mustern oder Kategorie-Kürzeln statt Farben; die Legende zeigt die Muster | 4 |

## 7 Automatische Prüfungen

Die Prüfungen laufen bei jeder Änderung; ein Zähler zeigt die offenen Befunde, ein Klick springt zur Stelle. Der PDF-Export bleibt möglich, zeigt aber vorher die Befunde der betroffenen Woche; bei Befunden der Stufe «Fehler» muss der Export bestätigt werden.

**Durch den Aufbau ausgeschlossen:** Beso ohne Termintext und umgekehrt, Abweichung zwischen Zeitfeld und Lage im Raster, Farbe ausserhalb der Legende, Formen neben dem Raster, falsches Datum oder falsche KW im Kopf.

| Nr | Regel | Stufe |
| --- | --- | --- |
| P1 | Eintrag liegt in einer Spalte, die es an diesem Tag nicht mehr gibt | Fehler |
| P8 | Ein Text (Block, Termin, Seitenleiste) passt auch bei Mindestschriftgrösse nicht; Rückfallregel siehe 10 | Fehler |
| P16 | Eintrag an einem ausgeblendeten Tag | Fehler |
| P17 | Beso-Nummernkreis eines Tages ist voll | Fehler |
| P2 | Fixierte Beso-Nummer passt nicht zum Nummernkreis des Tages | Warnung |
| P3 | Doppelter Eintrag: gleicher Titel, gleiche Zeit, gleiche Spalte | Warnung |
| P4 | Platzhalter oder leer: Titel leer, «???», «TBD», «…», «...», «xx» | Warnung |
| P5 | Eine als Einzelfunktion markierte Funktion (Kp Kdt, Kdt Stv, Einh Fw, Four …) oder eine gewählte Person leitet oder besucht zur gleichen Zeit zwei Einträge, inkl. übernommener Bat-Termine | Warnung |
| P6 | Übernommener Bat-Eintrag weicht von der neuesten Bat-Version ab | Warnung |
| P7 | Detachement oder Zug aus dem Detachementsplaner existiert an diesem Tag nicht mehr | Warnung |
| P18 | Datum im Text liegt ausserhalb des Plans oder nicht auf dem Tag des Eintrags (z.B. nach Übernahme aus einer Plan-Vorlage) | Warnung |
| P9 | Termintext wiederholt einen Block im Raster (gleicher Tag, Zeit ±15 Min, Titel inhaltlich gleich) → in den Block übernehmen | Hinweis |
| P10 | Zwei Blöcke überlappen in genau denselben Spalten | Hinweis |
| P11 | Tagesablauf unvollständig gemäss zugewiesenem Tagesablauf (z.B. AV, MiE oder ABV fehlt) | Hinweis |
| P12 | Uneinheitliche Schreibweise gemäss Wörterbuch (z.B. «Tagwache» statt «Tagwach», «Späh» statt «Sph»); verglichen werden ganze Wörter; Kurzformen aus Platzgründen (z.B. «Tw») sind als Ausnahme pflegbar | Hinweis |
| P13 | Kp-WAP verweist auf ein Bat-Dokument; geprüft gegen eine pro Plan gepflegte Liste der Bat-Dokumente (Nummer und Titel, auch Formen wie «Anh 04-01a-1»); die eigene Beilage-Zeile ist ausgenommen | Hinweis |
| P14 | Eintrag über Mitternacht oder ausserhalb des Anzeigebereichs | Hinweis |
| P15 | Kopfangaben fehlen (Beilage, Stand, Wochenziele) | Hinweis |
| P19 | Eine Zeitangabe im Freitext passt nicht zum Zeitfeld des Eintrags | Hinweis |

Das Wörterbuch für P12 ist pro Plan pflegbar; eine Korrektur lässt sich mit einem Klick auf alle Fundstellen anwenden. Einzelne Befunde lassen sich bewusst quittieren und verschwinden dann aus dem Zähler.

## 8 Bat-Stufe, Excel-Import und Übernahme in den Kp-WAP

Der Bat-WAP kommt als Excel-Datei (heute) oder als Plan-Datei aus dem Tool (künftig) zur Kp; in beiden Fällen führt derselbe Übernahme-Assistent die relevanten Einträge in den Kp-WAP.

### 8.1 Bat-WAP im Tool

- Der S3 erstellt den Bat-WAP mit der Bat-Vorlage (4.9): Spalten 0–4 (je eine Spalte pro Einheit), Stab, optional Stab 2, Rap, Beso; im KVK nach Funktionsstufen.
- Seitenleiste mit Wochenzielen nach Gruppen, Erhöhter Bereitschaft, Mehrtägigen Bemerkungen mit Nummer, Abkürzungen (BR, SR, FGG, BER, PIO …), Legende, Unterschrift Bat Kdt und Wappen.
- **Weitergabe:** Beim Export zur Weitergabe entfernt das Tool standardmässig interne Notizen, Pendenzen, quittierte Befunde und Wiederherstellungspunkte; Personen erscheinen nur mit Grad, Name, Vorname, Funktion. Eine Plan-Datei der anderen Stufe wird schreibgeschützt als Referenz geöffnet.

### 8.2 Excel-Import

Der Import liest das heutige Format (wie `0003_WAP PICASSO Inf Bat 61_FDT 2026_V2` und `01_02_WAP_FDT_2026`): ein Blatt pro Woche; Tage, Daten und Spalten aus dem Kopf; Blöcke, Kästchen, Marker und Querbalken aus den Formen. Zweck: Bat-WAP als Grundlage übernehmen und bestehende eigene Kp-WAP (FDT 2026, Vorjahre) ins Tool überführen.

Import-Regeln:

1. Termintexte werden aus Textfeldern und aus den Zellen des Terminbereichs gelesen.
2. Rot durchgestrichen heisst gestrichen: der ganze Eintrag, wenn die Nummer gestrichen ist, sonst nur der Teil. Rot heisst «geändert seit letztem Stand». Beides wird als Status übernommen, nie als gültiger Text.
3. Für die Zeit eines Beso hat der Termintext Vorrang vor der Lage des Kästchens; Abweichungen über 15 Min kommen in den Bericht.
4. Blockkanten werden auf 5 Min gerundet; liegt eine Kante mehr als 2 Min neben einer 15-Min-Linie, kommt sie in den Bericht.
5. Farben werden mit Toleranz der nächsten Legendenfarbe des Blatts zugeordnet, auch Design- und halbtransparente Farben; ein Farbverlauf zwischen zwei Legendenfarben wird zu «gemeinsamer Leitung»; Unklares kommt in den Bericht.
6. Formen ohne Nummer, die ganz in der Rap- oder Beso-Spalte liegen, werden Blöcke der Nebenspalte, die dafür automatisch angelegt wird; ragen sie nur teilweise hinein, werden sie auf die Planungsspalten gekürzt. Nummerierte Kästchen in der Rap-Spalte kommen in die Beso-Spalte; in Planungsspalten werden sie Zeitfenster des Beso in dieser Spalte. Alles kommt in den Bericht.
7. Unbeschriftete Zwischenspalten werden der Nachbarspalte zugeschlagen.
8. Keine Form geht still verloren: Der Importbericht nennt pro Blatt die gelesenen Formen, die erkannten Einträge und die nicht zugeordneten Formen, jeweils mit Sprung zur Stelle.
9. Die Originaldatei wird nie verändert. Vor dem Import entsteht ein Wiederherstellungspunkt.
10. Importierte Beso-Nummern gelten als fixiert; der Import legt einen ersten Stand mit dem Stand-Datum der Datei an. Nummern, die nicht zur Sortierzeit passen, bleiben und kommen in den Bericht.
11. Der Bericht nennt zudem: sich überlagernde Formen (auch in der Seitenleiste), Nummern in falscher Reihenfolge zur Sortierzeit, Kästchen mit mehr als 15 Min Abweichung zum Termintext, nummerierte Termine ohne Zeit (werden Bemerkungen), Kästchen ohne Termintext und umgekehrt.
12. Der Formtext wird in Felder zerlegt: fette Zeile(n) = Titel; Klammerausdruck = Ort, ausser er ist ein Name aus Personen- oder Funktionsliste (dann Ltg, z.B. «Kontrl Fsg (Beispiel)»); «Ltg: …» bzw. (Kp) Text vor der Ortsklammer = Ltg; «Tenue …» = Tenue; übrige Zeilen = Zusatz. Termintexte werden nach dem Muster in 4.8 zerlegt; der Rest bleibt Freitext. Unsichere Zerlegungen kommen in den Bericht.

### 8.3 Übernahme-Assistent

- **Vorauswahl relevanter Bat-Einträge:** Einträge in der Spalte der eigenen Kp oder in Spalte 0 / ganzes Bat; Rapporte und Termine mit Ltg oder Tn Kp Kdt, Einh Kdt oder «alle Einh»; Texte, die die eigene Kp nennen, auch in Listen und Bereichen («61/4», «Ustü», «61/0/1/2/4», «61/0-4», «Kp 61/1-4»); Mehrtägige Bemerkungen; Wochenziele «Ganzes Bat».
- **Kategorien:** Übernommene Einträge erhalten die Kp-Kategorie gleicher Bedeutung: Bat «Leitung Bat» → Kp «Ltg Bat», Bat «Leitung Kp» → Kp «Ltg Kp», Bat «Leitung Externe» → Kp «Extern». Die Zuordnung wird pro Plan einmal bestätigt.
- **Entscheid pro Eintrag:** übernehmen, ignorieren oder später. Übernommene Einträge erhalten einen Verweis auf die Quelle und einen Vorschlag für die betroffenen Kp-Spalten (Standard: alle).
- **Bat-Ebene einblenden:** Die vorausgewählten Bat-Einträge erscheinen auf Wunsch pro Tag als blasse Bänder über die ganze Tagesbreite hinter dem Kp-Raster, nicht spaltengenau.
- **Neue Bat-Version:** Beim erneuten Import zeigt das Tool neu, geändert und gestrichen; betroffene Kp-Einträge werden markiert (P6) und lassen sich pro Punkt mit einem Klick nachführen.
- Das Tool ändert übernommene Einträge nie selbständig; jede Anpassung bestätigt der Kp Kdt einzeln.

## 9 Einbindung in die Suite

Die Anbindungen an Detachementsplaner und Tagesbefehle gehören zum Umfang (Etappe 4); der WAP-Planer bleibt ohne sie voll nutzbar. Wo eine gemeinsame Lösung der Suite Nachteile hätte, bleibt das Tool eigenständig.

Datenflüsse:

- Bat-WAP (Excel oder Plan-Datei) → Übernahme-Assistent → WAP-Planer
- Detachementsplaner → Spalten und Personen → WAP-Planer
- WAP-Planer → PDF-WAP (Beilage 01-02 Kp, Beilage 00-03 Bat)
- WAP-Planer → Tagesbefehle (Einträge pro Tag, Rapporte getrennt)

### 9.1 Detachementsplaner

- **Spalten:**
    - Züge und Elemente aus dem Personenmerkmal «Zug / Element» (z.B. SERVIZIO, COBRA 10, COBRA 20, FALCON, HAWK) als feste Spalten.
    - Mehrtägige Detachemente als Spalten für ihren Zeitraum (z.B. Sph Det 1–3).
    - Kurze Detachemente (z.B. «Mun Fsg Det») als Vorschlag für einen Block.
- Das Tool schlägt pro Tag den Spaltensatz aus den an diesem Tag aktiven Zügen und Detachementen vor.
- Die Personenliste des Plans (4.1) wird aus dem Detachementsplaner gefüllt; im WAP erscheinen nur Grad, Name, Vorname und Funktion.
- Änderungen im Detachementsplaner (umbenannt, aufgelöst, Zeitraum geändert) erscheinen als Prüfbefund (P7), nie als stille Änderung.
- Einheit, Kader, Wappen und Motto werden im WAP-Planer gepflegt; eine gemeinsame Pflege in der Suite ist eine spätere Erweiterung.

### 9.2 Tagesbefehle

- Der WAP ist die Quelle der Tagesbefehle. Pro Tag stellt er alle Einträge strukturiert bereit: Zeit, Titel, Zusatz, betroffene Spalten und Detachemente, Leitungskategorie, Ltg, Tn, Tpt, Ort, Tenue, Rapporte getrennt, Beso-Texte, Bemerkungen, Status.
- Die Tagesbefehle erhalten die Daten ohne Abtippen und ohne Umweg über Excel. Der Bearbeiter löst die Lieferung aus («An Tagesbefehle übergeben», für einen Tag oder eine Woche); innerhalb der Suite übernimmt das Tagesbefehl-Werkzeug sie ohne Dateiauswahl, sonst als Datei.
- Die gelieferten Felder werden mit den in der Spezifikation «Tagesbefehle» erwarteten Feldern abgeglichen.
- Angaben, die nur der Tagesbefehl braucht (z.B. Tagesoffizier, Tagesbefehl-Nr), werden im Tool beim Tag gepflegt.
- Der WAP-Planer vermerkt pro Tag den Zeitpunkt der letzten Lieferung und zeigt Tage mit späteren Änderungen als «Tagesbefehl veraltet».

## 10 PDF-Output

Das PDF sieht aus wie heute: A4 quer, eine Seite pro Woche, Raster links, Seitenleiste rechts, Termine unten. Massstab für die Abnahme sind `WAP_FDT_2026_V1.pdf` (Kp) und der Bat-WAP PICASSO V2 (Bat); bewusste Abweichungen sind unten genannt.

```
+-----------------------------------------------------------------------------+
| KOPF   links: SCHWEIZER ARMEE, Woche vom … bis …, KW                        |
|        Mitte: Titel + Beilage (gerahmt)                                     |
|        rechts: [Klassifizierung, gerahmt, optional], Einheit, Stand         |
+--------------------------------------------------------+--------------------+
| RASTER                                                 | Wochenziele        |
| Band für Querbalken, dann Zeitachse 0500–2300          |                    |
| Tage Mo–So; je Tag: Spalten · (Det) · Rap · Beso       | Erhöhte Bereitsch. |
| Blöcke, Marker (AV/ABV/HV), Rapporte, Beso-Kästchen    |                    |
|                                                        | Bemerkungen        |
|                                                        |                    |
|                                                        | Kürzel             |
+--------------------------------------------------------+ Legende            |
| TERMINE (Kp) / TERMINDETAILS (Bat)                     |                    |
| pro Tag Spalte «Was»: «Nr Zeit: Text, Ltg, Tn, Ort»    | Unterschrift,      |
|                                                        | Wappen, Motto,     |
|                                                        | Sonnenzeiten       |
+--------------------------------------------------------+--------------------+
```

| Bereich | Inhalt und Regeln |
| --- | --- |
| Seite | A4 quer, eine Seite pro Woche, bei Bedarf plus Fortsetzungsseite gemäss Rückfallregel; Gesamt-PDF aller Wochen; optional A3. Text bleibt markier- und durchsuchbar |
| Kopf | Links «SCHWEIZER ARMEE» und «Woche vom … bis … KW»; Mitte gerahmt Titel fett (gemäss Vorlage) und Beilage-Zeile; rechts Klassifizierung als eigenes gerahmtes Feld (optional), Einheit, «Stand» mit Datum (Farbe gemäss Vorlage) |
| Raster | Zeitachse links und rechts; Tageskopf mit Wochentag und Datum; kompakte Tage «Sa 03.10.26»; Spaltenköpfe waagrecht oder senkrecht; Tagesgrenzen kräftig; Linien gemäss 4.5; Breiten gemäss 4.4 |
| Blöcke | Deckende Füllfarbe gemäss Legende, dünner schwarzer Rahmen. Gedruckt werden Titel (fett oder teilweise fett), Zusatz, Ort in Klammern und Ltg im Format der Vorlage; Tn und Tenue nur mit Häkchen «drucken». Gemeinsame Leitung diagonal geteilt; offenes Ende gewellt |
| Rapporte | Kästchen mit kräftigem Rahmen, Kürzel fett, Ort in Klammern |
| Beso-Kästchen | Klein, Nummer gemäss Vorlage (Kp normal, Bat fett), Farbe gemäss Leitungskategorie |
| Marker | Kräftige Linie mit Beschriftungsfeld; verdeckt keinen Text |
| Querbalken | Im Band oberhalb 0500, Text zentriert |
| Seitenleiste | Wochenziele, Erhöhte Bereitschaft (grau hinterlegt), Bemerkungen (Nr/Was), Kürzelliste (Überschrift gemäss Vorlage), Legende mit Farbfeldern, Unterschriftblock (Einheit, Name in gewählter Reihenfolge, Funktion), Wappen, Motto, Sonnenauf- und -untergang mit Symbol |
| Termine | Senkrechte Beschriftung links, Kopf «Was» je Tag, hängender Einzug; Zeilen gemäss 4.8 |
| Status | Status offen → Titel bzw. Terminzeile rot; Feldwert «offen» → nur das Wort rot; gestrichen → ganzer Eintrag rot durchgestrichen bis zum nächsten Stand, danach entfernt. Die rote Status-Darstellung ist pro PDF abschaltbar |
| Änderungen markieren (Option) | Seit dem letzten Stand geänderte Felder rot, entfernte Textteile rot durchgestrichen, geänderte Beso-Nummern rot |
| Schrift | Serifenlos. Standard 5 pt, Blocktitel 5,5 pt fett, Beso-Nummern und Rapportkürzel 5 pt; Mindestgrösse überall 4,5 pt (Werte sind vom Kp Kdt zu bestätigen). Innerhalb einer Woche haben gleichartige Texte dieselbe Grösse; nur Texte, die sonst nicht passen, werden bis zur Mindestgrösse verkleinert |
| Rückfallregel Platz | Passt ein Block auch bei Mindestgrösse nicht, entfallen zuerst Zusatzzeilen (Tn, Tenue, Ltg, Ort, Zusatz), dann wird mit «…» gekürzt. Terminbereich und Seitenleiste werden auf einer Zusatzseite «Fortsetzung – `<Woche>`» weitergeführt. Jeder dieser Fälle ist ein Befund P8 |
| Daten | Überall dd.mm.yyyy, ausser kompakte Tagesköpfe (dd.mm.yy) und Dateiname (yyyy-mm-dd); bewusste Abweichung von der Referenz, die «28/09/2026» bzw. US-Format zeigt |
| Datei | Name gemäss 6 «Dateiname nach Konvention» |
| Optionen | Zug-Auszug (nur eine Spalte); Schwarz-Weiss-Druck (Kann) |

## 11 Rahmenbedingungen

- In die WK Util Suite eingebunden nur dort, wo es Vorteile bringt (z.B. Detachemente, Personen, Tagesbefehle); wo die Suite Nachteile hätte, bleibt das Tool eigenständig und voll funktionsfähig.
- Läuft im Browser ohne Installation und ist nach dem ersten Öffnen auch ohne Netzverbindung voll nutzbar (Kaserne, Feld).
- Die Daten bleiben beim Nutzer; Sicherung und Weitergabe erfolgen als Plan-Datei.
- Personendaten im WAP: nur Grad, Name, Vorname, Funktion. Keine AHV-Nr, Telefonnummern oder Adressen, auch nicht in weitergegebenen Dateien.
- Sprache Deutsch (Schweizer Schreibweise mit «ss»), Zeiten militärisch (0700, 1300-1600), Datum dd.mm.yyyy, Abkürzungen der Armee.
- Bedienung mit Maus und Tastatur; alle Befehle per Tastatur erreichbar; sichtbarer Fokus; Kontrast der Oberfläche mindestens 4,5:1; Lesen auf dem Tablet.
- **Leistung** (Referenz: Plan mit 4 Wochen und 1000 Einträgen, üblicher Dienstlaptop): Ziehen folgt der Maus ohne sichtbare Verzögerung; Wochenwechsel und Filter unter 0,3 s; Prüfungen unter 0,5 s nach einer Änderung; PDF einer Woche unter 3 s, ganzer Plan unter 10 s; Import einer Referenzdatei unter 15 s.

## 12 Abgrenzung

Nicht im Umfang dieses Projekts:

- Gleichzeitige Bearbeitung durch mehrere Personen, Freigabe-Abläufe, Rechteverwaltung
- Infrastruktur-Zuweisung, Ausbildungskontrolle und Messkriterien (spätere Erweiterung möglich)
- Export des WAP zurück nach Excel
- Gestaltung der Tagesbefehle selbst (eigenes Werkzeug der Suite; der WAP liefert nur die Daten)
- Gemeinsame Pflege von Stammdaten (Einheit, Kader, Wappen) in der Suite
- Ein Feld «Rufname» im Detachementsplaner
- Versand und Ablage des PDF (Mail, OneDrive)
- Abgleich mit Kalendern

## 13 Etappen

Jede Etappe liefert ein nutzbares Werkzeug und endet mit einer Abnahme.

1. **Kern: Erfassen, PDF, eigener Import** – Plan, Wochen, Tage, Spalten und Breiten, alle Eintragstypen, Beso und Termine als Einheit, «Neuen Stand setzen» mit Fixierung der Beso-Nummern (5.3, 5.5), Seitenleiste, Kp-Vorlage, Personenliste (von Hand oder aus Datei), Status-Darstellung, Kürzelliste «nur Verwendetes», Sonnenzeiten von Hand, Schutz vor Datenverlust (5.6), Erststart (5.7), PDF im heutigen Layout inkl. Rückfallregel, Prüfungen P1, P8, P16, P17, Excel-Import des eigenen Kp-WAP (als Weg zum Nachbau), Quick Wins der Etappe 1 (inkl. Listenansicht).
    - Abnahme: KVK und Wo 1 per Import plus Nacharbeit gleichwertig zur Referenz; Kriterien 14.1 (100 % nach Nacharbeit für KVK und Wo 1), 14.2–14.5 und 14.7 für die eingeführten Regeln.
2. **Komfort und Prüfungen** – übrige Prüfungen ohne Bat-Anteil (P2–P5, P9–P15, P18, P19), Tagesabläufe und Plan-Vorlage, Vergleich von Ständen und Änderungsmarkierung, Quick Wins der Etappe 2.
    - Abnahme: 14.1 für alle Wochen, Tempo-Messung (14.6), 14.7 für die eingeführten Regeln.
3. **Bat-Stufe und Übernahme** – Bat-Vorlage, Bat-Import, Übernahme-Assistent, Bat-Ebene, Versionsabgleich (P6), Bat-Anteil von P5, Weitergabe (8.1).
    - Abnahme: 14.8–14.10, 14.16, 14.7 für P6.
4. **Anbindung an die Suite** – Detachementsplaner (Spalten, Personen, P7), Datenlieferung an die Tagesbefehle, Anzeige veralteter Tagesbefehle, Heute-Ansicht, Schwarz-Weiss-Druck (Kann).
    - Abnahme: 14.11, 14.12, 14.7 für P7.

Die Kriterien 14.13–14.15 (offline, Leistung, Datenverlust-Schutz) gelten ab Etappe 1 und werden bei jeder Abnahme erneut geprüft.

## 14 Abnahmekriterien

Grundlage sind Soll-Listen aus den Referenzdateien: Anhang A und B-Kp zu Projektbeginn, Anhang C und B-Bat vor Beginn der Etappe 3 (Anhang A: Kp FDT 2026 pro Woche – Blöcke, Beso mit Nr/Zeit, Rapporte, Marker, Querbalken; Anhang B-Kp und B-Bat: PDF-Checklisten aller Kopf-, Seitenleisten- und Terminelemente je Stufe; Anhang C: Soll-Liste Bat PICASSO V2). Anhang A und C entstehen unabhängig vom Import (Auszählung der Formen und Termintexte mit Sichtkontrolle am PDF), werden vom Kp Kdt vor Beginn der jeweiligen Import-Entwicklung bestätigt und danach nicht aus Importergebnissen angepasst; Korrekturen bestätigt der Kp Kdt einzeln. Bei Abweichungen zwischen Excel und PDF ist das neuere Excel massgebend.

1. [ ] Vor der Nacharbeit sind mindestens 95 % der Einträge von Anhang A (alle Wochen) automatisch korrekt erkannt; nach Import und Nacharbeit stimmt Anhang A zu 100 % mit der Listenansicht überein (Etappe 1: KVK und Wo 1; Etappe 2: alle Wochen).
2. [ ] PDF-Checkliste Anhang B-Kp vollständig erfüllt: alle Elemente in gleicher Anordnung, Legendenfarben gemäss 4.7, jede Blockkante auf ihrer Zeit, keine Schrift unter der Mindestgrösse; der Kp Kdt bestätigt den Seiten-an-Seiten-Vergleich.
3. [ ] In allen PDF-Seiten: keine Überlappung, kein abgeschnittener oder verdeckter Text. Für die Referenzwochen FDT 2026 greift die Rückfallregel nicht (kein «…», keine Fortsetzungsseite).
4. [ ] Beso: vor dem ersten Stand lückenlose Nummern nach Verschieben; danach bleibt jede Nummer unverändert.
5. [ ] Import Kp: Der Bericht nennt mindestens: Beso 52/53 Fr Wo 3 und 10/11 Mo Wo 2 überlappend; Bemerkungen über der Legende (alle Wochen); Beso 32 Mi Wo 1 und 52 Fr Wo 1 in der Rap-Spalte; KVK Mo Nr 13 «bis 1200» vor Nr 14 «1130» nummeriert; Kästchen mit mehr als 15 Min Abweichung zum Termintext; nummerierte Termine ohne Zeit (KVK Fr 51, Wo 2 Fr 53).
6. [ ] Tempo: Der Kp Kdt baut Kp Wo 1 aus leerer Woche mit Spaltensatz und Tagesablauf in höchstens der Hälfte der vorher gemessenen Excel-Zeit.
7. [ ] Jede Prüfregel ist mit mindestens einem positiven und einem negativen Testfall belegt; abgenommen in der Etappe, die sie einführt.
8. [ ] Import Bat V2 gegen Soll-Liste Anhang C: Beso, Termine und Wochenziele 100 %, Blöcke mindestens 95 % automatisch, Rest im Bericht; Gestrichenes (KVK Mo alter Nr 13) als gestrichen übernommen.
9. [ ] Bat-Änderung: Eine Testkopie von V2 mit 5 definierten Änderungen (verschoben, gestrichen, neu, Text, Spalte) ergibt genau 5 Meldungen.
10. [ ] Eine weitergegebene Plan-Datei enthält keine AHV-Nr, Telefonnummern, Adressen oder internen Notizen.
11. [ ] Züge und mehrtägige Detachemente aus dem Detachementsplaner erscheinen als Spalten; der Spaltensatz pro Tag wird vorgeschlagen.
12. [ ] Die Datenlieferung für KVK Montag enthält jeden Eintrag mit allen Feldern; Abgleich mit dem Inhalt des manuell erstellten Tagesbefehls Nr 1 ohne Fehlstellen.
13. [ ] Offline: einmal mit Netz geöffnet, danach ohne Netz und nach Browser-Neustart: öffnen, bearbeiten, PDF erzeugen, Datei sichern.
14. [ ] Leistungsziele gemäss 11 mit einem Plan von 1000 Einträgen gemessen und erfüllt.
15. [ ] Datenverlust-Schutz 5.6 Punkt für Punkt vorgeführt.
16. [ ] Bat-PDF der importierten Wochen erfüllt Anhang B-Bat sowie 14.3 sinngemäss; der Kp Kdt bestätigt den Seiten-an-Seiten-Vergleich.

## 15 Referenzmaterial, Entscheide und offene Punkte

| Datei | Zweck |
| --- | --- |
| `WAP_FDT_2026_V1.pdf` | Layout-Referenz Kp |
| `01_02_WAP_FDT_2026.xlsx` | Inhalt für den Nachbau, Import-Testfall Kp (bei Abweichungen zum PDF gilt das neuere Excel, 14) |
| `0003_WAP PICASSO Inf Bat 61_FDT 2026_V2.xlsx` | Import-Testfall Bat; Hilfsreferenz für das Layout bis zum offiziellen PDF |
| Offizielles PDF des Bat-WAP PICASSO V2 | Layout-Referenz Bat für 14.16; wird vom Kp Kdt nachgeliefert, bis dahin dient ein Rendering des Excel als gekennzeichnete Hilfsreferenz |
| Detachementsplaner (Werkzeug und Projekt-Sicherung) | Schnittstelle Züge, Detachemente und Personen |
| Spezifikation «Tagesbefehle» (`PROMPT_Tagesbefehle.md`) | Abnehmer der WAP-Daten; erwartete Felder mit 9.2 abgleichen |
| Tagesbefehl Nr 1 KVK (manuell erstellt) | Vergleich für 14.12 |

Personendaten (Personalliste, Detachementsplaner-Sicherung mit AHV-Nr und Telefon) gehören nicht zu den Projektdateien; Testdaten werden anonymisiert. Die Sonnenzeiten im Referenz-PDF sind falsch und kein Abnahmemassstab.

**Entschieden**

- Beso-Nummernkreis am Wochenende: Sa 60er, So 70er.
- Einbindung in die Suite nur, wo sie Vorteile bringt.

**Offene Punkte – bis zum Entscheid gilt die Vorgabe**

| Frage | Vorgabe bis zum Entscheid |
| --- | --- |
| Klassifizierung auf dem Kp-WAP? | Feld vorhanden, leer |
| Genügt das Einrasten auf 15 Minuten? | Einrasten 15 Min, Eingabe auf 5 Min |
| Unterschrift als Bild im PDF? | Möglich, standardmässig aus |
| Neutrale Kategorie (weiss) in der Legende? | Nicht in der Legende |
| Schriftgrössen im PDF (10)? | 5 / 5,5 / 4,5 pt |
| Umbruch langer Wörter in schmalen Spalten? | Umbruch an Wortgrenzen und Bindestrichen; deutsche Silbentrennung nur, wenn ein Wort sonst nicht passt |
| Excel-Ausgangszeit für 14.6 | Kp Kdt misst vor Etappe 2 die Zeit für Kp Wo 1 in Excel |
