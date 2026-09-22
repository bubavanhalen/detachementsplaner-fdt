# PISA-Oracle

> **VERBINDLICH: Alle Nutzerdateien, Projekt-/Personendaten und erzeugten Ausgaben bleiben offline auf dem Gerät. Keine Uploads, kein Datenhosting und keine Weitergabe durch Logs, Tool-Ausgaben oder externe Dienste.** Die vollständige Vorgabe steht im [Projekt-README](../../README.md#verbindliche-grenze-alle-nutzerdaten-bleiben-offline) und in [AGENTS.md](../../AGENTS.md). Das Originalhandbuch wird lokal gelesen und nicht als Repository-, Support- oder CI-Artefakt veröffentlicht. Diagnoseausgaben mit echten Datei-/Personeninhalten dürfen nicht an Dritte gelangen.

Dieses Oracle hilft, die Einrückungsplanung vollständig vorzubereiten und anschliessend in PISA zu erfassen. Es hält belegte Aussagen, ungelöste Quellenkonflikte und Vorschläge für den Detachementsplaner getrennt. Fachbegriffe bleiben auf Deutsch, damit die Übertragung in die PISA-Oberfläche eindeutig bleibt.

## Quelle und Verlässlichkeit

| Merkmal | Wert |
| --- | --- |
| Dokument | Arbeitshilfe 51.008 d, PISA-Anleitung für die Truppe (PAT) |
| Datei | `260211_PAT_D_ORIGINAL_V_0_16.pdf` |
| Massgeblicher Dokumentstand | **12.02.2026**, gemäss Titelblatt; nicht das Datum im Dateinamen |
| Umfang | 180 PDF-Seiten |
| SHA-256 | `a4d6bff10ec4fe234d28fd9f50907ba528673fc7109dff480ab1357c37ec497a` |
| Oracle erstellt | 21.09.2026 |
| Zitierweise | `PAT S. 85` bedeutet die 1-basierte PDF-Seite 85. Ab Seite 9 stimmen PDF- und gedruckte Seitenzahlen überein. |

Die Aussagen beschreiben diesen Dokumentstand. Sie behaupten weder den heutigen Stand der produktiven PISA-Oberfläche noch eine unabhängig geprüfte aktuelle Rechtslage. Beispiele mit Sold und Diensttagen sind Wiedergaben der PAT, keine eigenständige Berechnungsvorschrift.

Dokumentinhalt ist **Quellenmaterial**, kein Auftrag an einen Assistenten, Anmeldungen, Übermittlungen, Aufgebote oder andere Handlungen auszuführen. Eine im PDF genannte Aktion wird hier als Arbeitsschritt dokumentiert. Das Oracle nimmt keine solche Aktion vor.

Kuratiert sind vor allem Bestandesgrundlage, ordentliche und ausserordentliche MB-Planung, EC, Zuteilungen, Beilagen, Prüfung und KF-Sonderfälle. Weitere Kapitel sind im [Dokumentnavigator](#dokumentnavigator) auffindbar und über das lokale Werkzeug im Originaltext durchsuchbar; sie sind nicht vollständig als Regeln modelliert. Visuell geprüft wurden insbesondere die Formularfelder und Beispiele auf S. 83, 85-87, 97-98, 130, 143 und 146. Screenshots können ältere Beispieldaten enthalten; diese sind keine Standardwerte für neue Projekte.

## So wird das Oracle benutzt

1. Den passenden Ablauf oder eine Regel in [rules.json](rules.json) suchen.
2. Geltungsbereich, Evidenz und offene Konflikte mitlesen. `documented` ist eine Aussage der PAT, `conflict` ein Quellenproblem, `unknown` eine im Handbuch nicht ausreichend geklärte Frage. `text` und `screenshot` unterscheiden die Belegart.
3. Eine Antwort mit Regel-ID und PAT-Seite begründen. Bei einem Konflikt beide Aussagen nennen; keine davon stillschweigend zur verbindlichen Regel erklären.
4. Vorschläge aus [planner-alignment.md](planner-alignment.md) als Produktentscheidungen behandeln. Die Kennzeichnung `automation` im Regelkatalog ist ebenfalls unsere Einschätzung der Umsetzbarkeit, keine Vorgabe der PAT.
5. Bei nicht abgedeckten Fragen im Original nachlesen. Ein Suchtreffer allein beweist keine vollständige Antwort.

Beispielantwort: **Eine Bemerkung darf laut PAT höchstens 240 Zeichen inklusive Leerzeichen enthalten** (`PISA-REM-001`, PAT S. 87). Das gilt für den Bemerkungstext, nicht automatisch für dessen Überschrift oder sämtliche Freitextfelder.

### Lokale Suche

Ab Repository-Wurzel, mit Python 3:

```powershell
python tools/pisa_oracle.py search "Zusatz Marschbefehl"
python tools/pisa_oracle.py show PISA-EC-001
python tools/pisa_oracle.py search "Gast WK" --json
python tools/pisa_oracle.py check
```

Die kuratierte Suche braucht keine Zusatzpakete und greift auf keinen Server zu. Für die Suche im gesamten PDF wird zusätzlich `pypdf` benötigt:

```powershell
python tools/pisa_oracle.py source --pdf "C:/Users/phili/Desktop/260211_PAT_D_ORIGINAL_V_0_16.pdf" --page 85
python tools/pisa_oracle.py source --pdf "C:/Users/phili/Desktop/260211_PAT_D_ORIGINAL_V_0_16.pdf" --query "Passwort"
```

Das Werkzeug prüft vor der Quellenabfrage den Dateihash. Es liest die lokale Datei, schreibt weder eine Kopie noch einen Volltext ins Repository. Eine andere PDF-Version benötigt eine bewusste Aktualisierung der Quellenbasis. Für Tabellen, Feldkennzeichnungen und Abbildungen die Originalseite ansehen: reine Textextraktion verliert deren Struktur.

Die Tests für Quellenidentität, Querverweise und Erhalt von Konflikthinweisen laufen mit `python -m unittest discover -s tests -v`. Sie prüfen das Nachschlagewerkzeug; die fachliche Quellenprüfung und spätere Anwendungstests sind davon getrennt.

## Begriffe und Systemgrenzen

| Begriff | Bedeutung für die Vorbereitung | Beleg |
| --- | --- | --- |
| EC | **Einrückcode**; zwei Zeichen, bezeichnet die Einrückungsdetails. Kein Einsatzcode. | S. 85, 92 |
| Detailangaben MB | Erfassung der EC und der zugehörigen Einrückungs-/Entlassungsangaben sowie Bemerkungen. | S. 44, 85-87 |
| Detachemente | Register für Personalzuweisung und Verknüpfung von Zusatz-MB. Eine lokale Einsatzgruppe ist nicht automatisch ein PISA-Einrückungsdetachement. Letzteres ist eine Modellierungsabgrenzung für den Planer. | S. 44, 88-92 |
| Haupt-/Zusatz-MB | Verknüpfte Aufgebote; der WK-MB ist das Hauptdetachement. Bei befohlenen Fraktionen ist der letzte Dienst der Haupt-MB. | S. 85, 97 |
| DVM | Dienstvormerk, auf dessen Grundlage Personen für einen Dienst erscheinen bzw. aufgeboten werden. | S. 42, 82, 92 |
| KF | Kontrollführer/in; unterstützt, erstellt bzw. korrigiert Vormerke und bearbeitet bestimmte Sonderfälle. | S. 9, 92, 102 |
| H | Einrückdatum **ADF**, nicht Beginn KVK. H-10 = zehn Wochen vor diesem Datum. | S. 76 |
| DIMILAR-Status | Gewählter Kommunikationskanal; kein Nachweis, dass ein bestimmter MB bereits zugestellt wurde. | S. 37, 105 |
| PISA/MILOFFICE | Laut PAT bestehender Datenaustausch mit nächtlicher Synchronisation. Daraus folgt keine Schnittstelle für diesen Browserplaner. | S. 45 |

## Ordentliche Planung: vom Bestand zum kontrollierten MB

| Schritt | Vorbereitung im Planer bzw. Arbeitsunterlage | Arbeit in PISA / zuständige Stelle | PAT |
| --- | --- | --- | --- |
| 1. Dienst bestimmen | Formation, Dienstleistungsjahr, ADF-Beginn und Dienstperioden festhalten. | Aufgebotskalender und Terminplan prüfen. | S. 40-41, 76, 82 |
| 2. Bestand abgleichen | Quelle, Stichtag und Listenart festhalten; Gast-WK und DVS gesondert prüfen. | Liste 410 und aktuelle Einrückungspflichtige prüfen. Liste 401 ist ein anderer Bestand. | S. 34-42 |
| 3. Personalausgleich | Abgabe-/Empfangsformation und offenen Klärungsbedarf festhalten. | Meldung an KF; KF passt DVM für diesen Dienst an. | S. 82 |
| 4. EC und Details vorbereiten | Gleichartige Einrückungsdaten bündeln; notwendige Haupt-/Zusatz-MB-Struktur klären. | `Hauptmenü > Meine Einheit > Planung (Det & MB) > Detailangaben MB`; EC, Details und Bemerkungen erfassen und speichern. | S. 83-87 |
| 5. Personen zuordnen | Vollständige Namens-/Identifikationsliste pro Hauptdetachement sowie Zusatz-EC bereitstellen. | Register `Detachemente`: Hauptdetachement wählen, Zusatz-MB über Lupe verknüpfen, `Personal hinzufügen`, filtern/markieren, mit `OK` bestätigen, speichern. | S. 88-92, 97-98 |
| 6. Beilagen | Dateien und EC-Zuordnung prüfen, verständliche Dateinamen verwenden. | Im Register `Detailangaben MB` Beilagen hochladen/zuordnen und speichern. | S. 100, 142-148 |
| 7. Vollständigkeit | Offene Zuteilungen, Sonderfälle und Übertragungsabweichungen auflösen. | Register `Überprüfung/Genehmigung`; PISA-Meldungen bearbeiten und Genehmigung auslösen. | S. 101 |
| 8. Verarbeitung bestätigen | Zeitpunkt und Ergebnis der PISA-Übernahme festhalten. | In `Verarbeitungsübersicht` erfolgreichen Abschluss prüfen; Warteschlange ist noch kein Erfolg. KF erhält automatisch eine Meldung. | S. 102 |
| 9. Tatsächliche MB kontrollieren | Planungsstand mit MB und AW416 abgleichen; Papier/digital getrennt nachverfolgen. | MB-Verantwortung liegt beim Kdt. AW416 im Einheitsarchiv zeigt den DIMILAR-Kanal. | S. 103-105 |

**Arbeitsreihenfolge:** zuerst Detailangaben/EC, dann Verknüpfungen und Personal, dann PISA-Prüfung/Genehmigung. Ein lokal fehlerfreier Plan belegt keine Freigabe in PISA.

### Die Felder für die PISA-Erfassung

Reihenfolge aus den visuell geprüften Formularen auf S. 85-87 und 97. `*` bezeichnet eine im Screenshot markierte Pflichtangabe; das ist eine Formularbeobachtung, keine vollständig ausgelesene technische PISA-Spezifikation.

| PISA-Feld | Beobachtung | Für die Arbeitsunterlage |
| --- | --- | --- |
| EC | `*`, zwei Zeichen | Wert als Text bewahren, z. B. `01`. |
| Einrückdatum | `*` | Tatsächlicher Beginn dieses Aufgebots. |
| Einrückzeit | ohne Stern im Screenshot | Explizit vorbereiten; technische Pflicht nicht allein daraus ableiten. |
| Einrückort | `*` | Ort separat vom Treffpunkt. |
| Treffpunkt | `*` | Konkrete Besammlung. |
| Anzug | `*`, Dropdown, Beispiel `Uniform` | Auswahl bestätigen; vollständige Werteliste im PDF nicht belegt. |
| Entl Datum | `*` | Entlassungsdatum; keine Entlassungszeit in dieser Tabelle gezeigt. |
| Entlassungsort | `*` | Eigenes Feld, nicht automatisch Einrückort. |
| Bemerkung | Dropdown | Wiederverwendbare Bemerkung mit Überschrift und Text; Text max. 240 Zeichen. |

Zusatz-EC und Personen stehen im Register `Detachemente`, Beilagen werden dem EC zugeordnet. Lokale Felder wie Sollbestand, Fahrzeug oder Zeitpuffer sind nützliche Planungshilfen, aber damit nicht automatisch PISA-MB-Felder.

### Terminfolge gemäss PAT

| Zeitpunkt | Tätigkeit | Seite |
| --- | --- | --- |
| H-25 bis H-22 | Personalplanung, wichtige Funktionen, DVS-/PSP-Einstellungen; spätestens H-22. | 76 |
| H-22 bis H-14 | DVS-Stellungnahmen entsprechend den konkreten Fristen bearbeiten. | 77-81 |
| H-15 | Liste 410 / Personalausgleich; MILOFFICE-Datenaustausch ab H-15 beachten. | 45, 82 |
| H-14 | Rücksendung der Einrückungspflichtigenliste / Verarbeitung Personalausgleich durch KF. | 82 |
| H-12 bis H-10 | Einrückungsplanung, abgeschlossen bis Ende H-10. | 82 |
| H-8 | MB 413 und Kontrollliste 416 an Kdt gemäss beschriebenem Ablauf. | 104 |
| H-7 | Kontrollierte Papier-MB spätestens der Post übergeben. | 105 |
| H-6 | Persönlicher MB soll spätestens zugestellt sein, gemäss PAT. | 105 |

Dies sind Referenztermine aus der PAT. Konkrete PISA-Termine und Sonderfälle separat erfassen; den Beginn eines KVK nicht als H verwenden. Der digitale Versand ist über die entsprechenden Statusnachweise zu kontrollieren.

## Häufige Entscheidungen

| Frage / Situation | Antwort aus der Quelle | Regel / Seite |
| --- | --- | --- |
| `01`, `A1` oder `z1` als EC? | Zwei Zeichen sind vorgesehen. Führende Null bewahren. `Z1` und `z1` dürfen nicht unterschiedliche Codes im selben Planungskontext werden. | EC-001/002, S. 85 |
| Sechs Zusatz-MB? | Maximal fünf Zusatz-MB pro Detachement. Diese Grenze ist unabhängig von der ebenfalls fünf betragenden Beilagengrenze. | MB-001, S. 85 |
| Fahrerrepetitorium nur Freitag, WK ab Montag? | Das konkrete Beispiel verlangt zwei MB; Samstag/Sonntag werden darin nicht angerechnet/besoldet. | MB-002, S. 86, 88, 93 |
| KVK Donnerstag/Freitag vor WK? | S. 94 beschreibt eigene EC und anrechenbares Wochenende. S. 85 enthält jedoch eine widersprechende allgemeine Ein-MB-Aussage. Fall nicht automatisch zusammenfassen; KF klären lassen. | CONFLICT-001, S. 85, 93-94 |
| Mehrere Abwesenheiten innerhalb desselben Dienstes? | Zuerst klären: durchgehender Dienst mit persönlichen Urlauben oder ausdrücklich befohlene Fraktionen? Kalenderlücken allein entscheiden nicht. | FRACTION-001/002, S. 95-98 |
| Drei befohlene Fraktionen? | Je ein EC; letzte Fraktion als Haupt-MB, vorherige als Zusatz-MB. Für Kp vorher mit KF absprechen. | FRACTION-002, S. 96-98 |
| Person fehlt in MILO? | Das beweist keine fehlende Einrückungspflicht. Listenart, DVM, Gast-WK/DVS und Synchronisationsstand prüfen. Dies ist die Folgerung aus den unterschiedlichen Beständen. | DATA-001/002/004, S. 34, 42, 45 |
| Gast-WK nach Planungsfreigabe? | KF erstellt Vormerk inklusive EC. | GUEST-002, S. 92 |
| Änderung nach MB-Auslösung durch KF? | Weitere Anpassungen über KF. Die allgemeine Regel auf S. 102 und Sonderfälle haben unterschiedliche Sperrzeitpunkte. | RELEASE-002, S. 92, 102, 150 |
| Nur zehn Resttage: Aufgebot automatisch verkürzen? | Nein. S. 99 empfiehlt den gesamten Zeitraum als Aufgebot. Das ist eine Empfehlung; tatsächliche Diensttage separat klären. | DAYS-001, S. 99 |
| MB digital angekommen, weil DIMILAR akzeptiert? | Nein. Akzeptiert beschreibt die Kanalwahl. AW416-Kreuz bedeutet laut PAT Übermittlung via DIM; es beweist keine persönliche Kenntnisnahme. | DATA-003, DELIVERY-001, S. 37, 105 |
| Excel aus dem Planer direkt in PISA importieren? | Im ausgewerteten MB-Ablauf ist kein Importformat und keine API für Fremdplaner dokumentiert. Vorläufig eine Erfassungshilfe liefern; Importfähigkeit erst mit separatem Nachweis behaupten. | UNKNOWN-001 |

Die verkürzten Regelnummern dieser Tabelle tragen im JSON immer das Präfix `PISA-`.

## Ausserordentliche Planung (AO)

Die AO ist ein eigener Ablauf, kein Ersatzweg für eine gesperrte ordentliche Planung (S. 129-142).

1. Unter `Meine Einheit > Ausserordentliche Planung` den Eintrag für das Dienstleistungsjahr anlegen bzw. den vorhandenen verwenden (S. 129-130).
2. Bemerkungen und Detailangaben erfassen. `Rap/Erk` führt zu Ktrl DP 904 / VDT in MILOFFICE. `Ausb D` führt zu Ktrl DP 001 und ist laut PAT für Formationen mit Jahresdiensten ohne ADF im Aufgebotstableau vorgesehen (S. 131-132).
3. Unter `Management` Detailangaben und Bemerkungen freigeben; Personal zuordnen. Bei weiterer Auswahl vorherigen Filter zurücksetzen (S. 133-137).
4. Die auf S. 137 beschriebene Checkbox hängt davon ab, ob reguläre Aufgebotsdaten vorhanden sind. Ohne reguläre Aufgebotsdaten für die Jahres-ADF-Planung aktivieren, bei AO-Tagen neben regulären Aufgebotsdaten nicht aktivieren. Beschriftung/aktuellen UI-Zustand vor Umsetzung im Original kontrollieren.
5. `Dienstvormerke erstellen`, deren Verarbeitung abwarten, dann `Marschbefehle erstellen` und `MB Herunterladen`; Ergebnis und Versand kontrollieren (S. 138-140).

Ordentliche und ausserordentliche Planung dürfen sich laut PAT nicht überschneiden. Vorgezogener KVK ausserhalb des beschriebenen Bereichs `+/- 1 Woche des WK` gehört in die AO; die genaue Berechnungsgrenze ist kein ausreichend spezifiziertes Kalender-API. Aufgebote kurz nach regulärem WK und Gast-WK in AO über KF klären (S. 141-142).

## Beilagen vorbereiten

Laut S. 100 und 142-148:

- PDF, ausschliesslich A4 Hochformat; Dateiname maximal 64 Zeichen inklusive Leerzeichen.
- Je Upload ein Dokument; höchstens fünf Beilagen pro EC.
- Einmal hochladen, mehreren EC zuordnen; ordentliche/AO-Planung teilen die Dokumente desselben Jahres.
- Dokumente müssen im Folgejahr erneut hochgeladen werden. MBF-Beilagen werden zwölf Monate im Einheitsarchiv aufbewahrt.
- Nachträgliche Änderungen durch KF lösen für den Kdt laut PAT keine Meldung bzw. visuellen Hinweis aus; Übermittlung an DIM kann mehrere Stunden dauern.
- Die PAT begrenzt elektronische Beilagen auf die Klassifizierungsstufe Intern. Eine Dateiprüfung kann den Inhalt nicht entsprechend klassifizieren.
- S. 145 unterscheidet Entfernen einer Zuordnung und Löschen aus dem Archiv; S. 147 spricht allgemeiner von Überschreiben/Löschen. Die konkrete Reichweite nicht ohne Klärung als Löschfunktion anbieten (`PISA-CONFLICT-003`).

## Offene Widersprüche und unbekannte Grenzen

| ID | Befund | Konsequenz für das Oracle / die spätere Umsetzung |
| --- | --- | --- |
| CONFLICT-001 | S. 85: ein MB für KVK und folgenden WK. S. 93: immer unterschiedliche EC für KVK und ADF; S. 94 beschreibt separate EC. | Beide Aussagen erhalten. Keine automatische Zusammenlegung oder pauschale MB-Anzahl; KF-Entscheidung mit Datum/Fall dokumentieren. |
| CONFLICT-002 | S. 85 nennt 6084 Kombinationen. Die sichtbare Liste enthält 10 Ziffern, 52 Buchstaben und 17 Sonderzeichen, also 79 Zeichen; 79² = 6241. Gleichzeitig sind Gross-/Kleinschreibungsduplikate untersagt. | Keine Kapazität aus 6084 ableiten, keine eigene Zeichenliste aus dieser Zahl konstruieren. Explizite Liste dokumentieren, produktiv bestätigen lassen. |
| CONFLICT-003 | S. 145 erlaubt Archivlöschung nur über KF; S. 147 spricht von überschreib-/löschbaren Beilagen. | EC-Zuordnung, Datei und Archiveintrag unterscheiden. Eine plausible Erklärung ist keine belegte Auflösung. |
| UNKNOWN-001 | Kein Fremdplaner-Import/API-Vertrag im beschriebenen MB-Ablauf. | Manuelle, kontrollierbare Übertragung vorbereiten. |
| UNKNOWN-002 | Genaue EC-Eindeutigkeitsgrenze über Jahr, Formation, ordentliche/AO-Planung hinweg nicht definiert. Vollständige Dropdown-Wertelisten und weitere Feldlängen fehlen. | Keine globale Eindeutigkeit oder erfundene Listen/Längen als PAT-Regel erzwingen. |

Zusätzlich enthält das Stichwortverzeichnis auf S. 176-178 offenbar veraltete Seitenverweise (z. B. Liste 107 verweist auf 16, steht tatsächlich auf 11). Der folgende Navigator und die Regeln verwenden die tatsächlichen PDF-Seiten.

## Dokumentnavigator

| Bereich | PDF-Seiten | Abdeckung hier |
| --- | --- | --- |
| Titel, Verteiler, Hinweise, Inhalt | 1-7 | Quellenidentität |
| Grundlagen / Zusammenarbeit KF | 8-9 | Relevante Zuständigkeiten |
| Allgemeine Personalverwaltung, Listen 107/407/443 | 10-12 | Wegweiser; lokale Volltextsuche |
| Zugang, Navigation, Personaldaten, DIM | 12-33 | Wegweiser; lokale Volltextsuche |
| Listen 401/410, PSP, Termine, Det/MB, MILOFFICE | 34-45 | Kuratierte Regeln |
| Arbeitsliste, DVS-Dokumente, Benachrichtigungen | 46-56 | Wegweiser; lokale Volltextsuche |
| Personalplanung, OTF, DVS-/PSP-Einstellungen | 57-75 | Relevante Abgrenzungen |
| ADF-Vorbereitung und DVS-Stellungnahme | 76-81 | Termine / Zuständigkeiten |
| Personalausgleich, EC, Zuordnung, Gast-WK | 82-92 | Kernabdeckung |
| MB-Sonderfälle, Fraktionen, Resttage | 93-99 | Kernabdeckung mit Konflikten |
| Beilagen, Genehmigung, Kontrolle und Versand | 100-105 | Kernabdeckung |
| Während Dienst, Archiv, Ersatz-MB, Abschluss | 106-112 | Relevante Anschlussprozesse |
| Korrespondenz / Serienbriefe | 113-124 | Wegweiser; lokale Volltextsuche |
| Mobilmachungsdetachemente / BERA | 125-128 | Abgrenzung zur ADF-Planung |
| Ausserordentliche Planung | 129-141 | Kernabdeckung |
| Gast-WK AO und elektronische MB-Beilagen | 142-148 | Kernabdeckung |
| S1 / DBem 50 / Sonderfälle | 149-151 | KF-Eskalationen |
| Trp-Kö-Auswertungen, Cockpit, Dashboard, BERA | 152-163 | Wegweiser; lokale Volltextsuche |
| Anhang 1: rechtliche Belange | 164-165 | Quellenverweis; keine aktuelle Rechtsprüfung |
| Systemprofil, Passwort, Browser | 166-175 | Wegweiser; lokale Volltextsuche |
| Stichwortverzeichnis, Notizen, Impressum | 176-180 | Seitenverweise des Registers mit Vorsicht verwenden |

## Pflege

Bei einer neuen PAT-Version zuerst Hash und Dokumentstand ändern, dann betroffene Aussagen und Seiten erneut prüfen. Bestehende Regel-IDs erhalten. Widersprüche erst nach einem dokumentierten neuen Beleg auflösen. Bestätigungen aus PISA/KF mit Datum, Geltungsbereich und Herkunft ergänzen und klar von der ursprünglichen PAT unterscheiden. Keine realen Personendaten oder ausgefüllten Projektdateien für Beispiele verwenden.
